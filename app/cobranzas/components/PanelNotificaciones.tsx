import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/app/lib/supabase'
import { sincronizarEstadoTransaccion } from '@/app/lib/estadoTransaccion'
import { hoyISO } from '@/app/lib/fechas'
import {
  Bell, AlertTriangle, Calendar, Clock, Phone, Mail,
  DollarSign, Check, ChevronLeft, ChevronRight, RefreshCw, X
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
  transaccion_descripcion?: string
}

interface NotaDescripcion {
  origen: 'venta' | 'pago' | 'reprogramacion'
  texto: string
  numero_cuota?: number
  fecha?: string
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
  return new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', minimumFractionDigits: 2 }).format(monto)
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
  const [notasPorTransaccion, setNotasPorTransaccion] = useState<Record<string, NotaDescripcion[]>>({})
  const [cargandoNotas, setCargandoNotas] = useState<string | null>(null)
  const [filtroTipo, setFiltroTipo] = useState<'todos' | 'vencido' | 'hoy' | 'calendario'>('todos')

  // — Calendario —
  const [fechaSeleccionada, setFechaSeleccionada] = useState<Date | null>(null)

  // Cuántas tarjetas se muestran (renderizar miles juntas traba el celular)
  const POR_TANDA = 50
  const [cantidadVisible, setCantidadVisible] = useState(POR_TANDA)
  useEffect(() => { setCantidadVisible(POR_TANDA) }, [filtroTipo, fechaSeleccionada])
  const [mesActual, setMesActual] = useState(new Date())

  // — Modal pago —
  const [mostrarModalPago, setMostrarModalPago] = useState(false)
  const [notifSeleccionada, setNotifSeleccionada] = useState<NotificacionVencimiento | null>(null)
  const [montoPago, setMontoPago] = useState('')
  const [fechaPago, setFechaPago] = useState(hoyISO())
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
      // Paginate all pending/partial/reprogrammed pagos with their joins.
      // No second round of queries needed: saldo is computed from this result set
      // since pagados contribute 0 to the balance.
      const PAGE_SIZE = 1000
      let allData: any[] = []
      let from = 0

      while (true) {
        const { data: page, error } = await supabase
          .from('pagos')
          .select(`
            id, transaccion_id, fecha_vencimiento, numero_cuota,
            monto_cuota, monto_pagado, intereses_mora,
            fecha_reprogramacion, motivo_reprogramacion,
            transaccion:transacciones(
              id, cliente_id, monto_total, monto_cuota,
              numero_factura, tipo_transaccion, fecha_inicio, descripcion,
              cliente:clientes(id, nombre, apellido, email, telefono),
              producto:productos(nombre)
            )
          `)
          .in('estado', ['pendiente', 'parcial', 'reprogramado'])
          .order('fecha_vencimiento', { ascending: true })
          .range(from, from + PAGE_SIZE - 1)

        if (error) { console.error('Error cargando notificaciones:', error); return }
        if (!page || page.length === 0) break
        allData = allData.concat(page)
        if (page.length < PAGE_SIZE) break
        from += PAGE_SIZE
      }

      const data = allData
      if (data.length === 0) { setNotificacionesDetalladas([]); return }

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
          transaccion_descripcion: transaccion.descripcion ?? undefined,
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

  // ─── Descripciones / notas de la transacción ─────────────────────────────────
  const cargarNotasTransaccion = useCallback(async (notif: NotificacionVencimiento) => {
    const tid = notif.transaccion_id
    setCargandoNotas(tid)
    try {
      const { data, error } = await supabase
        .from('pagos')
        .select('numero_cuota, observaciones, motivo_reprogramacion, fecha_pago, fecha_reprogramacion')
        .eq('transaccion_id', tid)
        .order('numero_cuota', { ascending: true })

      if (error) { console.error('Error cargando notas:', error); return }

      const notas: NotaDescripcion[] = []

      if (notif.transaccion_descripcion?.trim()) {
        notas.push({
          origen: 'venta',
          texto: notif.transaccion_descripcion.trim(),
          fecha: notif.fecha_inicio,
        })
      }

      ;(data ?? []).forEach((p: any) => {
        if (p.observaciones?.trim()) {
          notas.push({
            origen: 'pago',
            texto: p.observaciones.trim(),
            numero_cuota: p.numero_cuota ?? undefined,
            fecha: p.fecha_pago ?? undefined,
          })
        }
        if (p.motivo_reprogramacion?.trim()) {
          notas.push({
            origen: 'reprogramacion',
            texto: p.motivo_reprogramacion.trim(),
            numero_cuota: p.numero_cuota ?? undefined,
            fecha: p.fecha_reprogramacion ?? undefined,
          })
        }
      })

      setNotasPorTransaccion(prev => ({ ...prev, [tid]: notas }))
    } catch (err) {
      console.error('Error inesperado cargando notas:', err)
    } finally {
      setCargandoNotas(null)
    }
  }, [])

