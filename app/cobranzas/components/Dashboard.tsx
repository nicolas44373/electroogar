import { useState, useEffect } from 'react'
import { supabase } from '@/app/lib/supabase'
import { 
  Users, 
  DollarSign, 
  TrendingUp, 
  AlertTriangle, 
  Calendar, 
  CreditCard, 
  Receipt,
  ArrowUpRight,
  ArrowDownRight,
  Clock,
  CheckCircle,
  XCircle,
  TrendingDown,
  Activity,
  Percent
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
}

interface Estadisticas {
  totalClientes: number
  ventasDelMes: number
  cobrosDelMes: number
  clientesVencidos: number
  pagosVencidosCount: number
  pagosHoyCount: number
  montoTotalPendiente: number
  montoVencido: number
  montoHoy: number
}

interface DashboardProps {
  estadisticas: Estadisticas
  notificaciones: NotificacionVencimiento[]
  onVerNotificaciones: () => void
  onRegistrarPago: () => void
  onNuevaVenta: () => void
}

interface ClienteConPrestamo {
  id: string
  nombre: string
  apellido: string
  telefono?: string
  transaccion_id: string
  monto_total: number
  monto_pendiente: number
  fecha_inicio: string
  numero_cuotas: number
  cuotas_pagadas: number
  descripcion?: string
  estado: string
}

