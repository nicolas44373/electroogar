import { useState, useEffect } from 'react'
import { supabase } from '@/app/lib/supabase'
import { Bell, AlertTriangle, Calendar, Clock, Phone, Mail, DollarSign, Eye, Check, ChevronLeft, ChevronRight, RefreshCw } from 'lucide-react'

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

export default function PanelNotificaciones({ notificaciones, onActualizar, onVerCuentaCliente }: PanelNotificacionesProps) {
  const [filtroTipo, setFiltroTipo] = useState<'todos' | 'vencido' | 'hoy' | 'calendario'>('todos')
  const [notificacionesDetalladas, setNotificacionesDetalladas] = useState<NotificacionVencimiento[]>([])
  const [loading, setLoading] = useState(false)
  const [mostrarContacto, setMostrarContacto] = useState<string | null>(null)
  
  // Estados para el calendario
  const [fechaSeleccionada, setFechaSeleccionada] = useState<Date | null>(null)
  const [mesActual, setMesActual] = useState(new Date())
  
  // Estados para el modal de pago
  const [mostrarModalPago, setMostrarModalPago] = useState(false)
  const [notifSeleccionada, setNotifSeleccionada] = useState<NotificacionVencimiento | null>(null)
  const [montoPago, setMontoPago] = useState('')
  const [fechaPago, setFechaPago] = useState(new Date().toISOString().split('T')[0])
  const [metodoPago, setMetodoPago] = useState<'efectivo' | 'transferencia' | 'cheque' | 'tarjeta'>('efectivo')
  const [observaciones, setObservaciones] = useState('')

  // Estados para reprogramación
  const [mostrarModalReprogramacion, setMostrarModalReprogramacion] = useState(false)
  const [notifReprogramar, setNotifReprogramar] = useState<NotificacionVencimiento | null>(null)
  const [nuevaFechaVencimiento, setNuevaFechaVencimiento] = useState('')
  const [interesesMora, setInteresesMora] = useState(0)
  const [motivoReprogramacion, setMotivoReprogramacion] = useState('')

  useEffect(() => {
    cargarNotificacionesDetalladas()
  }, [])

  // Actualizar notificaciones cuando cambia el prop
  useEffect(() => {
    if (notificaciones && notificaciones.length > 0) {
      setNotificacionesDetalladas(notificaciones)
    }
  }, [notificaciones])
  
  // Función centralizada para calcular diferencia de días
  const calcularDiasVencimiento = (fechaVencimiento: string) => {
    const hoy = new Date()
    hoy.setHours(0, 0, 0, 0)
    
    const [year, month, day] = fechaVencimiento.split('-').map(Number)
    const vencimiento = new Date(year, month - 1, day)
    vencimiento.setHours(0, 0, 0, 0)
    
    const diferencia = Math.floor((vencimiento.getTime() - hoy.getTime()) / (1000 * 60 * 60 * 24))
    return diferencia
  }

  // Función para calcular intereses sugeridos
  const calcularInteresesSugeridos = (diasAtraso: number, montoBase: number) => {
    // Ejemplo: 1% por cada 30 días de atraso
    const tasaMensual = 0.01
    const mesesAtraso = Math.ceil(Math.abs(diasAtraso) / 30)
    return montoBase * tasaMensual * mesesAtraso
  }

  // Función para obtener el monto de cuota correcto
  const obtenerMontoCuota = (pago: any) => {
    let montoBase = 0
    
    // Primero intentar obtener el monto_cuota del pago
    if (pago.monto_cuota && pago.monto_cuota > 0) {
      montoBase = pago.monto_cuota
    } else {
      // Si no, obtenerlo de la transacción
      montoBase = pago.transaccion?.monto_cuota || 0
    }
    
    // Sumar intereses de mora si existen
    const interesesMora = pago.intereses_mora || 0
    
    return montoBase + interesesMora
  }

  // Función para obtener el nombre del producto o tipo de transacción
  const obtenerNombreTransaccion = (transaccion: any) => {
    if (transaccion?.producto?.nombre) {
      return transaccion.producto.nombre
    }
    return transaccion?.tipo_transaccion === 'prestamo' ? 'Préstamo de Dinero' : 'Venta'
  }

  // Función para obtener notificaciones de una fecha específica
  const obtenerNotificacionesPorFecha = (fecha: Date) => {
    const año = fecha.getFullYear()
    const mes = String(fecha.getMonth() + 1).padStart(2, '0')
    const dia = String(fecha.getDate()).padStart(2, '0')
    const fechaStr = `${año}-${mes}-${dia}`
    return notificacionesDetalladas.filter(notif => notif.fecha_vencimiento === fechaStr)
  }

  // Función para contar vencimientos en una fecha
  const contarVencimientosPorFecha = (fecha: Date) => {
    return obtenerNotificacionesPorFecha(fecha).length
  }

  // Función para generar los días del calendario
  const generarDiasCalendario = () => {
    const año = mesActual.getFullYear()
    const mes = mesActual.getMonth()
    const primerDia = new Date(año, mes, 1)
    const ultimoDia = new Date(año, mes + 1, 0)
    const diasEnMes = ultimoDia.getDate()
    const primerDiaSemana = primerDia.getDay()
    
    const dias = []
    
    // Días vacíos al inicio
    for (let i = 0; i < primerDiaSemana; i++) {
      dias.push(null)
    }
    
    // Días del mes
    for (let i = 1; i <= diasEnMes; i++) {
      dias.push(new Date(año, mes, i))
    }
    
    return dias
  }

  // Función para cambiar de mes
  const cambiarMes = (direccion: 'anterior' | 'siguiente') => {
    setMesActual(prev => {
      const nuevaFecha = new Date(prev)
      if (direccion === 'anterior') {
        nuevaFecha.setMonth(prev.getMonth() - 1)
      } else {
        nuevaFecha.setMonth(prev.getMonth() + 1)
      }
      return nuevaFecha
    })
    setFechaSeleccionada(null)
  }

  // Función para verificar si es hoy
  const esHoy = (fecha: Date | null) => {
    if (!fecha) return false
    const hoy = new Date()
    return fecha.getDate() === hoy.getDate() &&
           fecha.getMonth() === hoy.getMonth() &&
           fecha.getFullYear() === hoy.getFullYear()
  }

  // Función para verificar si es la fecha seleccionada
  const esFechaSeleccionada = (fecha: Date | null) => {
    if (!fecha || !fechaSeleccionada) return false
    return fecha.getDate() === fechaSeleccionada.getDate() &&
           fecha.getMonth() === fechaSeleccionada.getMonth() &&
           fecha.getFullYear() === fechaSeleccionada.getFullYear()
  }

  const cargarNotificacionesDetalladas = async () => {
  setLoading(true)
  try {
    // Cargar todos los pagos pendientes sin límite de fecha
    const { data, error } = await supabase
      .from('pagos')
      .select(`
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
      `)
      .in('estado', ['pendiente', 'parcial', 'reprogramado'])
      .order('fecha_vencimiento')

    if (error) {
      console.error('Error en la consulta:', error)
      return
    }

    if (!data || data.length === 0) {
      console.log('No se encontraron pagos pendientes')
      setNotificacionesDetalladas([])
      return
    }

    // Obtener IDs únicos de transacciones
    const transaccionIds = [...new Set(data
      .map(p => p.transaccion?.id)
      .filter(Boolean))]

    // IMPORTANTE: Cargar TODOS los pagos de esas transacciones (no solo pendientes)
    const { data: todosPagosCompletos } = await supabase
      .from('pagos')
      .select('*')
      .in('transaccion_id', transaccionIds)

    // Calcular saldo total REAL por transacción
    const saldosPorTransaccion = new Map<string, number>()
    
    if (todosPagosCompletos) {
      // Agrupar pagos por transacción
      const pagosAgrupados = todosPagosCompletos.reduce<{[key: string]: any[]}>((acc, pago) => {
        const tid = pago.transaccion_id
        if (!acc[tid]) acc[tid] = []
        acc[tid].push(pago)
        return acc
      }, {})

      // Calcular el saldo real de cada transacción
      Object.entries(pagosAgrupados).forEach(([transaccionId, pagos]) => {
        let saldoTotalTransaccion = 0
        
        console.log(`📊 Calculando saldo para transacción ${transaccionId}:`)
        
        // Sumar TODAS las cuotas que no estén completamente pagadas
        pagos.forEach((pago: any) => {
          if (pago.estado !== 'pagado') {
            const montoCuota = pago.monto_cuota || 0
            const intereses = pago.intereses_mora || 0
            const totalCuota = montoCuota + intereses
            const pagado = pago.monto_pagado || 0
            const restante = totalCuota - pagado
            
            console.log(`  - Cuota ${pago.numero_cuota}: ${totalCuota} - ${pagado} = ${restante} (estado: ${pago.estado})`)
            
            saldoTotalTransaccion += restante
          }
        })
        
        console.log(`  ✅ Saldo total transacción ${transaccionId}: ${saldoTotalTransaccion}`)
        
        saldosPorTransaccion.set(transaccionId, saldoTotalTransaccion)
      })
      
      console.log(`💾 Mapa de saldos calculado:`, Object.fromEntries(saldosPorTransaccion))
    }

    const notificacionesMapeadas: NotificacionVencimiento[] = data
      .filter(pago => pago.transaccion && pago.transaccion.cliente)
      .map(pago => {
        const diferenciaDias = calcularDiasVencimiento(pago.fecha_vencimiento)
        
        let tipo: 'vencido' | 'por_vencer' | 'hoy'
        if (diferenciaDias < 0) tipo = 'vencido'
        else if (diferenciaDias === 0) tipo = 'hoy'
        else tipo = 'por_vencer'

        const montoCuota = obtenerMontoCuota(pago)
        const montoRestante = montoCuota - (pago.monto_pagado || 0)

        return {
          id: pago.id,
          cliente_id: pago.transaccion.cliente_id,
          cliente_nombre: pago.transaccion.cliente.nombre,
          cliente_apellido: pago.transaccion.cliente.apellido || '',
          cliente_telefono: pago.transaccion.cliente.telefono || '',
          cliente_email: pago.transaccion.cliente.email || '',
          monto: montoRestante,
          monto_cuota_total: montoCuota,
          monto_pagado: pago.monto_pagado || 0,
          fecha_vencimiento: pago.fecha_vencimiento,
          dias_vencimiento: diferenciaDias,
          tipo,
          numero_cuota: pago.numero_cuota,
          producto_nombre: obtenerNombreTransaccion(pago.transaccion),
          transaccion_id: pago.transaccion.id,
          
          // SALDO TOTAL DE TODAS LAS CUOTAS PENDIENTES DE ESTA TRANSACCIÓN
          saldo_total_cliente: saldosPorTransaccion.get(pago.transaccion.id) || 0,
          
          tipo_transaccion: pago.transaccion.tipo_transaccion,
          fecha_inicio: pago.transaccion.fecha_inicio,
          fecha_reprogramacion: pago.fecha_reprogramacion || undefined,
          intereses_mora: pago.intereses_mora || undefined,
          motivo_reprogramacion: pago.motivo_reprogramacion || undefined
        }
      })

    console.log(`Notificaciones cargadas: ${notificacionesMapeadas.length}`)
    setNotificacionesDetalladas(notificacionesMapeadas)
  } catch (error) {
    console.error('Error cargando notificaciones detalladas:', error)
  } finally {
    setLoading(false)
  }
}

  const formatearMoneda = (monto: number) => {
    return new Intl.NumberFormat('es-AR', {
      style: 'currency',
      currency: 'ARS'
    }).format(monto)
  }

  const formatearFecha = (fecha: string) => {
    const [year, month, day] = fecha.split('-').map(Number)
    const fechaObj = new Date(year, month - 1, day)
    return fechaObj.toLocaleDateString('es-AR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    })
  }

  const obtenerTextoVencimiento = (notif: NotificacionVencimiento) => {
    if (notif.tipo === 'vencido') {
      return `Vencido hace ${Math.abs(notif.dias_vencimiento)} días`
    } else if (notif.tipo === 'hoy') {
      return 'Vence hoy'
    } else {
      return `Vence en ${notif.dias_vencimiento} días`
    }
  }

  const obtenerIconoTipo = (tipo: string) => {
    switch (tipo) {
      case 'vencido':
        return <AlertTriangle className="w-5 h-5 text-red-500" />
      case 'hoy':
        return <Clock className="w-5 h-5 text-orange-500" />
      case 'por_vencer':
        return <Calendar className="w-5 h-5 text-blue-500" />
      default:
        return <Bell className="w-5 h-5 text-gray-500" />
    }
  }

  const obtenerColorFondo = (tipo: string) => {
    switch (tipo) {
      case 'vencido':
        return 'bg-red-50 border-red-200'
      case 'hoy':
        return 'bg-orange-50 border-orange-200'
      case 'por_vencer':
        return 'bg-blue-50 border-blue-200'
      default:
        return 'bg-gray-50 border-gray-200'
    }
  }

  const notificacionesFiltradas = (() => {
    if (filtroTipo === 'calendario' && fechaSeleccionada) {
      return obtenerNotificacionesPorFecha(fechaSeleccionada)
    }
    return notificacionesDetalladas.filter(notif => {
      if (filtroTipo === 'todos') return true
      return notif.tipo === filtroTipo
    })
  })()

  const estadisticas = {
    vencidos: notificacionesDetalladas.filter(n => n.tipo === 'vencido').length,
    hoy: notificacionesDetalladas.filter(n => n.tipo === 'hoy').length,
    montoTotal: notificacionesDetalladas.reduce((sum, n) => sum + n.monto, 0)
  }

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
    setMontoPago(notif.monto.toString())
    setFechaPago(new Date().toISOString().split('T')[0])
    setMetodoPago('efectivo')
    setObservaciones('')
    setMostrarModalPago(true)
  }

  const abrirModalReprogramacion = (notif: NotificacionVencimiento) => {
    setNotifReprogramar(notif)
    const interesesSugeridos = notif.dias_vencimiento < 0 ? 
      calcularInteresesSugeridos(notif.dias_vencimiento, notif.monto_cuota_total) : 0
    setInteresesMora(interesesSugeridos)
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
      const montoNumerico = parseFloat(montoPago)
      const montoCuota = notifSeleccionada.monto_cuota_total
      const montoPagadoActual = notifSeleccionada.monto_pagado
      const montoRestante = montoCuota - montoPagadoActual
      
      let nuevoEstado: 'pendiente' | 'parcial' | 'pagado'
      let nuevoMontoPagado: number

      if (montoNumerico >= montoRestante) {
        nuevoEstado = 'pagado'
        nuevoMontoPagado = montoCuota
      } else {
        nuevoEstado = 'parcial'
        nuevoMontoPagado = montoPagadoActual + montoNumerico
      }

      const { error } = await supabase
        .from('pagos')
        .update({
          estado: nuevoEstado,
          monto_pagado: nuevoMontoPagado,
          fecha_pago: fechaPago,
          metodo_pago: metodoPago,
          observaciones: observaciones,
          numero_recibo: `REC-${Date.now()}`
        })
        .eq('id', notifSeleccionada.id)

      if (error) throw error

      // Cerrar modal antes de recargar
      setMostrarModalPago(false)
      setNotifSeleccionada(null)
      
      // Solo recargar localmente si NO hay notificaciones del padre
      if (!notificaciones || notificaciones.length === 0) {
        await cargarNotificacionesDetalladas()
      }
      
      // Siempre llamar al callback del padre para que actualice
      if (onActualizar) {
        onActualizar()
      }
      
      alert('Pago registrado correctamente')
    } catch (error) {
      console.error('Error registrando pago:', error)
      alert('Error al registrar el pago')
    } finally {
      setLoading(false)
    }
  }

  const reprogramarPago = async () => {
    if (!notifReprogramar || !nuevaFechaVencimiento) {
      alert('Por favor complete todos los campos requeridos')
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
      
      // Cerrar modal antes de recargar
      cerrarModalReprogramacion()
      
      // Solo recargar localmente si NO hay notificaciones del padre
      if (!notificaciones || notificaciones.length === 0) {
        await cargarNotificacionesDetalladas()
      }
      
      // Siempre llamar al callback del padre para que actualice
      if (onActualizar) {
        onActualizar()
      }
      
      alert('✅ Pago reprogramado exitosamente')
    } catch (error: any) {
      alert('Error al reprogramar el pago: ' + error.message)
    } finally {
      setLoading(false)
    }
  }

  const nombresMeses = [
    'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
    'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
  ]

  const diasSemana = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb']

  return (
    <div className="space-y-4 md:space-y-6 p-2 md:p-0">
      {/* Header y estadísticas */}
      <div className="bg-white rounded-lg shadow-sm border p-4 md:p-6">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
          <h2 className="text-lg md:text-xl font-semibold text-gray-900 flex items-center">
            <Bell className="w-5 h-5 md:w-6 md:h-6 mr-2" />
            Centro de Notificaciones
          </h2>
          <button
            onClick={async () => {
              if (!notificaciones || notificaciones.length === 0) {
                await cargarNotificacionesDetalladas()
              }
              if (onActualizar) {
                onActualizar()
              }
            }}
            disabled={loading}
            className="w-full sm:w-auto px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center space-x-2 text-sm md:text-base"
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

        {/* Estadísticas */}
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
            { key: 'todos', label: 'Todos', count: notificacionesDetalladas.length },
            { key: 'vencido', label: 'Vencidos', count: estadisticas.vencidos },
            { key: 'hoy', label: 'Hoy', count: estadisticas.hoy },
            { key: 'calendario', label: '📅 Calendario', count: null }
          ].map(filtro => (
            <button
              key={filtro.key}
              onClick={() => {
                setFiltroTipo(filtro.key as any)
                if (filtro.key === 'calendario') {
                  setFechaSeleccionada(null)
                }
              }}
              className={`px-3 md:px-4 py-2 rounded-lg text-xs md:text-sm font-medium transition-colors ${
                filtroTipo === filtro.key
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              {filtro.label} {filtro.count !== null && `(${filtro.count})`}
            </button>
          ))}
        </div>
      </div>

      {/* Calendario */}
      {filtroTipo === 'calendario' && (
        <div className="bg-white rounded-lg shadow-sm border p-4 md:p-6">
          <div className="flex items-center justify-between mb-4">
            <button
              onClick={() => cambiarMes('anterior')}
              className="p-2 hover:bg-gray-100 rounded-full transition-colors"
            >
              <ChevronLeft className="w-4 h-4 md:w-5 md:h-5" />
            </button>
            <h3 className="text-base md:text-lg font-semibold">
              {nombresMeses[mesActual.getMonth()]} {mesActual.getFullYear()}
            </h3>
            <button
              onClick={() => cambiarMes('siguiente')}
              className="p-2 hover:bg-gray-100 rounded-full transition-colors"
            >
              <ChevronRight className="w-4 h-4 md:w-5 md:h-5" />
            </button>
          </div>

          {/* Días de la semana */}
          <div className="grid grid-cols-7 gap-1 md:gap-2 mb-2">
            {diasSemana.map(dia => (
              <div key={dia} className="text-center text-xs md:text-sm font-medium text-gray-600 py-1 md:py-2">
                {dia}
              </div>
            ))}
          </div>

          {/* Días del mes */}
          <div className="grid grid-cols-7 gap-1 md:gap-2">
            {generarDiasCalendario().map((dia, index) => {
              if (!dia) {
                return <div key={`empty-${index}`} className="h-14 md:h-20"></div>
              }

              const vencimientosDelDia = contarVencimientosPorFecha(dia)
              const tieneVencimientos = vencimientosDelDia > 0
              const seleccionado = esFechaSeleccionada(dia)
              const hoy = esHoy(dia)

              return (
                <button
                  key={index}
                  onClick={() => setFechaSeleccionada(dia)}
                  className={`h-14 md:h-20 p-1 md:p-2 rounded-lg border transition-all relative ${
                    seleccionado
                      ? 'bg-blue-100 border-blue-500'
                      : hoy
                      ? 'bg-yellow-50 border-yellow-400'
                      : tieneVencimientos
                      ? 'bg-red-50 border-red-200 hover:bg-red-100'
                      : 'bg-white border-gray-200 hover:bg-gray-50'
                  }`}
                >
                  <div className="text-xs md:text-sm font-medium">
                    {dia.getDate()}
                  </div>
                  {tieneVencimientos && (
                    <div className="mt-0.5 md:mt-1">
                      <span className="inline-block px-1 md:px-2 py-0.5 md:py-1 text-[10px] md:text-xs bg-red-500 text-white rounded-full">
                        {vencimientosDelDia}
                      </span>
                    </div>
                  )}
                  {hoy && (
                    <div className="absolute bottom-0.5 right-0.5 md:bottom-1 md:right-1 text-[10px] md:text-xs text-yellow-600 font-medium">
                      Hoy
                    </div>
                  )}
                </button>
              )
            })}
          </div>

          {/* Leyenda */}
          <div className="mt-4 flex flex-col sm:flex-row items-start sm:items-center justify-center gap-3 sm:gap-6 text-xs md:text-sm">
            <div className="flex items-center space-x-2">
              <div className="w-3 h-3 md:w-4 md:h-4 bg-yellow-50 border border-yellow-400 rounded"></div>
              <span>Hoy</span>
            </div>
            <div className="flex items-center space-x-2">
              <div className="w-3 h-3 md:w-4 md:h-4 bg-red-50 border border-red-200 rounded"></div>
              <span>Con vencimientos</span>
            </div>
            <div className="flex items-center space-x-2">
              <div className="w-3 h-3 md:w-4 md:h-4 bg-blue-100 border border-blue-500 rounded"></div>
              <span>Seleccionado</span>
            </div>
          </div>

          {/* Mostrar fecha seleccionada */}
          {fechaSeleccionada && (
            <div className="mt-4 p-3 md:p-4 bg-gray-50 rounded-lg">
              <p className="text-xs md:text-sm text-gray-600 mb-1">Fecha seleccionada:</p>
              <p className="text-sm md:text-base font-semibold">
                {fechaSeleccionada.toLocaleDateString('es-AR', {
                  weekday: 'long',
                  day: 'numeric',
                  month: 'long',
                  year: 'numeric'
                })}
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

      {/* Lista de notificaciones */}
      <div className="space-y-3 md:space-y-4">
        {loading ? (
          <div className="flex items-center justify-center py-8 bg-white rounded-lg shadow-sm border">
            <div className="animate-spin rounded-full h-6 w-6 md:h-8 md:w-8 border-b-2 border-blue-600"></div>
            <span className="ml-2 text-sm md:text-base text-gray-600">Actualizando notificaciones...</span>
          </div>
        ) : notificacionesFiltradas.length > 0 ? (
          notificacionesFiltradas.map((notif) => (
            <div
              key={notif.id}
              className={`bg-white rounded-lg shadow-sm border p-3 md:p-4 ${obtenerColorFondo(notif.tipo)}`}
            >
              <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 lg:gap-4">
                <div className="flex items-start space-x-3 md:space-x-4 flex-1 min-w-0">
                  <div className="flex-shrink-0 mt-1">
                    {obtenerIconoTipo(notif.tipo)}
                  </div>
                  
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-1 md:gap-2 mb-1">
                      <h3 className="font-semibold text-sm md:text-base text-gray-900 break-words">
                        {notif.cliente_nombre} {notif.cliente_apellido || ''}
                      </h3>
                      <span className="hidden sm:inline text-xs md:text-sm text-gray-500">•</span>
                      <span className="text-xs md:text-sm text-gray-600 break-words">{notif.producto_nombre}</span>
                      <span className="hidden sm:inline text-xs md:text-sm text-gray-500">•</span>
                      <span className="text-xs md:text-sm text-gray-600">Cuota {notif.numero_cuota}</span>
                    </div>
                    
                    <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4 mt-1">
                      <div>
                        <span className="text-xs md:text-sm text-gray-500">Esta cuota: </span>
                        <span className="text-base md:text-lg font-bold text-gray-900 break-all">
                          {formatearMoneda(notif.monto)}
                        </span>
                        {notif.monto_pagado > 0 && (
                          <span className="block sm:inline text-[10px] md:text-xs text-green-600 sm:ml-2 mt-1 sm:mt-0">
                            (Pagado: {formatearMoneda(notif.monto_pagado)})
                          </span>
                        )}
                      </div>
                      <span className="hidden sm:inline text-gray-300">|</span>
                      <div>
                        <span className="text-xs md:text-sm text-gray-500">Saldo de esta deuda: </span>
                        <span className="text-base md:text-lg font-bold text-red-600 break-all">
                          {formatearMoneda(notif.saldo_total_cliente)}
                        </span>
                      </div>
                    </div>
                    
                    <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-4 mt-1">
                      <span className="text-xs md:text-sm text-gray-600">
                        Vencimiento: {formatearFecha(notif.fecha_vencimiento)}
                      </span>
                      <span className={`text-xs md:text-sm font-medium ${
                        notif.tipo === 'vencido' ? 'text-red-600' :
                        notif.tipo === 'hoy' ? 'text-orange-600' :
                        'text-blue-600'
                      }`}>
                        {obtenerTextoVencimiento(notif)}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="flex flex-wrap lg:flex-nowrap items-center gap-2 lg:flex-shrink-0">
                  <button
                    onClick={() => abrirModalPago(notif)}
                    className="flex-1 sm:flex-none px-3 md:px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 transition-colors flex items-center justify-center space-x-1 md:space-x-2 text-xs md:text-sm"
                    title="Registrar pago"
                  >
                    <DollarSign className="w-3 h-3 md:w-4 md:h-4" />
                    <span className="whitespace-nowrap">Registrar Pago</span>
                  </button>

                  <button
                    onClick={() => abrirModalReprogramacion(notif)}
                    className="flex-1 sm:flex-none px-3 md:px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 transition-colors flex items-center justify-center space-x-1 md:space-x-2 text-xs md:text-sm"
                    title="Reprogramar pago"
                  >
                    <RefreshCw className="w-3 h-3 md:w-4 md:h-4" />
                    <span className="whitespace-nowrap">Reprogramar</span>
                  </button>
                  
                  {onVerCuentaCliente && (
                    <button
                      onClick={() => onVerCuentaCliente(notif.cliente_id)}
                      className="flex-1 sm:flex-none px-2 md:px-3 py-2 bg-purple-600 text-white rounded-md hover:bg-purple-700 transition-colors text-xs md:text-sm font-medium whitespace-nowrap"
                      title="Ver cuenta corriente"
                    >
                      Ver Cuenta
                    </button>
                  )}
                  
                  <div className="flex items-center gap-2">
                    {notif.cliente_telefono && (
                      <button
                        onClick={() => enviarRecordatorio(notif, 'whatsapp')}
                        className="p-2 text-green-600 hover:bg-green-100 rounded-full transition-colors"
                        title="Enviar WhatsApp"
                      >
                        <Phone className="w-3 h-3 md:w-4 md:h-4" />
                      </button>
                    )}
                    
                    {notif.cliente_email && (
                      <button
                        onClick={() => enviarRecordatorio(notif, 'email')}
                        className="p-2 text-blue-600 hover:bg-blue-100 rounded-full transition-colors"
                        title="Enviar Email"
                      >
                        <Mail className="w-3 h-3 md:w-4 md:h-4" />
                      </button>
                    )}

                    <button
                      onClick={() => setMostrarContacto(mostrarContacto === notif.id ? null : notif.id)}
                      className="px-2 md:px-3 py-1 text-xs md:text-sm bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors whitespace-nowrap"
                    >
                      {mostrarContacto === notif.id ? 'Ocultar' : 'Más Info'}
                    </button>
                  </div>
                </div>
              </div>

              {mostrarContacto === notif.id && (
                <div className="mt-4 p-3 md:p-4 bg-white rounded-lg border-2 border-blue-200">
                  <h4 className="font-medium text-sm md:text-base text-gray-900 mb-3">Información de Contacto y Transacción</h4>
                  
                  {/* Fecha de Inicio de la Transacción */}
                  <div className="mb-4 p-3 bg-blue-50 rounded-lg border border-blue-200">
                    <div className="flex items-center space-x-2">
                      <Calendar className="w-4 h-4 text-blue-600 flex-shrink-0" />
                      <span className="text-xs md:text-sm font-medium text-blue-900">Fecha de Inicio:</span>
                      <span className="text-xs md:text-sm font-bold text-blue-800">{formatearFecha(notif.fecha_inicio)}</span>
                    </div>
                    <p className="text-[10px] md:text-xs text-blue-600 mt-1 ml-6">
                      Esta {notif.tipo_transaccion === 'prestamo' ? 'préstamo' : 'venta'} comenzó el {formatearFecha(notif.fecha_inicio)}
                    </p>
                  </div>

                  {/* Información de Reprogramación */}
                  {notif.fecha_reprogramacion && (
                    <div className="mb-4 p-3 bg-orange-50 rounded-lg border border-orange-200">
                      <div className="flex items-center space-x-2 mb-2">
                        <RefreshCw className="w-4 h-4 text-orange-600 flex-shrink-0" />
                        <span className="text-xs md:text-sm font-medium text-orange-900">Pago Reprogramado</span>
                      </div>
                      <div className="space-y-1 ml-0 md:ml-6 text-xs md:text-sm">
                        <p className="text-gray-700">
                          <span className="font-medium">Fecha de reprogramación:</span> {formatearFecha(notif.fecha_reprogramacion)}
                        </p>
                        {notif.intereses_mora && notif.intereses_mora > 0 && (
                          <p className="text-gray-700 break-all">
                            <span className="font-medium">Intereses por mora:</span> {formatearMoneda(notif.intereses_mora)}
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
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 md:gap-4 mb-4">
                    {notif.cliente_telefono && (
                      <div className="flex flex-wrap items-center gap-2">
                        <Phone className="w-3 h-3 md:w-4 md:h-4 text-gray-400 flex-shrink-0" />
                        <span className="text-xs md:text-sm text-gray-600">Teléfono:</span>
                        <span className="text-xs md:text-sm font-medium break-all">{notif.cliente_telefono}</span>
                        <button
                          onClick={() => enviarRecordatorio(notif, 'whatsapp')}
                          className="px-2 py-1 text-[10px] md:text-xs bg-green-600 text-white rounded hover:bg-green-700 transition-colors whitespace-nowrap"
                        >
                          WhatsApp
                        </button>
                      </div>
                    )}
                    
                    {notif.cliente_email && (
                      <div className="flex flex-wrap items-center gap-2">
                        <Mail className="w-3 h-3 md:w-4 md:h-4 text-gray-400 flex-shrink-0" />
                        <span className="text-xs md:text-sm text-gray-600">Email:</span>
                        <span className="text-xs md:text-sm font-medium break-all">{notif.cliente_email}</span>
                        <button
                          onClick={() => enviarRecordatorio(notif, 'email')}
                          className="px-2 py-1 text-[10px] md:text-xs bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors whitespace-nowrap"
                        >
                          Enviar
                        </button>
                      </div>
                    )}
                  </div>

                  <div className="p-3 bg-gray-50 rounded">
                    <div className="text-xs md:text-sm font-medium text-gray-700 mb-2">Resumen de Deuda:</div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs md:text-sm">
                      <div>
                        <span className="text-gray-600">Monto cuota total:</span>
                        <div className="font-semibold break-all">{formatearMoneda(notif.monto_cuota_total)}</div>
                      </div>
                      <div>
                        <span className="text-gray-600">Monto pagado:</span>
                        <div className="font-semibold text-green-600 break-all">{formatearMoneda(notif.monto_pagado)}</div>
                      </div>
                      <div>
                        <span className="text-gray-600">Monto restante:</span>
                        <div className="font-semibold text-orange-600 break-all">{formatearMoneda(notif.monto)}</div>
                      </div>
                      <div>
                        <span className="text-gray-600">Saldo de esta deuda:</span>
                        <div className="font-semibold text-red-600 break-all">{formatearMoneda(notif.saldo_total_cliente)}</div>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          ))
        ) : (
          <div className="bg-white rounded-lg shadow-sm border p-6 md:p-8 text-center">
            <div className="text-gray-400 mb-4">
              <Bell className="w-10 h-10 md:w-12 md:h-12 mx-auto" />
            </div>
            <h3 className="text-base md:text-lg font-medium text-gray-900 mb-2">No hay notificaciones</h3>
            <p className="text-sm md:text-base text-gray-600">
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
                : `No hay notificaciones de tipo "${filtroTipo}" en este momento.`
              }
            </p>
          </div>
        )}
      </div>

      {/* Modal de registro de pago */}
      {mostrarModalPago && notifSeleccionada && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg max-w-md w-full p-4 md:p-6 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-base md:text-lg font-semibold text-gray-900">Registrar Pago</h3>
              <button
                onClick={() => setMostrarModalPago(false)}
                className="text-gray-400 hover:text-gray-600 text-xl"
              >
                ✕
              </button>
            </div>

            <div className="space-y-4">
              <div className="bg-gray-50 rounded-lg p-3 md:p-4">
                <div className="text-xs md:text-sm text-gray-600 mb-2">Cliente:</div>
                <div className="text-sm md:text-base font-medium break-words">
                  {notifSeleccionada.cliente_nombre} {notifSeleccionada.cliente_apellido || ''}
                </div>
                
                <div className="text-xs md:text-sm text-gray-600 mb-2 mt-3">Concepto:</div>
                <div className="text-sm md:text-base font-medium break-words">{notifSeleccionada.producto_nombre}</div>
                
                <div className="flex justify-between mt-3">
                  <div>
                    <div className="text-xs md:text-sm text-gray-600">Cuota:</div>
                    <div className="text-sm md:text-base font-medium">{notifSeleccionada.numero_cuota}</div>
                  </div>
                  <div className="text-right">
                    <div className="text-xs md:text-sm text-gray-600">Monto total:</div>
                    <div className="text-sm md:text-base font-bold break-all">{formatearMoneda(notifSeleccionada.monto_cuota_total)}</div>
                  </div>
                </div>
                
                {notifSeleccionada.monto_pagado > 0 && (
                  <div className="mt-2 text-right">
                    <div className="text-xs md:text-sm text-gray-600">Pagado anteriormente:</div>
                    <div className="text-sm md:text-base text-green-600 font-medium break-all">
                      {formatearMoneda(notifSeleccionada.monto_pagado)}
                    </div>
                    <div className="text-xs md:text-sm text-gray-600">Restante:</div>
                    <div className="text-sm md:text-base font-bold text-red-600 break-all">
                      {formatearMoneda(notifSeleccionada.monto)}
                    </div>
                  </div>
                )}
              </div>

              <div>
                <label className="block text-xs md:text-sm font-medium text-gray-700 mb-1">
                  Monto a pagar
                </label>
                <input
                  type="number"
                  step="0.01"
                  value={montoPago}
                  onChange={(e) => setMontoPago(e.target.value)}
                  max={notifSeleccionada.monto}
                  className="w-full px-3 py-2 text-sm md:text-base border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-xs md:text-sm font-medium text-gray-700 mb-1">
                  Fecha de pago
                </label>
                <input
                  type="date"
                  value={fechaPago}
                  onChange={(e) => setFechaPago(e.target.value)}
                  className="w-full px-3 py-2 text-sm md:text-base border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-xs md:text-sm font-medium text-gray-700 mb-1">
                  Método de pago
                </label>
                <select
                  value={metodoPago}
                  onChange={(e) => setMetodoPago(e.target.value as any)}
                  className="w-full px-3 py-2 text-sm md:text-base border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="efectivo">Efectivo</option>
                  <option value="transferencia">Transferencia</option>
                  <option value="cheque">Cheque</option>
                  <option value="tarjeta">Tarjeta</option>
                </select>
              </div>

              <div>
                <label className="block text-xs md:text-sm font-medium text-gray-700 mb-1">
                  Observaciones (opcional)
                </label>
                <textarea
                  value={observaciones}
                  onChange={(e) => setObservaciones(e.target.value)}
                  rows={3}
                  className="w-full px-3 py-2 text-sm md:text-base border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                  placeholder="Observaciones adicionales..."
                />
              </div>
            </div>

            <div className="flex flex-col sm:flex-row gap-3 mt-6">
              <button
                onClick={() => setMostrarModalPago(false)}
                className="flex-1 px-4 py-2 text-sm md:text-base border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50 transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={registrarPago}
                disabled={loading || !montoPago || parseFloat(montoPago) <= 0}
                className="flex-1 px-4 py-2 text-sm md:text-base bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors disabled:bg-gray-400 disabled:cursor-not-allowed flex items-center justify-center space-x-2"
              >
                {loading ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
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

      {/* Modal de Reprogramación */}
      {mostrarModalReprogramacion && notifReprogramar && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg max-w-md w-full p-4 md:p-6 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-base md:text-lg font-semibold text-gray-900 flex items-center">
                <RefreshCw className="w-4 h-4 md:w-5 md:h-5 mr-2" />
                Reprogramar Pago
              </h3>
              <button
                onClick={cerrarModalReprogramacion}
                className="text-gray-400 hover:text-gray-600 text-xl"
              >
                ✕
              </button>
            </div>

            <div className="space-y-4">
              <div className="bg-gray-50 rounded-lg p-3 md:p-4">
                <div className="text-xs md:text-sm text-gray-600 mb-2">Cliente:</div>
                <div className="text-sm md:text-base font-medium break-words">
                  {notifReprogramar.cliente_nombre} {notifReprogramar.cliente_apellido || ''}
                </div>
                
                <div className="text-xs md:text-sm text-gray-600 mb-2 mt-3">Concepto:</div>
                <div className="text-sm md:text-base font-medium break-words">{notifReprogramar.producto_nombre}</div>
                
                <div className="text-xs md:text-sm text-gray-600 mb-2 mt-3">Cuota:</div>
                <div className="text-sm md:text-base font-medium">#{notifReprogramar.numero_cuota}</div>
                
                <div className="text-xs md:text-sm text-gray-600 mb-2 mt-3">Vencimiento original:</div>
                <div className="text-sm md:text-base font-medium">{formatearFecha(notifReprogramar.fecha_vencimiento)}</div>
                
                {notifReprogramar.dias_vencimiento < 0 && (
                  <p className="text-xs md:text-sm text-red-600 mt-2">
                    Vencido hace {Math.abs(notifReprogramar.dias_vencimiento)} días
                  </p>
                )}
              </div>

              <div>
                <label className="block text-xs md:text-sm font-medium text-gray-700 mb-1">
                  Nueva fecha de vencimiento *
                </label>
                <input
                  type="date"
                  value={nuevaFechaVencimiento}
                  onChange={(e) => setNuevaFechaVencimiento(e.target.value)}
                  className="w-full px-3 py-2 text-sm md:text-base border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  min={new Date().toISOString().split('T')[0]}
                />
              </div>

              <div>
                <label className="block text-xs md:text-sm font-medium text-gray-700 mb-1">
                  Intereses por mora ($)
                </label>
                <input
                  type="number"
                  step="0.01"
                  value={interesesMora}
                  onChange={(e) => setInteresesMora(parseFloat(e.target.value) || 0)}
                  className="w-full px-3 py-2 text-sm md:text-base border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="0.00"
                />
                <div className="mt-2 p-3 bg-gray-50 rounded text-xs md:text-sm">
                  <p className="flex justify-between">
                    <span className="text-gray-600">Monto original:</span>
                    <span className="font-medium break-all">{formatearMoneda(notifReprogramar.monto_cuota_total)}</span>
                  </p>
                  <p className="flex justify-between">
                    <span className="text-gray-600">Intereses mora:</span>
                    <span className="font-medium break-all">{formatearMoneda(interesesMora)}</span>
                  </p>
                  <p className="flex justify-between border-t pt-1 mt-1">
                    <span className="text-gray-600 font-semibold">Total nuevo:</span>
                    <span className="font-bold break-all">{formatearMoneda(notifReprogramar.monto_cuota_total + interesesMora)}</span>
                  </p>
                </div>
              </div>

              <div>
                <label className="block text-xs md:text-sm font-medium text-gray-700 mb-1">
                  Motivo de la reprogramación
                </label>
                <textarea
                  value={motivoReprogramacion}
                  onChange={(e) => setMotivoReprogramacion(e.target.value)}
                  className="w-full px-3 py-2 text-sm md:text-base border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                  placeholder="Ej: Problemas económicos temporales, enfermedad, etc."
                  rows={3}
                />
              </div>
            </div>

            <div className="flex flex-col sm:flex-row gap-3 mt-6">
              <button
                onClick={cerrarModalReprogramacion}
                disabled={loading}
                className="flex-1 px-4 py-2 text-sm md:text-base border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50 transition-colors disabled:opacity-50"
              >
                Cancelar
              </button>
              <button
                onClick={reprogramarPago}
                disabled={!nuevaFechaVencimiento || loading}
                className="flex-1 px-4 py-2 text-sm md:text-base bg-blue-500 text-white rounded-md hover:bg-blue-600 transition-colors disabled:bg-gray-400 disabled:cursor-not-allowed flex items-center justify-center space-x-2"
              >
                {loading ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                    <span>Procesando...</span>
                  </>
                ) : (
                  <>
                    <Check className="w-4 h-4" />
                    <span>Confirmar Reprogramación</span>
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