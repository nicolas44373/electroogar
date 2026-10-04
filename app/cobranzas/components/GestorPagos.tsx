import { useState, useEffect } from 'react'
import EmojiImagen from '@/app/components/ui/EmojiImagen'
import { supabase } from '@/app/lib/supabase'
import { sincronizarEstadoTransaccion } from '@/app/lib/estadoTransaccion'
import { hoyISO } from '@/app/lib/fechas'
import { Cliente, Pago, Transaccion } from '@/app/lib/types/cobranzas'
import {
  Search,
  Calendar,
  DollarSign,
  Check,
  AlertTriangle,
  Filter,
  X,
} from 'lucide-react'
import EstadoBadge from '@/app/components/ui/EstadoBadge'

// Definir PagoExtendido sin extender Pago para evitar conflictos de tipos
interface PagoExtendido {
  id: string
  transaccion_id: string
  numero_cuota: number
  monto_pagado: number
  monto_cuota?: number
  fecha_pago: string | null
  fecha_vencimiento: string
  numero_recibo?: string
  metodo_pago?: 'efectivo' | 'transferencia' | 'cheque' | 'tarjeta'
  observaciones?: string
  usuario_registro?: string
  comprobante_url?: string
  referencia_externa?: string
  estado: 'pendiente' | 'parcial' | 'pagado'
  created_at: string
  transaccion: {
    cliente: Cliente
    producto: { nombre: string } | null  // Permitir null para préstamos
    monto_total: number
    monto_cuota: number  // Agregar monto_cuota de la transacción
    numero_factura?: string
    tipo_transaccion: string  // Agregar tipo de transacción
  }
}

interface GestorPagosProps {
  clientes: Cliente[]
  onPagoRegistrado: () => void
}

interface ToastMsg { tipo: 'success' | 'error'; texto: string }