export default function Dashboard({
  estadisticas,
  notificaciones,
  onVerNotificaciones,
  onRegistrarPago,
  onNuevaVenta,
}: DashboardProps) {
  const [clientesConPrestamos, setClientesConPrestamos] = useState<ClienteConPrestamo[]>([])
  const [loadingPrestamos, setLoadingPrestamos] = useState(true)
  const [mostrarTodosPrestamos, setMostrarTodosPrestamos] = useState(false)

  useEffect(() => {
    void cargarClientesConPrestamos()
  }, [])

  const cargarClientesConPrestamos = async () => {
    setLoadingPrestamos(true)
    try {
      // Single query with pagos embedded — eliminates N+1
      const { data: transacciones } = await supabase
        .from('transacciones')
        .select(`
          id,
          monto_total,
          numero_cuotas,
          fecha_inicio,
          descripcion,
          estado,
          cliente_id,
          clientes!inner (id, nombre, apellido, telefono),
          pagos (monto_pagado, estado)
        `)
        .eq('tipo_transaccion', 'prestamo')
        .in('estado', ['activo', 'completado'])
        .order('fecha_inicio', { ascending: false })
        .limit(100)

      if (transacciones) {
        const prestamos: ClienteConPrestamo[] = transacciones.map((trans: any) => {
          const pagos: any[] = trans.pagos || []
          const cuotasPagadas = pagos.filter((p: any) => p.estado === 'pagado').length
          const montoPagado = pagos.reduce((sum: number, p: any) => sum + (p.monto_pagado || 0), 0)
          const cliente = trans.clientes
          return {
            id: cliente.id,
            nombre: cliente.nombre,
            apellido: cliente.apellido || '',
            telefono: cliente.telefono,
            transaccion_id: trans.id,
            monto_total: trans.monto_total,
            monto_pendiente: Math.max(0, trans.monto_total - montoPagado),
            fecha_inicio: trans.fecha_inicio,
            numero_cuotas: trans.numero_cuotas,
            cuotas_pagadas: cuotasPagadas,
            descripcion: trans.descripcion,
            estado: trans.estado,
          }
        })
        setClientesConPrestamos(prestamos)
      }
    } catch (error) {
      console.error('Error cargando clientes con préstamos:', error)
    } finally {
      setLoadingPrestamos(false)
    }
  }

  const formatearMoneda = (monto: number) => {
    return new Intl.NumberFormat('es-AR', {
      style: 'currency',
      currency: 'ARS',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(monto || 0)
  }

  const formatearFecha = (fecha: string) => {
    try {
      const [year, month, day] = fecha.split('-').map(Number)
      const fechaObj = new Date(year, month - 1, day)
      return fechaObj.toLocaleDateString('es-AR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric'
      })
    } catch {
      return fecha
    }
  }

  // Listas para los paneles de detalle — vienen del padre (hasta 1000 items, suficiente para mostrar top 5)
  const notificacionesVencidas = notificaciones.filter(n => n.tipo === 'vencido')
  const notificacionesHoy      = notificaciones.filter(n => n.tipo === 'hoy')
  const notificacionesProximas = notificaciones.filter(n => n.tipo === 'por_vencer' && n.dias_vencimiento <= 7)

  // Conteos y montos exactos del padre (calculados con paginación completa)
  const pagosVencidosCount  = estadisticas?.pagosVencidosCount  || 0
  const pagosHoyCount       = estadisticas?.pagosHoyCount       || 0
  const montoVencido        = estadisticas?.montoVencido        || 0
  const montoHoy            = estadisticas?.montoHoy            || 0
  const montoProximo        = notificacionesProximas.reduce((sum, n) => sum + n.monto, 0)

  const efectividadCobros = estadisticas?.ventasDelMes > 0
    ? ((estadisticas.cobrosDelMes / estadisticas.ventasDelMes) * 100)
    : 0

  const promedioPorCliente = estadisticas?.clientesVencidos > 0
    ? montoVencido / estadisticas.clientesVencidos
    : 0

  const porcentajeClientesMora = estadisticas?.totalClientes > 0
    ? ((estadisticas.clientesVencidos / estadisticas.totalClientes) * 100)
    : 0

  const tarjetasEstadisticas = [
    {
      titulo: 'Total Clientes',
      valor: (estadisticas?.totalClientes || 0).toString(),
      subtitulo: null,
      icon: Users,
      color: 'from-blue-500 to-blue-600',
      bgColor: 'bg-blue-50',
      textColor: 'text-blue-600',
      descripcion: 'Clientes registrados',
    },
    {
      titulo: 'Ventas del Mes',
      valor: formatearMoneda(estadisticas?.ventasDelMes || 0),
      subtitulo: null,
      icon: TrendingUp,
      color: 'from-green-500 to-green-600',
      bgColor: 'bg-green-50',
      textColor: 'text-green-600',
      descripcion: 'Facturación este mes',
    },
    {
      titulo: 'Cobros del Mes',
      valor: formatearMoneda(estadisticas?.cobrosDelMes || 0),
      subtitulo: null,
      icon: DollarSign,
      color: 'from-emerald-500 to-emerald-600',
      bgColor: 'bg-emerald-50',
      textColor: 'text-emerald-600',
      descripcion: 'Ingresos cobrados este mes',
    },
    {
      titulo: 'Clientes en Mora',
      valor: (estadisticas?.clientesVencidos || 0).toString(),
      subtitulo: `${pagosVencidosCount} cuotas vencidas`,
      icon: AlertTriangle,
      color: 'from-red-500 to-red-600',
      bgColor: 'bg-red-50',
      textColor: 'text-red-600',
      descripcion: 'Con al menos 1 cuota vencida',
    },
    {
      titulo: 'Cartera Vencida',
      valor: formatearMoneda(montoVencido + montoHoy),
      subtitulo: `+ ${formatearMoneda(estadisticas?.montoTotalPendiente || 0)} total pendiente`,
      icon: CreditCard,
      color: 'from-orange-500 to-orange-600',
      bgColor: 'bg-orange-50',
      textColor: 'text-orange-600',
      descripcion: 'Vencido + vence hoy',
    },
  ]

  return (
    <div className="space-y-6">
      {/* Header del Dashboard */}
      <div className="bg-gradient-to-r from-blue-600 to-blue-700 rounded-xl shadow-lg p-6 text-white">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h2 className="text-2xl sm:text-3xl font-bold mb-2">Panel de Control</h2>
            <p className="text-blue-100 text-sm sm:text-base">
              Resumen general de tu negocio • {new Date().toLocaleDateString('es-AR', { 
                weekday: 'long', 
                year: 'numeric', 
                month: 'long', 
                day: 'numeric' 
              })}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <div className="bg-white/20 backdrop-blur-sm rounded-lg px-4 py-2">
              <div className="text-xs text-blue-100">Efectividad</div>
              <div className="text-xl font-bold">{efectividadCobros.toFixed(1)}%</div>
            </div>
          </div>
        </div>
      </div>

      {/* Tarjetas de estadísticas principales */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
        {tarjetasEstadisticas.map((tarjeta, index) => (
          <div
            key={index}
            className="group bg-white rounded-xl shadow-sm hover:shadow-lg transition-all duration-300 overflow-hidden border border-gray-100"
          >
            <div className="p-5">
              <div className="flex items-start justify-between mb-3">
                <div className={`${tarjeta.bgColor} p-3 rounded-xl group-hover:scale-110 transition-transform duration-300`}>
                  <tarjeta.icon className={`w-6 h-6 ${tarjeta.textColor}`} />
                </div>
              </div>

              <div className="space-y-0.5">
                <p className="text-sm font-medium text-gray-600">{tarjeta.titulo}</p>
                <p className="text-2xl font-bold text-gray-900 truncate">{tarjeta.valor}</p>
                {tarjeta.subtitulo && (
                  <p className={`text-xs font-medium ${tarjeta.textColor}`}>{tarjeta.subtitulo}</p>
                )}
                <p className="text-xs text-gray-400">{tarjeta.descripcion}</p>
              </div>
            </div>

            <div className="h-1 bg-gray-100">
              <div className={`h-full bg-gradient-to-r ${tarjeta.color}`} style={{ width: '75%' }} />
            </div>
          </div>
        ))}
      </div>

      {/* Alertas de vencimientos */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Pagos vencidos */}
        <div className="bg-white rounded-xl shadow-sm border border-red-100 overflow-hidden hover:shadow-md transition-shadow">
          <div className="bg-gradient-to-r from-red-50 to-red-100 p-4 border-b border-red-200">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <div className="bg-red-500 p-2 rounded-lg">
                  <AlertTriangle className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-red-900">Pagos Vencidos</h3>
                  <p className="text-xs text-red-600">{formatearMoneda(montoVencido)} pendiente</p>
                </div>
              </div>
              <div className="bg-red-500 text-white text-sm font-bold px-3 py-1.5 rounded-full shadow-sm">
                {pagosVencidosCount}
              </div>
            </div>
          </div>

          <div className="p-4 max-h-80 overflow-y-auto">
            {notificacionesVencidas.length > 0 ? (
              <div className="space-y-2">
                {notificacionesVencidas.slice(0, 5).map((notif, index) => (
                  <div 
                    key={index} 
                    className="group bg-red-50/50 hover:bg-red-50 rounded-lg p-3 border border-red-100 transition-all cursor-pointer"
                  >
                    <div className="flex justify-between items-start mb-2">
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-sm text-gray-900 truncate">
                          {notif.cliente_nombre} {notif.cliente_apellido || ''}
                        </p>
                        <div className="flex items-center gap-2 mt-1">
                          <span className="inline-flex items-center text-xs text-red-700 font-medium">
                            <XCircle className="w-3 h-3 mr-1" />
                            Vencido hace {Math.abs(notif.dias_vencimiento)} día{Math.abs(notif.dias_vencimiento) !== 1 ? 's' : ''}
                          </span>
                        </div>
                      </div>
                      <div className="text-right ml-2">
                        <p className="font-bold text-red-600 text-sm whitespace-nowrap">
                          {formatearMoneda(notif.monto)}
                        </p>
                        {notif.numero_cuota > 0 && (
                          <p className="text-xs text-gray-500 mt-1">Cuota #{notif.numero_cuota}</p>
                        )}
                      </div>
                    </div>
                    <div className="text-xs text-gray-600 truncate">
                      {notif.producto_nombre}
                    </div>
                  </div>
                ))}
                
                {pagosVencidosCount > 5 && (
                  <button
                    onClick={onVerNotificaciones}
                    className="w-full mt-3 py-2.5 bg-red-600 hover:bg-red-700 text-white text-sm font-medium rounded-lg transition-colors flex items-center justify-center gap-2"
                  >
                    Ver los {pagosVencidosCount} pagos vencidos
                    <ArrowUpRight className="w-4 h-4" />
                  </button>
                )}
              </div>
            ) : (
              <div className="text-center py-8">
                <CheckCircle className="w-12 h-12 text-green-500 mx-auto mb-2" />
                <p className="text-gray-600 text-sm font-medium">¡Excelente!</p>
                <p className="text-gray-500 text-xs mt-1">No hay pagos vencidos</p>
              </div>
            )}
          </div>
        </div>

        {/* Pagos de hoy */}
        <div className="bg-white rounded-xl shadow-sm border border-orange-100 overflow-hidden hover:shadow-md transition-shadow">
          <div className="bg-gradient-to-r from-orange-50 to-orange-100 p-4 border-b border-orange-200">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <div className="bg-orange-500 p-2 rounded-lg">
                  <Clock className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-orange-900">Vencen Hoy</h3>
                  <p className="text-xs text-orange-600">{formatearMoneda(montoHoy)} a cobrar</p>
                </div>
              </div>
              <div className="bg-orange-500 text-white text-sm font-bold px-3 py-1.5 rounded-full shadow-sm">
                {pagosHoyCount}
              </div>
            </div>
          </div>

          <div className="p-4 max-h-80 overflow-y-auto">
            {notificacionesHoy.length > 0 ? (
              <div className="space-y-2">
                {notificacionesHoy.map((notif, index) => (
                  <div 
                    key={index} 
                    className="group bg-orange-50/50 hover:bg-orange-50 rounded-lg p-3 border border-orange-100 transition-all cursor-pointer"
                  >
                    <div className="flex justify-between items-start mb-2">
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-sm text-gray-900 truncate">
                          {notif.cliente_nombre} {notif.cliente_apellido || ''}
                        </p>
                        <div className="flex items-center gap-2 mt-1">
                          <span className="inline-flex items-center text-xs text-orange-700 font-medium">
                            <Calendar className="w-3 h-3 mr-1" />
                            Vence hoy
                          </span>
                        </div>
                      </div>
                      <div className="text-right ml-2">
                        <p className="font-bold text-orange-600 text-sm whitespace-nowrap">
                          {formatearMoneda(notif.monto)}
                        </p>
                        {notif.numero_cuota > 0 && (
                          <p className="text-xs text-gray-500 mt-1">Cuota #{notif.numero_cuota}</p>
                        )}
                      </div>
                    </div>
                    <div className="text-xs text-gray-600 truncate">
                      {notif.producto_nombre}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8">
                <CheckCircle className="w-12 h-12 text-green-500 mx-auto mb-2" />
                <p className="text-gray-600 text-sm font-medium">Todo al día</p>
                <p className="text-gray-500 text-xs mt-1">No hay vencimientos para hoy</p>
              </div>
            )}
          </div>
        </div>

        {/* Próximos vencimientos */}
        <div className="bg-white rounded-xl shadow-sm border border-blue-100 overflow-hidden hover:shadow-md transition-shadow">
          <div className="bg-gradient-to-r from-blue-50 to-blue-100 p-4 border-b border-blue-200">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <div className="bg-blue-500 p-2 rounded-lg">
                  <Calendar className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-blue-900">Próximos 7 Días</h3>
                  <p className="text-xs text-blue-600">{formatearMoneda(montoProximo)} estimado</p>
                </div>
              </div>
              <div className="bg-blue-500 text-white text-sm font-bold px-3 py-1.5 rounded-full shadow-sm">
                {notificacionesProximas.length}
              </div>
            </div>
          </div>
          
          <div className="p-4 max-h-80 overflow-y-auto">
            {notificacionesProximas.length > 0 ? (
              <div className="space-y-2">
                {notificacionesProximas.slice(0, 5).map((notif, index) => (
                  <div 
                    key={index} 
                    className="group bg-blue-50/50 hover:bg-blue-50 rounded-lg p-3 border border-blue-100 transition-all cursor-pointer"
                  >
                    <div className="flex justify-between items-start mb-2">
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-sm text-gray-900 truncate">
                          {notif.cliente_nombre} {notif.cliente_apellido || ''}
                        </p>
                        <div className="flex items-center gap-2 mt-1">
                          <span className="inline-flex items-center text-xs text-blue-700 font-medium">
                            <Activity className="w-3 h-3 mr-1" />
                            En {notif.dias_vencimiento} día{notif.dias_vencimiento !== 1 ? 's' : ''}
                          </span>
                        </div>
                      </div>
                      <div className="text-right ml-2">
                        <p className="font-bold text-blue-600 text-sm whitespace-nowrap">
                          {formatearMoneda(notif.monto)}
                        </p>
                        {notif.numero_cuota > 0 && (
                          <p className="text-xs text-gray-500 mt-1">Cuota #{notif.numero_cuota}</p>
                        )}
                      </div>
                    </div>
                    <div className="text-xs text-gray-600 truncate">
                      {notif.producto_nombre}
                    </div>
                  </div>
                ))}
                
                {notificacionesProximas.length > 5 && (
                  <button
                    onClick={onVerNotificaciones}
                    className="w-full mt-3 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition-colors flex items-center justify-center gap-2"
                  >
                    Ver todos los {notificacionesProximas.length} próximos
                    <ArrowUpRight className="w-4 h-4" />
                  </button>
                )}
              </div>
            ) : (
              <div className="text-center py-8">
                <CheckCircle className="w-12 h-12 text-green-500 mx-auto mb-2" />
                <p className="text-gray-600 text-sm font-medium">Sin vencimientos</p>
                <p className="text-gray-500 text-xs mt-1">Próxima semana despejada</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Tabla de clientes con préstamos */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="bg-gradient-to-r from-purple-50 to-purple-100 p-5 border-b border-purple-200">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div className="flex items-center space-x-3">
              <div className="bg-purple-500 p-2.5 rounded-xl">
                <Receipt className="w-6 h-6 text-white" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-purple-900">Préstamos Activos</h3>
                <p className="text-xs text-purple-600">Seguimiento detallado de préstamos</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <div className="bg-purple-500 text-white text-sm font-bold px-4 py-2 rounded-full shadow-sm">
                {clientesConPrestamos.length} activo{clientesConPrestamos.length !== 1 ? 's' : ''}
              </div>
            </div>
          </div>
        </div>
        
        <div className="overflow-x-auto">
          {loadingPrestamos ? (
            <div className="flex items-center justify-center py-12">
              <div className="text-center">
                <div className="animate-spin rounded-full h-12 w-12 border-4 border-purple-200 border-t-purple-600 mx-auto mb-4"></div>
                <p className="text-gray-600 text-sm">Cargando préstamos...</p>
              </div>
            </div>
          ) : clientesConPrestamos.length > 0 ? (
            <>
              <div className="min-w-full">
                <table className="w-full">
                  <thead className="bg-gray-50 border-b-2 border-gray-200">
                    <tr>
                      <th className="text-left p-4 font-semibold text-xs uppercase tracking-wider text-gray-600">
                        Cliente
                      </th>
                      <th className="text-left p-4 font-semibold text-xs uppercase tracking-wider text-gray-600 hidden md:table-cell">
                        Descripción
                      </th>
                      <th className="text-right p-4 font-semibold text-xs uppercase tracking-wider text-gray-600">
                        Monto Total
                      </th>
                      <th className="text-right p-4 font-semibold text-xs uppercase tracking-wider text-gray-600">
                        Pendiente
                      </th>
                      <th className="text-center p-4 font-semibold text-xs uppercase tracking-wider text-gray-600 hidden lg:table-cell">
                        Progreso
                      </th>
                      <th className="text-left p-4 font-semibold text-xs uppercase tracking-wider text-gray-600 hidden xl:table-cell">
                        Fecha Inicio
                      </th>
                      <th className="text-center p-4 font-semibold text-xs uppercase tracking-wider text-gray-600">
                        Estado
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {(mostrarTodosPrestamos ? clientesConPrestamos : clientesConPrestamos.slice(0, 20)).map((cliente, index) => {
                      const porcentajePagado = (cliente.cuotas_pagadas / cliente.numero_cuotas) * 100
                      
                      return (
                        <tr 
                          key={index} 
                          className="hover:bg-purple-50/30 transition-colors group"
                        >
                          <td className="p-4">
                            <div>
                              <p className="font-semibold text-sm text-gray-900">
                                {cliente.nombre} {cliente.apellido}
                              </p>
                              {cliente.telefono && (
                                <p className="text-xs text-gray-500 mt-0.5">{cliente.telefono}</p>
                              )}
                            </div>
                          </td>
                          
                          <td className="p-4 hidden md:table-cell">
                            {cliente.descripcion ? (
                              <p className="text-sm text-gray-600 max-w-xs truncate" title={cliente.descripcion}>
                                {cliente.descripcion}
                              </p>
                            ) : (
                              <p className="text-sm text-gray-400 italic">Sin descripción</p>
                            )}
                          </td>
                          
                          <td className="p-4 text-right">
                            <p className="font-bold text-gray-900 text-sm">
                              {formatearMoneda(cliente.monto_total)}
                            </p>
                          </td>
                          
                          <td className="p-4 text-right">
                            <p className={`font-bold text-sm ${
                              cliente.monto_pendiente > 0 ? 'text-red-600' : 'text-green-600'
                            }`}>
                              {formatearMoneda(cliente.monto_pendiente)}
                            </p>
                          </td>
                          
                          <td className="p-4 hidden lg:table-cell">
                            <div className="space-y-1">
                              <div className="flex items-center justify-center gap-2 text-sm">
                                <span className="font-semibold text-green-600">
                                  {cliente.cuotas_pagadas}
                                </span>
                                <span className="text-gray-400">/</span>
                                <span className="font-semibold text-gray-900">
                                  {cliente.numero_cuotas}
                                </span>
                              </div>
                              <div className="w-full bg-gray-200 rounded-full h-2 overflow-hidden">
                                <div 
                                  className="bg-gradient-to-r from-green-500 to-green-600 h-2 rounded-full transition-all duration-500"
                                  style={{ width: `${porcentajePagado}%` }}
                                ></div>
                              </div>
                              <p className="text-xs text-center text-gray-500">
                                {porcentajePagado.toFixed(0)}% completado
                              </p>
                            </div>
                          </td>
                          
                          <td className="p-4 hidden xl:table-cell">
                            <p className="text-sm text-gray-600">
                              {formatearFecha(cliente.fecha_inicio)}
                            </p>
                          </td>
                          
                          <td className="p-4">
                            <div className="flex justify-center">
                              <span className={`px-3 py-1 rounded-full text-xs font-semibold ${
                                cliente.estado === 'activo'
                                  ? 'bg-green-100 text-green-700 border border-green-200'
                                  : 'bg-blue-100 text-blue-700 border border-blue-200'
                              }`}>
                                {cliente.estado === 'activo' ? '● Activo' : '✓ Completado'}
                              </span>
                            </div>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
              
              {clientesConPrestamos.length > 20 && (
                <div className="p-4 bg-gray-50 border-t border-gray-200">
                  <button
                    onClick={() => setMostrarTodosPrestamos(!mostrarTodosPrestamos)}
                    className="w-full py-3 bg-purple-600 hover:bg-purple-700 text-white text-sm font-semibold rounded-lg transition-colors flex items-center justify-center gap-2 shadow-sm hover:shadow-md"
                  >
                    {mostrarTodosPrestamos ? (
                      <>
                        <TrendingDown className="w-4 h-4" />
                        Mostrar menos
                      </>
                    ) : (
                      <>
                        <TrendingUp className="w-4 h-4" />
                        Mostrar todos ({clientesConPrestamos.length - 20} más)
                      </>
                    )}
                  </button>
                </div>
              )}
            </>
          ) : (
            <div className="text-center py-12">
              <Receipt className="w-16 h-16 text-gray-300 mx-auto mb-3" />
              <p className="text-gray-600 text-sm font-medium">No hay préstamos activos</p>
              <p className="text-gray-500 text-xs mt-1">Los préstamos aparecerán aquí cuando se registren</p>
            </div>
          )}
        </div>
      </div>

      {/* Indicadores clave */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="bg-gradient-to-r from-indigo-50 to-indigo-100 p-5 border-b border-indigo-200">
          <div className="flex items-center space-x-3">
            <div className="bg-indigo-500 p-2.5 rounded-xl">
              <Activity className="w-6 h-6 text-white" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-indigo-900">Indicadores Clave</h3>
              <p className="text-xs text-indigo-600">Métricas de desempeño del negocio</p>
            </div>
          </div>
        </div>
        
        <div className="p-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="text-center group hover:scale-105 transition-transform">
              <div className="bg-green-50 rounded-xl p-6 border-2 border-green-100">
                <div className="flex items-center justify-center mb-3">
                  <Percent className="w-8 h-8 text-green-600" />
                </div>
                <div className="text-3xl font-bold text-green-600 mb-2">
                  {efectividadCobros.toFixed(1)}%
                </div>
                <div className="text-sm font-medium text-gray-700 mb-1">Efectividad de Cobros</div>
                <div className="text-xs text-gray-500">
                  {efectividadCobros >= 80 ? '🎯 Excelente rendimiento' : 
                   efectividadCobros >= 60 ? '📈 Buen desempeño' : 
                   '⚠️ Necesita mejorar'}
                </div>
                <div className="mt-3 w-full bg-gray-200 rounded-full h-2">
                  <div 
                    className="bg-green-600 h-2 rounded-full"
                    style={{ width: `${Math.min(efectividadCobros, 100)}%` }}
                  ></div>
                </div>
              </div>
            </div>
            
            <div className="text-center group hover:scale-105 transition-transform">
              <div className="bg-blue-50 rounded-xl p-6 border-2 border-blue-100">
                <div className="flex items-center justify-center mb-3">
                  <DollarSign className="w-8 h-8 text-blue-600" />
                </div>
                <div className="text-3xl font-bold text-blue-600 mb-2">
                  {formatearMoneda(promedioPorCliente)}
                </div>
                <div className="text-sm font-medium text-gray-700 mb-1">Deuda Promedio en Mora</div>
                <div className="text-xs text-gray-500">Por cliente con cuotas vencidas</div>
                <div className="mt-3 flex items-center justify-center gap-2 text-xs">
                  <div className="bg-blue-100 px-2 py-1 rounded">
                    Cartera total: {formatearMoneda(estadisticas.montoTotalPendiente)}
                  </div>
                </div>
              </div>
            </div>
            
            <div className="text-center group hover:scale-105 transition-transform">
              <div className="bg-orange-50 rounded-xl p-6 border-2 border-orange-100">
                <div className="flex items-center justify-center mb-3">
                  <AlertTriangle className="w-8 h-8 text-orange-600" />
                </div>
                <div className="text-3xl font-bold text-orange-600 mb-2">
                  {porcentajeClientesMora.toFixed(1)}%
                </div>
                <div className="text-sm font-medium text-gray-700 mb-1">Tasa de Mora</div>
                <div className="text-xs text-gray-500">
                  {estadisticas.clientesVencidos} de {estadisticas.totalClientes} clientes
                </div>
                <div className="mt-3 w-full bg-gray-200 rounded-full h-2">
                  <div 
                    className={`h-2 rounded-full ${
                      porcentajeClientesMora > 20 ? 'bg-red-600' :
                      porcentajeClientesMora > 10 ? 'bg-orange-600' :
                      'bg-yellow-600'
                    }`}
                    style={{ width: `${Math.min(porcentajeClientesMora, 100)}%` }}
                  ></div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Acciones rápidas */}
      <div className="bg-gradient-to-r from-gray-50 to-gray-100 rounded-xl shadow-sm border border-gray-200 p-6">
        <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
          <div className="w-1 h-6 bg-blue-600 rounded-full"></div>
          Acciones Rápidas
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          <button
            onClick={onVerNotificaciones}
            className="group bg-white hover:bg-red-50 border-2 border-gray-200 hover:border-red-500 rounded-xl p-4 transition-all duration-300 shadow-sm hover:shadow-md"
          >
            <div className="flex items-center space-x-3">
              <div className="bg-red-100 group-hover:bg-red-500 p-3 rounded-lg transition-colors">
                <AlertTriangle className="w-5 h-5 text-red-600 group-hover:text-white transition-colors" />
              </div>
              <div className="text-left">
                <p className="font-semibold text-gray-900 text-sm">Ver Vencimientos</p>
                <p className="text-xs text-gray-500">Gestionar pagos pendientes</p>
              </div>
            </div>
          </button>
          
          <button
            onClick={onRegistrarPago}
            className="group bg-white hover:bg-blue-50 border-2 border-gray-200 hover:border-blue-500 rounded-xl p-4 transition-all duration-300 shadow-sm hover:shadow-md"
          >
            <div className="flex items-center space-x-3">
              <div className="bg-blue-100 group-hover:bg-blue-500 p-3 rounded-lg transition-colors">
                <CreditCard className="w-5 h-5 text-blue-600 group-hover:text-white transition-colors" />
              </div>
              <div className="text-left">
                <p className="font-semibold text-gray-900 text-sm">Registrar Pago</p>
                <p className="text-xs text-gray-500">Ingresar nuevo cobro</p>
              </div>
            </div>
          </button>
          
          <button
            onClick={onNuevaVenta}
            className="group bg-white hover:bg-green-50 border-2 border-gray-200 hover:border-green-500 rounded-xl p-4 transition-all duration-300 shadow-sm hover:shadow-md"
          >
            <div className="flex items-center space-x-3">
              <div className="bg-green-100 group-hover:bg-green-500 p-3 rounded-lg transition-colors">
                <Users className="w-5 h-5 text-green-600 group-hover:text-white transition-colors" />
              </div>
              <div className="text-left">
                <p className="font-semibold text-gray-900 text-sm">Nueva Venta</p>
                <p className="text-xs text-gray-500">Crear transacción</p>
              </div>
            </div>
          </button>
        </div>
      </div>
    </div>
  )
}