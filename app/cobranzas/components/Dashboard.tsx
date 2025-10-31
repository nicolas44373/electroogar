import { Users, DollarSign, TrendingUp, AlertTriangle, Calendar, CreditCard } from 'lucide-react'

interface NotificacionVencimiento {
  id: string
  cliente_id: string
  cliente_nombre: string
  cliente_apellido?: string
  cliente_telefono?: string
  cliente_email?: string
  monto: number
  monto_cuota: number
  monto_cuota_total: number
  monto_pagado: number
  monto_restante: number
  fecha_vencimiento: string
  dias_vencimiento: number
  tipo: 'vencido' | 'por_vencer' | 'hoy'
  numero_cuota: number
  producto_nombre: string
  transaccion_id: string
  saldo_total_cliente: number
  tipo_transaccion: string
  numero_factura?: string
  transaccion?: any
}

interface Estadisticas {
  totalClientes: number
  ventasDelMes: number
  cobrosDelMes: number
  clientesVencidos: number
  montoTotalPendiente: number
}

interface DashboardProps {
  estadisticas: Estadisticas
  notificaciones: NotificacionVencimiento[]
  onVerNotificaciones: () => void
  onRegistrarPago: () => void
  onNuevaVenta: () => void
}

export default function Dashboard({ 
  estadisticas, 
  notificaciones, 
  onVerNotificaciones,
  onRegistrarPago,
  onNuevaVenta
}: DashboardProps) {
  
  const formatearMoneda = (monto: number) => {
    return new Intl.NumberFormat('es-AR', {
      style: 'currency',
      currency: 'ARS'
    }).format(monto || 0)
  }

  // Función para obtener el monto de cuota correcto (misma lógica que PanelNotificaciones)
  const obtenerMontoCuota = (notif: any) => {
    // Si ya viene calculado el monto restante (monto a pagar)
    if (notif.monto && notif.monto > 0) {
      return notif.monto
    }
    
    // Si tiene monto_cuota_total
    if (notif.monto_cuota_total && notif.monto_cuota_total > 0) {
      const montoPagado = notif.monto_pagado || 0
      return notif.monto_cuota_total - montoPagado
    }
    
    // Si tiene monto_cuota directo
    if (notif.monto_cuota && notif.monto_cuota > 0) {
      const montoPagado = notif.monto_pagado || 0
      return notif.monto_cuota - montoPagado
    }
    
    // Obtener de la transacción
    if (notif.transaccion?.monto_cuota && notif.transaccion.monto_cuota > 0) {
      const montoPagado = notif.monto_pagado || 0
      return notif.transaccion.monto_cuota - montoPagado
    }
    
    return 0
  }

  const notificacionesVencidas = notificaciones.filter(n => n.tipo === 'vencido')
  const notificacionesHoy = notificaciones.filter(n => n.tipo === 'hoy')
  const notificacionesProximas = notificaciones.filter(n => n.tipo === 'por_vencer')

  const tarjetasEstadisticas = [
    {
      titulo: 'Total Clientes',
      valor: (estadisticas?.totalClientes || 0).toString(),
      icon: Users,
      color: 'bg-blue-500',
      descripcion: 'Clientes registrados'
    },
    {
      titulo: 'Ventas del Mes',
      valor: formatearMoneda(estadisticas?.ventasDelMes || 0),
      icon: TrendingUp,
      color: 'bg-green-500',
      descripcion: 'Facturación mensual'
    },
    {
      titulo: 'Cobros del Mes',
      valor: formatearMoneda(estadisticas?.cobrosDelMes || 0),
      icon: DollarSign,
      color: 'bg-emerald-500',
      descripcion: 'Ingresos recibidos'
    },
    {
      titulo: 'Clientes Vencidos',
      valor: (estadisticas?.clientesVencidos || 0).toString(),
      icon: AlertTriangle,
      color: 'bg-red-500',
      descripcion: 'Requieren atención'
    },
    {
      titulo: 'Monto Pendiente',
      valor: formatearMoneda(estadisticas?.montoTotalPendiente || 0),
      icon: CreditCard,
      color: 'bg-orange-500',
      descripcion: 'Total por cobrar'
    }
  ]

  // Cálculos para el resumen con validación
  const efectividadCobros = estadisticas?.ventasDelMes > 0 
    ? ((estadisticas.cobrosDelMes / estadisticas.ventasDelMes) * 100).toFixed(1)
    : '0.0'
  
  const promedioPorCliente = estadisticas?.totalClientes > 0
    ? formatearMoneda(estadisticas.montoTotalPendiente / estadisticas.totalClientes)
    : formatearMoneda(0)
  
  const porcentajeClientesMora = estadisticas?.totalClientes > 0
    ? ((estadisticas.clientesVencidos / estadisticas.totalClientes) * 100).toFixed(1)
    : '0.0'

  return (
    <div className="space-y-6">
      {/* Tarjetas de estadísticas */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
        {tarjetasEstadisticas.map((tarjeta, index) => (
          <div key={index} className="bg-white rounded-lg shadow-sm p-6 border">
            <div className="flex items-center">
              <div className={`${tarjeta.color} p-3 rounded-lg`}>
                <tarjeta.icon className="w-6 h-6 text-white" />
              </div>
              <div className="ml-4 flex-1">
                <p className="text-sm font-medium text-gray-600">{tarjeta.titulo}</p>
                <p className="text-2xl font-bold text-gray-900">{tarjeta.valor}</p>
                <p className="text-xs text-gray-500">{tarjeta.descripcion}</p>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Alertas y notificaciones */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Pagos vencidos */}
        <div className="bg-white rounded-lg shadow-sm border">
          <div className="p-4 border-b">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold text-red-600 flex items-center">
                <AlertTriangle className="w-5 h-5 mr-2" />
                Pagos Vencidos
              </h3>
              <span className="bg-red-100 text-red-800 text-xs font-medium px-2.5 py-0.5 rounded-full">
                {notificacionesVencidas.length}
              </span>
            </div>
          </div>
          <div className="p-4">
            {notificacionesVencidas.length > 0 ? (
              <div className="space-y-3">
                {notificacionesVencidas.slice(0, 5).map((notif, index) => {
                  const montoCuota = obtenerMontoCuota(notif)
                  return (
                    <div key={index} className="flex justify-between items-center py-2 border-b border-gray-100 last:border-0">
                      <div>
                        <p className="font-medium text-sm text-gray-900">
                          {notif.cliente_nombre} {notif.cliente_apellido || ''}
                        </p>
                        <p className="text-xs text-red-600">
                          Vencido hace {Math.abs(notif.dias_vencimiento)} días
                        </p>
                        {notif.numero_cuota > 0 && (
                          <p className="text-xs text-gray-500">Cuota #{notif.numero_cuota}</p>
                        )}
                      </div>
                      <p className="font-bold text-red-600 text-sm">
                        {formatearMoneda(montoCuota)}
                      </p>
                    </div>
                  )
                })}
                {notificacionesVencidas.length > 5 && (
                  <button
                    onClick={onVerNotificaciones}
                    className="w-full text-center text-sm text-red-600 hover:text-red-800 font-medium py-2"
                  >
                    Ver todos ({notificacionesVencidas.length})
                  </button>
                )}
              </div>
            ) : (
              <p className="text-gray-500 text-sm text-center py-4">
                No hay pagos vencidos
              </p>
            )}
          </div>
        </div>

        {/* Pagos de hoy */}
        <div className="bg-white rounded-lg shadow-sm border">
          <div className="p-4 border-b">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold text-orange-600 flex items-center">
                <Calendar className="w-5 h-5 mr-2" />
                Vencen Hoy
              </h3>
              <span className="bg-orange-100 text-orange-800 text-xs font-medium px-2.5 py-0.5 rounded-full">
                {notificacionesHoy.length}
              </span>
            </div>
          </div>
          <div className="p-4">
            {notificacionesHoy.length > 0 ? (
              <div className="space-y-3">
                {notificacionesHoy.map((notif, index) => {
                  const montoCuota = obtenerMontoCuota(notif)
                  return (
                    <div key={index} className="flex justify-between items-center py-2 border-b border-gray-100 last:border-0">
                      <div>
                        <p className="font-medium text-sm text-gray-900">
                          {notif.cliente_nombre} {notif.cliente_apellido || ''}
                        </p>
                        <p className="text-xs text-orange-600">Vence hoy</p>
                        {notif.numero_cuota > 0 && (
                          <p className="text-xs text-gray-500">Cuota #{notif.numero_cuota}</p>
                        )}
                      </div>
                      <p className="font-bold text-orange-600 text-sm">
                        {formatearMoneda(montoCuota)}
                      </p>
                    </div>
                  )
                })}
              </div>
            ) : (
              <p className="text-gray-500 text-sm text-center py-4">
                No hay pagos que venzan hoy
              </p>
            )}
          </div>
        </div>

        {/* Próximos vencimientos */}
        <div className="bg-white rounded-lg shadow-sm border">
          <div className="p-4 border-b">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold text-blue-600 flex items-center">
                <Calendar className="w-5 h-5 mr-2" />
                Próximos 7 Días
              </h3>
              <span className="bg-blue-100 text-blue-800 text-xs font-medium px-2.5 py-0.5 rounded-full">
                {notificacionesProximas.length}
              </span>
            </div>
          </div>
          <div className="p-4">
            {notificacionesProximas.length > 0 ? (
              <div className="space-y-3">
                {notificacionesProximas.slice(0, 5).map((notif, index) => {
                  const montoCuota = obtenerMontoCuota(notif)
                  return (
                    <div key={index} className="flex justify-between items-center py-2 border-b border-gray-100 last:border-0">
                      <div>
                        <p className="font-medium text-sm text-gray-900">
                          {notif.cliente_nombre} {notif.cliente_apellido || ''}
                        </p>
                        <p className="text-xs text-blue-600">
                          En {notif.dias_vencimiento} días
                        </p>
                        {notif.numero_cuota > 0 && (
                          <p className="text-xs text-gray-500">Cuota #{notif.numero_cuota}</p>
                        )}
                      </div>
                      <p className="font-bold text-blue-600 text-sm">
                        {formatearMoneda(montoCuota)}
                      </p>
                    </div>
                  )
                })}
                {notificacionesProximas.length > 5 && (
                  <button
                    onClick={onVerNotificaciones}
                    className="w-full text-center text-sm text-blue-600 hover:text-blue-800 font-medium py-2"
                  >
                    Ver todos ({notificacionesProximas.length})
                  </button>
                )}
              </div>
            ) : (
              <p className="text-gray-500 text-sm text-center py-4">
                No hay vencimientos próximos
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Resumen de actividad */}
      <div className="bg-white rounded-lg shadow-sm border p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Resumen de Actividad</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="text-center">
            <div className="text-2xl font-bold text-green-600">
              {efectividadCobros}%
            </div>
            <div className="text-sm text-gray-600">Efectividad de Cobros</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-blue-600">
              {promedioPorCliente}
            </div>
            <div className="text-sm text-gray-600">Promedio por Cliente</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-orange-600">
              {porcentajeClientesMora}%
            </div>
            <div className="text-sm text-gray-600">Clientes en Mora</div>
          </div>
        </div>
      </div>

      {/* Acciones rápidas */}
      <div className="bg-white rounded-lg shadow-sm border p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Acciones Rápidas</h3>
        <div className="flex flex-wrap gap-3">
          <button 
            onClick={onVerNotificaciones}
            className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors flex items-center space-x-2"
          >
            <AlertTriangle className="w-4 h-4" />
            <span>Ver Todos los Vencimientos</span>
          </button>
          <button 
            onClick={onRegistrarPago}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center space-x-2"
          >
            <CreditCard className="w-4 h-4" />
            <span>Registrar Pago</span>
          </button>
          <button 
            onClick={onNuevaVenta}
            className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors flex items-center space-x-2"
          >
            <Users className="w-4 h-4" />
            <span>Nueva Venta</span>
          </button>
        </div>
      </div>
    </div>
  )
}