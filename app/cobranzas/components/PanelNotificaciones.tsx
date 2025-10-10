import { useState, useEffect } from 'react'
import { supabase } from '@/app/lib/supabase'
import { Bell, AlertTriangle, Calendar, Clock, Phone, Mail, DollarSign, Eye, Check } from 'lucide-react'

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
}

interface PanelNotificacionesProps {
  notificaciones?: NotificacionVencimiento[]
  onActualizar: () => void
  onVerCuentaCliente?: (clienteId: string) => void
}

export default function PanelNotificaciones({ notificaciones, onActualizar, onVerCuentaCliente }: PanelNotificacionesProps) {
  const [filtroTipo, setFiltroTipo] = useState<'todos' | 'vencido' | 'hoy' | 'por_vencer'>('todos')
  const [notificacionesDetalladas, setNotificacionesDetalladas] = useState<NotificacionVencimiento[]>([])
  const [loading, setLoading] = useState(false)
  const [mostrarContacto, setMostrarContacto] = useState<string | null>(null)
  
  // Estados para el modal de pago
  const [mostrarModalPago, setMostrarModalPago] = useState(false)
  const [notifSeleccionada, setNotifSeleccionada] = useState<NotificacionVencimiento | null>(null)
  const [montoPago, setMontoPago] = useState('')
  const [fechaPago, setFechaPago] = useState(new Date().toISOString().split('T')[0])
  const [metodoPago, setMetodoPago] = useState<'efectivo' | 'transferencia' | 'cheque' | 'tarjeta'>('efectivo')
  const [observaciones, setObservaciones] = useState('')

  useEffect(() => {
    cargarNotificacionesDetalladas()
  }, [])

  // Función centralizada para calcular diferencia de días (igual que GestorPagos)
  const calcularDiasVencimiento = (fechaVencimiento: string) => {
    const hoy = new Date()
    hoy.setHours(0, 0, 0, 0)
    
    const [year, month, day] = fechaVencimiento.split('-').map(Number)
    const vencimiento = new Date(year, month - 1, day)
    vencimiento.setHours(0, 0, 0, 0)
    
    const diferencia = Math.floor((vencimiento.getTime() - hoy.getTime()) / (1000 * 60 * 60 * 24))
    return diferencia
  }

  // Función para obtener el monto de cuota correcto (igual que GestorPagos)
  const obtenerMontoCuota = (pago: any) => {
    if (pago.monto_cuota && pago.monto_cuota > 0) {
      return pago.monto_cuota
    }
    return pago.transaccion?.monto_cuota || 0
  }

  // Función para obtener el nombre del producto o tipo de transacción (igual que GestorPagos)
  const obtenerNombreTransaccion = (transaccion: any) => {
    if (transaccion?.producto?.nombre) {
      return transaccion.producto.nombre
    }
    return transaccion?.tipo_transaccion === 'prestamo' ? 'Préstamo de Dinero' : 'Venta'
  }

  const cargarNotificacionesDetalladas = async () => {
    setLoading(true)
    try {
      const hoy = new Date()
      hoy.setHours(0, 0, 0, 0)
      const fechaLimite = new Date()
      fechaLimite.setDate(hoy.getDate() + 15) // Próximos 15 días

      // Usar la misma consulta que GestorPagos
      const { data } = await supabase
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
            cliente:clientes(id, nombre, apellido, email, telefono),
            producto:productos(nombre)
          )
        `)
        .in('estado', ['pendiente', 'parcial'])
        .lte('fecha_vencimiento', fechaLimite.toISOString().split('T')[0])
        .order('fecha_vencimiento')

      if (data) {
        // Calcular saldo total por cliente usando la misma lógica que GestorPagos
        const saldosPorCliente = new Map<string, number>()
        
        data.forEach(pago => {
          const clienteId = pago.transaccion.cliente_id
          const montoCuota = obtenerMontoCuota(pago)
          const montoRestante = montoCuota - (pago.monto_pagado || 0)
          const saldoActual = saldosPorCliente.get(clienteId) || 0
          saldosPorCliente.set(clienteId, saldoActual + montoRestante)
        })

        const notificacionesMapeadas: NotificacionVencimiento[] = data.map(pago => {
          // Usar la función centralizada de cálculo de días
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
            cliente_apellido: pago.transaccion.cliente.apellido,
            cliente_telefono: pago.transaccion.cliente.telefono,
            cliente_email: pago.transaccion.cliente.email,
            monto: montoRestante,
            monto_cuota_total: montoCuota,
            monto_pagado: pago.monto_pagado || 0,
            fecha_vencimiento: pago.fecha_vencimiento,
            dias_vencimiento: diferenciaDias,
            tipo,
            numero_cuota: pago.numero_cuota,
            producto_nombre: obtenerNombreTransaccion(pago.transaccion),
            transaccion_id: pago.transaccion.id,
            saldo_total_cliente: saldosPorCliente.get(pago.transaccion.cliente_id) || 0,
            tipo_transaccion: pago.transaccion.tipo_transaccion
          }
        })

        setNotificacionesDetalladas(notificacionesMapeadas)
      }
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

  const notificacionesFiltradas = notificacionesDetalladas.filter(notif => {
    if (filtroTipo === 'todos') return true
    return notif.tipo === filtroTipo
  })

  const estadisticas = {
    vencidos: notificacionesDetalladas.filter(n => n.tipo === 'vencido').length,
    hoy: notificacionesDetalladas.filter(n => n.tipo === 'hoy').length,
    proximos: notificacionesDetalladas.filter(n => n.tipo === 'por_vencer').length,
    montoTotal: notificacionesDetalladas.reduce((sum, n) => sum + n.monto, 0)
  }

  const marcarComoVisto = async (notificacionId: string) => {
    console.log(`Marcando notificación ${notificacionId} como vista`)
  }

  const enviarRecordatorio = async (notificacion: NotificacionVencimiento, metodo: 'whatsapp' | 'email') => {
    const nombreCompleto = `${notificacion.cliente_nombre} ${notificacion.cliente_apellido || ''}`.trim()
    
    if (metodo === 'whatsapp' && notificacion.cliente_telefono) {
      const mensaje = `Hola ${nombreCompleto}, te recordamos que tienes una cuota pendiente de ${formatearMoneda(notificacion.monto)} del producto ${notificacion.producto_nombre} (Cuota ${notificacion.numero_cuota}) que ${notificacion.tipo === 'vencido' ? 'venció' : 'vence'} el ${formatearFecha(notificacion.fecha_vencimiento)}. Tu saldo total pendiente es de ${formatearMoneda(notificacion.saldo_total_cliente)}. Por favor, acercate a realizar el pago. Gracias.`
      const url = `https://wa.me/${notificacion.cliente_telefono.replace(/[^\d]/g, '')}?text=${encodeURIComponent(mensaje)}`
      window.open(url, '_blank')
    } else if (metodo === 'email' && notificacion.cliente_email) {
      const subject = encodeURIComponent('Recordatorio de pago pendiente')
      const body = encodeURIComponent(`Estimado/a ${nombreCompleto},\n\nTe recordamos que tienes una cuota pendiente:\n\nProducto: ${notificacion.producto_nombre}\nCuota: ${notificacion.numero_cuota}\nMonto cuota: ${formatearMoneda(notificacion.monto_cuota_total)}\nMonto pagado: ${formatearMoneda(notificacion.monto_pagado)}\nMonto restante: ${formatearMoneda(notificacion.monto)}\nFecha de vencimiento: ${formatearFecha(notificacion.fecha_vencimiento)}\n\nSaldo total pendiente: ${formatearMoneda(notificacion.saldo_total_cliente)}\n\nPor favor, acercate a realizar el pago a la brevedad.\n\nSaludos cordiales.`)
      const url = `mailto:${notificacion.cliente_email}?subject=${subject}&body=${body}`
      window.location.href = url
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

      // Actualizar el pago
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

      setMostrarModalPago(false)
      setNotifSeleccionada(null)
      await cargarNotificacionesDetalladas()
      onActualizar()
      
      alert('Pago registrado correctamente')
    } catch (error) {
      console.error('Error registrando pago:', error)
      alert('Error al registrar el pago')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-6">
      {/* Header y estadísticas */}
      <div className="bg-white rounded-lg shadow-sm border p-6">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-semibold text-gray-900 flex items-center">
            <Bell className="w-6 h-6 mr-2" />
            Centro de Notificaciones
          </h2>
          <button
            onClick={() => {
              cargarNotificacionesDetalladas()
              onActualizar()
            }}
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
          >
            Actualizar
          </button>
        </div>

        {/* Estadísticas */}
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
          
          <div className="bg-blue-50 rounded-lg p-4 border border-blue-200">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm text-blue-600 font-medium">Próximos</div>
                <div className="text-2xl font-bold text-blue-700">{estadisticas.proximos}</div>
              </div>
              <Calendar className="w-8 h-8 text-blue-500" />
            </div>
          </div>
          
          <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm text-gray-600 font-medium">Monto Total</div>
                <div className="text-lg font-bold text-gray-700">
                  {formatearMoneda(estadisticas.montoTotal)}
                </div>
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
            { key: 'por_vencer', label: 'Próximos', count: estadisticas.proximos }
          ].map(filtro => (
            <button
              key={filtro.key}
              onClick={() => setFiltroTipo(filtro.key as any)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                filtroTipo === filtro.key
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              {filtro.label} ({filtro.count})
            </button>
          ))}
        </div>
      </div>

      {/* Lista de notificaciones */}
      <div className="space-y-4">
        {loading ? (
          <div className="flex items-center justify-center py-8 bg-white rounded-lg shadow-sm border">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            <span className="ml-2 text-gray-600">Actualizando notificaciones...</span>
          </div>
        ) : notificacionesFiltradas.length > 0 ? (
          notificacionesFiltradas.map((notif) => (
            <div
              key={notif.id}
              className={`bg-white rounded-lg shadow-sm border p-4 ${obtenerColorFondo(notif.tipo)}`}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-4">
                  <div className="flex-shrink-0">
                    {obtenerIconoTipo(notif.tipo)}
                  </div>
                  
                  <div className="flex-1">
                    <div className="flex items-center space-x-2">
                      <h3 className="font-semibold text-gray-900">
                        {notif.cliente_nombre} {notif.cliente_apellido || ''}
                      </h3>
                      <span className="text-sm text-gray-500">•</span>
                      <span className="text-sm text-gray-600">{notif.producto_nombre}</span>
                      <span className="text-sm text-gray-500">•</span>
                      <span className="text-sm text-gray-600">Cuota {notif.numero_cuota}</span>
                    </div>
                    
                    <div className="flex items-center space-x-4 mt-1">
                      <div>
                        <span className="text-sm text-gray-500">Esta cuota: </span>
                        <span className="text-lg font-bold text-gray-900">
                          {formatearMoneda(notif.monto)}
                        </span>
                        {notif.monto_pagado > 0 && (
                          <span className="text-xs text-green-600 ml-2">
                            (Pagado: {formatearMoneda(notif.monto_pagado)})
                          </span>
                        )}
                      </div>
                      <span className="text-gray-300">|</span>
                      <div>
                        <span className="text-sm text-gray-500">Saldo total: </span>
                        <span className="text-lg font-bold text-red-600">
                          {formatearMoneda(notif.saldo_total_cliente)}
                        </span>
                      </div>
                    </div>
                    
                    <div className="flex items-center space-x-4 mt-1">
                      <span className="text-sm text-gray-600">
                        Vencimiento: {formatearFecha(notif.fecha_vencimiento)}
                      </span>
                      <span className={`text-sm font-medium ${
                        notif.tipo === 'vencido' ? 'text-red-600' :
                        notif.tipo === 'hoy' ? 'text-orange-600' :
                        'text-blue-600'
                      }`}>
                        {obtenerTextoVencimiento(notif)}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center space-x-2">
                  {/* Botón Registrar Pago */}
                  <button
                    onClick={() => abrirModalPago(notif)}
                    className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 transition-colors flex items-center space-x-2"
                    title="Registrar pago"
                  >
                    <DollarSign className="w-4 h-4" />
                    <span>Registrar Pago</span>
                  </button>
                  
                  {/* Botón para ver cuenta corriente */}
                  {onVerCuentaCliente && (
                    <button
                      onClick={() => onVerCuentaCliente(notif.cliente_id)}
                      className="px-3 py-2 bg-purple-600 text-white rounded-md hover:bg-purple-700 transition-colors text-sm font-medium"
                      title="Ver cuenta corriente"
                    >
                      Ver Cuenta
                    </button>
                  )}
                  
                  {/* Botones de contacto */}
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
                    {mostrarContacto === notif.id ? 'Ocultar' : 'Más Info'}
                  </button>
                </div>
              </div>

              {/* Panel de contacto expandido */}
              {mostrarContacto === notif.id && (
                <div className="mt-4 p-4 bg-white rounded-lg border-2 border-blue-200">
                  <h4 className="font-medium text-gray-900 mb-3">Información de Contacto</h4>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                    {notif.cliente_telefono && (
                      <div className="flex items-center space-x-2">
                        <Phone className="w-4 h-4 text-gray-400" />
                        <span className="text-sm text-gray-600">Teléfono:</span>
                        <span className="font-medium">{notif.cliente_telefono}</span>
                        <button
                          onClick={() => enviarRecordatorio(notif, 'whatsapp')}
                          className="ml-2 px-2 py-1 text-xs bg-green-600 text-white rounded hover:bg-green-700 transition-colors"
                        >
                          WhatsApp
                        </button>
                      </div>
                    )}
                    
                    {notif.cliente_email && (
                      <div className="flex items-center space-x-2">
                        <Mail className="w-4 h-4 text-gray-400" />
                        <span className="text-sm text-gray-600">Email:</span>
                        <span className="font-medium">{notif.cliente_email}</span>
                        <button
                          onClick={() => enviarRecordatorio(notif, 'email')}
                          className="ml-2 px-2 py-1 text-xs bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
                        >
                          Enviar
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Resumen de deuda */}
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
                        <span className="text-gray-600">Saldo total cliente:</span>
                        <div className="font-semibold text-red-600">{formatearMoneda(notif.saldo_total_cliente)}</div>
                      </div>
                    </div>
                  </div>

                  <div className="pt-3 border-t">
                    <div className="text-sm text-gray-600">
                      <strong>Mensaje sugerido:</strong> "Hola {notif.cliente_nombre}, te recordamos que tienes una cuota de {formatearMoneda(notif.monto)} del producto {notif.producto_nombre} que {notif.tipo === 'vencido' ? 'venció' : 'vence'} el {formatearFecha(notif.fecha_vencimiento)}. Tu saldo total pendiente es de {formatearMoneda(notif.saldo_total_cliente)}. Por favor, acercate a realizar el pago."
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
              {filtroTipo === 'todos' 
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
          <div className="bg-white rounded-lg max-w-md w-full p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900">Registrar Pago</h3>
              <button
                onClick={() => setMostrarModalPago(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                ✕
              </button>
            </div>

            <div className="space-y-4">
              {/* Información del pago */}
              <div className="bg-gray-50 rounded-lg p-4">
                <div className="text-sm text-gray-600 mb-2">Cliente:</div>
                <div className="font-medium">
                  {notifSeleccionada.cliente_nombre} {notifSeleccionada.cliente_apellido || ''}
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
                    <div className="text-green-600 font-medium">
                      {formatearMoneda(notifSeleccionada.monto_pagado)}
                    </div>
                    <div className="text-sm text-gray-600">Restante:</div>
                    <div className="font-bold text-red-600">
                      {formatearMoneda(notifSeleccionada.monto)}
                    </div>
                  </div>
                )}
              </div>

              {/* Formulario de pago */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Monto a pagar
                </label>
                <input
                  type="number"
                  step="0.01"
                  value={montoPago}
                  onChange={(e) => setMontoPago(e.target.value)}
                  max={notifSeleccionada.monto}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Fecha de pago
                </label>
                <input
                  type="date"
                  value={fechaPago}
                  onChange={(e) => setFechaPago(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Método de pago
                </label>
                <select
                  value={metodoPago}
                  onChange={(e) => setMetodoPago(e.target.value as any)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="efectivo">Efectivo</option>
                  <option value="transferencia">Transferencia</option>
                  <option value="cheque">Cheque</option>
                  <option value="tarjeta">Tarjeta</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Observaciones (opcional)
                </label>
                <textarea
                  value={observaciones}
                  onChange={(e) => setObservaciones(e.target.value)}
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                  placeholder="Observaciones adicionales..."
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
                disabled={loading || !montoPago || parseFloat(montoPago) <= 0}
                className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors disabled:bg-gray-400 disabled:cursor-not-allowed flex items-center justify-center space-x-2"
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
    </div>
  )
}