import { useState } from 'react'
import EmojiImagen from '@/app/components/ui/EmojiImagen'
import { Cliente, Transaccion, Pago } from '@/app/lib/types/cobranzas'
import TablaPagos from './TablaPagos'
import ResumenPagos from './ResumenPagos'
import ExportadorPDFCliente from './Exportadorpdfcliente'
import ComprobanteTransaccion from './Comprobantetransaccion'
import ComprobanteCompra from './ComprobanteCompra'
import {
  FileText,
  ShoppingBag,
  Trash2,
  AlertTriangle,
  Circle,
  CheckCircle2,
  ChevronDown,
} from 'lucide-react'

// Solo presentación: muestra un número como $ 1.234,56
const mostrarPesos = (valor: number | undefined) =>
  new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', minimumFractionDigits: 2 }).format(Number(valor) || 0)

interface HistorialTransaccionesProps {
  cliente: Cliente
  transacciones: Transaccion[]
  pagos: { [key: string]: Pago[] }
  onPagoRegistrado: () => void
  onEliminarTransaccion?: (transaccionId: string) => Promise<void>
  loading?: boolean
}

export default function HistorialTransacciones({
  cliente,
  transacciones,
  pagos,
  onPagoRegistrado,
  onEliminarTransaccion,
  loading = false,
}: HistorialTransaccionesProps) {
  const [eliminando, setEliminando] = useState<string | null>(null)
  const [mostrarConfirmacion, setMostrarConfirmacion] = useState<string | null>(null)
  const [comprobanteActivo, setComprobanteActivo] = useState<string | null>(null)
  const [comprobanteCompraActivo, setComprobanteCompraActivo] = useState<string | null>(null)
  const [verTerminadas, setVerTerminadas] = useState(false)

  if (loading) {
    return (
      <div className="card p-5 space-y-3" role="status" aria-live="polite">
        <span className="sr-only">Cargando historial…</span>
        <div className="skeleton h-5 w-1/3"></div>
        <div className="skeleton h-4 w-2/3"></div>
        <div className="skeleton h-24 w-full"></div>
      </div>
    )
  }

  if (transacciones.length === 0) {
    return (
      <div className="card empty-state">
        <span className="empty-emoji" aria-hidden="true">📭</span>
        <p className="text-base font-semibold text-fg mb-1">Este cliente todavía no tiene ventas ni préstamos</p>
        <p className="text-sm">Usá “Nueva venta o préstamo” para cargar la primera.</p>
      </div>
    )
  }

  const obtenerTituloTransaccion = (transaccion: Transaccion) => {
    if (transaccion.tipo_transaccion === 'prestamo') return 'Préstamo de Dinero'
    return transaccion.producto?.nombre || 'Venta de Producto'
  }

  const formatearFecha = (fecha: string) => {
    try {
      const [year, month, day] = fecha.split('-').map(Number)
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

  // (No se usa hoy, pero lo dejo por si lo necesitas después)
  const formatearFechaLarga = (fecha: string) => {
    try {
      const [year, month, day] = fecha.split('-').map(Number)
      const fechaObj = new Date(year, month - 1, day)
      return fechaObj.toLocaleDateString('es-AR', {
        day: '2-digit',
        month: 'long',
        year: 'numeric',
      })
    } catch {
      return fecha
    }
  }

  const handleEliminar = async (transaccionId: string) => {
    if (!onEliminarTransaccion) return
    setEliminando(transaccionId)
    try {
      await onEliminarTransaccion(transaccionId)
      setMostrarConfirmacion(null)
    } catch (error) {
      console.error('Error al eliminar transacción:', error)
      alert('Error al eliminar la transacción. Por favor intenta de nuevo.')
    } finally {
      setEliminando(null)
    }
  }

  const generarDatosComprobante = (transaccion: Transaccion) => {
    const pagosTransaccion = pagos[transaccion.id] || []

    const cuotas = pagosTransaccion.map((pago) => ({
      numero: pago.numero_cuota ?? 0,
      // Fallback to transaccion.monto_cuota when the pago row has 0/null
      monto: (pago.monto_cuota || transaccion.monto_cuota),
      interesesMora: pago.intereses_mora || 0,
      fechaVencimiento: pago.fecha_vencimiento,
      fechaReprogramacion: pago.fecha_reprogramacion || undefined,
      estado: pago.estado as 'pendiente' | 'pagado' | 'parcial' | 'reprogramado',
      montoPagado: pago.monto_pagado || 0,
      fechaPago: pago.fecha_pago || undefined,
    }))

    const montoOriginal = transaccion.monto_original || transaccion.monto_total
    const interesAplicado = transaccion.interes_porcentaje || 0

    return {
      tipo: transaccion.tipo_transaccion,
      cliente: {
        nombre: cliente.nombre,
        apellido: cliente.apellido || '',
        telefono: cliente.telefono,
        email: cliente.email,
      },
      transaccion: {
        numeroFactura: transaccion.numero_factura,
        fecha: transaccion.fecha_inicio,
        montoOriginal: montoOriginal,
        interes: interesAplicado,
        montoTotal: transaccion.monto_total,
        numeroCuotas: transaccion.numero_cuotas,
        montoCuota: transaccion.monto_cuota,
        tipoPago: transaccion.tipo_pago,
        descripcion: transaccion.descripcion || undefined,
        productoNombre: transaccion.producto?.nombre,
      },
      cuotas,
    }
  }

  const abrirComprobante = (transaccionId: string) => {
    setComprobanteActivo(transaccionId)
  }

  const cerrarComprobante = () => {
    setComprobanteActivo(null)
  }

  // Terminada = todas sus cuotas pagadas (aunque el estado guardado no se haya actualizado)
  const estaTerminada = (t: Transaccion) =>
    t.estado === 'completado' ||
    ((pagos[t.id]?.length ?? 0) > 0 && pagos[t.id].every((p) => p.estado === 'pagado'))
  const enCurso = transacciones.filter((t) => !estaTerminada(t))
  const terminadas = transacciones.filter((t) => estaTerminada(t))

  // Renderizar comprobante si está activo
  const transaccionConComprobante = transacciones.find((t) => t.id === comprobanteActivo)
  if (comprobanteActivo && transaccionConComprobante) {
    const datosComprobante = generarDatosComprobante(transaccionConComprobante)
    return (
      <ComprobanteTransaccion
        tipo={datosComprobante.tipo as 'venta' | 'prestamo'}
        cliente={datosComprobante.cliente}
        transaccion={datosComprobante.transaccion}
        cuotas={datosComprobante.cuotas}
        onCerrar={cerrarComprobante}
      />
    )
  }

  // Renderizar comprobante de compra (sin cuotas) si está activo
  const transaccionCompra = transacciones.find((t) => t.id === comprobanteCompraActivo)
  if (comprobanteCompraActivo && transaccionCompra) {
    const datos = generarDatosComprobante(transaccionCompra)
    return (
      <ComprobanteCompra
        tipo={datos.tipo as 'venta' | 'prestamo'}
        cliente={{ ...datos.cliente, documento: cliente.documento }}
        transaccion={datos.transaccion}
        onCerrar={() => setComprobanteCompraActivo(null)}
      />
    )
  }

  return (
    <div className="space-y-4">
      <h2 className="section-title">
        <span className="emoji" aria-hidden="true">🛍️</span>
        Ventas y préstamos
      </h2>

      {/* Exportador PDF */}
      <ExportadorPDFCliente cliente={cliente} transacciones={transacciones} pagos={pagos} />

      {[...enCurso, ...terminadas].map((transaccion, indice) => (
        <div key={transaccion.id} className="space-y-4">
        {/* Botón antes de la primera operación terminada */}
        {indice === enCurso.length && (
          <button
            type="button"
            onClick={() => setVerTerminadas(!verTerminadas)}
            aria-expanded={verTerminadas}
            className="btn-secondary w-full justify-between"
          >
            <span className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-success" />
              {verTerminadas ? 'Ocultar' : 'Ver'} {terminadas.length} {terminadas.length === 1 ? 'operación terminada' : 'operaciones terminadas'}
            </span>
            <ChevronDown className={`w-4 h-4 transition-transform ${verTerminadas ? 'rotate-180' : ''}`} />
          </button>
        )}
        {(indice < enCurso.length || verTerminadas) && (
        <div className="card overflow-hidden relative">
          {/* Modal de confirmación */}
          {mostrarConfirmacion === transaccion.id && (
            <div
              className="modal-backdrop"
              onClick={() => setMostrarConfirmacion(null)}
              role="dialog"
              aria-modal="true"
            >
              <div
                className="modal"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="modal-body">
                  <div className="flex items-start gap-3">
                    <div className="icon-tile bg-danger-soft text-danger-text">
                      <span className="emoji text-xl" aria-hidden="true">⚠️</span>
                    </div>
                    <div>
                      <h3 className="text-base font-semibold text-fg">
                        ¿Eliminar esta {transaccion.tipo_transaccion === 'venta' ? 'venta' : 'operación'}?
                      </h3>
                      <p className="text-sm text-muted mt-1">
                        Se borran la operación y todas sus cuotas. Esta acción no se puede deshacer.
                      </p>
                    </div>
                  </div>

                  <dl className="rounded-lg bg-surface-2 p-3 text-sm space-y-1">
                    <p className="font-medium text-fg">{obtenerTituloTransaccion(transaccion)}</p>
                    <div className="flex gap-2"><dt className="text-muted">Total:</dt><dd className="text-fg num">{mostrarPesos(transaccion.monto_total)}</dd></div>
                    <div className="flex gap-2"><dt className="text-muted">Cuotas:</dt><dd className="text-fg num">{transaccion.numero_cuotas}</dd></div>
                  </dl>
                </div>

                <div className="modal-footer">
                  <button
                    type="button"
                    onClick={(e) => {
                      e.preventDefault()
                      e.stopPropagation()
                      setMostrarConfirmacion(null)
                    }}
                    className="btn-secondary"
                    disabled={eliminando === transaccion.id}
                  >
                    Cancelar
                  </button>

                  <button
                    type="button"
                    onClick={(e) => {
                      e.preventDefault()
                      e.stopPropagation()
                      void handleEliminar(transaccion.id)
                    }}
                    disabled={eliminando === transaccion.id}
                    className="btn-danger"
                  >
                    {eliminando === transaccion.id ? (
                      <>
                        <span className="spinner" />
                        Eliminando…
                      </>
                    ) : (
                      <>
                        <Trash2 className="w-4 h-4" />
                        Eliminar definitivamente
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Header */}
          <div className="p-4 sm:p-5 border-b border-line">
            <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-4">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-3">
                  <div className="icon-tile bg-primary/10 text-primary">
                    <EmojiImagen nombre={transaccion.tipo_transaccion === 'venta' ? 'carrito' : 'billete'} className="w-8 h-8" />
                  </div>
                  <div className="min-w-0">
                    <h3 className="font-semibold text-base text-fg truncate">
                      {obtenerTituloTransaccion(transaccion)}
                    </h3>
                    <div className="flex flex-wrap items-center gap-2 mt-1">
                      <EstadoBadge estado={estaTerminada(transaccion) ? 'completado' : (transaccion.estado || 'activo')} />
                      <span className="text-xs text-muted">
                        {transaccion.tipo_transaccion === 'venta' ? 'Venta' : 'Préstamo'}
                        {' · '}
                        <span className="capitalize">{transaccion.tipo_pago}</span>
                        {' · '}
                        <span className="num">Inicio {formatearFecha(transaccion.fecha_inicio)}</span>
                      </span>
                    </div>
                  </div>
                </div>

                {transaccion.descripcion && (
                  <p className="mt-3 text-sm text-muted border-l-2 border-primary/40 pl-3">
                    {transaccion.descripcion}
                  </p>
                )}
              </div>

              <div className="flex flex-col sm:items-end gap-3">
                <div className="sm:text-right">
                  <p className="text-2xl font-bold text-fg num">
                    {mostrarPesos(transaccion.monto_total)}
                  </p>
                  <p className="text-xs text-muted mt-0.5 num">
                    {transaccion.numero_cuotas} cuotas de {mostrarPesos(transaccion.monto_cuota)}
                  </p>

                  {transaccion.tipo_transaccion === 'prestamo' && (
                    <div className="mt-1 text-xs text-muted num">
                      {transaccion.monto_original && (
                        <p>Monto prestado: {mostrarPesos(transaccion.monto_original)}</p>
                      )}
                      {transaccion.interes_porcentaje && transaccion.interes_porcentaje > 0 && (
                        <p>Interés aplicado: {transaccion.interes_porcentaje}%</p>
                      )}
                    </div>
                  )}
                </div>

                {/* Botones de acción */}
                <div className="flex gap-1">
                  <button
                    type="button"
                    onClick={(e) => {
                      e.preventDefault()
                      e.stopPropagation()
                      abrirComprobante(transaccion.id)
                    }}
                    className="btn-secondary btn-sm"
                    title="Ver comprobante con plan de cuotas"
                  >
                    <FileText className="w-4 h-4" />
                    <span className="hidden sm:inline">Comprobante</span>
                  </button>

                  <button
                    type="button"
                    onClick={(e) => {
                      e.preventDefault()
                      e.stopPropagation()
                      setComprobanteCompraActivo(transaccion.id)
                    }}
                    className="btn-secondary btn-sm"
                    title="Comprobante de compra (sin cuotas)"
                  >
                    <ShoppingBag className="w-4 h-4" />
                    <span className="hidden sm:inline">Compra</span>
                  </button>

                  {onEliminarTransaccion && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.preventDefault()
                        e.stopPropagation()
                        setMostrarConfirmacion(transaccion.id)
                      }}
                      className="btn-icon hover:!text-danger hover:!bg-danger-soft"
                      title="Eliminar operación"
                      aria-label="Eliminar operación"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Tabla pagos con scroll horizontal */}
          <div className="overflow-x-auto">
            <TablaPagos
              transaccion={transaccion}
              pagos={pagos[transaccion.id] || []}
              onPagoRegistrado={onPagoRegistrado}
            />
          </div>

          {/* Resumen */}
          <div className="px-4 sm:px-5 pb-5">
            <ResumenPagos transaccion={transaccion} pagos={pagos[transaccion.id] || []} />
          </div>
        </div>
        )}
        </div>
      ))}

      {enCurso.length === 0 && (
        <p className="text-sm text-muted">Este cliente no tiene operaciones en curso.</p>
      )}
    </div>
  )
}

function EstadoBadge({ estado }: { estado: string }) {
  const estilos = {
    activo: 'badge-primary',
    completado: 'badge-success',
    moroso: 'badge-danger',
  }
  const etiquetas = {
    activo: 'En curso',
    completado: 'Completada',
    moroso: 'En mora',
  }
  const iconos = {
    activo: Circle,
    completado: CheckCircle2,
    moroso: AlertTriangle,
  }
  const Icono = iconos[estado as keyof typeof iconos] || Circle

  return (
    <span
      className={estilos[estado as keyof typeof estilos] || 'badge-neutral'}
    >
      <Icono className="w-3.5 h-3.5" aria-hidden="true" />
      {etiquetas[estado as keyof typeof etiquetas] || estado}
    </span>
  )
}
