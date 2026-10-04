import { useState, useEffect } from 'react'
import { supabase } from '@/app/lib/supabase'
import {
  Users,
  DollarSign,
  TrendingUp,
  AlertTriangle,
  Calendar,
  CreditCard,
  ArrowUpRight,
  Clock,
  CheckCircle,
  XCircle,
  TrendingDown,
} from 'lucide-react'
import EstadoBadge from '@/app/components/ui/EstadoBadge'
import PageHero from '@/app/components/ui/PageHero'

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
  cargandoNotificaciones?: boolean
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
  cargandoNotificaciones = false,
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
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
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

  // Mientras cargan las listas, mostrar esqueletos (no "todo al día")
  const cargandoListas = cargandoNotificaciones
  const esqueletoLista = (
    <div className="space-y-2" role="status" aria-live="polite">
      <span className="sr-only">Cargando cuotas…</span>
      {[0, 1, 2].map((i) => (
        <div key={i} className="rounded-lg p-3 border border-line space-y-2">
          <div className="skeleton h-4 w-2/3" />
          <div className="skeleton h-3 w-1/2" />
        </div>
      ))}
    </div>
  )

  const efectividadCobros = estadisticas?.ventasDelMes > 0
    ? ((estadisticas.cobrosDelMes / estadisticas.ventasDelMes) * 100)
    : 0

  const promedioPorCliente = estadisticas?.clientesVencidos > 0
    ? montoVencido / estadisticas.clientesVencidos
    : 0

  const porcentajeClientesMora = estadisticas?.totalClientes > 0
    ? ((estadisticas.clientesVencidos / estadisticas.totalClientes) * 100)
    : 0

  // Tarjetas KPI principales (solo presentación de valores ya calculados)
  const tarjetasEstadisticas = [
    {
      titulo: 'Total a cobrar',
      valor: formatearMoneda(estadisticas?.montoTotalPendiente || 0),
      subtitulo: null,
      icon: DollarSign,
      emoji: '💰',
      tinte: 'tint-primary',
      tile: 'bg-primary/10 text-primary',
      acento: 'border-l-primary',
      descripcion: 'Todas las cuotas pendientes',
    },
    {
      titulo: 'Cobrado este mes',
      valor: formatearMoneda(estadisticas?.cobrosDelMes || 0),
      subtitulo: null,
      icon: CheckCircle,
      emoji: '✅',
      tinte: 'tint-success',
      tile: 'bg-success-soft text-success-text',
      acento: 'border-l-success',
      descripcion: 'Pagos registrados en el mes',
    },
    {
      titulo: 'Vencido',
      valor: formatearMoneda(montoVencido),
      subtitulo: `${pagosVencidosCount} cuota${pagosVencidosCount !== 1 ? 's' : ''} · ${estadisticas?.clientesVencidos || 0} cliente${(estadisticas?.clientesVencidos || 0) !== 1 ? 's' : ''}`,
      icon: AlertTriangle,
      emoji: '🚨',
      tinte: 'tint-danger',
      tile: 'bg-danger-soft text-danger-text',
      acento: 'border-l-danger',
      descripcion: 'Cuotas con fecha ya pasada',
    },
    {
      titulo: 'Por vencer (7 días)',
      valor: formatearMoneda(montoProximo),
      subtitulo: `Hoy: ${formatearMoneda(montoHoy)} · ${pagosHoyCount} cuota${pagosHoyCount !== 1 ? 's' : ''}`,
      icon: Clock,
      emoji: '⏰',
      tinte: 'tint-warning',
      tile: 'bg-warning-soft text-warning-text',
      acento: 'border-l-warning',
      descripcion: `${notificacionesProximas.length} cuota${notificacionesProximas.length !== 1 ? 's' : ''} en la próxima semana`,
    },
  ]

  return (
    <div className="space-y-6">
      {/* Header del Dashboard */}
      <PageHero
        emoji="📊"
        titulo="Resumen"
        subtitulo={<span className="first-letter:uppercase inline-block">{new Date().toLocaleDateString('es-AR', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</span>}
      >
          <button onClick={onRegistrarPago} className="btn-primary">
            <CreditCard className="w-4 h-4" />
            Registrar pago
          </button>
          <button onClick={onNuevaVenta} className="btn-secondary">
            <Users className="w-4 h-4" />
            Nueva venta o préstamo
          </button>
          <button onClick={onVerNotificaciones} className="btn-secondary">
            <AlertTriangle className="w-4 h-4" />
            Ver vencimientos
          </button>
      </PageHero>

      {/* Tarjetas de estadísticas principales */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        {tarjetasEstadisticas.map((tarjeta, index) => (
          <div
            key={index}
            className={`card card-hover animate-aparecer p-5 border-l-4 ${tarjeta.acento} ${tarjeta.tinte}`}
          >
            <div className="flex items-center gap-3 mb-3">
              <div className={`icon-tile ${tarjeta.tile}`}>
                <span className="emoji text-xl" aria-hidden="true">{tarjeta.emoji}</span>
              </div>
              <p className="text-sm font-medium text-muted">{tarjeta.titulo}</p>
            </div>
            <p className="text-2xl font-bold text-fg num truncate">{tarjeta.valor}</p>
            {tarjeta.subtitulo && (
              <p className="text-xs font-medium text-fg mt-1 num">{tarjeta.subtitulo}</p>
            )}
            <p className="text-xs text-muted mt-1">{tarjeta.descripcion}</p>
          </div>
        ))}
      </div>

      {/* Alertas de vencimientos */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Pagos vencidos */}
        <section className="card overflow-hidden border-t-4 border-t-danger">
          <div className="card-header">
            <div className="flex items-center gap-3 min-w-0">
              <div className="icon-tile bg-danger-soft text-danger-text">
                <span className="emoji text-xl" aria-hidden="true">🚨</span>
              </div>
              <div className="min-w-0">
                <h3 className="text-base font-semibold text-fg">Cuotas vencidas</h3>
                <p className="text-xs text-muted num">{formatearMoneda(montoVencido)} sin cobrar</p>
              </div>
            </div>
            <span className="badge-danger num">
              {pagosVencidosCount}
            </span>
          </div>

          <div className="p-3 max-h-80 overflow-y-auto">
            {cargandoListas ? esqueletoLista : notificacionesVencidas.length > 0 ? (
              <div className="space-y-2">
                {notificacionesVencidas.slice(0, 5).map((notif, index) => (
                  <div
                    key={index}
                    className="rounded-lg p-3 border border-line hover:bg-surface-2 transition-colors"
                  >
                    <div className="flex justify-between items-start gap-2">
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-sm text-fg truncate">
                          {notif.cliente_nombre} {notif.cliente_apellido || ''}
                        </p>
                        <p className="text-xs text-muted truncate mt-0.5">
                          {notif.producto_nombre}
                          {notif.numero_cuota > 0 && <> · Cuota {notif.numero_cuota}</>}
                        </p>
                      </div>
                      <p className="font-semibold text-fg text-sm whitespace-nowrap num">
                        {formatearMoneda(notif.monto)}
                      </p>
                    </div>
                    <span className="badge-danger mt-2">
                      <XCircle className="w-3.5 h-3.5" />
                      Vencida hace {Math.abs(notif.dias_vencimiento)} día{Math.abs(notif.dias_vencimiento) !== 1 ? 's' : ''}
                    </span>
                  </div>
                ))}

                {pagosVencidosCount > 5 && (
                  <button
                    onClick={onVerNotificaciones}
                    className="btn-secondary w-full"
                  >
                    Ver las {pagosVencidosCount} cuotas vencidas
                    <ArrowUpRight className="w-4 h-4" />
                  </button>
                )}
              </div>
            ) : (
              <div className="empty-state py-8">
                <span className="empty-emoji" aria-hidden="true">🎉</span>
                <p className="text-sm font-medium text-fg">No hay cuotas vencidas</p>
                <p className="text-xs mt-1">Todos los clientes están al día.</p>
              </div>
            )}
          </div>
        </section>

        {/* Pagos de hoy */}
        <section className="card overflow-hidden border-t-4 border-t-warning">
          <div className="card-header">
            <div className="flex items-center gap-3 min-w-0">
              <div className="icon-tile bg-warning-soft text-warning-text">
                <span className="emoji text-xl" aria-hidden="true">⏰</span>
              </div>
              <div className="min-w-0">
                <h3 className="text-base font-semibold text-fg">Vencen hoy</h3>
                <p className="text-xs text-muted num">{formatearMoneda(montoHoy)} a cobrar</p>
              </div>
            </div>
            <span className="badge-warning num">
              {pagosHoyCount}
            </span>
          </div>

          <div className="p-3 max-h-80 overflow-y-auto">
            {cargandoListas ? esqueletoLista : notificacionesHoy.length > 0 ? (
              <div className="space-y-2">
                {notificacionesHoy.map((notif, index) => (
                  <div
                    key={index}
                    className="rounded-lg p-3 border border-line hover:bg-surface-2 transition-colors"
                  >
                    <div className="flex justify-between items-start gap-2">
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-sm text-fg truncate">
                          {notif.cliente_nombre} {notif.cliente_apellido || ''}
                        </p>
                        <p className="text-xs text-muted truncate mt-0.5">
                          {notif.producto_nombre}
                          {notif.numero_cuota > 0 && <> · Cuota {notif.numero_cuota}</>}
                        </p>
                      </div>
                      <p className="font-semibold text-fg text-sm whitespace-nowrap num">
                        {formatearMoneda(notif.monto)}
                      </p>
                    </div>
                    <span className="badge-warning mt-2">
                      <Calendar className="w-3.5 h-3.5" />
                      Vence hoy
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="empty-state py-8">
                <span className="empty-emoji" aria-hidden="true">😌</span>
                <p className="text-sm font-medium text-fg">Nada para hoy</p>
                <p className="text-xs mt-1">No hay cuotas que venzan hoy.</p>
              </div>
            )}
          </div>
        </section>

        {/* Próximos vencimientos */}
        <section className="card overflow-hidden border-t-4 border-t-primary">
          <div className="card-header">
            <div className="flex items-center gap-3 min-w-0">
              <div className="icon-tile bg-primary/10 text-primary">
                <span className="emoji text-xl" aria-hidden="true">📅</span>
              </div>
              <div className="min-w-0">
                <h3 className="text-base font-semibold text-fg">Próximos 7 días</h3>
                <p className="text-xs text-muted num">{formatearMoneda(montoProximo)} a cobrar</p>
              </div>
            </div>
            <span className="badge-primary num">
              {notificacionesProximas.length}
            </span>
          </div>

          <div className="p-3 max-h-80 overflow-y-auto">
            {cargandoListas ? esqueletoLista : notificacionesProximas.length > 0 ? (
              <div className="space-y-2">
                {notificacionesProximas.slice(0, 5).map((notif, index) => (
                  <div
                    key={index}
                    className="rounded-lg p-3 border border-line hover:bg-surface-2 transition-colors"
                  >
                    <div className="flex justify-between items-start gap-2">
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-sm text-fg truncate">
                          {notif.cliente_nombre} {notif.cliente_apellido || ''}
                        </p>
                        <p className="text-xs text-muted truncate mt-0.5">
                          {notif.producto_nombre}
                          {notif.numero_cuota > 0 && <> · Cuota {notif.numero_cuota}</>}
                        </p>
                      </div>
                      <p className="font-semibold text-fg text-sm whitespace-nowrap num">
                        {formatearMoneda(notif.monto)}
                      </p>
                    </div>
                    <span className="badge-warning mt-2">
                      <Clock className="w-3.5 h-3.5" />
                      Vence en {notif.dias_vencimiento} día{notif.dias_vencimiento !== 1 ? 's' : ''}
                    </span>
                  </div>
                ))}

                {notificacionesProximas.length > 5 && (
                  <button
                    onClick={onVerNotificaciones}
                    className="btn-secondary w-full"
                  >
                    Ver las {notificacionesProximas.length} cuotas próximas
                    <ArrowUpRight className="w-4 h-4" />
                  </button>
                )}
              </div>
            ) : (
              <div className="empty-state py-8">
                <span className="empty-emoji" aria-hidden="true">🌤️</span>
                <p className="text-sm font-medium text-fg">Semana tranquila</p>
                <p className="text-xs mt-1">No hay cuotas en los próximos 7 días.</p>
              </div>
            )}
          </div>
        </section>
      </div>

      {/* Indicadores clave */}
      <section className="card">
        <div className="card-header">
          <h3 className="section-title">
            <span className="emoji" aria-hidden="true">📈</span>
            Indicadores del mes
          </h3>
        </div>

        <div className="card-body grid grid-cols-2 lg:grid-cols-5 gap-4">
          <div className="p-4 rounded-lg bg-surface-2">
            <p className="text-xs font-medium text-muted flex items-center gap-1.5"><span className="emoji" aria-hidden="true">👥</span> Clientes</p>
            <p className="text-2xl font-bold text-fg num mt-1">{estadisticas?.totalClientes || 0}</p>
            <p className="text-xs text-muted mt-1">Registrados</p>
          </div>

          <div className="p-4 rounded-lg bg-surface-2">
            <p className="text-xs font-medium text-muted flex items-center gap-1.5"><span className="emoji" aria-hidden="true">📈</span> Ventas del mes</p>
            <p className="text-lg font-bold text-fg num mt-1 truncate">{formatearMoneda(estadisticas?.ventasDelMes || 0)}</p>
            <p className="text-xs text-muted mt-1">Ventas y préstamos nuevos</p>
          </div>

          <div className="p-4 rounded-lg bg-surface-2">
            <p className="text-xs font-medium text-muted flex items-center gap-1.5"><span className="emoji" aria-hidden="true">🎯</span> Efectividad de cobro</p>
            <p className="text-2xl font-bold text-fg num mt-1">{efectividadCobros.toFixed(1)}%</p>
            <div className="mt-2 w-full bg-line rounded-full h-1.5">
              <div
                className="bg-success h-1.5 rounded-full"
                style={{ width: `${Math.min(efectividadCobros, 100)}%` }}
              ></div>
            </div>
            <p className="text-xs text-muted mt-1.5">
              {efectividadCobros >= 80 ? 'Muy buen nivel' :
               efectividadCobros >= 60 ? 'Nivel aceptable' :
               'Por debajo de lo esperado'}
            </p>
          </div>

          <div className="p-4 rounded-lg bg-surface-2">
            <p className="text-xs font-medium text-muted flex items-center gap-1.5"><span className="emoji" aria-hidden="true">💸</span> Deuda vencida promedio</p>
            <p className="text-lg font-bold text-fg num mt-1 truncate">{formatearMoneda(promedioPorCliente)}</p>
            <p className="text-xs text-muted mt-1">Por cliente con cuotas vencidas</p>
          </div>

          <div className="p-4 rounded-lg bg-surface-2 col-span-2 lg:col-span-1">
            <p className="text-xs font-medium text-muted flex items-center gap-1.5"><span className="emoji" aria-hidden="true">⚠️</span> Clientes con atraso</p>
            <p className="text-2xl font-bold text-fg num mt-1">{porcentajeClientesMora.toFixed(1)}%</p>
            <div className="mt-2 w-full bg-line rounded-full h-1.5">
              <div
                className={`h-1.5 rounded-full ${
                  porcentajeClientesMora > 20 ? 'bg-danger' :
                  porcentajeClientesMora > 10 ? 'bg-warning' :
                  'bg-success'
                }`}
                style={{ width: `${Math.min(porcentajeClientesMora, 100)}%` }}
              ></div>
            </div>
            <p className="text-xs text-muted mt-1.5 num">
              {estadisticas.clientesVencidos} de {estadisticas.totalClientes} clientes
            </p>
          </div>
        </div>
      </section>

      {/* Tabla de clientes con préstamos */}
      <section className="card overflow-hidden">
        <div className="card-header">
          <div className="flex items-center gap-3">
            <div className="icon-tile bg-reprog-soft text-reprog-text">
              <span className="emoji text-xl" aria-hidden="true">💸</span>
            </div>
            <div>
              <h3 className="text-base font-semibold text-fg">Préstamos</h3>
              <p className="text-xs text-muted">Avance de cobro de cada préstamo</p>
            </div>
          </div>
          <span className="badge-neutral num">
            {clientesConPrestamos.length} préstamo{clientesConPrestamos.length !== 1 ? 's' : ''}
          </span>
        </div>

        <div className="overflow-x-auto">
          {loadingPrestamos ? (
            <div className="p-4 space-y-3" role="status" aria-live="polite">
              <span className="sr-only">Cargando préstamos…</span>
              {[0, 1, 2, 3].map((i) => (
                <div key={i} className="flex items-center gap-4">
                  <div className="skeleton h-4 w-1/4" />
                  <div className="skeleton h-4 w-1/6 ml-auto" />
                  <div className="skeleton h-4 w-1/6" />
                  <div className="skeleton h-6 w-20 rounded-full" />
                </div>
              ))}
            </div>
          ) : clientesConPrestamos.length > 0 ? (
            <>
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Cliente</th>
                    <th className="hidden md:table-cell">Descripción</th>
                    <th className="!text-right">Total</th>
                    <th className="!text-right">Saldo</th>
                    <th className="!text-center hidden lg:table-cell">Cuotas pagadas</th>
                    <th className="hidden xl:table-cell">Inicio</th>
                    <th className="!text-center">Estado</th>
                  </tr>
                </thead>
                <tbody>
                  {(mostrarTodosPrestamos ? clientesConPrestamos : clientesConPrestamos.slice(0, 20)).map((cliente, index) => {
                    const porcentajePagado = (cliente.cuotas_pagadas / cliente.numero_cuotas) * 100

                    return (
                      <tr key={index}>
                        <td>
                          <p className="font-medium text-fg">
                            {cliente.nombre} {cliente.apellido}
                          </p>
                          {cliente.telefono && (
                            <p className="text-xs text-muted mt-0.5">{cliente.telefono}</p>
                          )}
                        </td>

                        <td className="hidden md:table-cell">
                          {cliente.descripcion ? (
                            <p className="text-muted max-w-xs truncate" title={cliente.descripcion}>
                              {cliente.descripcion}
                            </p>
                          ) : (
                            <p className="text-muted/70 italic">Sin descripción</p>
                          )}
                        </td>

                        <td className="text-right font-medium text-fg num whitespace-nowrap">
                          {formatearMoneda(cliente.monto_total)}
                        </td>

                        <td className={`text-right font-semibold num whitespace-nowrap ${
                          cliente.monto_pendiente > 0 ? 'text-danger-text' : 'text-success-text'
                        }`}>
                          {formatearMoneda(cliente.monto_pendiente)}
                        </td>

                        <td className="hidden lg:table-cell">
                          <div className="min-w-[120px]">
                            <div className="flex items-center justify-between text-xs mb-1 num">
                              <span className="font-medium text-fg">
                                {cliente.cuotas_pagadas} de {cliente.numero_cuotas}
                              </span>
                              <span className="text-muted">{porcentajePagado.toFixed(0)}%</span>
                            </div>
                            <div className="w-full bg-line rounded-full h-1.5 overflow-hidden">
                              <div
                                className="bg-success h-1.5 rounded-full transition-all duration-500"
                                style={{ width: `${porcentajePagado}%` }}
                              ></div>
                            </div>
                          </div>
                        </td>

                        <td className="hidden xl:table-cell text-muted num whitespace-nowrap">
                          {formatearFecha(cliente.fecha_inicio)}
                        </td>

                        <td className="text-center">
                          {cliente.estado === 'activo'
                            ? <EstadoBadge estado="activo" texto="En curso" />
                            : <EstadoBadge estado="completado" />}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>

              {clientesConPrestamos.length > 20 && (
                <div className="p-4 border-t border-line">
                  <button
                    onClick={() => setMostrarTodosPrestamos(!mostrarTodosPrestamos)}
                    className="btn-secondary w-full"
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
            <div className="empty-state">
              <span className="empty-emoji" aria-hidden="true">💸</span>
              <p className="text-sm font-medium text-fg">Todavía no hay préstamos</p>
              <p className="text-xs mt-1">Cuando registres un préstamo, vas a ver su avance acá.</p>
            </div>
          )}
        </div>
      </section>

    </div>
  )
}
