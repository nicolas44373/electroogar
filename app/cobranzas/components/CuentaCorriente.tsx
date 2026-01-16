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
} from 'lucide-react'
import { Transaccion, Pago } from '@/app/lib/types/cobranzas'
import { supabase } from '@/app/lib/supabase'

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
    setFechaPago(new Date().toISOString().split('T')[0])
    setModalPagoAbierto(true)
  }
  const cerrarModalPago = () => {
    setModalPagoAbierto(false)
    setVentaSeleccionada(null)
    setMontoPago('')
    setFechaPago('')
  }

  const registrarPago = async () => {
    if (!ventaSeleccionada || !ventaSeleccionada.transaccionId) return alert('Venta inválida')
    const monto = typeof montoPago === 'string' ? parseFloat(montoPago || '0') : (montoPago as any)
    if (!monto || monto <= 0) return alert('Ingrese un monto válido')

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
      alert('Error al registrar el pago: ' + error.message)
    } else {
      alert('Pago registrado correctamente')
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
      }

      if (error) {
        console.error(error)
        alert(
          `Error al procesar ${movimientoAEliminar.tipo}: ${
            error.message || JSON.stringify(error)
          }`
        )
      } else {
        alert(
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
      alert('Ocurrió un error inesperado al procesar la operación')
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
      <div className="bg-white rounded-lg shadow-sm border overflow-hidden">
        {/* Header */}
        <div className="p-4 sm:p-6 border-b">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <FileText className="w-5 h-5 text-gray-700" />
              <h3 className="text-base sm:text-lg font-semibold text-gray-900">
                Cuenta Corriente
              </h3>
            </div>
            {/* resumen rapido (oculto en xs para dar espacio) */}
            <div className="hidden sm:flex items-center gap-3">
              <div className="text-xs text-gray-500">Cliente</div>
              <div className="text-sm font-medium text-gray-800">{clienteId}</div>
            </div>
          </div>

          {/* Resumen (tarjetas) - mobile first */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-4">
            <div className="p-3 bg-blue-50 rounded-lg flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-blue-100 rounded-md">
                  <TrendingUp className="w-4 h-4 text-blue-600" />
                </div>
                <div>
                  <div className="text-xs text-blue-600 font-medium">Total Ventas</div>
                  <div className="text-sm font-bold text-blue-700">
                    {formatearMoneda(totalVentas)}
                  </div>
                </div>
              </div>
            </div>

            <div className="p-3 bg-green-50 rounded-lg flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-green-100 rounded-md">
                  <TrendingDown className="w-4 h-4 text-green-600" />
                </div>
                <div>
                  <div className="text-xs text-green-600 font-medium">Total Pagos</div>
                  <div className="text-sm font-bold text-green-700">
                    {formatearMoneda(totalPagos)}
                  </div>
                </div>
              </div>
            </div>

            <div className="p-3 bg-gray-50 rounded-lg flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-gray-100 rounded-md">
                  <DollarSign className="w-4 h-4 text-gray-600" />
                </div>
                <div>
                  <div className="text-xs text-gray-600 font-medium">Saldo Actual</div>
                  <div
                    className={`text-sm font-bold ${
                      saldoActual > 0
                        ? 'text-red-600'
                        : saldoActual < 0
                        ? 'text-green-600'
                        : 'text-gray-700'
                    }`}
                  >
                    {formatearMoneda(Math.abs(saldoActual))}
                    <span className="text-xs ml-1">
                      {saldoActual > 0 ? ' (Debe)' : saldoActual < 0 ? ' (Favor)' : ' (Saldada)'}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* filtros - mobile friendly */}
          <div className="mt-4 grid grid-cols-1 sm:grid-cols-4 gap-3">
            <div>
              <label className="block text-xs text-gray-600 mb-1">Tipo</label>
              <select
                value={filtroTipo}
                onChange={(e) => setFiltroTipo(e.target.value as any)}
                className="w-full px-3 py-2 border rounded-md text-sm"
              >
                <option value="todos">Todos</option>
                <option value="ventas">Ventas</option>
                <option value="pagos">Pagos</option>
              </select>
            </div>

            <div>
              <label className="block text-xs text-gray-600 mb-1">Desde</label>
              <input
                type="date"
                value={fechaDesde}
                onChange={(e) => setFechaDesde(e.target.value)}
                className="w-full px-3 py-2 border rounded-md text-sm"
              />
            </div>

            <div>
              <label className="block text-xs text-gray-600 mb-1">Hasta</label>
              <input
                type="date"
                value={fechaHasta}
                onChange={(e) => setFechaHasta(e.target.value)}
                className="w-full px-3 py-2 border rounded-md text-sm"
              />
            </div>

            <div className="flex items-end gap-2">
              <button
                onClick={() => {
                  setFechaDesde('')
                  setFechaHasta('')
                  setFiltroTipo('todos')
                }}
                className="text-sm text-gray-600 underline"
              >
                Limpiar
              </button>
            </div>
          </div>
        </div>

        {/* Contenido principal: Lista móvil (xs) y Tabla en sm+ */}
        <div className="p-3 sm:p-4">
          {/* MOBILE: tarjetas lista (visible en xs, oculto en sm+) */}
          <div className="space-y-3 sm:hidden">
            {movimientosFiltrados.length > 0 ? (
              movimientosFiltrados.map((mov) => (
                <article key={mov.id} className="bg-white border rounded-lg p-3 shadow-sm">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <Calendar className="w-4 h-4 text-gray-400" />
                        <div className="text-sm font-medium text-gray-800">
                          {formatearFecha(mov.fecha)}
                        </div>
                      </div>

                      <div className="mt-2">
                        <div className="text-sm font-medium">{mov.descripcion}</div>

                        {/* Mostrar descripción de la transacción si existe */}
                        {mov.descripcionTransaccion && (
                          <div className="mt-1 bg-blue-50 border-l-2 border-blue-400 px-2 py-1 rounded">
                            <p className="text-xs text-gray-700">
                              <span className="font-medium">📝</span>{' '}
                              {mov.descripcionTransaccion}
                            </p>
                          </div>
                        )}

                        <div className="flex items-center gap-2 mt-1 text-xs">
                          {mov.tipo === 'venta' ? (
                            <div className="text-blue-600 flex items-center gap-1">
                              <TrendingUp className="w-3 h-3" /> Venta
                            </div>
                          ) : (
                            <div className="text-green-600 flex items-center gap-1">
                              <TrendingDown className="w-3 h-3" /> Pago
                            </div>
                          )}
                          <div className="text-gray-500">• {mov.referencia}</div>
                        </div>
                      </div>
                    </div>

                    <div className="flex flex-col items-end justify-between">
                      <div className="text-sm font-semibold">
                        {mov.debe > 0 ? (
                          <span className="text-red-600">{formatearMoneda(mov.debe)}</span>
                        ) : null}
                        {mov.haber > 0 ? (
                          <span className="text-green-600">{formatearMoneda(mov.haber)}</span>
                        ) : null}
                      </div>
                      <div className="text-xs mt-2 text-gray-600">
                        Saldo {formatearMoneda(mov.saldo)}
                      </div>

                      <div className="flex gap-2 mt-3">
                        {mov.tipo === 'venta' && (
                          <button
                            onClick={() => abrirModalPago(mov)}
                            className="flex items-center gap-1 px-3 py-2 rounded bg-green-600 text-white text-xs"
                          >
                            <DollarSign className="w-3 h-3" /> Pagar
                          </button>
                        )}
                        <button
                          onClick={() => abrirModalEliminar(mov)}
                          className="flex items-center gap-1 px-3 py-2 rounded bg-red-600 text-white text-xs"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </div>
                    </div>
                  </div>
                </article>
              ))
            ) : (
              <div className="text-center py-6 text-gray-500">No hay movimientos</div>
            )}
          </div>

          {/* TABLE for sm+ (hidden on xs) */}
          <div className="hidden sm:block">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[720px] text-sm">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs text-gray-500 uppercase">Fecha</th>
                    <th className="px-4 py-3 text-left text-xs text-gray-500 uppercase">
                      Descripción
                    </th>
                    <th className="px-4 py-3 text-left text-xs text-gray-500 uppercase">
                      Referencia
                    </th>
                    <th className="px-4 py-3 text-right text-xs text-gray-500 uppercase">Debe</th>
                    <th className="px-4 py-3 text-right text-xs text-gray-500 uppercase">
                      Haber
                    </th>
                    <th className="px-4 py-3 text-right text-xs text-gray-500 uppercase">
                      Saldo
                    </th>
                    <th className="px-4 py-3 text-center text-xs text-gray-500 uppercase">
                      Acciones
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {movimientosFiltrados.length > 0 ? (
                    movimientosFiltrados.map((mov, i) => (
                      <tr key={mov.id} className={i % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                        <td className="px-4 py-3 whitespace-nowrap">
                          <div className="flex items-center gap-2">
                            <Calendar className="w-4 h-4 text-gray-400" />
                            <span>{formatearFecha(mov.fecha)}</span>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <div className="font-medium">{mov.descripcion}</div>

                          {/* Mostrar descripción de la transacción si existe */}
                          {mov.descripcionTransaccion && (
                            <div className="mt-1 bg-blue-50 border-l-2 border-blue-400 px-2 py-1 rounded text-xs text-gray-700">
                              📝 {mov.descripcionTransaccion}
                            </div>
                          )}

                          <div className="text-xs text-gray-500 mt-1">
                            {mov.tipo === 'venta' ? (
                              <span className="text-blue-600 inline-flex items-center gap-1">
                                <TrendingUp className="w-3 h-3" />
                                Venta
                              </span>
                            ) : (
                              <span className="text-green-600 inline-flex items-center gap-1">
                                <TrendingDown className="w-3 h-3" />
                                Pago
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-3 text-gray-500">{mov.referencia}</td>
                        <td className="px-4 py-3 text-right">
                          {mov.debe > 0 ? (
                            <span className="text-red-600 font-medium">
                              {formatearMoneda(mov.debe)}
                            </span>
                          ) : (
                            '-'
                          )}
                        </td>
                        <td className="px-4 py-3 text-right">
                          {mov.haber > 0 ? (
                            <span className="text-green-600 font-medium">
                              {formatearMoneda(mov.haber)}
                            </span>
                          ) : (
                            '-'
                          )}
                        </td>
                        <td className="px-4 py-3 text-right font-medium">
                          {formatearMoneda(mov.saldo)}
                        </td>
                        <td className="px-4 py-3 text-center">
                          <div className="inline-flex items-center gap-2">
                            {mov.tipo === 'venta' && (
                              <button
                                onClick={() => abrirModalPago(mov)}
                                className="px-2 py-1 rounded bg-green-600 text-white text-xs"
                              >
                                <DollarSign className="w-3 h-3 inline" /> Pagar
                              </button>
                            )}
                            <button
                              onClick={() => abrirModalEliminar(mov)}
                              className="px-2 py-1 rounded bg-red-600 text-white text-xs"
                            >
                              <Trash2 className="w-3 h-3 inline" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={7} className="text-center py-6 text-gray-500">
                        No hay movimientos para mostrar
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Footer resumen */}
        <div className="p-3 sm:p-4 border-t bg-gray-50">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
            <div className="text-sm text-gray-600">
              Total de movimientos: {movimientosFiltrados.length}
            </div>
            <div className="text-right">
              <div className="text-xs text-gray-600">Saldo Final</div>
              <div
                className={`text-base font-bold ${
                  saldoActual > 0
                    ? 'text-red-600'
                    : saldoActual < 0
                    ? 'text-green-600'
                    : 'text-gray-700'
                }`}
              >
                {formatearMoneda(Math.abs(saldoActual))}
                <span className="text-xs ml-1">
                  {saldoActual > 0
                    ? '(A favor del comercio)'
                    : saldoActual < 0
                    ? '(A favor del cliente)'
                    : '(Cuenta saldada)'}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* --------------------
          Modales
          -------------------- */}

      {/* Modal Pago - bottom sheet en móviles, modal centrado en sm+ */}
      {modalPagoAbierto && ventaSeleccionada && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center" aria-modal="true" role="dialog">
          {/* overlay */}
          <div className="absolute inset-0 bg-black opacity-40" onClick={cerrarModalPago}></div>

          {/* modal panel */}
          <div className="relative w-full sm:max-w-md bg-white rounded-t-xl sm:rounded-xl p-4 sm:p-6 shadow-lg transform-gpu">
            {/* header */}
            <div className="flex items-center justify-between">
              <h4 className="text-base font-semibold">Registrar pago</h4>
              <button onClick={cerrarModalPago} className="p-2 rounded-md">
                <X className="w-4 h-4 text-gray-600" />
              </button>
            </div>

            <div className="mt-3 space-y-3">
              <div>
                <label className="block text-xs text-gray-600 mb-1">Venta</label>
                <div className="text-sm font-medium text-gray-800">{ventaSeleccionada.descripcion}</div>
                <div className="text-xs text-gray-500 mt-1">{ventaSeleccionada.referencia}</div>

                {/* Mostrar descripción de la transacción si existe */}
                {ventaSeleccionada.descripcionTransaccion && (
                  <div className="mt-2 bg-blue-50 border-l-2 border-blue-400 px-2 py-1 rounded">
                    <p className="text-xs text-gray-700">
                      <span className="font-medium">📝</span> {ventaSeleccionada.descripcionTransaccion}
                    </p>
                  </div>
                )}
              </div>

              <div>
                <label className="block text-xs text-gray-600 mb-1">Monto</label>
                <input
                  inputMode="decimal"
                  value={montoPago}
                  onChange={(e) => montoInputOnChange(e.target.value)}
                  placeholder="0.00"
                  className="w-full px-3 py-2 border rounded-md text-sm"
                />
              </div>

              <div>
                <label className="block text-xs text-gray-600 mb-1">Fecha</label>
                <input
                  type="date"
                  value={fechaPago}
                  onChange={(e) => setFechaPago(e.target.value)}
                  className="w-full px-3 py-2 border rounded-md text-sm"
                />
              </div>

              <div className="flex justify-end gap-2 mt-1">
                <button onClick={cerrarModalPago} className="px-3 py-2 rounded bg-gray-200 text-sm">
                  Cancelar
                </button>
                <button onClick={registrarPago} className="px-3 py-2 rounded bg-green-600 text-white text-sm">
                  Registrar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal eliminar - same pattern bottom sheet mobile / centered on sm+ */}
      {modalEliminarAbierto && movimientoAEliminar && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center" role="dialog" aria-modal="true">
          <div className="absolute inset-0 bg-black opacity-40" onClick={cerrarModalEliminar}></div>

          <div className="relative w-full sm:max-w-lg bg-white rounded-t-xl sm:rounded-xl p-4 sm:p-6 shadow-lg">
            <div className="flex items-start gap-3">
              <AlertCircle className="w-6 h-6 text-orange-600" />
              <div className="flex-1">
                <h4 className="text-base font-semibold">Confirmar reversión</h4>
                <p className="text-sm text-gray-600 mt-1">
                  ¿Estás seguro de que deseas {movimientoAEliminar.tipo === 'venta' ? 'eliminar esta venta' : 'revertir este pago'}?
                </p>
              </div>
              <button onClick={cerrarModalEliminar} className="p-1 rounded-md">
                <X className="w-4 h-4 text-gray-600" />
              </button>
            </div>

            <div className="mt-4 bg-gray-50 rounded p-3">
              <div className="text-sm font-medium text-gray-700">{movimientoAEliminar.descripcion}</div>

              {/* Mostrar descripción de la transacción si existe */}
              {movimientoAEliminar.descripcionTransaccion && (
                <div className="mt-2 bg-blue-50 border-l-2 border-blue-400 px-2 py-1 rounded">
                  <p className="text-xs text-gray-700">📝 {movimientoAEliminar.descripcionTransaccion}</p>
                </div>
              )}

              <div className="text-xs text-gray-500 mt-1">Fecha: {formatearFecha(movimientoAEliminar.fecha)}</div>
              <div className="text-xs text-gray-500 mt-1">
                Monto: {formatearMoneda(movimientoAEliminar.debe || movimientoAEliminar.haber)}
              </div>
            </div>

            {movimientoAEliminar.tipo === 'venta' ? (
              <div className="mt-3 bg-yellow-50 border border-yellow-200 rounded p-3 text-sm text-yellow-800">
                <strong>Advertencia:</strong> Al eliminar la venta, todos los pagos asociados volverán a estado "pendiente" y la venta se eliminará permanentemente.
              </div>
            ) : (
              <div className="mt-3 bg-blue-50 border border-blue-200 rounded p-3 text-sm text-blue-800">
                <strong>Información:</strong> Este pago volverá a estado "pendiente". La cuota seguirá existiendo y podrás registrar el pago más adelante.
              </div>
            )}

            <div className="mt-4 flex justify-end gap-2">
              <button onClick={cerrarModalEliminar} className="px-4 py-2 bg-gray-200 rounded text-sm" disabled={eliminando}>
                Cancelar
              </button>
              <button
                onClick={eliminarMovimiento}
                className="px-4 py-2 bg-orange-600 text-white rounded text-sm flex items-center gap-2"
                disabled={eliminando}
              >
                {eliminando ? (
                  <svg
                    className="animate-spin -ml-1 mr-2 h-4 w-4 text-white"
                    xmlns="http://www.w3.org/2000/svg"
                    fill="none"
                    viewBox="0 0 24 24"
                  >
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                    ></path>
                  </svg>
                ) : null}
                {movimientoAEliminar.tipo === 'pago' ? 'Revertir Pago' : 'Eliminar Venta'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