  const toggleMasInfo = (notif: NotificacionVencimiento) => {
    if (mostrarContacto === notif.id) {
      setMostrarContacto(null)
      return
    }
    setMostrarContacto(notif.id)
    cargarNotasTransaccion(notif)
  }

  // ─── Modal pago ───────────────────────────────────────────────────────────────
  const abrirModalPago = (notif: NotificacionVencimiento) => {
    setNotifSeleccionada(notif)
    setMontoPago(notif.monto.toFixed(2))
    setFechaPago(hoyISO())
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
      await sincronizarEstadoTransaccion(notifSeleccionada.transaccion_id)

      cerrarModalPago()
      setNotasPorTransaccion({})
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
          // El importe de la cuota no cambia: el interés va solo en intereses_mora
          // (se muestra como monto_cuota + intereses_mora). Se acumula con el anterior.
          intereses_mora: (notifReprogramar.intereses_mora || 0) + interesesMora,
          fecha_reprogramacion: hoyISO(),
          motivo_reprogramacion: motivoReprogramacion || null,
          estado: 'reprogramado',
        })
        .eq('id', notifReprogramar.id)

      if (error) throw error

      cerrarModalReprogramacion()
      setNotasPorTransaccion({})
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
    vencidos:     notificacionesDetalladas.filter(n => n.tipo === 'vencido').length,
    hoy:          notificacionesDetalladas.filter(n => n.tipo === 'hoy').length,
    porVencer:    notificacionesDetalladas.filter(n => n.tipo === 'por_vencer').length,
    montoVencido: notificacionesDetalladas.filter(n => n.tipo === 'vencido').reduce((s, n) => s + n.monto, 0),
    montoHoy:     notificacionesDetalladas.filter(n => n.tipo === 'hoy').reduce((s, n) => s + n.monto, 0),
    montoFuturo:  notificacionesDetalladas.filter(n => n.tipo === 'por_vencer').reduce((s, n) => s + n.monto, 0),
    montoTotal:   notificacionesDetalladas.reduce((s, n) => s + n.monto, 0),
  }

  const obtenerTextoVencimiento = (notif: NotificacionVencimiento): string => {
    if (notif.tipo === 'vencido') return `Vencido hace ${Math.abs(notif.dias_vencimiento)} días`
    if (notif.tipo === 'hoy') return 'Vence hoy'
    return `Vence en ${notif.dias_vencimiento} días`
  }

  const obtenerIconoTipo = (tipo: string) => {
    if (tipo === 'vencido') return <span className="icon-tile bg-danger-soft text-danger-text"><AlertTriangle className="w-5 h-5" /></span>
    if (tipo === 'hoy') return <span className="icon-tile bg-warning-soft text-warning-text"><Clock className="w-5 h-5" /></span>
    if (tipo === 'por_vencer') return <span className="icon-tile bg-warning-soft text-warning-text"><Calendar className="w-5 h-5" /></span>
    return <span className="icon-tile bg-neutral-soft text-neutral-text"><Bell className="w-5 h-5" /></span>
  }

  const obtenerColorFondo = (tipo: string): string => {
    if (tipo === 'vencido') return 'border-l-danger'
    if (tipo === 'hoy') return 'border-l-warning'
    if (tipo === 'por_vencer') return 'border-l-warning/50'
    return 'border-l-line'
  }

  const nombresMeses = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre']
  const diasSemana = ['Dom','Lun','Mar','Mié','Jue','Vie','Sáb']

  // ─── Render ───────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-4">

      {/* ── Header + estadísticas ── */}
      <div className="card card-body">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 mb-5">
          <div>
            <h2 className="section-title">
              <Bell className="w-5 h-5 text-primary" />
              Vencimientos
            </h2>
            <p className="text-xs text-muted mt-0.5">Cuotas vencidas, que vencen hoy y próximas a vencer.</p>
          </div>
          <button
            onClick={async () => {
              await cargarNotificacionesDetalladas()
              onActualizar()
            }}
            disabled={loading}
            className="btn-secondary w-full sm:w-auto"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            <span>{loading ? 'Actualizando…' : 'Actualizar'}</span>
          </button>
        </div>

        {/* Tarjetas de estadísticas */}
        <dl className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-5">
          <div className="rounded-lg p-3 md:p-4 bg-danger-soft border-l-4 border-danger">
            <dt className="text-xs font-medium text-danger-text flex items-center gap-1.5">
              <AlertTriangle className="w-4 h-4" /> Vencidas
            </dt>
            <dd className="text-2xl font-bold text-danger-text num mt-1">{estadisticas.vencidos}</dd>
            <dd className="text-xs font-medium text-danger-text num">{formatearMoneda(estadisticas.montoVencido)}</dd>
          </div>

          <div className="rounded-lg p-3 md:p-4 bg-warning-soft border-l-4 border-warning">
            <dt className="text-xs font-medium text-warning-text flex items-center gap-1.5">
              <Clock className="w-4 h-4" /> Vencen hoy
            </dt>
            <dd className="text-2xl font-bold text-warning-text num mt-1">{estadisticas.hoy}</dd>
            <dd className="text-xs font-medium text-warning-text num">{formatearMoneda(estadisticas.montoHoy)}</dd>
          </div>

          <div className="rounded-lg p-3 md:p-4 bg-surface-2 border-l-4 border-warning/50">
            <dt className="text-xs font-medium text-muted flex items-center gap-1.5">
              <Calendar className="w-4 h-4" /> Por vencer
            </dt>
            <dd className="text-2xl font-bold text-fg num mt-1">{estadisticas.porVencer}</dd>
            <dd className="text-xs font-medium text-muted num">{formatearMoneda(estadisticas.montoFuturo)}</dd>
          </div>

          <div className="rounded-lg p-3 md:p-4 bg-surface-2 border-l-4 border-primary">
            <dt className="text-xs font-medium text-muted flex items-center gap-1.5">
              <DollarSign className="w-4 h-4" /> Total a cobrar
            </dt>
            <dd className="text-lg font-bold text-fg num mt-1 truncate">{formatearMoneda(estadisticas.montoTotal)}</dd>
            <dd className="text-xs text-muted num">{notificacionesDetalladas.length} cuotas</dd>
          </div>
        </dl>

        {/* Filtros */}
        <div className="flex flex-wrap gap-2" role="group" aria-label="Filtrar vencimientos">
          {[
            { key: 'todos',      label: 'Todas',         count: notificacionesDetalladas.length },
            { key: 'vencido',    label: 'Vencidas',      count: estadisticas.vencidos },
            { key: 'hoy',        label: 'Vencen hoy',    count: estadisticas.hoy },
            { key: 'calendario', label: 'Calendario',    count: null },
          ].map(f => (
            <button
              key={f.key}
              onClick={() => { setFiltroTipo(f.key as any); if (f.key === 'calendario') setFechaSeleccionada(null) }}
              aria-pressed={filtroTipo === f.key}
              className={`min-h-[40px] px-3 md:px-4 rounded-lg border text-sm font-medium transition-colors flex items-center gap-2 ${
                filtroTipo === f.key ? 'bg-primary text-on-primary border-primary' : 'bg-surface text-fg border-line hover:bg-surface-2'
              }`}
            >
              {f.key === 'calendario' && <Calendar className="w-4 h-4" />}
              {f.label}
              {f.count !== null && (
                <span className={`min-w-[20px] text-xs px-1.5 py-0.5 rounded-full num ${filtroTipo === f.key ? 'bg-white/25' : 'bg-surface-2 text-muted'}`}>
                  {f.count}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* ── Calendario ── */}
      {filtroTipo === 'calendario' && (
        <div className="card card-body">
          {/* Navegación mes */}
          <div className="flex items-center justify-between mb-4">
            <button onClick={() => cambiarMes('anterior')} className="btn-icon" aria-label="Mes anterior">
              <ChevronLeft className="w-5 h-5" />
            </button>
            <h3 className="text-base font-semibold text-fg">
              {nombresMeses[mesActual.getMonth()]} {mesActual.getFullYear()}
            </h3>
            <button onClick={() => cambiarMes('siguiente')} className="btn-icon" aria-label="Mes siguiente">
              <ChevronRight className="w-5 h-5" />
            </button>
          </div>

          {/* Días semana */}
          <div className="grid grid-cols-7 gap-1 md:gap-2 mb-2">
            {diasSemana.map(d => (
              <div key={d} className="text-center text-xs font-semibold uppercase tracking-wide text-muted py-1">{d}</div>
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
                  aria-pressed={seleccionado}
                  className={`h-14 md:h-20 p-1 md:p-2 rounded-lg border text-left transition-colors relative ${
                    seleccionado ? 'bg-primary/10 border-primary ring-2 ring-primary/30'
                    : hoy        ? 'bg-surface border-primary/60'
                    : count > 0  ? 'bg-danger-soft/50 border-danger/30 hover:bg-danger-soft'
                                 : 'bg-surface border-line hover:bg-surface-2'
                  }`}
                >
                  <div className={`text-xs md:text-sm font-medium num ${hoy ? 'text-primary font-bold' : 'text-fg'}`}>{dia.getDate()}</div>
                  {count > 0 && (
                    <div className="mt-0.5 md:mt-1">
                      <span className="inline-block min-w-[18px] text-center px-1 md:px-1.5 py-0.5 text-[11px] md:text-xs font-semibold bg-danger text-white rounded-full num">
                        {count}
                      </span>
                    </div>
                  )}
                  {hoy && (
                    <div className="absolute bottom-0.5 right-1 text-[10px] text-primary font-semibold">Hoy</div>
                  )}
                </button>
              )
            })}
          </div>

          {/* Leyenda */}
          <div className="mt-4 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-xs text-muted">
            {[
              { bg: 'bg-surface border-primary/60',          label: 'Hoy' },
              { bg: 'bg-danger-soft/50 border-danger/30',    label: 'Con vencimientos' },
              { bg: 'bg-primary/10 border-primary',          label: 'Seleccionado' },
            ].map(l => (
              <div key={l.label} className="flex items-center gap-2">
                <div className={`w-4 h-4 ${l.bg} border rounded`} />
                <span>{l.label}</span>
              </div>
            ))}
          </div>

          {/* Info fecha seleccionada */}
          {fechaSeleccionada && (
            <div className="mt-4 p-3 md:p-4 bg-surface-2 rounded-lg">
              <p className="text-xs text-muted mb-0.5">Fecha seleccionada</p>
              <p className="text-sm font-semibold text-fg first-letter:uppercase">
                {fechaSeleccionada.toLocaleDateString('es-AR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
              </p>
              <p className="text-xs text-muted mt-1">
                {notificacionesFiltradas.length > 0
                  ? `${notificacionesFiltradas.length} cuota(s) vencen este día`
                  : 'No hay cuotas que venzan este día'}
              </p>
            </div>
          )}
        </div>
      )}

      {/* ── Lista de notificaciones ── */}
      <div className="space-y-3">
        {loading ? (
          <div className="space-y-3" role="status" aria-live="polite">
            <span className="sr-only">Cargando vencimientos…</span>
            {[0, 1, 2].map((i) => (
              <div key={i} className="card p-4 flex items-start gap-4">
                <div className="skeleton w-10 h-10" />
                <div className="flex-1 space-y-2">
                  <div className="skeleton h-4 w-1/3" />
                  <div className="skeleton h-4 w-1/2" />
                  <div className="skeleton h-3 w-1/4" />
                </div>
                <div className="skeleton h-10 w-32 hidden md:block" />
              </div>
            ))}
          </div>
        ) : notificacionesFiltradas.length > 0 ? (
          <>
          {notificacionesFiltradas.slice(0, cantidadVisible).map(notif => (
            <div key={notif.id} className={`card p-4 border-l-4 ${obtenerColorFondo(notif.tipo)}`}>
              <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">

                {/* Info principal */}
                <div className="flex items-start gap-3 md:gap-4 flex-1 min-w-0">
                  <div className="flex-shrink-0">{obtenerIconoTipo(notif.tipo)}</div>
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                      <h3 className="font-semibold text-base text-fg">
                        {notif.cliente_nombre} {notif.cliente_apellido}
                      </h3>
                      <span className={
                        notif.tipo === 'vencido' ? 'badge-danger'
                        : notif.tipo === 'hoy'   ? 'badge-warning'
                                                 : 'badge-warning'
                      }>
                        {notif.tipo === 'vencido' ? <AlertTriangle className="w-3.5 h-3.5" /> : <Clock className="w-3.5 h-3.5" />}
                        {obtenerTextoVencimiento(notif)}
                      </span>
                    </div>
                    <p className="text-sm text-muted mt-0.5 break-words">
                      {notif.producto_nombre} · Cuota {notif.numero_cuota} · <span className="num">Vence {formatearFecha(notif.fecha_vencimiento)}</span>
                    </p>

                    <dl className="flex flex-wrap gap-x-6 gap-y-1 mt-2">
                      <div>
                        <dt className="text-xs text-muted">A cobrar de esta cuota</dt>
                        <dd className="text-lg font-bold text-fg num">
                          {formatearMoneda(notif.monto)}
                          {notif.monto_pagado > 0 && (
                            <span className="ml-2 text-xs font-medium text-success-text">
                              (ya pagó {formatearMoneda(notif.monto_pagado)})
                            </span>
                          )}
                        </dd>
                      </div>
                      <div>
                        <dt className="text-xs text-muted">Saldo total de la operación</dt>
                        <dd className="text-lg font-bold text-fg num">{formatearMoneda(notif.saldo_total_cliente)}</dd>
                      </div>
                    </dl>
                  </div>
                </div>

                {/* Acciones */}
                <div className="flex flex-wrap lg:flex-nowrap items-center gap-2 lg:flex-shrink-0">
                  <button onClick={() => abrirModalPago(notif)}
                    className="btn-accent btn-sm flex-1 sm:flex-none">
                    <DollarSign className="w-4 h-4" />
                    <span className="whitespace-nowrap">Registrar pago</span>
                  </button>

                  <button onClick={() => abrirModalReprogramacion(notif)}
                    className="btn-secondary btn-sm flex-1 sm:flex-none">
                    <RefreshCw className="w-4 h-4" />
                    <span className="whitespace-nowrap">Reprogramar</span>
                  </button>

                  {onVerCuentaCliente && (
                    <button onClick={() => onVerCuentaCliente(notif.cliente_id)}
                      className="btn-secondary btn-sm flex-1 sm:flex-none whitespace-nowrap">
                      Ver cuenta
                    </button>
                  )}

                  <div className="flex items-center gap-1">
                    {notif.cliente_telefono && (
                      <button onClick={() => enviarRecordatorio(notif, 'whatsapp')}
                        className="btn-icon text-success-text" title="Enviar recordatorio por WhatsApp" aria-label="Enviar recordatorio por WhatsApp">
                        <Phone className="w-4 h-4" />
                      </button>
                    )}
                    {notif.cliente_email && (
                      <button onClick={() => enviarRecordatorio(notif, 'email')}
                        className="btn-icon" title="Enviar recordatorio por email" aria-label="Enviar recordatorio por email">
                        <Mail className="w-4 h-4" />
                      </button>
                    )}
                    <button
                      onClick={() => toggleMasInfo(notif)}
                      aria-expanded={mostrarContacto === notif.id}
                      className="btn-ghost btn-sm whitespace-nowrap">
                      {mostrarContacto === notif.id ? 'Ocultar detalle' : 'Ver detalle'}
                    </button>
                  </div>
                </div>
              </div>

              {/* Panel "Más Info" */}
              {mostrarContacto === notif.id && (
                <div className="mt-4 pt-4 border-t border-line space-y-4">
                  <h4 className="text-sm font-semibold text-fg">Detalle de la operación</h4>

                  {/* Fecha inicio */}
                  <div className="flex items-start gap-2 text-sm">
                    <Calendar className="w-4 h-4 text-muted flex-shrink-0 mt-0.5" />
                    <p className="text-muted">
                      {notif.tipo_transaccion === 'prestamo' ? 'Este préstamo' : 'Esta venta'} comenzó el{' '}
                      <span className="font-medium text-fg num">{formatearFecha(notif.fecha_inicio)}</span>
                    </p>
                  </div>

                  {/* Descripciones y notas */}
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-muted mb-2">Notas y descripciones</p>

                    {cargandoNotas === notif.transaccion_id ? (
                      <div className="space-y-2" role="status">
                        <div className="skeleton h-4 w-2/3" />
                        <div className="skeleton h-4 w-1/2" />
                      </div>
                    ) : (notasPorTransaccion[notif.transaccion_id]?.length ?? 0) === 0 ? (
                      <p className="text-sm text-muted">
                        No hay notas para esta {notif.tipo_transaccion === 'prestamo' ? 'operación' : 'venta'}.
                      </p>
                    ) : (
                      <ul className="space-y-2">
                        {notasPorTransaccion[notif.transaccion_id].map((nota, i) => {
                          const etiqueta =
                            nota.origen === 'venta' ? 'Descripción de la venta'
                            : nota.origen === 'reprogramacion' ? 'Motivo de reprogramación'
                            : 'Nota de cobro'
                          const colorEtiqueta =
                            nota.origen === 'venta' ? 'badge-primary'
                            : nota.origen === 'reprogramacion' ? 'badge-reprog'
                            : 'badge-success'
                          return (
                            <li key={i} className="p-3 rounded-lg bg-surface-2">
                              <div className="flex flex-wrap items-center gap-2 mb-1">
                                <span className={colorEtiqueta}>
                                  {etiqueta}
                                </span>
                                {nota.numero_cuota != null && (
                                  <span className="text-xs text-muted num">Cuota {nota.numero_cuota}</span>
                                )}
                                {nota.fecha && (
                                  <span className="text-xs text-muted num">· {formatearFecha(nota.fecha)}</span>
                                )}
                              </div>
                              <p className="text-sm text-fg break-words whitespace-pre-wrap">{nota.texto}</p>
                            </li>
                          )
                        })}
                      </ul>
                    )}
                  </div>

                  {/* Reprogramación */}
                  {notif.fecha_reprogramacion && (
                    <div className="p-3 rounded-lg bg-reprog-soft text-reprog-text">
                      <p className="text-sm font-semibold flex items-center gap-2 mb-1">
                        <RefreshCw className="w-4 h-4 flex-shrink-0" />
                        Cuota reprogramada
                      </p>
                      <div className="space-y-1 text-sm">
                        <p>
                          <span className="font-medium">Reprogramada el:</span> <span className="num">{formatearFecha(notif.fecha_reprogramacion)}</span>
                        </p>
                        {notif.intereses_mora && notif.intereses_mora > 0 && (
                          <p>
                            <span className="font-medium">Interés por atraso:</span> <span className="num">{formatearMoneda(notif.intereses_mora)}</span>
                          </p>
                        )}
                        {notif.motivo_reprogramacion && (
                          <p className="break-words">
                            <span className="font-medium">Motivo:</span> {notif.motivo_reprogramacion}
                          </p>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Contacto */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {notif.cliente_telefono && (
                      <div className="flex flex-wrap items-center gap-2 text-sm">
                        <Phone className="w-4 h-4 text-muted flex-shrink-0" />
                        <span className="font-medium text-fg num break-all">{notif.cliente_telefono}</span>
                        <button onClick={() => enviarRecordatorio(notif, 'whatsapp')}
                          className="btn-secondary btn-sm whitespace-nowrap">
                          Enviar recordatorio
                        </button>
                      </div>
                    )}
                    {notif.cliente_email && (
                      <div className="flex flex-wrap items-center gap-2 text-sm">
                        <Mail className="w-4 h-4 text-muted flex-shrink-0" />
                        <span className="font-medium text-fg break-all">{notif.cliente_email}</span>
                        <button onClick={() => enviarRecordatorio(notif, 'email')}
                          className="btn-secondary btn-sm whitespace-nowrap">
                          Enviar email
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Resumen deuda */}
                  <div className="p-3 rounded-lg bg-surface-2">
                    <p className="text-xs font-semibold uppercase tracking-wide text-muted mb-2">Resumen</p>
                    <dl className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
                      {[
                        { label: 'Importe de la cuota', value: formatearMoneda(notif.monto_cuota_total), color: 'text-fg' },
                        { label: 'Pagado',              value: formatearMoneda(notif.monto_pagado),      color: 'text-success-text' },
                        { label: 'Falta de esta cuota', value: formatearMoneda(notif.monto),             color: 'text-warning-text' },
                        { label: 'Saldo total',         value: formatearMoneda(notif.saldo_total_cliente),color: 'text-danger-text' },
                      ].map(item => (
                        <div key={item.label}>
                          <dt className="text-xs text-muted">{item.label}</dt>
                          <dd className={`font-semibold break-all num ${item.color}`}>{item.value}</dd>
                        </div>
                      ))}
                    </dl>
                  </div>
                </div>
              )}
            </div>
          ))}
          {notificacionesFiltradas.length > cantidadVisible && (
            <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
              <p className="text-sm text-muted num">
                Mostrando {cantidadVisible} de {notificacionesFiltradas.length} cuotas
              </p>
              <button
                onClick={() => setCantidadVisible((n) => n + POR_TANDA)}
                className="btn-secondary"
              >
                Mostrar {Math.min(POR_TANDA, notificacionesFiltradas.length - cantidadVisible)} más
              </button>
            </div>
          )}
          </>
        ) : (
          <div className="card empty-state">
            <Bell className="w-10 h-10 text-muted/50 mb-3" />
            <h3 className="text-base font-semibold text-fg mb-1">
              {filtroTipo === 'todos' ? 'Todo al día' : 'Sin vencimientos'}
            </h3>
            <p className="text-sm">
              {filtroTipo === 'calendario' && fechaSeleccionada
                ? `No hay cuotas que venzan el ${fechaSeleccionada.toLocaleDateString('es-AR', { day: 'numeric', month: 'long', year: 'numeric' })}.`
                : filtroTipo === 'calendario'
                ? 'Elegí un día del calendario para ver sus vencimientos.'
                : filtroTipo === 'todos'
                ? 'No hay cuotas pendientes de cobro en este momento.'
                : `No hay cuotas con el filtro "${filtroTipo}".`}
            </p>
          </div>
        )}
      </div>

      {/* ── Modal Registrar Pago ── */}
      {mostrarModalPago && notifSeleccionada && (
        <div className="modal-backdrop">
          <div className="modal" role="dialog" aria-modal="true" aria-labelledby="notif-titulo-pago">
            <div className="modal-header justify-between">
              <h3 id="notif-titulo-pago" className="text-base font-semibold text-fg">Registrar pago</h3>
              <button onClick={cerrarModalPago} className="btn-icon" aria-label="Cerrar"><X className="w-5 h-5" /></button>
            </div>

            <div className="modal-body">
              <dl className="rounded-lg bg-surface-2 p-4 text-sm space-y-3">
                <div>
                  <dt className="text-xs text-muted">Cliente</dt>
                  <dd className="font-medium text-fg">{notifSeleccionada.cliente_nombre} {notifSeleccionada.cliente_apellido}</dd>
                </div>
                <div>
                  <dt className="text-xs text-muted">Concepto</dt>
                  <dd className="font-medium text-fg">{notifSeleccionada.producto_nombre}</dd>
                </div>
                <div className="flex justify-between">
                  <div><dt className="text-xs text-muted">Cuota</dt><dd className="font-medium text-fg num">{notifSeleccionada.numero_cuota}</dd></div>
                  <div className="text-right"><dt className="text-xs text-muted">Importe de la cuota</dt><dd className="font-bold text-fg num">{formatearMoneda(notifSeleccionada.monto_cuota_total)}</dd></div>
                </div>
                {notifSeleccionada.monto_pagado > 0 && (
                  <div className="flex justify-between pt-3 border-t border-line">
                    <div><dt className="text-xs text-muted">Ya pagó</dt><dd className="text-success-text font-medium num">{formatearMoneda(notifSeleccionada.monto_pagado)}</dd></div>
                    <div className="text-right"><dt className="text-xs text-muted">Falta pagar</dt><dd className="text-danger-text font-bold num">{formatearMoneda(notifSeleccionada.monto)}</dd></div>
                  </div>
                )}
              </dl>

              <div>
                <label htmlFor="notif-monto" className="label">Monto recibido</label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted font-medium pointer-events-none">$</span>
                  <input id="notif-monto" type="number" step="0.01" min="0.01" max={notifSeleccionada.monto}
                    value={montoPago} onChange={e => setMontoPago(e.target.value)}
                    className="input pl-8 num" />
                </div>
                <p className="help">Si es menor a lo que falta, queda registrado como pago parcial.</p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label htmlFor="notif-fecha" className="label">Fecha del pago</label>
                  <input id="notif-fecha" type="date" value={fechaPago} onChange={e => setFechaPago(e.target.value)}
                    className="input" />
                </div>

                <div>
                  <label htmlFor="notif-metodo" className="label">Medio de pago</label>
                  <select id="notif-metodo" value={metodoPago} onChange={e => setMetodoPago(e.target.value as any)}
                    className="input">
                    <option value="efectivo">Efectivo</option>
                    <option value="transferencia">Transferencia</option>
                    <option value="cheque">Cheque</option>
                    <option value="tarjeta">Tarjeta</option>
                  </select>
                </div>
              </div>

              <div>
                <label htmlFor="notif-observaciones" className="label">Observaciones <span className="font-normal text-muted">(opcional)</span></label>
                <textarea id="notif-observaciones" value={observaciones} onChange={e => setObservaciones(e.target.value)} rows={3}
                  className="input resize-none"
                  placeholder="Ej: Pagó una parte en efectivo" />
              </div>
            </div>

            <div className="modal-footer">
              <button onClick={cerrarModalPago}
                className="btn-secondary flex-1 sm:flex-none">
                Cancelar
              </button>
              <button onClick={registrarPago} disabled={loading || !montoPago || parseFloat(montoPago) <= 0}
                className="btn-accent flex-1 sm:flex-none">
                {loading
                  ? <><span className="spinner" /><span>Guardando…</span></>
                  : <><Check className="w-4 h-4" /><span>Confirmar pago</span></>}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Modal Reprogramación ── */}
      {mostrarModalReprogramacion && notifReprogramar && (
        <div className="modal-backdrop">
          <div className="modal" role="dialog" aria-modal="true" aria-labelledby="notif-titulo-reprog">
            <div className="modal-header justify-between">
              <h3 id="notif-titulo-reprog" className="text-base font-semibold text-fg flex items-center gap-2">
                <RefreshCw className="w-5 h-5 text-reprog" /> Reprogramar cuota
              </h3>
              <button onClick={cerrarModalReprogramacion} className="btn-icon" aria-label="Cerrar"><X className="w-5 h-5" /></button>
            </div>

            <div className="modal-body">
              <dl className="rounded-lg bg-surface-2 p-4 text-sm space-y-2">
                <div>
                  <dt className="text-xs text-muted">Cliente</dt>
                  <dd className="font-medium text-fg">{notifReprogramar.cliente_nombre} {notifReprogramar.cliente_apellido}</dd>
                </div>
                <div>
                  <dt className="text-xs text-muted">Concepto</dt>
                  <dd className="font-medium text-fg">{notifReprogramar.producto_nombre} · Cuota {notifReprogramar.numero_cuota}</dd>
                </div>
                <div>
                  <dt className="text-xs text-muted">Vencimiento actual</dt>
                  <dd className="font-medium text-fg num">{formatearFecha(notifReprogramar.fecha_vencimiento)}</dd>
                </div>
                {notifReprogramar.dias_vencimiento < 0 && (
                  <span className="badge-danger">
                    <AlertTriangle className="w-3.5 h-3.5" />
                    Vencida hace {Math.abs(notifReprogramar.dias_vencimiento)} días
                  </span>
                )}
              </dl>

              <div>
                <label htmlFor="notif-nueva-fecha" className="label">Nueva fecha de vencimiento <span className="text-danger" aria-hidden="true">*</span></label>
                <input id="notif-nueva-fecha" type="date" value={nuevaFechaVencimiento} onChange={e => setNuevaFechaVencimiento(e.target.value)}
                  min={hoyISO()}
                  className="input" />
              </div>

              <div>
                <label htmlFor="notif-interes" className="label">Interés por atraso</label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted font-medium pointer-events-none">$</span>
                  <input id="notif-interes" type="number" step="0.01" min="0" value={interesesMora}
                    onChange={e => setInteresesMora(parseFloat(e.target.value) || 0)}
                    className="input pl-8 num" />
                </div>
                <p className="help">Se sugiere un 1% por cada mes de atraso. Podés modificarlo.</p>
                <dl className="mt-3 p-3 rounded-lg bg-surface-2 text-sm space-y-1 num">
                  <div className="flex justify-between"><dt className="text-muted">Importe actual de la cuota</dt><dd className="font-medium text-fg">{formatearMoneda(notifReprogramar.monto_cuota_total)}</dd></div>
                  <div className="flex justify-between"><dt className="text-muted">Interés por atraso</dt><dd className="font-medium text-danger-text">{formatearMoneda(interesesMora)}</dd></div>
                  <div className="flex justify-between border-t border-line pt-1"><dt className="font-semibold text-fg">Nuevo total</dt><dd className="font-bold text-fg">{formatearMoneda(notifReprogramar.monto_cuota_total + interesesMora)}</dd></div>
                </dl>
              </div>

              <div>
                <label htmlFor="notif-motivo" className="label">Motivo <span className="font-normal text-muted">(opcional)</span></label>
                <textarea id="notif-motivo" value={motivoReprogramacion} onChange={e => setMotivoReprogramacion(e.target.value)} rows={3}
                  className="input resize-none"
                  placeholder="Ej: Pidió pagar a fin de mes" />
              </div>
            </div>

            <div className="modal-footer">
              <button onClick={cerrarModalReprogramacion} disabled={loading}
                className="btn-secondary flex-1 sm:flex-none">
                Cancelar
              </button>
              <button onClick={reprogramarPago} disabled={!nuevaFechaVencimiento || loading}
                className="btn-primary flex-1 sm:flex-none">
                {loading
                  ? <><span className="spinner" /><span>Guardando…</span></>
                  : <><Check className="w-4 h-4" /><span>Reprogramar</span></>}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
