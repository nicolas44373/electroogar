import { useEffect, useState } from 'react'
import {
  Calendar,
  DollarSign,
  FileText,
  TrendingUp,
  TrendingDown,
  Trash2,
  AlertCircle,
  X,
  CheckCircle,
  XCircle,
} from 'lucide-react'
import { Transaccion, Pago } from '@/app/lib/types/cobranzas'
import { supabase } from '@/app/lib/supabase'
import { sincronizarEstadoTransaccion } from '@/app/lib/estadoTransaccion'
import { hoyISO } from '@/app/lib/fechas'

interface ToastMsg { tipo: 'success' | 'error'; texto: string }

interface MovimientoCuentaCorriente {
  id: string
  fecha: string
  tipo: 'venta' | 'pago'
  descripcion: string
  debe: number
  haber: number
  saldo: number
  referencia?: string
  estado?: string
  transaccionId?: string
  pagoId?: string
  descripcionTransaccion?: string // Nueva propiedad para la descripción de la transacción
}

interface CuentaCorrienteProps {
  clienteId: string
  transacciones: Transaccion[]
  pagos: { [key: string]: Pago[] }
  onTransaccionesUpdate?: () => void
}

export default function CuentaCorriente({
  clienteId,
  transacciones,
  pagos,
  onTransaccionesUpdate,
}: CuentaCorrienteProps) {
  const [movimientos, setMovimientos] = useState<MovimientoCuentaCorriente[]>([])
  const [filtroTipo, setFiltroTipo] = useState<'todos' | 'ventas' | 'pagos'>('todos')
  const [fechaDesde, setFechaDesde] = useState('')
  const [fechaHasta, setFechaHasta] = useState('')
  const [toast, setToast] = useState<ToastMsg | null>(null)

  const mostrarToast = (tipo: 'success' | 'error', texto: string) => {
    setToast({ tipo, texto })
    setTimeout(() => setToast(null), 4000)
  }

  // Pago modal
  const [modalPagoAbierto, setModalPagoAbierto] = useState(false)
  const [ventaSeleccionada, setVentaSeleccionada] = useState<MovimientoCuentaCorriente | null>(null)
  const [montoPago, setMontoPago] = useState<string>('')
  const [fechaPago, setFechaPago] = useState<string>('')

  // Eliminar modal
  const [modalEliminarAbierto, setModalEliminarAbierto] = useState(false)
  const [movimientoAEliminar, setMovimientoAEliminar] = useState<MovimientoCuentaCorriente | null>(null)
  const [eliminando, setEliminando] = useState(false)

  useEffect(() => {
    generarMovimientos()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [transacciones, pagos])

  const formatearMoneda = (monto: number) =>
    new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS' }).format(monto)

  const formatearFecha = (fecha: string) => {
    try {
      // Separar la fecha en componentes para evitar problemas de zona horaria
      const [year, month, day] = fecha.split('T')[0].split('-').map(Number)
      const fechaObj = new Date(year, month - 1, day)
      return fechaObj.toLocaleDateString('es-AR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
      })
    } catch {
      return fecha
    }
  }

  const generarMovimientos = () => {
    const movimientosTemp: MovimientoCuentaCorriente[] = []

    transacciones.forEach((transaccion) => {
      // Agregar la venta/transacción
      movimientosTemp.push({
        id: `venta-${transaccion.id}`,
        transaccionId: transaccion.id,
        fecha: transaccion.fecha_inicio, // ✅ CORREGIDO: Usar fecha_inicio en lugar de created_at
        tipo: 'venta',
        descripcion:
          transaccion.tipo_transaccion === 'prestamo'
            ? 'Préstamo de Dinero'
            : `Venta - ${transaccion.producto?.nombre || 'Producto'}`,
        debe: transaccion.monto_total || 0,
        haber: 0,
        saldo: 0,
        referencia: `Fact. ${transaccion.numero_factura || transaccion.id.slice(0, 8)}`,
        estado: transaccion.estado,
        descripcionTransaccion: transaccion.descripcion || undefined,
      })

      // Agregar los pagos (solo los que están realmente pagados)
      const pagosTransaccion = pagos[transaccion.id] || []
      pagosTransaccion
        .filter((p) => p.estado === 'pagado' && p.fecha_pago)
        .forEach((pago) => {
          movimientosTemp.push({
            id: `pago-${pago.id}`,
            pagoId: pago.id,
            transaccionId: transaccion.id,
            fecha: pago.fecha_pago!,
            tipo: 'pago',
            descripcion:
              transaccion.tipo_transaccion === 'prestamo'
                ? `Pago cuota ${pago.numero_cuota} - Préstamo de Dinero`
                : `Pago cuota ${pago.numero_cuota} - ${transaccion.producto?.nombre || 'Producto'}`,
            debe: 0,
            haber: pago.monto_pagado || 0,
            saldo: 0,
            referencia: `Recibo ${pago.numero_recibo || pago.id.slice(0, 8)}`,
            estado: pago.estado,
            descripcionTransaccion: transaccion.descripcion || undefined,
          })
        })
    })

    // Ordenar por fecha
    movimientosTemp.sort((a, b) => new Date(a.fecha).getTime() - new Date(b.fecha).getTime())

    // Calcular saldos acumulados
    let saldoAcumulado = 0
    movimientosTemp.forEach((mov) => {
      saldoAcumulado += (mov.debe || 0) - (mov.haber || 0)
      mov.saldo = saldoAcumulado
    })

    setMovimientos(movimientosTemp)
  }

  const movimientosFiltrados = movimientos.filter((mov) => {
    if (filtroTipo !== 'todos') {
      if (filtroTipo === 'ventas' && mov.tipo !== 'venta') return false
      if (filtroTipo === 'pagos' && mov.tipo !== 'pago') return false
    }
    if (fechaDesde && new Date(mov.fecha) < new Date(fechaDesde)) return false
    if (fechaHasta && new Date(mov.fecha) > new Date(fechaHasta)) return false
    return true
  })

  const saldoActual = movimientos.length > 0 ? movimientos[movimientos.length - 1].saldo : 0
  const totalVentas = movimientos.reduce((s, m) => s + (m.debe || 0), 0)
  const totalPagos = movimientos.reduce((s, m) => s + (m.haber || 0), 0)

  // ---------- Modal Pago ----------
  const abrirModalPago = (mov: MovimientoCuentaCorriente) => {
    setVentaSeleccionada(mov)
    setMontoPago('') // vacío para que el usuario lo escriba
    setFechaPago(hoyISO())
    setModalPagoAbierto(true)
  }
  const cerrarModalPago = () => {
    setModalPagoAbierto(false)
    setVentaSeleccionada(null)
    setMontoPago('')
    setFechaPago('')
  }

  const registrarPago = async () => {
    if (!ventaSeleccionada || !ventaSeleccionada.transaccionId) {
      mostrarToast('error', 'Venta inválida')
      return
    }
    const monto = typeof montoPago === 'string' ? parseFloat(montoPago || '0') : (montoPago as any)
    if (!monto || monto <= 0) {
      mostrarToast('error', 'Ingrese un monto válido')
      return
    }

    const { error } = await supabase.from('pagos').insert({
      transaccion_id: ventaSeleccionada.transaccionId,
      numero_cuota: 1,
      monto_pagado: monto,
      fecha_pago: fechaPago,
      fecha_vencimiento: fechaPago,
      estado: 'pagado',
      metodo_pago: 'efectivo',
    })

    if (error) {
      console.error(error)
      mostrarToast('error', 'Error al registrar el pago: ' + error.message)
    } else {
      await sincronizarEstadoTransaccion(ventaSeleccionada.transaccionId)
      mostrarToast('success', 'Pago registrado correctamente')
      cerrarModalPago()
      onTransaccionesUpdate?.()
      generarMovimientos()
    }
  }

  // ---------- Eliminar / Revertir ----------
  const abrirModalEliminar = (movimiento: MovimientoCuentaCorriente) => {
    setMovimientoAEliminar(movimiento)
    setModalEliminarAbierto(true)
  }

  const cerrarModalEliminar = () => {
    setModalEliminarAbierto(false)
    setMovimientoAEliminar(null)
    setEliminando(false)
  }

  const eliminarMovimiento = async () => {
    if (!movimientoAEliminar) return
    setEliminando(true)

    try {
      let error: any = null

      if (movimientoAEliminar.tipo === 'venta' && movimientoAEliminar.transaccionId) {
        // Revertir pagos pagados a pendiente
        const { error: err1 } = await supabase
          .from('pagos')
          .update({
            estado: 'pendiente',
            fecha_pago: null,
            monto_pagado: 0,
            numero_recibo: null,
            metodo_pago: null,
          })
          .eq('transaccion_id', movimientoAEliminar.transaccionId)
          .eq('estado', 'pagado')

        if (err1) console.error('Error revirtiendo pagos:', err1)

        const { error: err2 } = await supabase
          .from('transacciones')
          .delete()
          .eq('id', movimientoAEliminar.transaccionId)

        error = err2
      } else if (movimientoAEliminar.tipo === 'pago' && movimientoAEliminar.pagoId) {
        const { error: err } = await supabase
          .from('pagos')
          .update({
            estado: 'pendiente',
            fecha_pago: null,
            monto_pagado: 0,
            numero_recibo: null,
            metodo_pago: null,
          })
          .eq('id', movimientoAEliminar.pagoId)

        error = err
        if (!err && movimientoAEliminar.transaccionId) await sincronizarEstadoTransaccion(movimientoAEliminar.transaccionId)
      }

      if (error) {
        console.error(error)
        mostrarToast('error', `Error al procesar ${movimientoAEliminar.tipo}: ${error.message || JSON.stringify(error)}`)
      } else {
        mostrarToast(
          'success',
          movimientoAEliminar.tipo === 'venta'
            ? 'Transacción eliminada y pagos revertidos correctamente'
            : 'Pago revertido a estado pendiente correctamente'
        )
        cerrarModalEliminar()
        onTransaccionesUpdate?.()

        // Actualizamos vista local inmediatamente
        const nuevosMovimientos = movimientos.filter((m) => {
          if (movimientoAEliminar.tipo === 'venta') {
            return m.transaccionId !== movimientoAEliminar.transaccionId
          } else {
            return m.id !== movimientoAEliminar.id
          }
        })

        // recalcular saldos
        let saldoAcumulado = 0
        nuevosMovimientos.forEach((mv) => {
          saldoAcumulado += (mv.debe || 0) - (mv.haber || 0)
          mv.saldo = saldoAcumulado
        })

        setMovimientos(nuevosMovimientos)
      }
    } catch (err) {
      console.error('Error inesperado:', err)
      mostrarToast('error', 'Ocurrió un error inesperado al procesar la operación')
    } finally {
      setEliminando(false)
    }
  }

  // ---------- Helpers UI ----------
  const montoInputOnChange = (v: string) => {
    // permite números y comas/puntos; guardo como string para evitar NaN momentáneo
    setMontoPago(v === '' ? '' : v)
  }

  return (
    <div className="w-full max-w-full">
      {toast && (
        <div className={`mb-3 ${toast.tipo === 'success' ? 'alert-success' : 'alert-danger'}`} role="status">
          {toast.tipo === 'success' ? <CheckCircle className="w-4 h-4 flex-shrink-0" /> : <XCircle className="w-4 h-4 flex-shrink-0" />}
          {toast.texto}
        </div>
      )}
      <div className="card overflow-hidden">
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-line">
          <h3 className="section-title">
            <FileText className="w-5 h-5 text-primary" />
            Cuenta corriente
          </h3>

          {/* Resumen (tarjetas) - mobile first */}
          <dl className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-4">
            <div className="p-3 rounded-lg bg-surface-2">
              <dt className="text-xs text-muted font-medium flex items-center gap-1.5">
                <TrendingUp className="w-4 h-4" /> Total vendido y prestado
              </dt>
              <dd className="text-base font-semibold text-fg num mt-1">
                {formatearMoneda(totalVentas)}
              </dd>
            </div>

            <div className="p-3 rounded-lg bg-surface-2">
              <dt className="text-xs text-muted font-medium flex items-center gap-1.5">
                <TrendingDown className="w-4 h-4" /> Total pagado
              </dt>
              <dd className="text-base font-semibold text-success-text num mt-1">
                {formatearMoneda(totalPagos)}
              </dd>
            </div>

            <div className={`p-3 rounded-lg ${
              saldoActual > 0 ? 'bg-danger-soft' : saldoActual < 0 ? 'bg-success-soft' : 'bg-surface-2'
            }`}>
              <dt className="text-xs text-muted font-medium flex items-center gap-1.5">
                <DollarSign className="w-4 h-4" /> Saldo actual
              </dt>
              <dd
                className={`text-base font-bold num mt-1 ${
                  saldoActual > 0
                    ? 'text-danger-text'
                    : saldoActual < 0
                    ? 'text-success-text'
                    : 'text-fg'
                }`}
              >
                {formatearMoneda(Math.abs(saldoActual))}
                <span className="text-xs font-medium ml-1">
                  {saldoActual > 0 ? ' (Debe)' : saldoActual < 0 ? ' (Favor)' : ' (Saldada)'}
                </span>
              </dd>
            </div>
          </dl>

          {/* filtros - mobile friendly */}
          <div className="mt-4 grid grid-cols-1 sm:grid-cols-4 gap-3">
            <div>
              <label htmlFor="cc-tipo" className="label">Mostrar</label>
              <select
                id="cc-tipo"
                value={filtroTipo}
                onChange={(e) => setFiltroTipo(e.target.value as any)}
                className="input"
              >
                <option value="todos">Todos los movimientos</option>
                <option value="ventas">Solo ventas y préstamos</option>
                <option value="pagos">Solo pagos</option>
              </select>
            </div>

            <div>
              <label htmlFor="cc-desde" className="label">Desde</label>
              <input
                id="cc-desde"
                type="date"
                value={fechaDesde}
                onChange={(e) => setFechaDesde(e.target.value)}
                className="input"
              />
            </div>

            <div>
              <label htmlFor="cc-hasta" className="label">Hasta</label>
              <input
                id="cc-hasta"
                type="date"
                value={fechaHasta}
                onChange={(e) => setFechaHasta(e.target.value)}
                className="input"
              />
            </div>

            <div className="flex items-end">
              <button
                onClick={() => {
                  setFechaDesde('')
                  setFechaHasta('')
                  setFiltroTipo('todos')
                }}
                className="btn-ghost w-full sm:w-auto"
              >
                <X className="w-4 h-4" />
                Quitar filtros
              </button>
            </div>
          </div>
        </div>

        {/* Contenido principal: Lista móvil (xs) y Tabla en sm+ */}
        <div>
          {/* MOBILE: tarjetas lista (visible en xs, oculto en sm+) */}
          <div className="sm:hidden divide-y divide-line">
            {movimientosFiltrados.length > 0 ? (
              movimientosFiltrados.map((mov) => (
                <article key={mov.id} className="p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        {mov.tipo === 'venta' ? (
                          <span className="badge-primary">
                            <TrendingUp className="w-3.5 h-3.5" /> Venta
                          </span>
                        ) : (
                          <span className="badge-success">
                            <TrendingDown className="w-3.5 h-3.5" /> Pago
                          </span>
                        )}
                        <span className="text-xs text-muted num">{formatearFecha(mov.fecha)}</span>
                      </div>

                      <p className="text-sm font-medium text-fg mt-2">{mov.descripcion}</p>

                      {/* Mostrar descripción de la transacción si existe */}
                      {mov.descripcionTransaccion && (
                        <p className="mt-1 text-xs text-muted border-l-2 border-primary/40 pl-2">
                          {mov.descripcionTransaccion}
                        </p>
                      )}

                      <p className="text-xs text-muted mt-1">{mov.referencia}</p>
                    </div>

                    <div className="text-right">
                      {mov.debe > 0 ? (
                        <p className="text-sm font-semibold text-danger-text num whitespace-nowrap">{formatearMoneda(mov.debe)}</p>
                      ) : null}
                      {mov.haber > 0 ? (
                        <p className="text-sm font-semibold text-success-text num whitespace-nowrap">{formatearMoneda(mov.haber)}</p>
                      ) : null}
                      <p className="text-xs text-muted mt-1 num whitespace-nowrap">
                        Saldo {formatearMoneda(mov.saldo)}
                      </p>
                    </div>
                  </div>

                  <div className="flex gap-2 mt-3">
                    {mov.tipo === 'venta' && (
                      <button
                        onClick={() => abrirModalPago(mov)}
                        className="btn-accent btn-sm flex-1"
                      >
                        <DollarSign className="w-4 h-4" /> Registrar pago
                      </button>
                    )}
                    <button
                      onClick={() => abrirModalEliminar(mov)}
                      className="btn-secondary btn-sm text-danger-text"
                      aria-label={mov.tipo === 'venta' ? 'Eliminar venta' : 'Anular pago'}
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </article>
              ))
            ) : (
              <div className="empty-state py-8">
                <FileText className="w-8 h-8 text-muted/60 mb-2" />
                <p className="text-sm">No hay movimientos con estos filtros.</p>
              </div>
            )}
          </div>

          {/* TABLE for sm+ (hidden on xs) */}
          <div className="hidden sm:block overflow-x-auto">
            <table className="data-table min-w-[720px]">
              <thead>
                <tr>
                  <th>Fecha</th>
                  <th>Detalle</th>
                  <th>Comprobante</th>
                  <th className="!text-right">Debe</th>
                  <th className="!text-right">Haber</th>
                  <th className="!text-right">Saldo</th>
                  <th className="!text-right">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {movimientosFiltrados.length > 0 ? (
                  movimientosFiltrados.map((mov) => (
                    <tr key={mov.id}>
                      <td className="whitespace-nowrap text-muted num">
                        {formatearFecha(mov.fecha)}
                      </td>
                      <td>
                        <div className="flex items-center gap-2">
                          {mov.tipo === 'venta' ? (
                            <span className="badge-primary">
                              <TrendingUp className="w-3.5 h-3.5" />
                              Venta
                            </span>
                          ) : (
                            <span className="badge-success">
                              <TrendingDown className="w-3.5 h-3.5" />
                              Pago
                            </span>
                          )}
                        </div>
                        <p className="font-medium text-fg mt-1">{mov.descripcion}</p>

                        {/* Mostrar descripción de la transacción si existe */}
                        {mov.descripcionTransaccion && (
                          <p className="mt-1 text-xs text-muted border-l-2 border-primary/40 pl-2">
                            {mov.descripcionTransaccion}
                          </p>
                        )}
                      </td>
                      <td className="text-muted text-xs">{mov.referencia}</td>
                      <td className="text-right num whitespace-nowrap">
                        {mov.debe > 0 ? (
                          <span className="text-danger-text font-medium">
                            {formatearMoneda(mov.debe)}
                          </span>
                        ) : (
                          <span className="text-muted">—</span>
                        )}
                      </td>
                      <td className="text-right num whitespace-nowrap">
                        {mov.haber > 0 ? (
                          <span className="text-success-text font-medium">
                            {formatearMoneda(mov.haber)}
                          </span>
                        ) : (
                          <span className="text-muted">—</span>
                        )}
                      </td>
                      <td className="text-right font-semibold text-fg num whitespace-nowrap">
                        {formatearMoneda(mov.saldo)}
                      </td>
                      <td>
                        <div className="flex items-center justify-end gap-1">
                          {mov.tipo === 'venta' && (
                            <button
                              onClick={() => abrirModalPago(mov)}
                              className="btn-accent btn-sm"
                            >
                              <DollarSign className="w-3.5 h-3.5" /> Registrar pago
                            </button>
                          )}
                          <button
                            onClick={() => abrirModalEliminar(mov)}
                            className="btn-icon hover:!text-danger hover:!bg-danger-soft"
                            title={mov.tipo === 'venta' ? 'Eliminar venta' : 'Anular pago'}
                            aria-label={mov.tipo === 'venta' ? 'Eliminar venta' : 'Anular pago'}
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={7} className="text-center !py-10 text-muted">
                      No hay movimientos con estos filtros.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Footer resumen */}
        <div className="p-4 sm:px-5 border-t border-line bg-surface-2">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
            <p className="text-sm text-muted num">
              {movimientosFiltrados.length} movimiento{movimientosFiltrados.length !== 1 ? 's' : ''}
            </p>
            <div className="sm:text-right">
              <p className="text-xs text-muted">Saldo final</p>
              <p
                className={`text-lg font-bold num ${
                  saldoActual > 0
                    ? 'text-danger-text'
                    : saldoActual < 0
                    ? 'text-success-text'
                    : 'text-fg'
                }`}
              >
                {formatearMoneda(Math.abs(saldoActual))}
                <span className="text-xs font-medium ml-1">
                  {saldoActual > 0
                    ? '(a cobrar al cliente)'
                    : saldoActual < 0
                    ? '(a favor del cliente)'
                    : '(cuenta saldada)'}
                </span>
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* --------------------
          Modales
          -------------------- */}

      {/* Modal Pago - bottom sheet en móviles, modal centrado en sm+ */}
      {modalPagoAbierto && ventaSeleccionada && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center sm:p-4" aria-modal="true" role="dialog" aria-labelledby="cc-titulo-pago">
          {/* overlay */}
          <div className="absolute inset-0 bg-slate-950/50" onClick={cerrarModalPago}></div>

          {/* modal panel */}
          <div className="relative w-full sm:max-w-md bg-surface border border-line rounded-t-xl sm:rounded-xl shadow-e3">
            {/* header */}
            <div className="modal-header justify-between">
              <h4 id="cc-titulo-pago" className="text-base font-semibold text-fg">Registrar pago</h4>
              <button onClick={cerrarModalPago} className="btn-icon" aria-label="Cerrar">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="modal-body">
              <div className="rounded-lg bg-surface-2 p-3">
                <p className="text-xs text-muted">Venta o préstamo</p>
                <p className="text-sm font-medium text-fg">{ventaSeleccionada.descripcion}</p>
                <p className="text-xs text-muted mt-0.5">{ventaSeleccionada.referencia}</p>

                {/* Mostrar descripción de la transacción si existe */}
                {ventaSeleccionada.descripcionTransaccion && (
                  <p className="mt-2 text-xs text-muted border-l-2 border-primary/40 pl-2">
                    {ventaSeleccionada.descripcionTransaccion}
                  </p>
                )}
              </div>

              <div>
                <label htmlFor="cc-monto" className="label">Monto recibido</label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted font-medium pointer-events-none">$</span>
                  <input
                    id="cc-monto"
                    inputMode="decimal"
                    value={montoPago}
                    onChange={(e) => montoInputOnChange(e.target.value)}
                    placeholder="0,00"
                    className="input pl-8 num"
                  />
                </div>
              </div>

              <div>
                <label htmlFor="cc-fecha" className="label">Fecha del pago</label>
                <input
                  id="cc-fecha"
                  type="date"
                  value={fechaPago}
                  onChange={(e) => setFechaPago(e.target.value)}
                  className="input"
                />
              </div>
            </div>

            <div className="modal-footer">
              <button onClick={cerrarModalPago} className="btn-secondary">
                Cancelar
              </button>
              <button onClick={registrarPago} className="btn-accent">
                <CheckCircle className="w-4 h-4" />
                Registrar pago
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal eliminar - same pattern bottom sheet mobile / centered on sm+ */}
      {modalEliminarAbierto && movimientoAEliminar && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center sm:p-4" role="dialog" aria-modal="true" aria-labelledby="cc-titulo-eliminar">
          <div className="absolute inset-0 bg-slate-950/50" onClick={cerrarModalEliminar}></div>

          <div className="relative w-full sm:max-w-lg bg-surface border border-line rounded-t-xl sm:rounded-xl shadow-e3">
            <div className="modal-body">
              <div className="flex items-start gap-3">
                <div className="icon-tile bg-warning-soft text-warning-text">
                  <AlertCircle className="w-5 h-5" />
                </div>
                <div className="flex-1">
                  <h4 id="cc-titulo-eliminar" className="text-base font-semibold text-fg">
                    {movimientoAEliminar.tipo === 'venta' ? '¿Eliminar esta venta?' : '¿Anular este pago?'}
                  </h4>
                  <p className="text-sm text-muted mt-1">
                    Revisá los datos antes de confirmar.
                  </p>
                </div>
                <button onClick={cerrarModalEliminar} className="btn-icon -mt-2 -mr-2" aria-label="Cerrar">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="rounded-lg bg-surface-2 p-3 text-sm">
                <p className="font-medium text-fg">{movimientoAEliminar.descripcion}</p>

                {/* Mostrar descripción de la transacción si existe */}
                {movimientoAEliminar.descripcionTransaccion && (
                  <p className="mt-1 text-xs text-muted border-l-2 border-primary/40 pl-2">{movimientoAEliminar.descripcionTransaccion}</p>
                )}

                <p className="text-xs text-muted mt-2 num">Fecha: {formatearFecha(movimientoAEliminar.fecha)}</p>
                <p className="text-xs text-muted mt-0.5 num">
                  Monto: {formatearMoneda(movimientoAEliminar.debe || movimientoAEliminar.haber)}
                </p>
              </div>

              {movimientoAEliminar.tipo === 'venta' ? (
                <div className="alert-warning">
                  <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                  <span>Se elimina la venta de forma permanente y los pagos que tenía vuelven a quedar pendientes.</span>
                </div>
              ) : (
                <div className="alert-info">
                  <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                  <span>La cuota vuelve a quedar pendiente. Vas a poder registrar el pago de nuevo más adelante.</span>
                </div>
              )}
            </div>

            <div className="modal-footer">
              <button onClick={cerrarModalEliminar} className="btn-secondary" disabled={eliminando}>
                Cancelar
              </button>
              <button
                onClick={eliminarMovimiento}
                className="btn-danger"
                disabled={eliminando}
              >
                {eliminando ? <span className="spinner" /> : <Trash2 className="w-4 h-4" />}
                {movimientoAEliminar.tipo === 'pago' ? 'Anular pago' : 'Eliminar venta'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