export default function GestorPagos({ clientes, onPagoRegistrado }: GestorPagosProps) {
  const [pagosPendientes, setPagosPendientes] = useState<PagoExtendido[]>([])
  const [pagoSeleccionado, setPagoSeleccionado] = useState<PagoExtendido | null>(null)
  const [mostrarModal, setMostrarModal] = useState(false)
  const [loading, setLoading] = useState(false)
  const [busqueda, setBusqueda] = useState('')
  const [filtroEstado, setFiltroEstado] = useState<'todos' | 'pendiente' | 'parcial' | 'vencido'>('todos')
  const [filtroFecha, setFiltroFecha] = useState<'todos' | 'hoy' | 'semana' | 'mes' | 'vencidos'>('todos')
  const [toast, setToast] = useState<ToastMsg | null>(null)

  const mostrarToast = (tipo: 'success' | 'error', texto: string) => {
    setToast({ tipo, texto })
    setTimeout(() => setToast(null), 4000)
  }
  
  // Datos del formulario de pago
  const [montoPago, setMontoPago] = useState('')
  const [fechaPago, setFechaPago] = useState(hoyISO())
  const [metodoPago, setMetodoPago] = useState<'efectivo' | 'transferencia' | 'cheque' | 'tarjeta'>('efectivo')
  const [observaciones, setObservaciones] = useState('')

  useEffect(() => {
    cargarPagosPendientes()
  }, [])

  const cargarPagosPendientes = async () => {
    setLoading(true)
    try {
      const { data } = await supabase
        .from('pagos')
        .select(`
          *,
          transaccion:transacciones(
            monto_total,
            monto_cuota,
            numero_factura,
            tipo_transaccion,
            cliente:clientes(id, nombre, apellido, email, telefono),
            producto:productos(nombre)
          )
        `)
        .in('estado', ['pendiente', 'parcial'])
        .order('fecha_vencimiento')

      if (data) {
        setPagosPendientes(data as PagoExtendido[])
      }
    } catch (error) {
      console.error('Error cargando pagos:', error)
    } finally {
      setLoading(false)
    }
  }

  // Función centralizada para calcular diferencia de días (evita problemas de timezone)
  const calcularDiasVencimiento = (fechaVencimiento: string) => {
    // Crear fechas forzando interpretación local
    const hoy = new Date()
    hoy.setHours(0, 0, 0, 0)
    
    // Parsear fecha como local usando split para evitar conversión UTC
    const [year, month, day] = fechaVencimiento.split('-').map(Number)
    const vencimiento = new Date(year, month - 1, day) // month - 1 porque los meses en JS van de 0-11
    vencimiento.setHours(0, 0, 0, 0)
    
    const diferencia = Math.floor((vencimiento.getTime() - hoy.getTime()) / (1000 * 60 * 60 * 24))
    return diferencia
  }

  // Función para obtener el monto de cuota correcto
  const obtenerMontoCuota = (pago: PagoExtendido) => {
    // Si el pago tiene monto_cuota propio (ej: reprogramado con intereses), usarlo
    if (pago.monto_cuota && pago.monto_cuota > 0) {
      return pago.monto_cuota
    }
    // Si no, usar el monto_cuota de la transacción
    return pago.transaccion.monto_cuota || 0
  }

  // Función para obtener el nombre del producto o tipo de transacción
  const obtenerNombreTransaccion = (transaccion: PagoExtendido['transaccion']) => {
    if (transaccion.producto?.nombre) {
      return transaccion.producto.nombre
    }
    
    // Si no hay producto, es un préstamo
    return transaccion.tipo_transaccion === 'prestamo' ? 'Préstamo de Dinero' : 'Venta'
  }

  const formatearMoneda = (monto: number) => {
    return new Intl.NumberFormat('es-AR', {
      style: 'currency',
      currency: 'ARS'
    }).format(monto)
  }

  const formatearFecha = (fecha: string) => {
    // Parsear fecha como local para evitar conversión UTC
    const [year, month, day] = fecha.split('-').map(Number)
    const fechaObj = new Date(year, month - 1, day)
    return fechaObj.toLocaleDateString('es-AR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    })
  }

  const obtenerEstadoVencimiento = (fechaVencimiento: string) => {
    const diferenciaDias = calcularDiasVencimiento(fechaVencimiento)

    if (diferenciaDias < 0) return { estado: 'vencido', dias: Math.abs(diferenciaDias), texto: `Vencido hace ${Math.abs(diferenciaDias)} días` }
    if (diferenciaDias === 0) return { estado: 'hoy', dias: 0, texto: 'Vence hoy' }
    if (diferenciaDias <= 7) return { estado: 'proximo', dias: diferenciaDias, texto: `Vence en ${diferenciaDias} días` }
    return { estado: 'futuro', dias: diferenciaDias, texto: `Vence en ${diferenciaDias} días` }
  }

  const filtrarPagos = () => {
    let pagosFiltrados = pagosPendientes

    // Filtro por búsqueda
    if (busqueda) {
      pagosFiltrados = pagosFiltrados.filter(pago =>
        pago.transaccion.cliente.nombre.toLowerCase().includes(busqueda.toLowerCase()) ||
        obtenerNombreTransaccion(pago.transaccion).toLowerCase().includes(busqueda.toLowerCase())
      )
    }

    // Filtro por estado
    if (filtroEstado !== 'todos') {
      if (filtroEstado === 'vencido') {
        pagosFiltrados = pagosFiltrados.filter(pago =>
          obtenerEstadoVencimiento(pago.fecha_vencimiento).estado === 'vencido'
        )
      } else {
        pagosFiltrados = pagosFiltrados.filter(pago => pago.estado === filtroEstado)
      }
    }

    // Filtro por fecha - usando la función centralizada
    if (filtroFecha !== 'todos') {
      pagosFiltrados = pagosFiltrados.filter(pago => {
        const diferenciaDias = calcularDiasVencimiento(pago.fecha_vencimiento)

        switch (filtroFecha) {
          case 'hoy':
            return diferenciaDias === 0
          case 'semana':
            return diferenciaDias >= 0 && diferenciaDias <= 7
          case 'mes':
            return diferenciaDias >= 0 && diferenciaDias <= 30
          case 'vencidos':
            return diferenciaDias < 0
          default:
            return true
        }
      })
    }

    return pagosFiltrados
  }

  const abrirModalPago = (pago: PagoExtendido) => {
    setPagoSeleccionado(pago)
    // Usar la función helper para obtener el monto correcto
    const montoRestante = obtenerMontoCuota(pago) - (pago.monto_pagado || 0)
    setMontoPago(montoRestante.toString())
    setFechaPago(hoyISO())
    setObservaciones('')
    setMostrarModal(true)
  }

  const registrarPago = async () => {
    if (!pagoSeleccionado) return

    setLoading(true)
    try {
      const montoNumerico = parseFloat(montoPago)
      const montoCuota = obtenerMontoCuota(pagoSeleccionado)  // Usar función helper
      const montoPagado = pagoSeleccionado.monto_pagado || 0
      const montoRestante = montoCuota - montoPagado
      
      let nuevoEstado: 'pendiente' | 'parcial' | 'pagado'
      let nuevoMontoPagado: number

      if (montoNumerico >= montoRestante) {
        nuevoEstado = 'pagado'
        nuevoMontoPagado = montoCuota
      } else {
        nuevoEstado = 'parcial'
        nuevoMontoPagado = montoPagado + montoNumerico
      }

      // Actualizar el pago
      const { error } = await supabase
        .from('pagos')
        .update({
          estado: nuevoEstado,
          monto_pagado: nuevoMontoPagado,
          fecha_pago: fechaPago,  // Ya está en formato correcto YYYY-MM-DD
          metodo_pago: metodoPago,
          observaciones: observaciones,
          numero_recibo: `REC-${Date.now()}`
        })
        .eq('id', pagoSeleccionado.id)

      if (error) throw error
      await sincronizarEstadoTransaccion(pagoSeleccionado.transaccion_id)

      setMostrarModal(false)
      setPagoSeleccionado(null)
      await cargarPagosPendientes()
      onPagoRegistrado()
      mostrarToast('success', 'Pago registrado correctamente')
    } catch (error) {
      console.error('Error registrando pago:', error)
      mostrarToast('error', 'Error al registrar el pago')
    } finally {
      setLoading(false)
    }
  }

  const pagosFiltrados = filtrarPagos()

  return (
    <div className="space-y-4">
      {toast && (
        <div className={toast.tipo === 'success' ? 'alert-success' : 'alert-danger'} role="status">
          {toast.tipo === 'success' ? <Check className="w-4 h-4 flex-shrink-0" /> : <AlertTriangle className="w-4 h-4 flex-shrink-0" />}
          {toast.texto}
        </div>
      )}
      <div className="card">
        <div className="card-header">
          <div>
            <h2 className="section-title">
              <span className="emoji" aria-hidden="true">💳</span>
              Registrar pago
            </h2>
            <p className="text-xs text-muted mt-0.5">Elegí la cuota que te pagaron y cargá el cobro.</p>
          </div>
        </div>

        {/* Filtros y búsqueda */}
        <div className="card-body border-b border-line grid grid-cols-1 md:grid-cols-4 gap-3">
          <div className="relative md:col-span-2">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted pointer-events-none" />
            <input
              type="text"
              placeholder="Buscar por cliente o producto"
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              className="input input-icon"
              aria-label="Buscar por cliente o producto"
            />
          </div>

          <select
            value={filtroEstado}
            onChange={(e) => setFiltroEstado(e.target.value as any)}
            className="input"
            aria-label="Filtrar por estado"
          >
            <option value="todos">Todos los estados</option>
            <option value="pendiente">Pendientes</option>
            <option value="parcial">Con pago parcial</option>
            <option value="vencido">Vencidas</option>
          </select>

          <select
            value={filtroFecha}
            onChange={(e) => setFiltroFecha(e.target.value as any)}
            className="input"
            aria-label="Filtrar por fecha de vencimiento"
          >
            <option value="todos">Cualquier fecha</option>
            <option value="vencidos">Ya vencidas</option>
            <option value="hoy">Vencen hoy</option>
            <option value="semana">Próximos 7 días</option>
            <option value="mes">Próximos 30 días</option>
          </select>

          <p className="md:col-span-4 flex items-center gap-2 text-xs text-muted num">
            <Filter className="w-4 h-4" />
            Mostrando {pagosFiltrados.length} de {pagosPendientes.length} cuotas
          </p>
        </div>

        {/* Lista de pagos */}
        <div className="divide-y divide-line">
          {loading ? (
            <div className="p-4 space-y-4" role="status" aria-live="polite">
              <span className="sr-only">Cargando cuotas…</span>
              {[0, 1, 2, 3].map((i) => (
                <div key={i} className="flex items-center gap-4">
                  <div className="flex-1 space-y-2">
                    <div className="skeleton h-4 w-1/3" />
                    <div className="skeleton h-3 w-1/4" />
                  </div>
                  <div className="skeleton h-5 w-24" />
                  <div className="skeleton h-10 w-36" />
                </div>
              ))}
            </div>
          ) : pagosFiltrados.length > 0 ? (
            pagosFiltrados.map((pago) => {
              const estadoVencimiento = obtenerEstadoVencimiento(pago.fecha_vencimiento)
              const montoCuota = obtenerMontoCuota(pago)  // Usar la función helper
              const montoPagado = pago.monto_pagado || 0
              const montoRestante = montoCuota - montoPagado

              return (
                <div
                  key={pago.id}
                  className={`p-4 sm:px-5 transition-colors border-l-4 ${
                    estadoVencimiento.estado === 'vencido' ? 'border-l-danger bg-danger-soft/20' :
                    estadoVencimiento.estado === 'hoy' ? 'border-l-warning bg-warning-soft/20' :
                    'border-l-transparent hover:bg-surface-2'
                  }`}
                >
                  <div className="flex flex-col lg:flex-row lg:items-center gap-3 lg:gap-6">
                    <div className="flex-1 min-w-0">
                      <h3 className="font-semibold text-fg truncate">
                        {pago.transaccion.cliente.nombre} {pago.transaccion.cliente.apellido || ''}
                      </h3>
                      <p className="text-sm text-muted truncate">
                        {obtenerNombreTransaccion(pago.transaccion)} · Cuota {pago.numero_cuota}
                      </p>
                    </div>

                    <div className="grid grid-cols-3 lg:flex lg:items-center gap-3 lg:gap-6">
                      <div className="lg:text-right lg:w-32">
                        <p className="text-xs text-muted">A cobrar</p>
                        <p className="font-semibold text-fg num whitespace-nowrap">
                          {formatearMoneda(montoRestante)}
                        </p>
                        {montoPagado > 0 && (
                          <p className="text-xs text-success-text num whitespace-nowrap">
                            Ya pagó {formatearMoneda(montoPagado)}
                          </p>
                        )}
                      </div>

                      <div className="lg:w-36">
                        <p className="text-xs text-muted">Vencimiento</p>
                        <p className="font-medium text-fg num">
                          {formatearFecha(pago.fecha_vencimiento)}
                        </p>
                        <p className={`text-xs font-medium flex items-center gap-1 ${
                          estadoVencimiento.estado === 'vencido' ? 'text-danger-text' :
                          estadoVencimiento.estado === 'hoy' ? 'text-warning-text' :
                          'text-muted'
                        }`}>
                          {estadoVencimiento.estado === 'vencido' && (
                            <AlertTriangle className="w-3.5 h-3.5" />
                          )}
                          {estadoVencimiento.estado === 'hoy' && (
                            <Calendar className="w-3.5 h-3.5" />
                          )}
                          {estadoVencimiento.texto}
                        </p>
                      </div>

                      <div className="flex items-start lg:items-center">
                        {pago.estado === 'pendiente' ? <EstadoBadge estado="pendiente" /> :
                         pago.estado === 'parcial' ? <EstadoBadge estado="parcial" /> : <EstadoBadge estado="pagado" />}
                      </div>
                    </div>

                    <button
                      onClick={() => abrirModalPago(pago)}
                      className="btn-accent w-full lg:w-auto"
                    >
                      <DollarSign className="w-4 h-4" />
                      <span>Registrar pago</span>
                    </button>
                  </div>
                </div>
              )
            })
          ) : (
            <div className="empty-state">
              <span className="empty-emoji" aria-hidden="true">✅</span>
              <p className="text-sm font-medium text-fg">No hay cuotas para mostrar</p>
              <p className="text-xs mt-1">Probá cambiando la búsqueda o los filtros.</p>
            </div>
          )}
        </div>
      </div>

      {/* Modal de registro de pago */}
      {mostrarModal && pagoSeleccionado && (
        <div className="modal-backdrop">
          <div className="modal" role="dialog" aria-modal="true" aria-labelledby="titulo-registrar-pago">
            <div className="modal-header justify-between">
              <h3 id="titulo-registrar-pago" className="text-base font-semibold text-fg"><EmojiImagen nombre="billete" className="w-5 h-5" /> Registrar pago</h3>
              <button
                onClick={() => setMostrarModal(false)}
                className="btn-icon"
                aria-label="Cerrar"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="modal-body">
              {/* Información del pago */}
              <dl className="rounded-lg bg-surface-2 p-4 text-sm space-y-3">
                <div>
                  <dt className="text-xs text-muted">Cliente</dt>
                  <dd className="font-medium text-fg">
                    {pagoSeleccionado.transaccion.cliente.nombre} {pagoSeleccionado.transaccion.cliente.apellido || ''}
                  </dd>
                </div>

                <div>
                  <dt className="text-xs text-muted">Concepto</dt>
                  <dd className="font-medium text-fg">{obtenerNombreTransaccion(pagoSeleccionado.transaccion)}</dd>
                </div>

                <div className="flex justify-between">
                  <div>
                    <dt className="text-xs text-muted">Cuota</dt>
                    <dd className="font-medium text-fg num">{pagoSeleccionado.numero_cuota}</dd>
                  </div>
                  <div className="text-right">
                    <dt className="text-xs text-muted">Importe de la cuota</dt>
                    <dd className="font-bold text-fg num">{formatearMoneda(obtenerMontoCuota(pagoSeleccionado))}</dd>
                  </div>
                </div>

                {(pagoSeleccionado.monto_pagado || 0) > 0 && (
                  <div className="flex justify-between pt-3 border-t border-line">
                    <div>
                      <dt className="text-xs text-muted">Ya pagó</dt>
                      <dd className="text-success-text font-medium num">
                        {formatearMoneda(pagoSeleccionado.monto_pagado || 0)}
                      </dd>
                    </div>
                    <div className="text-right">
                      <dt className="text-xs text-muted">Falta pagar</dt>
                      <dd className="font-bold text-danger-text num">
                        {formatearMoneda(obtenerMontoCuota(pagoSeleccionado) - (pagoSeleccionado.monto_pagado || 0))}
                      </dd>
                    </div>
                  </div>
                )}
              </dl>

              {/* Formulario de pago */}
              <div>
                <label htmlFor="gp-monto" className="label">
                  Monto recibido
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted font-medium pointer-events-none">$</span>
                  <input
                    id="gp-monto"
                    type="number"
                    step="0.01"
                    value={montoPago}
                    onChange={(e) => setMontoPago(e.target.value)}
                    max={obtenerMontoCuota(pagoSeleccionado) - (pagoSeleccionado.monto_pagado || 0)}
                    className="input pl-8 num"
                  />
                </div>
                <p className="help">Si es menor al saldo de la cuota, queda registrado como pago parcial.</p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label htmlFor="gp-fecha" className="label">
                    Fecha del pago
                  </label>
                  <input
                    id="gp-fecha"
                    type="date"
                    value={fechaPago}
                    onChange={(e) => setFechaPago(e.target.value)}
                    className="input"
                  />
                </div>

                <div>
                  <label htmlFor="gp-metodo" className="label">
                    Medio de pago
                  </label>
                  <select
                    id="gp-metodo"
                    value={metodoPago}
                    onChange={(e) => setMetodoPago(e.target.value as any)}
                    className="input"
                  >
                    <option value="efectivo">Efectivo</option>
                    <option value="transferencia">Transferencia</option>
                    <option value="cheque">Cheque</option>
                    <option value="tarjeta">Tarjeta</option>
                  </select>
                </div>
              </div>

              <div>
                <label htmlFor="gp-observaciones" className="label">
                  Observaciones <span className="font-normal text-muted">(opcional)</span>
                </label>
                <textarea
                  id="gp-observaciones"
                  value={observaciones}
                  onChange={(e) => setObservaciones(e.target.value)}
                  rows={3}
                  className="input resize-none"
                  placeholder="Ej: Pagó con billetes de $1.000"
                />
              </div>
            </div>

            <div className="modal-footer">
              <button
                onClick={() => setMostrarModal(false)}
                className="btn-secondary flex-1 sm:flex-none"
              >
                Cancelar
              </button>
              <button
                onClick={registrarPago}
                disabled={loading || !montoPago || parseFloat(montoPago) <= 0}
                className="btn-accent flex-1 sm:flex-none"
              >
                {loading ? (
                  <>
                    <span className="spinner" />
                    <span>Guardando…</span>
                  </>
                ) : (
                  <>
                    <Check className="w-4 h-4" />
                    <span>Confirmar pago</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
