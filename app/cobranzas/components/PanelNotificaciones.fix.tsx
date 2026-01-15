'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/app/lib/supabase'
import {
  Bell,
  AlertTriangle,
  Calendar,
  Clock,
  Phone,
  Mail,
  DollarSign,
  Check,
  ChevronLeft,
  ChevronRight,
  RefreshCw
} from 'lucide-react'

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
  notificaciones?: NotificacionVencimiento[]
  onActualizar: () => void
  onVerCuentaCliente?: (clienteId: string) => void
}

type PagoRow = {
  id: string
  transaccion_id: string
  numero_cuota: number
  fecha_vencimiento: string
  estado: 'pendiente' | 'parcial' | 'pagado' | 'reprogramado' | string
  monto_cuota: number | null
  monto_pagado: number | null
  intereses_mora: number | null
  fecha_reprogramacion: string | null
  motivo_reprogramacion: string | null
  transaccion?: {
    id: string
    cliente_id: string
    monto_total: number | null
    monto_cuota: number | null
    numero_factura: string | null
    tipo_transaccion: string
    fecha_inicio: string | null
    cliente?: { id: string; nombre: string | null; apellido: string | null; email?: string | null; telefono?: string | null } | null
    producto?: { nombre: string | null } | null
  } | null
}

export default function PanelNotificaciones({
  notificaciones,
  onActualizar,
  onVerCuentaCliente
}: PanelNotificacionesProps) {
  const [filtroTipo, setFiltroTipo] = useState<'todos' | 'vencido' | 'hoy' | 'calendario'>('todos')
  const [notificacionesDetalladas, setNotificacionesDetalladas] = useState<NotificacionVencimiento[]>([])
  const [notificacionesCalendario, setNotificacionesCalendario] = useState<NotificacionVencimiento[]>([])
  const [loading, setLoading] = useState(false)
  const [mostrarContacto, setMostrarContacto] = useState<string | null>(null)

  // Calendario
  const [fechaSeleccionada, setFechaSeleccionada] = useState<Date | null>(null)
  const [mesActual, setMesActual] = useState(new Date())

  // Modal pago
  const [mostrarModalPago, setMostrarModalPago] = useState(false)
  const [notifSeleccionada, setNotifSeleccionada] = useState<NotificacionVencimiento | null>(null)
  const [montoPago, setMontoPago] = useState('')
  const [fechaPago, setFechaPago] = useState(new Date().toISOString().split('T')[0])
  const [metodoPago, setMetodoPago] = useState<'efectivo' | 'transferencia' | 'cheque' | 'tarjeta'>('efectivo')
  const [observaciones, setObservaciones] = useState('')

  // Modal reprogramacion
  const [mostrarModalReprogramacion, setMostrarModalReprogramacion] = useState(false)
  const [notifReprogramar, setNotifReprogramar] = useState<NotificacionVencimiento | null>(null)
  const [nuevaFechaVencimiento, setNuevaFechaVencimiento] = useState('')
  const [interesesMora, setInteresesMora] = useState(0)
  const [motivoReprogramacion, setMotivoReprogramacion] = useState('')

  useEffect(() => {
    // fallback si el padre no manda notificaciones
    if (!notificaciones || notificaciones.length === 0) {
      cargarNotificacionesDetalladas()
    } else {
      setNotificacionesDetalladas(notificaciones)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (filtroTipo === 'calendario') {
      cargarTodasLasNotificaciones()
    } else if (notificaciones && notificaciones.length > 0) {
      setNotificacionesDetalladas(notificaciones)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [notificaciones, filtroTipo])

  useEffect(() => {
    if (filtroTipo === 'calendario') {
      cargarTodasLasNotificaciones()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mesActual])

  // Utils
  const formatearMoneda = (monto: number) =>
    new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS' }).format(monto)

  const formatearFecha = (fecha: string) => {
    const [year, month, day] = fecha.split('-').map(Number)
    const fechaObj = new Date(year, month - 1, day)
    return fechaObj.toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' })
  }

  const calcularDiasVencimiento = (fechaVencimiento: string) => {
    const hoy = new Date()
    hoy.setHours(0, 0, 0, 0)

    const [year, month, day] = fechaVencimiento.split('-').map(Number)
    const vencimiento = new Date(year, month - 1, day)
    vencimiento.setHours(0, 0, 0, 0)

    return Math.floor((vencimiento.getTime() - hoy.getTime()) / (1000 * 60 * 60 * 24))
  }

  const calcularInteresesSugeridos = (diasAtraso: number, montoBase: number) => {
    const tasaMensual = 0.01
    const mesesAtraso = Math.ceil(Math.abs(diasAtraso) / 30)
    return montoBase * tasaMensual * mesesAtraso
  }

  const obtenerMontoCuota = (pago: PagoRow) => {
    const base = (pago.monto_cuota && pago.monto_cuota > 0) ? pago.monto_cuota : (pago.transaccion?.monto_cuota ?? 0)
    const mora = pago.intereses_mora ?? 0
    return base + mora
  }

  const obtenerNombreTransaccion = (transaccion: PagoRow['transaccion']) => {
    if (transaccion?.producto?.nombre) return transaccion.producto.nombre
    return transaccion?.tipo_transaccion === 'prestamo' ? 'Prestamo de dinero' : 'Venta'
  }

  const obtenerTextoVencimiento = (notif: NotificacionVencimiento) => {
    if (notif.tipo === 'vencido') return `Vencido hace ${Math.abs(notif.dias_vencimiento)} dias`
    if (notif.tipo === 'hoy') return 'Vence hoy'
    return `Vence en ${notif.dias_vencimiento} dias`
  }

  const obtenerIconoTipo = (tipo: string) => {
    if (tipo === 'vencido') return <AlertTriangle className="w-5 h-5 text-red-500" />
    if (tipo === 'hoy') return <Clock className="w-5 h-5 text-orange-500" />
    if (tipo === 'por_vencer') return <Calendar className="w-5 h-5 text-blue-500" />
    return <Bell className="w-5 h-5 text-gray-500" />
  }

  const obtenerColorFondo = (tipo: string) => {
    if (tipo === 'vencido') return 'bg-red-50 border-red-200'
    if (tipo === 'hoy') return 'bg-orange-50 border-orange-200'
    if (tipo === 'por_vencer') return 'bg-blue-50 border-blue-200'
    return 'bg-gray-50 border-gray-200'
  }

  const obtenerNotificacionesPorFecha = (fecha: Date) => {
    const anio = fecha.getFullYear()
    const mes = String(fecha.getMonth() + 1).padStart(2, '0')
    const dia = String(fecha.getDate()).padStart(2, '0')
    const fechaStr = `${anio}-${mes}-${dia}`

    const fuente = filtroTipo === 'calendario' ? notificacionesCalendario : notificacionesDetalladas
    return fuente.filter(n => n.fecha_vencimiento === fechaStr)
  }

  const contarVencimientosPorFecha = (fecha: Date) => obtenerNotificacionesPorFecha(fecha).length

  const generarDiasCalendario = () => {
    const anio = mesActual.getFullYear()
    const mes = mesActual.getMonth()
    const primerDia = new Date(anio, mes, 1)
    const ultimoDia = new Date(anio, mes + 1, 0)
    const diasEnMes = ultimoDia.getDate()
    const primerDiaSemana = primerDia.getDay()

    const dias: (Date | null)[] = []
    for (let i = 0; i < primerDiaSemana; i++) dias.push(null)
    for (let i = 1; i <= diasEnMes; i++) dias.push(new Date(anio, mes, i))
    return dias
  }

  const cambiarMes = (direccion: 'anterior' | 'siguiente') => {
    setMesActual(prev => {
      const nueva = new Date(prev)
      nueva.setMonth(prev.getMonth() + (direccion === 'anterior' ? -1 : 1))
      return nueva
    })
    setFechaSeleccionada(null)
  }

  const esHoy = (fecha: Date | null) => {
    if (!fecha) return false
    const hoy = new Date()
    return fecha.getDate() === hoy.getDate() && fecha.getMonth() === hoy.getMonth() && fecha.getFullYear() === hoy.getFullYear()
  }

  const esFechaSeleccionada = (fecha: Date | null) => {
    if (!fecha || !fechaSeleccionada) return false
    return (
      fecha.getDate() === fechaSeleccionada.getDate() &&
      fecha.getMonth() === fechaSeleccionada.getMonth() &&
      fecha.getFullYear() === fechaSeleccionada.getFullYear()
    )
  }

  // Carga completa para calendario (paginada)
  const cargarTodasLasNotificaciones = async () => {
    setLoading(true)
    try {
      const BATCH_SIZE = 1000
      let allPagos: PagoRow[] = []
      let start = 0
      let hasMore = true
      let batch = 1

      while (hasMore) {
        const { data, error, count } = await supabase
          .from('pagos')
          .select(
            `
            *,
            transaccion:transacciones(
              id,
              cliente_id,
              monto_total,
              monto_cuota,
              numero_factura,
              tipo_transaccion,
              fecha_inicio,
              cliente:clientes(id, nombre, apellido, email, telefono),
              producto:productos(nombre)
            )
          `,
            { count: 'exact' }
          )
          .in('estado', ['pendiente', 'parcial', 'reprogramado'])
          .order('fecha_vencimiento')
          .range(start, start + BATCH_SIZE - 1)

        if (error) throw error

        const chunk = (data ?? []) as PagoRow[]
        if (batch === 1) {
          // eslint-disable-next-line no-console
          console.log('Total registros en BD (aprox):', count)
        }

        if (chunk.length === 0) {
          hasMore = false
        } else {
          allPagos = allPagos.concat(chunk)
          start += BATCH_SIZE
          hasMore = chunk.length === BATCH_SIZE
          batch++
        }
      }

      if (allPagos.length === 0) {
        setNotificacionesCalendario([])
        return
      }

      const transaccionIds = Array.from(
        new Set(allPagos.map(p => p.transaccion?.id).filter(Boolean))
      ) as string[]

      // Cargar pagos completos de esas transacciones, paginado
      let todosPagos: PagoRow[] = []
      let startPagos = 0
      let hasMorePagos = true

      while (hasMorePagos) {
        const { data: batchPagos, error } = await supabase
          .from('pagos')
          .select('*')
          .in('transaccion_id', transaccionIds)
          .range(startPagos, startPagos + BATCH_SIZE - 1)

        if (error) throw error
        const chunk = (batchPagos ?? []) as PagoRow[]
        if (chunk.length === 0) hasMorePagos = false
        else {
          todosPagos = todosPagos.concat(chunk)
          startPagos += BATCH_SIZE
          hasMorePagos = chunk.length === BATCH_SIZE
        }
      }

      const saldosPorTransaccion = new Map<string, number>()
      const pagosAgrupados = todosPagos.reduce<Record<string, PagoRow[]>>((acc, p) => {
        const tid = p.transaccion_id
        if (!acc[tid]) acc[tid] = []
        acc[tid].push(p)
        return acc
      }, {})

      Object.entries(pagosAgrupados).forEach(([tid, pagos]) => {
        let saldo = 0
        for (const p of pagos) {
          if (p.estado !== 'pagado') {
            const totalCuota = (p.monto_cuota ?? 0) + (p.intereses_mora ?? 0)
            const pagado = p.monto_pagado ?? 0
            saldo += Math.max(0, totalCuota - pagado)
          }
        }
        saldosPorTransaccion.set(tid, saldo)
      })

      const notifs: NotificacionVencimiento[] = allPagos
        .filter(p => p.transaccion && p.transaccion.cliente)
        .map(p => {
          const dias = calcularDiasVencimiento(p.fecha_vencimiento)
          const tipo: NotificacionVencimiento['tipo'] = dias < 0 ? 'vencido' : dias === 0 ? 'hoy' : 'por_vencer'

          const montoCuota = obtenerMontoCuota(p)
          const pagado = p.monto_pagado ?? 0
          const restante = Math.max(0, montoCuota - pagado)

          return {
            id: p.id,
            cliente_id: p.transaccion!.cliente_id,
            cliente_nombre: p.transaccion!.cliente?.nombre ?? '',
            cliente_apellido: p.transaccion!.cliente?.apellido ?? '',
            cliente_telefono: p.transaccion!.cliente?.telefono ?? '',
            cliente_email: p.transaccion!.cliente?.email ?? '',
            monto: restante,
            monto_cuota_total: montoCuota,
            monto_pagado: pagado,
            fecha_vencimiento: p.fecha_vencimiento,
            dias_vencimiento: dias,
            tipo,
            numero_cuota: p.numero_cuota,
            producto_nombre: obtenerNombreTransaccion(p.transaccion),
            transaccion_id: p.transaccion!.id,
            saldo_total_cliente: saldosPorTransaccion.get(p.transaccion!.id) ?? 0,
            tipo_transaccion: p.transaccion!.tipo_transaccion,
            fecha_inicio: p.transaccion!.fecha_inicio ?? '',
            fecha_reprogramacion: p.fecha_reprogramacion ?? undefined,
            intereses_mora: p.intereses_mora ?? undefined,
            motivo_reprogramacion: p.motivo_reprogramacion ?? undefined
          }
        })

      setNotificacionesCalendario(notifs)
    } catch (e) {
      // eslint-disable-next-line no-console
      console.error('Error cargando notificaciones calendario:', e)
      setNotificacionesCalendario([])
    } finally {
      setLoading(false)
    }
  }

  // Carga “normal” (sin paginar a lo bestia, pero igual completa)
  const cargarNotificacionesDetalladas = async () => {
    setLoading(true)
    try {
      const { data, error } = await supabase
        .from('pagos')
        .select(
          `
          *,
          transaccion:transacciones(
            id,
            cliente_id,
            monto_total,
            monto_cuota,
            numero_factura,
            tipo_transaccion,
            fecha_inicio,
            cliente:clientes(id, nombre, apellido, email, telefono),
            producto:productos(nombre)
          )
        `
        )
        .in('estado', ['pendiente', 'parcial', 'reprogramado'])
        .order('fecha_vencimiento')

      if (error) throw error
      const pagos = (data ?? []) as PagoRow[]

      if (pagos.length === 0) {
        setNotificacionesDetalladas([])
        return
      }

      const transaccionIds = Array.from(new Set(pagos.map(p => p.transaccion?.id).filter(Boolean))) as string[]

      const { data: pagosCompletos, error: error2 } = await supabase
        .from('pagos')
        .select('*')
        .in('transaccion_id', transaccionIds)

      if (error2) throw error2

      const todos = (pagosCompletos ?? []) as PagoRow[]
      const saldosPorTransaccion = new Map<string, number>()

      const pagosAgrupados = todos.reduce<Record<string, PagoRow[]>>((acc, p) => {
        const tid = p.transaccion_id
        if (!acc[tid]) acc[tid] = []
        acc[tid].push(p)
        return acc
      }, {})

      Object.entries(pagosAgrupados).forEach(([tid, ps]) => {
        let saldo = 0
        for (const p of ps) {
          if (p.estado !== 'pagado') {
            const totalCuota = (p.monto_cuota ?? 0) + (p.intereses_mora ?? 0)
            const pagado = p.monto_pagado ?? 0
            saldo += Math.max(0, totalCuota - pagado)
          }
        }
        saldosPorTransaccion.set(tid, saldo)
      })

      const notifs: NotificacionVencimiento[] = pagos
        .filter(p => p.transaccion && p.transaccion.cliente)
        .map(p => {
          const dias = calcularDiasVencimiento(p.fecha_vencimiento)
          const tipo: NotificacionVencimiento['tipo'] = dias < 0 ? 'vencido' : dias === 0 ? 'hoy' : 'por_vencer'

          const montoCuota = obtenerMontoCuota(p)
          const pagado = p.monto_pagado ?? 0
          const restante = Math.max(0, montoCuota - pagado)

          return {
            id: p.id,
            cliente_id: p.transaccion!.cliente_id,
            cliente_nombre: p.transaccion!.cliente?.nombre ?? '',
            cliente_apellido: p.transaccion!.cliente?.apellido ?? '',
            cliente_telefono: p.transaccion!.cliente?.telefono ?? '',
            cliente_email: p.transaccion!.cliente?.email ?? '',
            monto: restante,
            monto_cuota_total: montoCuota,
            monto_pagado: pagado,
            fecha_vencimiento: p.fecha_vencimiento,
            dias_vencimiento: dias,
            tipo,
            numero_cuota: p.numero_cuota,
            producto_nombre: obtenerNombreTransaccion(p.transaccion),
            transaccion_id: p.transaccion!.id,
            saldo_total_cliente: saldosPorTransaccion.get(p.transaccion!.id) ?? 0,
            tipo_transaccion: p.transaccion!.tipo_transaccion,
            fecha_inicio: p.transaccion!.fecha_inicio ?? '',
            fecha_reprogramacion: p.fecha_reprogramacion ?? undefined,
            intereses_mora: p.intereses_mora ?? undefined,
            motivo_reprogramacion: p.motivo_reprogramacion ?? undefined
          }
        })

      setNotificacionesDetalladas(notifs)
    } catch (e) {
      // eslint-disable-next-line no-console
      console.error('Error cargando notificaciones:', e)
      setNotificacionesDetalladas([])
    } finally {
      setLoading(false)
    }
  }

  // Acciones
  const enviarRecordatorio = async (
  notificacion: NotificacionVencimiento,
  metodo: 'whatsapp' | 'email'
) => {
  const nombreCompleto = `${notificacion.cliente_nombre} ${notificacion.cliente_apellido || ''}`.trim()

  if (metodo === 'whatsapp' && notificacion.cliente_telefono) {
    const phone = notificacion.cliente_telefono.replace(/[^\d]/g, '')

    // Abrir chat SIN texto precargado
    const url = `https://wa.me/${phone}`
    window.open(url, '_blank')
    return
  }

  if (metodo === 'email' && notificacion.cliente_email) {
    // Si también querés email sin texto, abrí mailto solo con destinatario
    const url = `mailto:${notificacion.cliente_email}`
    window.location.href = url
    return
  }
}


  const abrirModalPago = (notif: NotificacionVencimiento) => {
    setNotifSeleccionada(notif)
    setMontoPago(String(notif.monto))
    setFechaPago(new Date().toISOString().split('T')[0])
    setMetodoPago('efectivo')
    setObservaciones('')
    setMostrarModalPago(true)
  }

  const abrirModalReprogramacion = (notif: NotificacionVencimiento) => {
    setNotifReprogramar(notif)
    const sugeridos = notif.dias_vencimiento < 0 ? calcularInteresesSugeridos(notif.dias_vencimiento, notif.monto_cuota_total) : 0
    setInteresesMora(sugeridos)
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

  const registrarPago = async () => {
    if (!notifSeleccionada) return
    setLoading(true)

    try {
      const montoNumerico = Number(montoPago)
      if (!Number.isFinite(montoNumerico) || montoNumerico <= 0) {
        alert('Monto invalido')
        return
      }

      const montoCuota = notifSeleccionada.monto_cuota_total
      const pagadoActual = notifSeleccionada.monto_pagado
      const restante = Math.max(0, montoCuota - pagadoActual)

      const nuevoEstado = montoNumerico >= restante ? 'pagado' : 'parcial'
      const nuevoMontoPagado = montoNumerico >= restante ? montoCuota : pagadoActual + montoNumerico

      const { error } = await supabase
        .from('pagos')
        .update({
          estado: nuevoEstado,
          monto_pagado: nuevoMontoPagado,
          fecha_pago: fechaPago,
          metodo_pago: metodoPago,
          observaciones,
          numero_recibo: `REC-${Date.now()}`
        })
        .eq('id', notifSeleccionada.id)

      if (error) throw error

      setMostrarModalPago(false)
      setNotifSeleccionada(null)

      if (filtroTipo === 'calendario') await cargarTodasLasNotificaciones()
      else if (!notificaciones || notificaciones.length === 0) await cargarNotificacionesDetalladas()

      onActualizar?.()
      alert('Pago registrado correctamente')
    } catch (e) {
      // eslint-disable-next-line no-console
      console.error('Error registrando pago:', e)
      alert('Error al registrar el pago')
    } finally {
      setLoading(false)
    }
  }

  const reprogramarPago = async () => {
    if (!notifReprogramar || !nuevaFechaVencimiento) {
      alert('Completa la nueva fecha de vencimiento')
      return
    }

    setLoading(true)
    try {
      const nuevoMonto = notifReprogramar.monto_cuota_total + interesesMora

      const { error } = await supabase
        .from('pagos')
        .update({
          fecha_vencimiento: nuevaFechaVencimiento,
          monto_cuota: nuevoMonto,
          intereses_mora: interesesMora,
          fecha_reprogramacion: new Date().toISOString().split('T')[0],
          motivo_reprogramacion: motivoReprogramacion || null,
          estado: 'reprogramado'
        })
        .eq('id', notifReprogramar.id)

      if (error) throw error

      cerrarModalReprogramacion()

      if (filtroTipo === 'calendario') await cargarTodasLasNotificaciones()
      else if (!notificaciones || notificaciones.length === 0) await cargarNotificacionesDetalladas()

      onActualizar?.()
      alert('Pago reprogramado correctamente')
    } catch (e: any) {
      alert('Error al reprogramar el pago: ' + (e?.message ?? 'desconocido'))
    } finally {
      setLoading(false)
    }
  }

  // Datos derivados
  const notificacionesFiltradas = (() => {
    if (filtroTipo === 'calendario' && fechaSeleccionada) return obtenerNotificacionesPorFecha(fechaSeleccionada)

    const fuente = filtroTipo === 'calendario' ? notificacionesCalendario : notificacionesDetalladas
    return fuente.filter(n => {
      if (filtroTipo === 'todos') return true
      if (filtroTipo === 'calendario') return true
      return n.tipo === filtroTipo
    })
  })()

  const estadisticas = {
    vencidos: notificacionesDetalladas.filter(n => n.tipo === 'vencido').length,
    hoy: notificacionesDetalladas.filter(n => n.tipo === 'hoy').length,
    montoTotal: notificacionesDetalladas.reduce((sum, n) => sum + n.monto, 0)
  }

  const nombresMeses = [
    'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
    'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
  ]
  const diasSemana = ['Dom', 'Lun', 'Mar', 'Mie', 'Jue', 'Vie', 'Sab']

  return (
    <div className="space-y-6">
      {/* Header + estadisticas */}
      <div className="bg-white rounded-lg shadow-sm border p-6">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-semibold text-gray-900 flex items-center">
            <Bell className="w-6 h-6 mr-2" />
            Centro de Notificaciones
          </h2>

          <button
            onClick={async () => {
              if (filtroTipo === 'calendario') await cargarTodasLasNotificaciones()
              else if (!notificaciones || notificaciones.length === 0) await cargarNotificacionesDetalladas()
              onActualizar?.()
            }}
            disabled={loading}
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-2"
          >
            {loading ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin" />
                <span>Actualizando...</span>
              </>
            ) : (
              <>
                <RefreshCw className="w-4 h-4" />
                <span>Actualizar</span>
              </>
            )}
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <div className="bg-red-50 rounded-lg p-4 border border-red-200">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm text-red-600 font-medium">Pagos Vencidos</div>
                <div className="text-2xl font-bold text-red-700">{estadisticas.vencidos}</div>
              </div>
              <AlertTriangle className="w-8 h-8 text-red-500" />
            </div>
          </div>

          <div className="bg-orange-50 rounded-lg p-4 border border-orange-200">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm text-orange-600 font-medium">Vencen Hoy</div>
                <div className="text-2xl font-bold text-orange-700">{estadisticas.hoy}</div>
              </div>
              <Clock className="w-8 h-8 text-orange-500" />
            </div>
          </div>

          <div className="bg-purple-50 rounded-lg p-4 border border-purple-200">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm text-purple-600 font-medium">Calendario</div>
                <div className="text-sm text-purple-700">Seleccionar fecha</div>
              </div>
              <Calendar className="w-8 h-8 text-purple-500" />
            </div>
          </div>

          <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm text-gray-600 font-medium">Monto Total</div>
                <div className="text-lg font-bold text-gray-700">{formatearMoneda(estadisticas.montoTotal)}</div>
              </div>
              <DollarSign className="w-8 h-8 text-gray-500" />
            </div>
          </div>
        </div>

        {/* Filtros */}
        <div className="flex flex-wrap gap-2">
          {[
            { key: 'todos', label: 'Todos', count: notificacionesDetalladas.length },
            { key: 'vencido', label: 'Vencidos', count: estadisticas.vencidos },
            { key: 'hoy', label: 'Hoy', count: estadisticas.hoy },
            { key: 'calendario', label: 'Calendario', count: null }
          ].map(f => (
            <button
              key={f.key}
              onClick={() => {
                setFiltroTipo(f.key as any)
                if (f.key === 'calendario') setFechaSeleccionada(null)
              }}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                filtroTipo === f.key ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              {f.label} {f.count !== null && `(${f.count})`}
            </button>
          ))}
        </div>
      </div>

      {/* Calendario */}
      {filtroTipo === 'calendario' && (
        <div className="bg-white rounded-lg shadow-sm border p-6">
          <div className="flex items-center justify-between mb-4">
            <button onClick={() => cambiarMes('anterior')} className="p-2 hover:bg-gray-100 rounded-full transition-colors">
              <ChevronLeft className="w-5 h-5" />
            </button>

            <h3 className="text-lg font-semibold">
              {nombresMeses[mesActual.getMonth()]} {mesActual.getFullYear()}
            </h3>

            <button onClick={() => cambiarMes('siguiente')} className="p-2 hover:bg-gray-100 rounded-full transition-colors">
              <ChevronRight className="w-5 h-5" />
            </button>
          </div>

          <div className="grid grid-cols-7 gap-2 mb-2">
            {diasSemana.map(d => (
              <div key={d} className="text-center text-sm font-medium text-gray-600 py-2">
                {d}
              </div>
            ))}
          </div>

          <div className="grid grid-cols-7 gap-2">
            {generarDiasCalendario().map((dia, idx) => {
              if (!dia) return <div key={`empty-${idx}`} className="h-20" />

              const cantidad = contarVencimientosPorFecha(dia)
              const tiene = cantidad > 0
              const seleccionado = esFechaSeleccionada(dia)
              const hoy = esHoy(dia)

              return (
                <button
                  key={idx}
                  onClick={() => setFechaSeleccionada(dia)}
                  className={`h-20 p-2 rounded-lg border transition-all relative ${
                    seleccionado
                      ? 'bg-blue-100 border-blue-500'
                      : hoy
                      ? 'bg-yellow-50 border-yellow-400'
                      : tiene
                      ? 'bg-red-50 border-red-200 hover:bg-red-100'
                      : 'bg-white border-gray-200 hover:bg-gray-50'
                  }`}
                >
                  <div className="text-sm font-medium">{dia.getDate()}</div>
                  {tiene && (
                    <div className="mt-1">
                      <span className="inline-block px-2 py-1 text-xs bg-red-500 text-white rounded-full">{cantidad}</span>
                    </div>
                  )}
                  {hoy && <div className="absolute bottom-1 right-1 text-xs text-yellow-600 font-medium">Hoy</div>}
                </button>
              )
            })}
          </div>

          {fechaSeleccionada && (
            <div className="mt-4 p-4 bg-gray-50 rounded-lg">
              <p className="text-sm text-gray-600 mb-1">Fecha seleccionada:</p>
              <p className="font-semibold">
                {fechaSeleccionada.toLocaleDateString('es-AR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
              </p>
              <p className="text-sm text-gray-600 mt-2">
                {notificacionesFiltradas.length > 0
                  ? `${notificacionesFiltradas.length} vencimiento(s) en esta fecha`
                  : 'No hay vencimientos en esta fecha'}
              </p>
            </div>
          )}
        </div>
      )}

      {/* Lista */}
      <div className="space-y-4">
        {loading ? (
          <div className="flex items-center justify-center py-8 bg-white rounded-lg shadow-sm border">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
            <span className="ml-2 text-gray-600">Actualizando notificaciones...</span>
          </div>
        ) : notificacionesFiltradas.length > 0 ? (
          notificacionesFiltradas.map(notif => (
            <div key={notif.id} className={`bg-white rounded-lg shadow-sm border p-4 ${obtenerColorFondo(notif.tipo)}`}>
              <div className="flex items-center justify-between gap-4">
                <div className="flex items-center space-x-4">
                  <div className="flex-shrink-0">{obtenerIconoTipo(notif.tipo)}</div>

                  <div className="flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="font-semibold text-gray-900">
                        {notif.cliente_nombre} {notif.cliente_apellido ?? ''}
                      </h3>
                      <span className="text-sm text-gray-500">•</span>
                      <span className="text-sm text-gray-600">{notif.producto_nombre}</span>
                      <span className="text-sm text-gray-500">•</span>
                      <span className="text-sm text-gray-600">Cuota {notif.numero_cuota}</span>
                    </div>

                    <div className="flex flex-wrap items-center gap-4 mt-1">
                      <div>
                        <span className="text-sm text-gray-500">Esta cuota: </span>
                        <span className="text-lg font-bold text-gray-900">{formatearMoneda(notif.monto)}</span>
                        {notif.monto_pagado > 0 && (
                          <span className="text-xs text-green-600 ml-2">(Pagado: {formatearMoneda(notif.monto_pagado)})</span>
                        )}
                      </div>

                      <span className="text-gray-300">|</span>

                      <div>
                        <span className="text-sm text-gray-500">Saldo de esta deuda: </span>
                        <span className="text-lg font-bold text-red-600">{formatearMoneda(notif.saldo_total_cliente)}</span>
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-4 mt-1">
                      <span className="text-sm text-gray-600">Vencimiento: {formatearFecha(notif.fecha_vencimiento)}</span>
                      <span
                        className={`text-sm font-medium ${
                          notif.tipo === 'vencido' ? 'text-red-600' : notif.tipo === 'hoy' ? 'text-orange-600' : 'text-blue-600'
                        }`}
                      >
                        {obtenerTextoVencimiento(notif)}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2 justify-end">
                  <button
                    onClick={() => abrirModalPago(notif)}
                    className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 transition-colors flex items-center space-x-2"
                    title="Registrar pago"
                  >
                    <DollarSign className="w-4 h-4" />
                    <span>Registrar Pago</span>
                  </button>

                  <button
                    onClick={() => abrirModalReprogramacion(notif)}
                    className="px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 transition-colors flex items-center space-x-2"
                    title="Reprogramar pago"
                  >
                    <RefreshCw className="w-4 h-4" />
                    <span>Reprogramar</span>
                  </button>

                  {onVerCuentaCliente && (
                    <button
                      onClick={() => onVerCuentaCliente(notif.cliente_id)}
                      className="px-3 py-2 bg-purple-600 text-white rounded-md hover:bg-purple-700 transition-colors text-sm font-medium"
                      title="Ver cuenta corriente"
                    >
                      Ver Cuenta
                    </button>
                  )}

                  {notif.cliente_telefono && (
                    <button
                      onClick={() => enviarRecordatorio(notif, 'whatsapp')}
                      className="p-2 text-green-600 hover:bg-green-100 rounded-full transition-colors"
                      title="Enviar WhatsApp"
                    >
                      <Phone className="w-4 h-4" />
                    </button>
                  )}

                  {notif.cliente_email && (
                    <button
                      onClick={() => enviarRecordatorio(notif, 'email')}
                      className="p-2 text-blue-600 hover:bg-blue-100 rounded-full transition-colors"
                      title="Enviar Email"
                    >
                      <Mail className="w-4 h-4" />
                    </button>
                  )}

                  <button
                    onClick={() => setMostrarContacto(mostrarContacto === notif.id ? null : notif.id)}
                    className="px-3 py-1 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
                  >
                    {mostrarContacto === notif.id ? 'Ocultar' : 'Mas Info'}
                  </button>
                </div>
              </div>

              {mostrarContacto === notif.id && (
                <div className="mt-4 p-4 bg-white rounded-lg border-2 border-blue-200">
                  <h4 className="font-medium text-gray-900 mb-3">Informacion de Contacto y Transaccion</h4>

                  <div className="mb-4 p-3 bg-blue-50 rounded-lg border border-blue-200">
                    <div className="flex items-center space-x-2">
                      <Calendar className="w-4 h-4 text-blue-600" />
                      <span className="text-sm font-medium text-blue-900">Fecha de Inicio:</span>
                      <span className="font-bold text-blue-800">{notif.fecha_inicio ? formatearFecha(notif.fecha_inicio) : '-'}</span>
                    </div>
                  </div>

                  {notif.fecha_reprogramacion && (
                    <div className="mb-4 p-3 bg-orange-50 rounded-lg border border-orange-200">
                      <div className="flex items-center space-x-2 mb-2">
                        <RefreshCw className="w-4 h-4 text-orange-600" />
                        <span className="text-sm font-medium text-orange-900">Pago Reprogramado</span>
                      </div>
                      <div className="space-y-1 ml-6 text-sm">
                        <p className="text-gray-700">
                          <span className="font-medium">Fecha de reprogramacion:</span> {formatearFecha(notif.fecha_reprogramacion)}
                        </p>
                        {notif.intereses_mora && notif.intereses_mora > 0 && (
                          <p className="text-gray-700">
                            <span className="font-medium">Intereses por mora:</span> {formatearMoneda(notif.intereses_mora)}
                          </p>
                        )}
                        {notif.motivo_reprogramacion && (
                          <div className="mt-2 p-2 bg-white rounded border border-orange-200">
                            <p className="font-medium text-orange-800 text-xs mb-1">Motivo:</p>
                            <p className="text-gray-700 text-xs">{notif.motivo_reprogramacion}</p>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                    {notif.cliente_telefono && (
                      <div className="flex items-center space-x-2">
                        <Phone className="w-4 h-4 text-gray-400" />
                        <span className="text-sm text-gray-600">Telefono:</span>
                        <span className="font-medium">{notif.cliente_telefono}</span>
                      </div>
                    )}

                    {notif.cliente_email && (
                      <div className="flex items-center space-x-2">
                        <Mail className="w-4 h-4 text-gray-400" />
                        <span className="text-sm text-gray-600">Email:</span>
                        <span className="font-medium">{notif.cliente_email}</span>
                      </div>
                    )}
                  </div>

                  <div className="mb-3 p-3 bg-gray-50 rounded">
                    <div className="text-sm font-medium text-gray-700 mb-2">Resumen de Deuda:</div>
                    <div className="grid grid-cols-2 gap-2 text-sm">
                      <div>
                        <span className="text-gray-600">Monto cuota total:</span>
                        <div className="font-semibold">{formatearMoneda(notif.monto_cuota_total)}</div>
                      </div>
                      <div>
                        <span className="text-gray-600">Monto pagado:</span>
                        <div className="font-semibold text-green-600">{formatearMoneda(notif.monto_pagado)}</div>
                      </div>
                      <div>
                        <span className="text-gray-600">Monto restante:</span>
                        <div className="font-semibold text-orange-600">{formatearMoneda(notif.monto)}</div>
                      </div>
                      <div>
                        <span className="text-gray-600">Saldo de esta deuda:</span>
                        <div className="font-semibold text-red-600">{formatearMoneda(notif.saldo_total_cliente)}</div>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          ))
        ) : (
          <div className="bg-white rounded-lg shadow-sm border p-8 text-center">
            <div className="text-gray-400 mb-4">
              <Bell className="w-12 h-12 mx-auto" />
            </div>
            <h3 className="text-lg font-medium text-gray-900 mb-2">No hay notificaciones</h3>
            <p className="text-gray-600">
              {filtroTipo === 'calendario' && fechaSeleccionada
                ? `No hay vencimientos para el ${fechaSeleccionada.toLocaleDateString('es-AR', {
                    day: 'numeric',
                    month: 'long',
                    year: 'numeric'
                  })}`
                : filtroTipo === 'calendario'
                ? 'Selecciona una fecha en el calendario para ver los vencimientos'
                : filtroTipo === 'todos'
                ? 'No tienes notificaciones pendientes en este momento.'
                : `No hay notificaciones de tipo "${filtroTipo}" en este momento.`}
            </p>
          </div>
        )}
      </div>

      {/* Modal Pago */}
      {mostrarModalPago && notifSeleccionada && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg max-w-md w-full p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900">Registrar Pago</h3>
              <button onClick={() => setMostrarModalPago(false)} className="text-gray-400 hover:text-gray-600">
                X
              </button>
            </div>

            <div className="space-y-4">
              <div className="bg-gray-50 rounded-lg p-4">
                <div className="text-sm text-gray-600 mb-2">Cliente:</div>
                <div className="font-medium">
                  {notifSeleccionada.cliente_nombre} {notifSeleccionada.cliente_apellido ?? ''}
                </div>

                <div className="text-sm text-gray-600 mb-2 mt-3">Concepto:</div>
                <div className="font-medium">{notifSeleccionada.producto_nombre}</div>

                <div className="flex justify-between mt-3">
                  <div>
                    <div className="text-sm text-gray-600">Cuota:</div>
                    <div className="font-medium">{notifSeleccionada.numero_cuota}</div>
                  </div>
                  <div className="text-right">
                    <div className="text-sm text-gray-600">Monto total:</div>
                    <div className="font-bold">{formatearMoneda(notifSeleccionada.monto_cuota_total)}</div>
                  </div>
                </div>

                {notifSeleccionada.monto_pagado > 0 && (
                  <div className="mt-2 text-right">
                    <div className="text-sm text-gray-600">Pagado anteriormente:</div>
                    <div className="text-green-600 font-medium">{formatearMoneda(notifSeleccionada.monto_pagado)}</div>
                    <div className="text-sm text-gray-600">Restante:</div>
                    <div className="font-bold text-red-600">{formatearMoneda(notifSeleccionada.monto)}</div>
                  </div>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Monto a pagar</label>
                <input
                  type="number"
                  step="0.01"
                  value={montoPago}
                  onChange={e => setMontoPago(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Fecha de pago</label>
                <input
                  type="date"
                  value={fechaPago}
                  onChange={e => setFechaPago(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Metodo de pago</label>
                <select
                  value={metodoPago}
                  onChange={e => setMetodoPago(e.target.value as any)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="efectivo">Efectivo</option>
                  <option value="transferencia">Transferencia</option>
                  <option value="cheque">Cheque</option>
                  <option value="tarjeta">Tarjeta</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Observaciones (opcional)</label>
                <textarea
                  value={observaciones}
                  onChange={e => setObservaciones(e.target.value)}
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                />
              </div>
            </div>

            <div className="flex space-x-3 mt-6">
              <button
                onClick={() => setMostrarModalPago(false)}
                className="flex-1 px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50 transition-colors"
              >
                Cancelar
              </button>

              <button
                onClick={registrarPago}
                disabled={loading || !montoPago || Number(montoPago) <= 0}
                className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors disabled:bg-gray-400 disabled:cursor-not-allowed flex items-center justify-center space-x-2"
              >
                {loading ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" />
                    <span>Procesando...</span>
                  </>
                ) : (
                  <>
                    <Check className="w-4 h-4" />
                    <span>Confirmar Pago</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Reprogramacion */}
      {mostrarModalReprogramacion && notifReprogramar && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg max-w-md w-full p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900 flex items-center">
                <RefreshCw className="w-5 h-5 mr-2" />
                Reprogramar Pago
              </h3>
              <button onClick={cerrarModalReprogramacion} className="text-gray-400 hover:text-gray-600">
                X
              </button>
            </div>

            <div className="space-y-4">
              <div className="bg-gray-50 rounded-lg p-4">
                <div className="text-sm text-gray-600 mb-2">Cliente:</div>
                <div className="font-medium">
                  {notifReprogramar.cliente_nombre} {notifReprogramar.cliente_apellido ?? ''}
                </div>

                <div className="text-sm text-gray-600 mb-2 mt-3">Concepto:</div>
                <div className="font-medium">{notifReprogramar.producto_nombre}</div>

                <div className="text-sm text-gray-600 mb-2 mt-3">Cuota:</div>
                <div className="font-medium">#{notifReprogramar.numero_cuota}</div>

                <div className="text-sm text-gray-600 mb-2 mt-3">Vencimiento original:</div>
                <div className="font-medium">{formatearFecha(notifReprogramar.fecha_vencimiento)}</div>

                {notifReprogramar.dias_vencimiento < 0 && (
                  <p className="text-sm text-red-600 mt-2">Vencido hace {Math.abs(notifReprogramar.dias_vencimiento)} dias</p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Nueva fecha de vencimiento *</label>
                <input
                  type="date"
                  value={nuevaFechaVencimiento}
                  onChange={e => setNuevaFechaVencimiento(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Intereses por mora</label>
                <input
                  type="number"
                  step="0.01"
                  value={interesesMora}
                  onChange={e => setInteresesMora(Number(e.target.value) || 0)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />

                <div className="mt-2 p-3 bg-gray-50 rounded text-sm">
                  <p className="flex justify-between">
                    <span className="text-gray-600">Monto original:</span>
                    <span className="font-medium">{formatearMoneda(notifReprogramar.monto_cuota_total)}</span>
                  </p>
                  <p className="flex justify-between">
                    <span className="text-gray-600">Intereses mora:</span>
                    <span className="font-medium">{formatearMoneda(interesesMora)}</span>
                  </p>
                  <p className="flex justify-between border-t pt-1 mt-1">
                    <span className="text-gray-600 font-semibold">Total nuevo:</span>
                    <span className="font-bold">{formatearMoneda(notifReprogramar.monto_cuota_total + interesesMora)}</span>
                  </p>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Motivo (opcional)</label>
                <textarea
                  value={motivoReprogramacion}
                  onChange={e => setMotivoReprogramacion(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                  rows={3}
                />
              </div>
            </div>

            <div className="flex space-x-3 mt-6">
              <button
                onClick={cerrarModalReprogramacion}
                disabled={loading}
                className="flex-1 px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50 transition-colors disabled:opacity-50"
              >
                Cancelar
              </button>

              <button
                onClick={reprogramarPago}
                disabled={!nuevaFechaVencimiento || loading}
                className="flex-1 px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 transition-colors disabled:bg-gray-400 disabled:cursor-not-allowed flex items-center justify-center space-x-2"
              >
                {loading ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" />
                    <span>Procesando...</span>
                  </>
                ) : (
                  <>
                    <Check className="w-4 h-4" />
                    <span>Confirmar</span>
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
