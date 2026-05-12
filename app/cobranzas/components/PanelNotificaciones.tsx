import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/app/lib/supabase'
import {
  Bell, AlertTriangle, Calendar, Clock, Phone, Mail,
  DollarSign, Check, ChevronLeft, ChevronRight, RefreshCw
} from 'lucide-react'

// ─── Tipos ────────────────────────────────────────────────────────────────────

interface NotificacionVencimiento {
  id: string
  cliente_id: string
  cliente_nombre: string
  cliente_apellido?: string
  cliente_telefono?: string
  cliente_email?: string
  monto: number
  monto_cuota_total: number
  monto_pagado: number
  fecha_vencimiento: string
  dias_vencimiento: number
  tipo: 'vencido' | 'por_vencer' | 'hoy'
  numero_cuota: number
  producto_nombre: string
  transaccion_id: string
  saldo_total_cliente: number
  tipo_transaccion: string
  fecha_inicio: string
  fecha_reprogramacion?: string
  intereses_mora?: number
  motivo_reprogramacion?: string
}

interface PanelNotificacionesProps {
  onActualizar: () => void
  onVerCuentaCliente?: (clienteId: string) => void
}

// ─── Helpers puros (fuera del componente, no se recrean) ──────────────────────

function calcularDiasVencimiento(fechaVencimiento: string): number {
  const hoy = new Date()
  hoy.setHours(0, 0, 0, 0)
  const [year, month, day] = fechaVencimiento.split('-').map(Number)
  const vencimiento = new Date(year, month - 1, day)
  vencimiento.setHours(0, 0, 0, 0)
  return Math.floor((vencimiento.getTime() - hoy.getTime()) / 86_400_000)
}

function calcularInteresesSugeridos(diasAtraso: number, montoBase: number): number {
  const tasaMensual = 0.01
  const mesesAtraso = Math.ceil(Math.abs(diasAtraso) / 30)
  return montoBase * tasaMensual * mesesAtraso
}

function obtenerMontoCuota(pago: any): number {
  const montoBase =
    pago.monto_cuota && pago.monto_cuota > 0
      ? pago.monto_cuota
      : pago.transaccion?.monto_cuota ?? 0
  return montoBase + (pago.intereses_mora ?? 0)
}

function obtenerNombreTransaccion(transaccion: any): string {
  if (transaccion?.producto?.nombre) return transaccion.producto.nombre
  return transaccion?.tipo_transaccion === 'prestamo' ? 'Préstamo de Dinero' : 'Venta'
}

function formatearMoneda(monto: number): string {
  return new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS' }).format(monto)
}

function formatearFecha(fecha: string): string {
  const [year, month, day] = fecha.split('-').map(Number)
  return new Date(year, month - 1, day).toLocaleDateString('es-AR', {
    day: '2-digit', month: '2-digit', year: 'numeric',
  })
}

