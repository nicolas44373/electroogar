import { useState, useEffect } from 'react'
import { supabase } from '@/app/lib/supabase'
import { Bell, AlertTriangle, Calendar, Clock, Phone, Mail, DollarSign, Eye, Check } from 'lucide-react'

interface NotificacionVencimiento {
  id: string
  cliente_nombre: string
  cliente_telefono?: string
  cliente_email?: string
  monto: number
  fecha_vencimiento: string
  dias_vencimiento: number
  tipo: 'vencido' | 'por_vencer' | 'hoy'
  numero_cuota: number
  producto_nombre: string
  transaccion_id: string
}

interface PanelNotificacionesProps {
  notificaciones: NotificacionVencimiento[]
  onActualizar: () => void
}

export default function PanelNotificaciones({ notificaciones, onActualizar }: PanelNotificacionesProps) {
  const [filtroTipo, setFiltroTipo] = useState<'todos' | 'vencido' | 'hoy' | 'por_vencer'>('todos')
  const [notificacionesDetalladas, setNotificacionesDetalladas] = useState<NotificacionVencimiento[]>([])
  const [loading, setLoading] = useState(false)
  const [mostrarContacto, setMostrarContacto] = useState<string | null>(null)

  useEffect(() => {
    cargarNotificacionesDetalladas()
  }, [notificaciones])

  const cargarNotificacionesDetalladas = async () => {
    setLoading(true)
    try {
      const hoy = new Date()
      hoy.setHours(0, 0, 0, 0)
      const fechaLimite = new Date()
      fechaLimite.setDate(hoy.getDate() + 15) // Próximos 15 días

      const { data } = await supabase
        .from('pagos')
        .select(`
          *,
          transaccion:transacciones(
            id,
            cliente:clientes(nombre, telefono, email),
            producto:productos(nombre)
          )
        `)
        .in('estado', ['pendiente', 'parcial'])
        .lte('fecha_vencimiento', fechaLimite.toISOString().split('T')[0])
        .order('fecha_vencimiento')

      if (data) {
        const notificacionesMapeadas: NotificacionVencimiento[] = data.map(pago => {
          // Parsear fecha como local para evitar conversión UTC
          const [year, month, day] = pago.fecha_vencimiento.split('-').map(Number)
          const fechaVenc = new Date(year, month - 1, day)
          fechaVenc.setHours(0, 0, 0, 0)
          
          const diferenciaDias = Math.floor((fechaVenc.getTime() - hoy.getTime()) / (1000 * 60 * 60 * 24))
          
          let tipo: 'vencido' | 'por_vencer' | 'hoy'
          if (diferenciaDias < 0) tipo = 'vencido'
          else if (diferenciaDias === 0) tipo = 'hoy'
          else tipo = 'por_vencer'

          return {
            id: pago.id,
            cliente_nombre: pago.transaccion.cliente.nombre,
            cliente_telefono: pago.transaccion.cliente.telefono,
            cliente_email: pago.transaccion.cliente.email,
            monto: pago.monto_cuota - (pago.monto_pagado || 0),
            fecha_vencimiento: pago.fecha_vencimiento,
            dias_vencimiento: diferenciaDias,
            tipo,
            numero_cuota: pago.numero_cuota,
            producto_nombre: pago.transaccion.producto?.nombre || 'Préstamo de Dinero',
            transaccion_id: pago.transaccion.id
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
    // Parsear fecha como local para evitar conversión UTC
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
    // Aquí podrías implementar lógica para marcar notificaciones como vistas
    // Por ejemplo, agregar una tabla de notificaciones_vistas
    console.log(`Marcando notificación ${notificacionId} como vista`)
  }

  const enviarRecordatorio = async (notificacion: NotificacionVencimiento, metodo: 'whatsapp' | 'email') => {
    if (metodo === 'whatsapp' && notificacion.cliente_telefono) {
      const mensaje = `Hola ${notificacion.cliente_nombre}, te recordamos que tienes una cuota pendiente de ${formatearMoneda(notificacion.monto)} que venció el ${formatearFecha(notificacion.fecha_vencimiento)}. Por favor, acercate a realizar el pago. Gracias.`
      const url = `https://wa.me/${notificacion.cliente_telefono.replace(/[^\d]/g, '')}?text=${encodeURIComponent(mensaje)}`
      window.open(url, '_blank')
    } else if (metodo === 'email' && notificacion.cliente_email) {
      const subject = encodeURIComponent('Recordatorio de pago pendiente')
      const body = encodeURIComponent(`Estimado/a ${notificacion.cliente_nombre},\n\nTe recordamos que tienes una cuota pendiente:\n\nProducto: ${notificacion.producto_nombre}\nCuota: ${notificacion.numero_cuota}\nMonto: ${formatearMoneda(notificacion.monto)}\nFecha de vencimiento: ${formatearFecha(notificacion.fecha_vencimiento)}\n\nPor favor, acercate a realizar el pago a la brevedad.\n\nSaludos cordiales.`)
      const url = `mailto:${notificacion.cliente_email}?subject=${subject}&body=${body}`
      window.location.href = url
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
            onClick={onActualizar}
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
                      <h3 className="font-semibold text-gray-900">{notif.cliente_nombre}</h3>
                      <span className="text-sm text-gray-500">•</span>
                      <span className="text-sm text-gray-600">{notif.producto_nombre}</span>
                      <span className="text-sm text-gray-500">•</span>
                      <span className="text-sm text-gray-600">Cuota {notif.numero_cuota}</span>
                    </div>
                    
                    <div className="flex items-center space-x-4 mt-1">
                      <span className="text-lg font-bold text-gray-900">
                        {formatearMoneda(notif.monto)}
                      </span>
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
                    onClick={() => marcarComoVisto(notif.id)}
                    className="p-2 text-gray-600 hover:bg-gray-100 rounded-full transition-colors"
                    title="Marcar como visto"
                  >
                    <Eye className="w-4 h-4" />
                  </button>

                  <button
                    onClick={() => setMostrarContacto(mostrarContacto === notif.id ? null : notif.id)}
                    className="px-3 py-1 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
                  >
                    {mostrarContacto === notif.id ? 'Ocultar' : 'Contactar'}
                  </button>
                </div>
              </div>

              {/* Panel de contacto expandido */}
              {mostrarContacto === notif.id && (
                <div className="mt-4 p-4 bg-white rounded-lg border-2 border-blue-200">
                  <h4 className="font-medium text-gray-900 mb-3">Información de Contacto</h4>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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

                  <div className="mt-3 pt-3 border-t">
                    <div className="text-sm text-gray-600">
                      <strong>Mensaje sugerido:</strong> "Hola {notif.cliente_nombre}, te recordamos que tienes una cuota de {formatearMoneda(notif.monto)} del producto {notif.producto_nombre} que {notif.tipo === 'vencido' ? 'venció' : 'vence'} el {formatearFecha(notif.fecha_vencimiento)}. Por favor, acercate a realizar el pago."
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
    </div>
  )
}