function fechaAStr(fecha: Date): string {
  const y = fecha.getFullYear()
  const m = String(fecha.getMonth() + 1).padStart(2, '0')
  const d = String(fecha.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

// ─── Componente ───────────────────────────────────────────────────────────────

export default function PanelNotificaciones({ onActualizar, onVerCuentaCliente }: PanelNotificacionesProps) {

  // — Estado general —
  const [notificacionesDetalladas, setNotificacionesDetalladas] = useState<NotificacionVencimiento[]>([])
  const [loading, setLoading] = useState(false)
  const [mostrarContacto, setMostrarContacto] = useState<string | null>(null)
  const [filtroTipo, setFiltroTipo] = useState<'todos' | 'vencido' | 'hoy' | 'calendario'>('todos')

  // — Calendario —
  const [fechaSeleccionada, setFechaSeleccionada] = useState<Date | null>(null)
  const [mesActual, setMesActual] = useState(new Date())

  // — Modal pago —
  const [mostrarModalPago, setMostrarModalPago] = useState(false)
  const [notifSeleccionada, setNotifSeleccionada] = useState<NotificacionVencimiento | null>(null)
  const [montoPago, setMontoPago] = useState('')
  const [fechaPago, setFechaPago] = useState(new Date().toISOString().split('T')[0])
  const [metodoPago, setMetodoPago] = useState<'efectivo' | 'transferencia' | 'cheque' | 'tarjeta'>('efectivo')
  const [observaciones, setObservaciones] = useState('')

  // — Modal reprogramación —
  const [mostrarModalReprogramacion, setMostrarModalReprogramacion] = useState(false)
  const [notifReprogramar, setNotifReprogramar] = useState<NotificacionVencimiento | null>(null)
  const [nuevaFechaVencimiento, setNuevaFechaVencimiento] = useState('')
  const [interesesMora, setInteresesMora] = useState(0)
  const [motivoReprogramacion, setMotivoReprogramacion] = useState('')



  // ─── Carga detallada para la lista de notificaciones ─────────────────────────
  const cargarNotificacionesDetalladas = useCallback(async () => {
    setLoading(true)
    try {
      // Single query — no pagination loop, no second round of queries
      // We fetch up to 1000 pending/partial/reprogrammed payments with their joins.
      // The saldo is computed from this same result set (no extra queries needed,
      // since pagado rows contribute 0 to the balance anyway).
      const { data, error } = await supabase
        .from('pagos')
        .select(`
          id, transaccion_id, fecha_vencimiento, numero_cuota,
          monto_cuota, monto_pagado, intereses_mora,
          fecha_reprogramacion, motivo_reprogramacion,
          transaccion:transacciones(
            id, cliente_id, monto_total, monto_cuota,
            numero_factura, tipo_transaccion, fecha_inicio,
            cliente:clientes(id, nombre, apellido, email, telefono),
            producto:productos(nombre)
          )
        `)
        .in('estado', ['pendiente', 'parcial', 'reprogramado'])
        .order('fecha_vencimiento', { ascending: true })
        .limit(1000)

      if (error) { console.error('Error cargando notificaciones:', error); return }
      if (!data || data.length === 0) { setNotificacionesDetalladas([]); return }

      // Normalise Supabase join (can return array or object)
      const pagosNormalizados = (data as any[])
        .filter(p => {
          const t = Array.isArray(p.transaccion) ? p.transaccion[0] : p.transaccion
          const c = Array.isArray(t?.cliente) ? t.cliente[0] : t?.cliente
          return t && c
        })
        .map(p => {
          const t = Array.isArray(p.transaccion) ? p.transaccion[0] : p.transaccion
          return {
            ...p,
            transaccion: {
              ...t,
              cliente:  Array.isArray(t.cliente)  ? t.cliente[0]  : t.cliente,
              producto: Array.isArray(t.producto) ? t.producto[0] : t.producto,
            },
          }
        })

      // Compute saldo per transaction from already-fetched pending pagos.
      // Pagados contribute 0 to balance so we don't need a second query round.
      const saldosPorTransaccion = new Map<string, number>()
      pagosNormalizados.forEach((p: any) => {
        const tid = p.transaccion.id
        const monto = obtenerMontoCuota(p)
        const restante = Math.max(0, monto - (p.monto_pagado ?? 0))
        saldosPorTransaccion.set(tid, (saldosPorTransaccion.get(tid) ?? 0) + restante)
      })

      // 5) Mapear a NotificacionVencimiento
      const notificacionesMapeadas: NotificacionVencimiento[] = pagosNormalizados.map((pago: any) => {
        const dias = calcularDiasVencimiento(pago.fecha_vencimiento)
        const tipo: NotificacionVencimiento['tipo'] =
          dias < 0 ? 'vencido' : dias === 0 ? 'hoy' : 'por_vencer'
        const montoCuota = obtenerMontoCuota(pago)
        const montoRestante = Math.max(0, montoCuota - (pago.monto_pagado ?? 0))
        const transaccion = pago.transaccion
        const cliente = transaccion.cliente

        return {
          id: pago.id,
          cliente_id: transaccion.cliente_id,
          cliente_nombre: cliente.nombre,
          cliente_apellido: cliente.apellido ?? '',
          cliente_telefono: cliente.telefono ?? '',
          cliente_email: cliente.email ?? '',
          monto: montoRestante,
          monto_cuota_total: montoCuota,
          monto_pagado: pago.monto_pagado ?? 0,
          fecha_vencimiento: pago.fecha_vencimiento,
          dias_vencimiento: dias,
          tipo,
          numero_cuota: pago.numero_cuota,
          producto_nombre: obtenerNombreTransaccion(transaccion),
          transaccion_id: transaccion.id,
          saldo_total_cliente: saldosPorTransaccion.get(transaccion.id) ?? 0,
          tipo_transaccion: transaccion.tipo_transaccion,
          fecha_inicio: transaccion.fecha_inicio,
          fecha_reprogramacion: pago.fecha_reprogramacion ?? undefined,
          intereses_mora: pago.intereses_mora ?? undefined,
          motivo_reprogramacion: pago.motivo_reprogramacion ?? undefined,
        }
      })

      setNotificacionesDetalladas(notificacionesMapeadas)
    } catch (err) {
      console.error('Error inesperado en cargarNotificacionesDetalladas:', err)
    } finally {
      setLoading(false)
    }
  }, [])

  // ─── Carga inicial ────────────────────────────────────────────────────────────
  useEffect(() => {
    cargarNotificacionesDetalladas()
  }, [cargarNotificacionesDetalladas])

  // ─── Helpers de calendario ────────────────────────────────────────────────────
  const contarVencimientosPorFecha = (fecha: Date): number =>
    notificacionesDetalladas.filter(n => n.fecha_vencimiento === fechaAStr(fecha)).length

  const obtenerNotificacionesPorFecha = (fecha: Date): NotificacionVencimiento[] =>
    notificacionesDetalladas.filter(n => n.fecha_vencimiento === fechaAStr(fecha))

  const generarDiasCalendario = (): (Date | null)[] => {
    const año = mesActual.getFullYear()
    const mes = mesActual.getMonth()
    const primerDiaSemana = new Date(año, mes, 1).getDay()
    const diasEnMes = new Date(año, mes + 1, 0).getDate()
    const dias: (Date | null)[] = Array(primerDiaSemana).fill(null)
    for (let i = 1; i <= diasEnMes; i++) dias.push(new Date(año, mes, i))
    return dias
  }

  const cambiarMes = (dir: 'anterior' | 'siguiente') => {
    setMesActual(prev => {
      const d = new Date(prev)
      d.setMonth(prev.getMonth() + (dir === 'anterior' ? -1 : 1))
      return d
    })
    setFechaSeleccionada(null)
  }

  const esHoy = (fecha: Date | null): boolean => {
    if (!fecha) return false
    const hoy = new Date()
    return fecha.getDate() === hoy.getDate() &&
      fecha.getMonth() === hoy.getMonth() &&
      fecha.getFullYear() === hoy.getFullYear()
  }

  const esFechaSeleccionada = (fecha: Date | null): boolean => {
    if (!fecha || !fechaSeleccionada) return false
    return fechaAStr(fecha) === fechaAStr(fechaSeleccionada)
  }

  // ─── Acciones de contacto ─────────────────────────────────────────────────────
  const enviarRecordatorio = (notif: NotificacionVencimiento, metodo: 'whatsapp' | 'email') => {
    if (metodo === 'whatsapp' && notif.cliente_telefono) {
      const phone = notif.cliente_telefono.replace(/[^\d]/g, '')
      window.open(`https://wa.me/${phone}`, '_blank')
    } else if (metodo === 'email' && notif.cliente_email) {
      window.location.href = `mailto:${notif.cliente_email}`
    }
  }

  // ─── Modal pago ───────────────────────────────────────────────────────────────
  const abrirModalPago = (notif: NotificacionVencimiento) => {
    setNotifSeleccionada(notif)
    setMontoPago(notif.monto.toFixed(2))
    setFechaPago(new Date().toISOString().split('T')[0])
    setMetodoPago('efectivo')
    setObservaciones('')
    setMostrarModalPago(true)
  }

  const cerrarModalPago = () => {
    setMostrarModalPago(false)
    setNotifSeleccionada(null)
  }

  const registrarPago = async () => {
    if (!notifSeleccionada) return
    setLoading(true)
    try {
      const montoNum = parseFloat(montoPago)
      if (isNaN(montoNum) || montoNum <= 0) { alert('Ingrese un monto válido'); return }

      const montoCuota = notifSeleccionada.monto_cuota_total
      const pagadoActual = notifSeleccionada.monto_pagado
      const restante = montoCuota - pagadoActual
      const nuevoMontoPagado = montoNum >= restante ? montoCuota : pagadoActual + montoNum
      const nuevoEstado = montoNum >= restante ? 'pagado' : 'parcial'

      const { error } = await supabase
        .from('pagos')
        .update({
          estado: nuevoEstado,
          monto_pagado: nuevoMontoPagado,
          fecha_pago: fechaPago,
          metodo_pago: metodoPago,
          observaciones: observaciones || null,
          numero_recibo: `REC-${Date.now()}`,
        })
        .eq('id', notifSeleccionada.id)

      if (error) throw error

      cerrarModalPago()
      await cargarNotificacionesDetalladas()
      onActualizar()
      alert('Pago registrado correctamente')
    } catch (err) {
      console.error('Error registrando pago:', err)
      alert('Error al registrar el pago')
    } finally {
      setLoading(false)
    }
  }

  // ─── Modal reprogramación ─────────────────────────────────────────────────────
  const abrirModalReprogramacion = (notif: NotificacionVencimiento) => {
    setNotifReprogramar(notif)
    setInteresesMora(
      notif.dias_vencimiento < 0
        ? calcularInteresesSugeridos(notif.dias_vencimiento, notif.monto_cuota_total)
        : 0
    )
    setNuevaFechaVencimiento('')
    setMotivoReprogramacion('')
    setMostrarModalReprogramacion(true)
  }

  const cerrarModalReprogramacion = () => {
    setMostrarModalReprogramacion(false)
    setNotifReprogramar(null)
    setNuevaFechaVencimiento('')
    setInteresesMora(0)
    setMotivoReprogramacion('')
  }

  const reprogramarPago = async () => {
    if (!notifReprogramar || !nuevaFechaVencimiento) {
      alert('Complete todos los campos requeridos')
      return
    }
    setLoading(true)
    try {
      const { error } = await supabase
        .from('pagos')
        .update({
          fecha_vencimiento: nuevaFechaVencimiento,
          monto_cuota: notifReprogramar.monto_cuota_total + interesesMora,
          intereses_mora: interesesMora,
          fecha_reprogramacion: new Date().toISOString().split('T')[0],
          motivo_reprogramacion: motivoReprogramacion || null,
          estado: 'reprogramado',
        })
        .eq('id', notifReprogramar.id)

      if (error) throw error

      cerrarModalReprogramacion()
      await cargarNotificacionesDetalladas()
      onActualizar()
      alert('✅ Pago reprogramado exitosamente')
    } catch (err: any) {
      alert('Error al reprogramar el pago: ' + err.message)
    } finally {
      setLoading(false)
    }
  }

  // ─── Datos derivados ──────────────────────────────────────────────────────────
  const notificacionesFiltradas = (() => {
    if (filtroTipo === 'calendario' && fechaSeleccionada)
      return obtenerNotificacionesPorFecha(fechaSeleccionada)
    if (filtroTipo === 'todos') return notificacionesDetalladas
    return notificacionesDetalladas.filter(n => n.tipo === filtroTipo)
  })()

  const estadisticas = {
    vencidos: notificacionesDetalladas.filter(n => n.tipo === 'vencido').length,
    hoy: notificacionesDetalladas.filter(n => n.tipo === 'hoy').length,
    montoTotal: notificacionesDetalladas.reduce((s, n) => s + n.monto, 0),
  }

  const obtenerTextoVencimiento = (notif: NotificacionVencimiento): string => {
    if (notif.tipo === 'vencido') return `Vencido hace ${Math.abs(notif.dias_vencimiento)} días`
    if (notif.tipo === 'hoy') return 'Vence hoy'
    return `Vence en ${notif.dias_vencimiento} días`
  }

  const obtenerIconoTipo = (tipo: string) => {
    if (tipo === 'vencido') return <AlertTriangle className="w-5 h-5 text-red-500" />
    if (tipo === 'hoy') return <Clock className="w-5 h-5 text-orange-500" />
    if (tipo === 'por_vencer') return <Calendar className="w-5 h-5 text-blue-500" />
    return <Bell className="w-5 h-5 text-gray-500" />
  }

  const obtenerColorFondo = (tipo: string): string => {
    if (tipo === 'vencido') return 'bg-red-50 border-red-200'
    if (tipo === 'hoy') return 'bg-orange-50 border-orange-200'
    if (tipo === 'por_vencer') return 'bg-blue-50 border-blue-200'
    return 'bg-gray-50 border-gray-200'
  }

  const nombresMeses = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre']
  const diasSemana = ['Dom','Lun','Mar','Mié','Jue','Vie','Sáb']

  // ─── Render ───────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-4 md:space-y-6 p-2 md:p-0">

      {/* ── Header + estadísticas ── */}
      <div className="bg-white rounded-lg shadow-sm border p-4 md:p-6">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
          <h2 className="text-lg md:text-xl font-semibold text-gray-900 flex items-center">
            <Bell className="w-5 h-5 md:w-6 md:h-6 mr-2" />
            Centro de Notificaciones
          </h2>
          <button
            onClick={async () => {
              await cargarNotificacionesDetalladas()
              onActualizar()
            }}
            disabled={loading}
            className="w-full sm:w-auto px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center space-x-2 text-sm md:text-base"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            <span>{loading ? 'Actualizando...' : 'Actualizar'}</span>
          </button>
        </div>

        {/* Tarjetas de estadísticas */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4 mb-6">
          <div className="bg-red-50 rounded-lg p-3 md:p-4 border border-red-200">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-xs md:text-sm text-red-600 font-medium">Pagos Vencidos</div>
                <div className="text-xl md:text-2xl font-bold text-red-700">{estadisticas.vencidos}</div>
              </div>
              <AlertTriangle className="w-6 h-6 md:w-8 md:h-8 text-red-500" />
            </div>
          </div>

          <div className="bg-orange-50 rounded-lg p-3 md:p-4 border border-orange-200">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-xs md:text-sm text-orange-600 font-medium">Vencen Hoy</div>
                <div className="text-xl md:text-2xl font-bold text-orange-700">{estadisticas.hoy}</div>
              </div>
              <Clock className="w-6 h-6 md:w-8 md:h-8 text-orange-500" />
            </div>
          </div>

          <div className="bg-purple-50 rounded-lg p-3 md:p-4 border border-purple-200">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-xs md:text-sm text-purple-600 font-medium">Ver Calendario</div>
                <div className="text-xs md:text-sm text-purple-700">Seleccionar fecha</div>
              </div>
              <Calendar className="w-6 h-6 md:w-8 md:h-8 text-purple-500" />
            </div>
          </div>

          <div className="bg-gray-50 rounded-lg p-3 md:p-4 border border-gray-200">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-xs md:text-sm text-gray-600 font-medium">Monto Total</div>
                <div className="text-sm md:text-lg font-bold text-gray-700 break-all">
                  {formatearMoneda(estadisticas.montoTotal)}
                </div>
              </div>
              <DollarSign className="w-6 h-6 md:w-8 md:h-8 text-gray-500" />
            </div>
          </div>
        </div>

        {/* Filtros */}
        <div className="flex flex-wrap gap-2">
          {[
            { key: 'todos',      label: 'Todos',         count: notificacionesDetalladas.length },
            { key: 'vencido',    label: 'Vencidos',      count: estadisticas.vencidos },
            { key: 'hoy',        label: 'Hoy',           count: estadisticas.hoy },
            { key: 'calendario', label: '📅 Calendario', count: null },
          ].map(f => (
            <button
              key={f.key}
              onClick={() => { setFiltroTipo(f.key as any); if (f.key === 'calendario') setFechaSeleccionada(null) }}
              className={`px-3 md:px-4 py-2 rounded-lg text-xs md:text-sm font-medium transition-colors ${
                filtroTipo === f.key ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              {f.label} {f.count !== null && `(${f.count})`}
            </button>
          ))}
        </div>
      </div>

      {/* ── Calendario ── */}
      {filtroTipo === 'calendario' && (
        <div className="bg-white rounded-lg shadow-sm border p-4 md:p-6">
          {/* Navegación mes */}
          <div className="flex items-center justify-between mb-4">
            <button onClick={() => cambiarMes('anterior')} className="p-2 hover:bg-gray-100 rounded-full transition-colors">
              <ChevronLeft className="w-4 h-4 md:w-5 md:h-5" />
            </button>
            <h3 className="text-base md:text-lg font-semibold">
              {nombresMeses[mesActual.getMonth()]} {mesActual.getFullYear()}
            </h3>
            <button onClick={() => cambiarMes('siguiente')} className="p-2 hover:bg-gray-100 rounded-full transition-colors">
              <ChevronRight className="w-4 h-4 md:w-5 md:h-5" />
            </button>
          </div>

          {/* Días semana */}
          <div className="grid grid-cols-7 gap-1 md:gap-2 mb-2">
            {diasSemana.map(d => (
              <div key={d} className="text-center text-xs md:text-sm font-medium text-gray-600 py-1 md:py-2">{d}</div>
            ))}
          </div>

          {/* Días mes */}
          <div className="grid grid-cols-7 gap-1 md:gap-2">
            {generarDiasCalendario().map((dia, idx) => {
              if (!dia) return <div key={`e-${idx}`} className="h-14 md:h-20" />

              const count = contarVencimientosPorFecha(dia)
              const seleccionado = esFechaSeleccionada(dia)
              const hoy = esHoy(dia)

              return (
                <button
                  key={idx}
                  onClick={() => setFechaSeleccionada(dia)}
                  className={`h-14 md:h-20 p-1 md:p-2 rounded-lg border transition-all relative ${
                    seleccionado ? 'bg-blue-100 border-blue-500'
                    : hoy        ? 'bg-yellow-50 border-yellow-400'
                    : count > 0  ? 'bg-red-50 border-red-200 hover:bg-red-100'
                                 : 'bg-white border-gray-200 hover:bg-gray-50'
                  }`}
                >
                  <div className="text-xs md:text-sm font-medium">{dia.getDate()}</div>
                  {count > 0 && (
                    <div className="mt-0.5 md:mt-1">
                      <span className="inline-block px-1 md:px-2 py-0.5 text-[10px] md:text-xs bg-red-500 text-white rounded-full">
                        {count}
                      </span>
                    </div>
                  )}
                  {hoy && (
                    <div className="absolute bottom-0.5 right-0.5 text-[10px] text-yellow-600 font-medium">Hoy</div>
                  )}
                </button>
              )
            })}
          </div>



          {/* Leyenda */}
          <div className="mt-4 flex flex-col sm:flex-row items-start sm:items-center justify-center gap-3 sm:gap-6 text-xs md:text-sm">
            {[
              { bg: 'bg-yellow-50 border-yellow-400', label: 'Hoy' },
              { bg: 'bg-red-50 border-red-200',      label: 'Con vencimientos' },
              { bg: 'bg-blue-100 border-blue-500',   label: 'Seleccionado' },
            ].map(l => (
              <div key={l.label} className="flex items-center space-x-2">
                <div className={`w-3 h-3 md:w-4 md:h-4 ${l.bg} border rounded`} />
                <span>{l.label}</span>
              </div>
            ))}
          </div>

          {/* Info fecha seleccionada */}
          {fechaSeleccionada && (
            <div className="mt-4 p-3 md:p-4 bg-gray-50 rounded-lg">
              <p className="text-xs md:text-sm text-gray-600 mb-1">Fecha seleccionada:</p>
              <p className="text-sm md:text-base font-semibold">
                {fechaSeleccionada.toLocaleDateString('es-AR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
              </p>
              <p className="text-xs md:text-sm text-gray-600 mt-2">
                {notificacionesFiltradas.length > 0
                  ? `${notificacionesFiltradas.length} vencimiento(s) en esta fecha`
                  : 'No hay vencimientos en esta fecha'}
              </p>
            </div>
          )}
        </div>
      )}

      {/* ── Lista de notificaciones ── */}
      <div className="space-y-3 md:space-y-4">
        {loading ? (
          <div className="flex items-center justify-center py-8 bg-white rounded-lg shadow-sm border">
            <div className="animate-spin rounded-full h-6 w-6 md:h-8 md:w-8 border-b-2 border-blue-600" />
            <span className="ml-2 text-sm md:text-base text-gray-600">Cargando notificaciones...</span>
          </div>
        ) : notificacionesFiltradas.length > 0 ? (
          notificacionesFiltradas.map(notif => (
            <div key={notif.id} className={`bg-white rounded-lg shadow-sm border p-3 md:p-4 ${obtenerColorFondo(notif.tipo)}`}>
              <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 lg:gap-4">

                {/* Info principal */}
                <div className="flex items-start space-x-3 md:space-x-4 flex-1 min-w-0">
                  <div className="flex-shrink-0 mt-1">{obtenerIconoTipo(notif.tipo)}</div>
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-1 md:gap-2 mb-1">
                      <h3 className="font-semibold text-sm md:text-base text-gray-900">
                        {notif.cliente_nombre} {notif.cliente_apellido}
                      </h3>
                      <span className="hidden sm:inline text-gray-400">•</span>
                      <span className="text-xs md:text-sm text-gray-600 break-words">{notif.producto_nombre}</span>
                      <span className="hidden sm:inline text-gray-400">•</span>
                      <span className="text-xs md:text-sm text-gray-600">Cuota {notif.numero_cuota}</span>
                    </div>

                    <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4 mt-1">
                      <div>
                        <span className="text-xs md:text-sm text-gray-500">Esta cuota: </span>
                        <span className="text-base md:text-lg font-bold text-gray-900">{formatearMoneda(notif.monto)}</span>
                        {notif.monto_pagado > 0 && (
                          <span className="block sm:inline text-[10px] md:text-xs text-green-600 sm:ml-2">
                            (Pagado: {formatearMoneda(notif.monto_pagado)})
                          </span>
                        )}
                      </div>
                      <span className="hidden sm:inline text-gray-300">|</span>
                      <div>
                        <span className="text-xs md:text-sm text-gray-500">Saldo deuda: </span>
                        <span className="text-base md:text-lg font-bold text-red-600">{formatearMoneda(notif.saldo_total_cliente)}</span>
                      </div>
                    </div>

                    <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-4 mt-1">
                      <span className="text-xs md:text-sm text-gray-600">
                        Vencimiento: {formatearFecha(notif.fecha_vencimiento)}
                      </span>
                      <span className={`text-xs md:text-sm font-medium ${
                        notif.tipo === 'vencido' ? 'text-red-600'
                        : notif.tipo === 'hoy'   ? 'text-orange-600'
                                                 : 'text-blue-600'
                      }`}>
                        {obtenerTextoVencimiento(notif)}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Acciones */}
                <div className="flex flex-wrap lg:flex-nowrap items-center gap-2 lg:flex-shrink-0">
                  <button onClick={() => abrirModalPago(notif)}
                    className="flex-1 sm:flex-none px-3 md:px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 transition-colors flex items-center justify-center space-x-1 md:space-x-2 text-xs md:text-sm">
                    <DollarSign className="w-3 h-3 md:w-4 md:h-4" />
                    <span className="whitespace-nowrap">Registrar Pago</span>
                  </button>

                  <button onClick={() => abrirModalReprogramacion(notif)}
                    className="flex-1 sm:flex-none px-3 md:px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 transition-colors flex items-center justify-center space-x-1 md:space-x-2 text-xs md:text-sm">
                    <RefreshCw className="w-3 h-3 md:w-4 md:h-4" />
                    <span className="whitespace-nowrap">Reprogramar</span>
                  </button>

                  {onVerCuentaCliente && (
                    <button onClick={() => onVerCuentaCliente(notif.cliente_id)}
                      className="flex-1 sm:flex-none px-2 md:px-3 py-2 bg-purple-600 text-white rounded-md hover:bg-purple-700 transition-colors text-xs md:text-sm font-medium whitespace-nowrap">
                      Ver Cuenta
                    </button>
                  )}

                  <div className="flex items-center gap-2">
                    {notif.cliente_telefono && (
                      <button onClick={() => enviarRecordatorio(notif, 'whatsapp')}
                        className="p-2 text-green-600 hover:bg-green-100 rounded-full transition-colors" title="WhatsApp">
                        <Phone className="w-3 h-3 md:w-4 md:h-4" />
                      </button>
                    )}
                    {notif.cliente_email && (
                      <button onClick={() => enviarRecordatorio(notif, 'email')}
                        className="p-2 text-blue-600 hover:bg-blue-100 rounded-full transition-colors" title="Email">
                        <Mail className="w-3 h-3 md:w-4 md:h-4" />
                      </button>
                    )}
                    <button
                      onClick={() => setMostrarContacto(mostrarContacto === notif.id ? null : notif.id)}
                      className="px-2 md:px-3 py-1 text-xs md:text-sm bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors whitespace-nowrap">
                      {mostrarContacto === notif.id ? 'Ocultar' : 'Más Info'}
                    </button>
                  </div>
                </div>
              </div>

              {/* Panel "Más Info" */}
              {mostrarContacto === notif.id && (
                <div className="mt-4 p-3 md:p-4 bg-white rounded-lg border-2 border-blue-200">
                  <h4 className="font-medium text-sm md:text-base text-gray-900 mb-3">Información de Contacto y Transacción</h4>

                  {/* Fecha inicio */}
                  <div className="mb-4 p-3 bg-blue-50 rounded-lg border border-blue-200">
                    <div className="flex items-center space-x-2">
                      <Calendar className="w-4 h-4 text-blue-600 flex-shrink-0" />
                      <span className="text-xs md:text-sm font-medium text-blue-900">Fecha de Inicio:</span>
                      <span className="text-xs md:text-sm font-bold text-blue-800">{formatearFecha(notif.fecha_inicio)}</span>
                    </div>
                    <p className="text-[10px] md:text-xs text-blue-600 mt-1 ml-6">
                      {notif.tipo_transaccion === 'prestamo' ? 'Este préstamo' : 'Esta venta'} comenzó el {formatearFecha(notif.fecha_inicio)}
                    </p>
                  </div>

                  {/* Reprogramación */}
                  {notif.fecha_reprogramacion && (
                    <div className="mb-4 p-3 bg-orange-50 rounded-lg border border-orange-200">
                      <div className="flex items-center space-x-2 mb-2">
                        <RefreshCw className="w-4 h-4 text-orange-600 flex-shrink-0" />
                        <span className="text-xs md:text-sm font-medium text-orange-900">Pago Reprogramado</span>
                      </div>
                      <div className="space-y-1 text-xs md:text-sm">
                        <p className="text-gray-700">
                          <span className="font-medium">Reprogramado el:</span> {formatearFecha(notif.fecha_reprogramacion)}
                        </p>
                        {notif.intereses_mora && notif.intereses_mora > 0 && (
                          <p className="text-gray-700">
                            <span className="font-medium">Intereses mora:</span> {formatearMoneda(notif.intereses_mora)}
                          </p>
                        )}
                        {notif.motivo_reprogramacion && (
                          <div className="mt-2 p-2 bg-white rounded border border-orange-200">
                            <p className="font-medium text-orange-800 text-[10px] md:text-xs mb-1">Motivo:</p>
                            <p className="text-gray-700 text-[10px] md:text-xs break-words">{notif.motivo_reprogramacion}</p>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Contacto */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 md:gap-4 mb-4">
                    {notif.cliente_telefono && (
                      <div className="flex flex-wrap items-center gap-2">
                        <Phone className="w-3 h-3 md:w-4 md:h-4 text-gray-400 flex-shrink-0" />
                        <span className="text-xs md:text-sm text-gray-600">Tel:</span>
                        <span className="text-xs md:text-sm font-medium break-all">{notif.cliente_telefono}</span>
                        <button onClick={() => enviarRecordatorio(notif, 'whatsapp')}
                          className="px-2 py-1 text-[10px] md:text-xs bg-green-600 text-white rounded hover:bg-green-700 whitespace-nowrap">
                          WhatsApp
                        </button>
                      </div>
                    )}
                    {notif.cliente_email && (
                      <div className="flex flex-wrap items-center gap-2">
                        <Mail className="w-3 h-3 md:w-4 md:h-4 text-gray-400 flex-shrink-0" />
                        <span className="text-xs md:text-sm text-gray-600">Email:</span>
                        <span className="text-xs md:text-sm font-medium break-all">{notif.cliente_email}</span>
                        <button onClick={() => enviarRecordatorio(notif, 'email')}
                          className="px-2 py-1 text-[10px] md:text-xs bg-blue-600 text-white rounded hover:bg-blue-700 whitespace-nowrap">
                          Enviar
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Resumen deuda */}
                  <div className="p-3 bg-gray-50 rounded">
                    <div className="text-xs md:text-sm font-medium text-gray-700 mb-2">Resumen de Deuda:</div>
                    <div className="grid grid-cols-2 gap-2 text-xs md:text-sm">
                      {[
                        { label: 'Cuota total',    value: formatearMoneda(notif.monto_cuota_total), color: '' },
                        { label: 'Pagado',          value: formatearMoneda(notif.monto_pagado),      color: 'text-green-600' },
                        { label: 'Resta esta cuota',value: formatearMoneda(notif.monto),             color: 'text-orange-600' },
                        { label: 'Saldo deuda',     value: formatearMoneda(notif.saldo_total_cliente),color: 'text-red-600' },
                      ].map(item => (
                        <div key={item.label}>
                          <span className="text-gray-600">{item.label}:</span>
                          <div className={`font-semibold break-all ${item.color}`}>{item.value}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>
          ))
        ) : (
          <div className="bg-white rounded-lg shadow-sm border p-6 md:p-8 text-center">
            <Bell className="w-10 h-10 md:w-12 md:h-12 mx-auto text-gray-300 mb-4" />
            <h3 className="text-base md:text-lg font-medium text-gray-900 mb-2">No hay notificaciones</h3>
            <p className="text-sm md:text-base text-gray-600">
              {filtroTipo === 'calendario' && fechaSeleccionada
                ? `No hay vencimientos para el ${fechaSeleccionada.toLocaleDateString('es-AR', { day: 'numeric', month: 'long', year: 'numeric' })}`
                : filtroTipo === 'calendario'
                ? 'Seleccioná una fecha para ver los vencimientos'
                : filtroTipo === 'todos'
                ? 'No hay notificaciones pendientes en este momento.'
                : `No hay notificaciones de tipo "${filtroTipo}".`}
            </p>
          </div>
        )}
      </div>

      {/* ── Modal Registrar Pago ── */}
      {mostrarModalPago && notifSeleccionada && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg max-w-md w-full p-4 md:p-6 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-base md:text-lg font-semibold text-gray-900">Registrar Pago</h3>
              <button onClick={cerrarModalPago} className="text-gray-400 hover:text-gray-600 text-xl">✕</button>
            </div>

            <div className="space-y-4">
              <div className="bg-gray-50 rounded-lg p-3 md:p-4 text-sm">
                <p className="text-gray-600">Cliente:</p>
                <p className="font-medium">{notifSeleccionada.cliente_nombre} {notifSeleccionada.cliente_apellido}</p>
                <p className="text-gray-600 mt-2">Concepto:</p>
                <p className="font-medium">{notifSeleccionada.producto_nombre}</p>
                <div className="flex justify-between mt-2">
                  <div><p className="text-gray-600">Cuota:</p><p className="font-medium">{notifSeleccionada.numero_cuota}</p></div>
                  <div className="text-right"><p className="text-gray-600">Total cuota:</p><p className="font-bold">{formatearMoneda(notifSeleccionada.monto_cuota_total)}</p></div>
                </div>
                {notifSeleccionada.monto_pagado > 0 && (
                  <div className="mt-2 text-right">
                    <p className="text-gray-600">Pagado: <span className="text-green-600 font-medium">{formatearMoneda(notifSeleccionada.monto_pagado)}</span></p>
                    <p className="text-gray-600">Resta: <span className="text-red-600 font-bold">{formatearMoneda(notifSeleccionada.monto)}</span></p>
                  </div>
                )}
              </div>

              <div>
                <label className="block text-xs md:text-sm font-medium text-gray-700 mb-1">Monto a pagar</label>
                <input type="number" step="0.01" min="0.01" max={notifSeleccionada.monto}
                  value={montoPago} onChange={e => setMontoPago(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>

              <div>
                <label className="block text-xs md:text-sm font-medium text-gray-700 mb-1">Fecha de pago</label>
                <input type="date" value={fechaPago} onChange={e => setFechaPago(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>

              <div>
                <label className="block text-xs md:text-sm font-medium text-gray-700 mb-1">Método de pago</label>
                <select value={metodoPago} onChange={e => setMetodoPago(e.target.value as any)}
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500">
                  <option value="efectivo">Efectivo</option>
                  <option value="transferencia">Transferencia</option>
                  <option value="cheque">Cheque</option>
                  <option value="tarjeta">Tarjeta</option>
                </select>
              </div>

              <div>
                <label className="block text-xs md:text-sm font-medium text-gray-700 mb-1">Observaciones (opcional)</label>
                <textarea value={observaciones} onChange={e => setObservaciones(e.target.value)} rows={3}
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                  placeholder="Observaciones adicionales..." />
              </div>
            </div>

            <div className="flex flex-col sm:flex-row gap-3 mt-6">
              <button onClick={cerrarModalPago}
                className="flex-1 px-4 py-2 text-sm border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50 transition-colors">
                Cancelar
              </button>
              <button onClick={registrarPago} disabled={loading || !montoPago || parseFloat(montoPago) <= 0}
                className="flex-1 px-4 py-2 text-sm bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors disabled:bg-gray-400 disabled:cursor-not-allowed flex items-center justify-center space-x-2">
                {loading
                  ? <><div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" /><span>Procesando...</span></>
                  : <><Check className="w-4 h-4" /><span>Confirmar Pago</span></>}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Modal Reprogramación ── */}
      {mostrarModalReprogramacion && notifReprogramar && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg max-w-md w-full p-4 md:p-6 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-base md:text-lg font-semibold text-gray-900 flex items-center">
                <RefreshCw className="w-4 h-4 md:w-5 md:h-5 mr-2" /> Reprogramar Pago
              </h3>
              <button onClick={cerrarModalReprogramacion} className="text-gray-400 hover:text-gray-600 text-xl">✕</button>
            </div>

            <div className="space-y-4">
              <div className="bg-gray-50 rounded-lg p-3 md:p-4 text-sm">
                <p className="text-gray-600">Cliente:</p>
                <p className="font-medium">{notifReprogramar.cliente_nombre} {notifReprogramar.cliente_apellido}</p>
                <p className="text-gray-600 mt-2">Concepto:</p>
                <p className="font-medium">{notifReprogramar.producto_nombre}</p>
                <p className="text-gray-600 mt-2">Cuota: <span className="font-medium">#{notifReprogramar.numero_cuota}</span></p>
                <p className="text-gray-600 mt-1">Vencimiento original: <span className="font-medium">{formatearFecha(notifReprogramar.fecha_vencimiento)}</span></p>
                {notifReprogramar.dias_vencimiento < 0 && (
                  <p className="text-red-600 mt-1 text-xs">Vencido hace {Math.abs(notifReprogramar.dias_vencimiento)} días</p>
                )}
              </div>

              <div>
                <label className="block text-xs md:text-sm font-medium text-gray-700 mb-1">Nueva fecha de vencimiento *</label>
                <input type="date" value={nuevaFechaVencimiento} onChange={e => setNuevaFechaVencimiento(e.target.value)}
                  min={new Date().toISOString().split('T')[0]}
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>

              <div>
                <label className="block text-xs md:text-sm font-medium text-gray-700 mb-1">Intereses por mora ($)</label>
                <input type="number" step="0.01" min="0" value={interesesMora}
                  onChange={e => setInteresesMora(parseFloat(e.target.value) || 0)}
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500" />
                <div className="mt-2 p-3 bg-gray-50 rounded text-xs md:text-sm space-y-1">
                  <p className="flex justify-between"><span className="text-gray-600">Monto original:</span><span className="font-medium">{formatearMoneda(notifReprogramar.monto_cuota_total)}</span></p>
                  <p className="flex justify-between"><span className="text-gray-600">Intereses mora:</span><span className="font-medium">{formatearMoneda(interesesMora)}</span></p>
                  <p className="flex justify-between border-t pt-1"><span className="text-gray-600 font-semibold">Total nuevo:</span><span className="font-bold">{formatearMoneda(notifReprogramar.monto_cuota_total + interesesMora)}</span></p>
                </div>
              </div>

              <div>
                <label className="block text-xs md:text-sm font-medium text-gray-700 mb-1">Motivo (opcional)</label>
                <textarea value={motivoReprogramacion} onChange={e => setMotivoReprogramacion(e.target.value)} rows={3}
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                  placeholder="Ej: Problemas económicos temporales, enfermedad, etc." />
              </div>
            </div>

            <div className="flex flex-col sm:flex-row gap-3 mt-6">
              <button onClick={cerrarModalReprogramacion} disabled={loading}
                className="flex-1 px-4 py-2 text-sm border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50 transition-colors disabled:opacity-50">
                Cancelar
              </button>
              <button onClick={reprogramarPago} disabled={!nuevaFechaVencimiento || loading}
                className="flex-1 px-4 py-2 text-sm bg-blue-500 text-white rounded-md hover:bg-blue-600 transition-colors disabled:bg-gray-400 disabled:cursor-not-allowed flex items-center justify-center space-x-2">
                {loading
                  ? <><div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" /><span>Procesando...</span></>
                  : <><Check className="w-4 h-4" /><span>Confirmar Reprogramación</span></>}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}