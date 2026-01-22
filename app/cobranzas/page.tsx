'use client'
import { useState, useEffect } from 'react'
import { supabase } from '@/app/lib/supabase'
import { Cliente, Transaccion, Pago, Producto, NotificacionVencimiento } from '@/app/lib/types/cobranzas'
import BusquedaCliente from './components/BusquedaCliente'
import InfoCliente from './components/InfoCliente'
import FormularioVenta from './components/FormularioVenta'
import HistorialTransacciones from './components/HistorialTransacciones'
import CuentaCorriente from './components/CuentaCorriente'
import GestorPagos from './components/GestorPagos'
import GeneradorRecibos from './components/GeneradorRecibos'
import PanelNotificaciones from './components/PanelNotificaciones'
import Dashboard from './components/Dashboard'
import { 
  Bell, 
  Menu, 
  LayoutDashboard,
  X,
  Zap,
  Users,
  FileText,
  AlertTriangle
} from 'lucide-react'

export default function CobranzasPage() {
  const [clientes, setClientes] = useState<Cliente[]>([])
  const [clienteSeleccionado, setClienteSeleccionado] = useState<string>('')
  const [transacciones, setTransacciones] = useState<Transaccion[]>([])
  const [pagos, setPagos] = useState<{ [key: string]: Pago[] }>({})
  const [productos, setProductos] = useState<Producto[]>([])
  const [notificaciones, setNotificaciones] = useState<NotificacionVencimiento[]>([])
  const [mostrarNuevaVenta, setMostrarNuevaVenta] = useState(false)
  const [vistaActiva, setVistaActiva] = useState<'dashboard' | 'clientes' | 'pagos' | 'recibos' | 'notificaciones'>('dashboard')
  const [loading, setLoading] = useState(false)
  const [menuAbierto, setMenuAbierto] = useState(false)

  const [estadisticas, setEstadisticas] = useState({
    totalClientes: 0,
    ventasDelMes: 0,
    cobrosDelMes: 0,
    clientesVencidos: 0,
    montoTotalPendiente: 0
  })

  useEffect(() => {
    cargarDatosIniciales()
    cargarNotificaciones()
    cargarEstadisticas()
    const interval = setInterval(cargarNotificaciones, 300000)
    return () => clearInterval(interval)
  }, [])

  useEffect(() => {
    if (clienteSeleccionado) cargarHistorial(clienteSeleccionado)
    else {
      setTransacciones([])
      setPagos({})
    }
  }, [clienteSeleccionado])

  const cargarDatosIniciales = async () => {
    setLoading(true)
    try {
      await Promise.all([cargarClientes(), cargarProductos()])
    } finally {
      setLoading(false)
    }
  }

  const cargarClientes = async () => {
    const { data } = await supabase.from('clientes').select('*').order('nombre')
    if (data) setClientes(data)
  }

  const cargarProductos = async () => {
    const { data } = await supabase.from('productos').select('*').order('nombre')
    if (data) setProductos(data)
  }

  const cargarHistorial = async (clienteId: string) => {
    setLoading(true)
    try {
      const { data: transData } = await supabase
        .from('transacciones')
        .select(`*, producto:productos(nombre, precio_unitario)`)
        .eq('cliente_id', clienteId)
        .order('created_at', { ascending: false })
      if (transData) {
        setTransacciones(transData)
        const pagosPorTransaccion: { [key: string]: Pago[] } = {}
        for (const trans of transData) {
          const { data: pagosData } = await supabase
            .from('pagos')
            .select('*')
            .eq('transaccion_id', trans.id)
            .order('numero_cuota')
          if (pagosData) pagosPorTransaccion[trans.id] = pagosData
        }
        setPagos(pagosPorTransaccion)
      }
    } finally {
      setLoading(false)
    }
  }

  const obtenerMontoCuota = (pago: any) => {
    let montoBase = 0
    if (pago.monto_cuota && pago.monto_cuota > 0) {
      montoBase = pago.monto_cuota
    } else {
      montoBase = pago.transaccion?.monto_cuota || 0
    }
    const interesesMora = pago.intereses_mora || 0
    return montoBase + interesesMora
  }

  const obtenerNombreTransaccion = (transaccion: any) => {
    if (transaccion?.producto?.nombre) {
      return transaccion.producto.nombre
    }
    return transaccion?.tipo_transaccion === 'prestamo' ? 'Préstamo de Dinero' : 'Venta'
  }

  const cargarNotificaciones = async () => {
    const hoy = new Date()
    hoy.setHours(0, 0, 0, 0)
    const fechaLimite = new Date()
    fechaLimite.setDate(hoy.getDate() + 15)
    
    try {
      const { data: notificacionesRango } = await supabase
        .from('pagos')
        .select(`
          *,
          transaccion:transacciones(
            id,
            cliente_id,
            numero_factura,
            monto_total,
            monto_cuota,
            numero_cuotas,
            tipo_transaccion,
            fecha_inicio,
            cliente:clientes(id, nombre, apellido, telefono, email),
            producto:productos(nombre)
          )
        `)
        .in('estado', ['pendiente', 'parcial', 'reprogramado'])
        .lte('fecha_vencimiento', fechaLimite.toISOString().split('T')[0])
        .order('fecha_vencimiento')
      
      if (!notificacionesRango) return

      const transaccionIds = [...new Set(notificacionesRango
        .map(p => p.transaccion?.id)
        .filter(Boolean))]

      const { data: todosPagosCompletos } = await supabase
        .from('pagos')
        .select('*')
        .in('transaccion_id', transaccionIds)

      const saldosPorTransaccion = new Map<string, number>()
      
      if (todosPagosCompletos) {
        interface PagosAgrupados {
          [key: string]: any[]
        }
        
        const pagosAgrupados = todosPagosCompletos.reduce<PagosAgrupados>((acc, pago) => {
          const tid = pago.transaccion_id
          if (!acc[tid]) acc[tid] = []
          acc[tid].push(pago)
          return acc
        }, {})

        Object.entries(pagosAgrupados).forEach(([transaccionId, pagos]: [string, any[]]) => {
          let saldoTotalTransaccion = 0
          
          pagos.forEach((pago: any) => {
            if (pago.estado !== 'pagado') {
              const montoCuota = pago.monto_cuota || 0
              const intereses = pago.intereses_mora || 0
              const totalCuota = montoCuota + intereses
              const pagado = pago.monto_pagado || 0
              const restante = totalCuota - pagado
              
              saldoTotalTransaccion += restante
            }
          })
          
          saldosPorTransaccion.set(transaccionId, saldoTotalTransaccion)
        })
      }
      
      const notificacionesMapeadas: NotificacionVencimiento[] = notificacionesRango.map(pago => {
        const [y, m, d] = pago.fecha_vencimiento.split('-').map(Number)
        const fechaVenc = new Date(y, m - 1, d)
        fechaVenc.setHours(0, 0, 0, 0)
        const diff = Math.floor((fechaVenc.getTime() - hoy.getTime()) / (1000 * 60 * 60 * 24))
        
        let tipo: 'vencido' | 'por_vencer' | 'hoy'
        if (diff < 0) tipo = 'vencido'
        else if (diff === 0) tipo = 'hoy'
        else tipo = 'por_vencer'
        
        const clienteId = pago.transaccion?.cliente?.id || ''
        const transaccionId = pago.transaccion?.id || ''
        
        const montoCuota = obtenerMontoCuota(pago)
        const montoPagado = pago.monto_pagado || 0
        const montoRestante = montoCuota - montoPagado
        
        let saldoTotal = saldosPorTransaccion.get(transaccionId) || 0
        
        if (saldoTotal === 0 && pago.transaccion?.monto_total) {
          const montoTotal = pago.transaccion.monto_total
          saldoTotal = montoTotal
        }
        
        return {
          id: pago.id,
          cliente_id: clienteId,
          cliente_nombre: pago.transaccion?.cliente?.nombre || 'Desconocido',
          cliente_apellido: pago.transaccion?.cliente?.apellido || '',
          cliente_telefono: pago.transaccion?.cliente?.telefono,
          cliente_email: pago.transaccion?.cliente?.email,
          
          monto: montoRestante,
          monto_cuota: montoCuota,
          monto_cuota_total: montoCuota,
          monto_pagado: montoPagado,
          monto_restante: montoRestante,
          
          fecha_vencimiento: pago.fecha_vencimiento,
          dias_vencimiento: diff,
          tipo,
          numero_cuota: pago.numero_cuota || 0,
          producto_nombre: obtenerNombreTransaccion(pago.transaccion),
          transaccion_id: transaccionId,
          
          saldo_total_cliente: saldoTotal,
          
          tipo_transaccion: pago.transaccion?.tipo_transaccion || 'venta',
          numero_factura: pago.transaccion?.numero_factura,
          fecha_inicio: pago.transaccion?.fecha_inicio || '',
          
          fecha_reprogramacion: pago.fecha_reprogramacion || undefined,
          intereses_mora: pago.intereses_mora || undefined,
          motivo_reprogramacion: pago.motivo_reprogramacion || undefined,
          
          transaccion: pago.transaccion
        }
      })
      
      setNotificaciones(notificacionesMapeadas)
    } catch (error) {
      console.error('Error cargando notificaciones:', error)
    }
  }

  const cargarEstadisticas = async () => {
    const hoy = new Date()
    hoy.setHours(0, 0, 0, 0)
    const inicioMes = new Date(hoy.getFullYear(), hoy.getMonth(), 1)
    const hoyStr = hoy.toISOString().split('T')[0]
    
    try {
      const { count: totalClientes } = await supabase
        .from('clientes')
        .select('*', { count: 'exact', head: true })
      
      const { data: ventasMes } = await supabase
        .from('transacciones')
        .select('monto_total')
        .gte('created_at', inicioMes.toISOString())
      
      const { data: cobrosMes } = await supabase
        .from('pagos')
        .select('monto_pagado')
        .eq('estado', 'pagado')
        .gte('fecha_pago', inicioMes.toISOString().split('T')[0])
      
      const { data: pagosVencidos } = await supabase
        .from('pagos')
        .select('transaccion_id, transaccion:transacciones!inner(cliente_id)')
        .in('estado', ['pendiente', 'parcial', 'reprogramado'])
        .lt('fecha_vencimiento', hoyStr)
      
      const clientesVencidosUnicos = new Set<string>()
      pagosVencidos?.forEach(p => {
        if (p.transaccion && 'cliente_id' in p.transaccion) {
          const clienteId = (p.transaccion as any).cliente_id
          if (clienteId) clientesVencidosUnicos.add(clienteId)
        }
      })
      
      // ✅ CALCULAR MONTO URGENTE AQUÍ DIRECTAMENTE (vencidos + hoy)
      const { data: pagosUrgentes } = await supabase
        .from('pagos')
        .select('transaccion_id, monto_cuota, monto_pagado, intereses_mora, estado')
        .in('estado', ['pendiente', 'parcial', 'reprogramado'])
        .lte('fecha_vencimiento', hoyStr)
      
      const transaccionesUrgentes = [...new Set(pagosUrgentes?.map(p => p.transaccion_id) || [])]
      const saldoPorTransaccion = new Map()
      
      for (const transId of transaccionesUrgentes) {
        const { data: todosPagos } = await supabase
          .from('pagos')
          .select('*')
          .eq('transaccion_id', transId)
        
        let saldo = 0
        todosPagos?.forEach(p => {
          if (p.estado !== 'pagado') {
            const montoCuota = p.monto_cuota || 0
            const intereses = p.intereses_mora || 0
            const pagado = p.monto_pagado || 0
            saldo += (montoCuota + intereses - pagado)
          }
        })
        
        saldoPorTransaccion.set(transId, saldo)
      }
      
      const montoTotalPendiente = Array.from(saldoPorTransaccion.values())
        .reduce((sum, val) => sum + val, 0)
      
      setEstadisticas({
        totalClientes: totalClientes || 0,
        ventasDelMes: ventasMes?.reduce((s, v) => s + v.monto_total, 0) || 0,
        cobrosDelMes: cobrosMes?.reduce((s, v) => s + v.monto_pagado, 0) || 0,
        clientesVencidos: clientesVencidosUnicos.size,
        montoTotalPendiente: montoTotalPendiente // ✅ Calculado aquí
      })
      
    } catch (err) {
      console.error('Error cargando estadísticas:', err)
    }
  }

  const clienteActual = clientes.find(c => c.id === clienteSeleccionado)
  const notificacionesUrgentes = notificaciones.filter(n => n.tipo === 'vencido' || n.tipo === 'hoy')

  const verCuentaCliente = (clienteId: string) => {
    setClienteSeleccionado(clienteId)
    setVistaActiva('clientes')
    setMostrarNuevaVenta(false)
  }

  const renderVistaActiva = () => {
    switch (vistaActiva) {
      case 'dashboard':
        // ✅ SIN onActualizarMontoUrgente
        return <Dashboard 
          estadisticas={estadisticas} 
          onVerNotificaciones={() => setVistaActiva('notificaciones')} 
          onRegistrarPago={() => setVistaActiva('pagos')} 
          onNuevaVenta={() => { setVistaActiva('clientes'); setMostrarNuevaVenta(true) }} 
        />
      case 'clientes':
        return (
          <div className="space-y-6">
            <BusquedaCliente clientes={clientes} clienteSeleccionado={clienteSeleccionado} onClienteSeleccionado={setClienteSeleccionado} />
            {clienteActual && (
              <>
                <InfoCliente cliente={clienteActual} mostrarFormulario={mostrarNuevaVenta} onToggleFormulario={() => setMostrarNuevaVenta(!mostrarNuevaVenta)} />
                {mostrarNuevaVenta && <FormularioVenta clienteId={clienteSeleccionado} productos={productos} onVentaCreada={() => { setMostrarNuevaVenta(false); cargarHistorial(clienteSeleccionado) }} onCancelar={() => setMostrarNuevaVenta(false)} />}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  <CuentaCorriente clienteId={clienteSeleccionado} transacciones={transacciones} pagos={pagos} />
                  <HistorialTransacciones cliente={clienteActual} transacciones={transacciones} pagos={pagos} onPagoRegistrado={() => cargarHistorial(clienteSeleccionado)} onEliminarTransaccion={() => cargarHistorial(clienteSeleccionado)} loading={loading} />
                </div>
              </>
            )}
          </div>
        )
      case 'pagos': return <GestorPagos clientes={clientes} onPagoRegistrado={() => cargarHistorial(clienteSeleccionado)} />
      case 'recibos': return <GeneradorRecibos clientes={clientes} transacciones={transacciones} pagos={pagos} />
      case 'notificaciones': return <PanelNotificaciones notificaciones={notificaciones} onActualizar={cargarNotificaciones} onVerCuentaCliente={verCuentaCliente} />
      default: return null
    }
  }

  const tabs = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard, color: 'emerald' },
    { id: 'clientes', label: 'Clientes', icon: Users, color: 'blue' },
    { id: 'recibos', label: 'Recibos', icon: FileText, color: 'purple' },
    { id: 'notificaciones', label: 'Notificaciones', icon: AlertTriangle, color: 'orange' }
  ]

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-slate-800 relative overflow-hidden">
      {/* Animated background pattern */}
      <div className="absolute inset-0 overflow-hidden opacity-10">
        <div className="absolute inset-0" style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23ffffff' fill-opacity='0.4'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`,
        }}></div>
      </div>

      {/* Floating shapes */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-20 left-10 w-64 h-64 bg-emerald-500/10 rounded-full blur-3xl animate-pulse"></div>
        <div className="absolute bottom-20 right-10 w-80 h-80 bg-blue-500/10 rounded-full blur-3xl animate-pulse animation-delay-2000"></div>
        <div className="absolute top-1/2 right-1/3 w-96 h-96 bg-purple-500/10 rounded-full blur-3xl animate-pulse animation-delay-4000"></div>
      </div>

      <div className="relative">
        {/* HEADER */}
        <header className="backdrop-blur-xl bg-slate-800/40 border-b border-slate-700/50 sticky top-0 z-40 shadow-xl">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex items-center justify-between py-4">
              <div className="flex items-center space-x-3">
                <button 
                  className="lg:hidden p-2 rounded-lg text-slate-300 hover:bg-slate-700/50 transition-colors" 
                  onClick={() => setMenuAbierto(!menuAbierto)}
                >
                  {menuAbierto ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
                </button>
                
                <div className="flex items-center gap-3">
                  <div className="relative">
                    <div className="absolute inset-0 bg-gradient-to-r from-emerald-500 to-blue-500 rounded-lg blur opacity-50"></div>
                    <div className="relative bg-gradient-to-br from-slate-700 to-slate-800 w-10 h-10 sm:w-12 sm:h-12 rounded-lg flex items-center justify-center border border-emerald-500/30">
                      <Zap className="w-5 h-5 sm:w-6 sm:h-6 text-emerald-400" strokeWidth={2.5} />
                    </div>
                  </div>
                  
                  <div>
                    <h1 className="text-lg sm:text-xl font-bold text-white">Sistema de Cobranzas</h1>
                    <p className="text-xs text-slate-400 hidden sm:block">Gestión profesional de cobranzas</p>
                  </div>
                </div>
              </div>

              {/* Notificaciones */}
              {notificacionesUrgentes.length > 0 && (
                <button 
                  onClick={() => setVistaActiva('notificaciones')} 
                  className="group relative p-3 hover:bg-red-500/10 rounded-xl transition-all"
                >
                  <div className="absolute inset-0 bg-gradient-to-r from-red-600 to-orange-600 rounded-xl blur opacity-0 group-hover:opacity-50 transition-opacity"></div>
                  <div className="relative flex items-center gap-2">
                    <Bell className="w-5 h-5 sm:w-6 sm:h-6 text-red-400 group-hover:text-red-300 transition-colors" />
                    <div className="absolute -top-1 -right-1 bg-gradient-to-r from-red-500 to-orange-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center font-bold shadow-lg">
                      {notificacionesUrgentes.length}
                    </div>
                  </div>
                </button>
              )}
            </div>

            {/* NAVIGATION - Desktop */}
            <nav className="hidden lg:block pb-4">
              <div className="flex space-x-2">
                {tabs.map(({ id, label, icon: Icon, color }) => {
                  const isActive = vistaActiva === id
                  const colorClasses = {
                    emerald: {
                      active: 'from-emerald-600 to-emerald-500 text-white border-emerald-400/50',
                      inactive: 'text-slate-300 hover:text-emerald-400 border-transparent hover:border-emerald-500/30'
                    },
                    blue: {
                      active: 'from-blue-600 to-blue-500 text-white border-blue-400/50',
                      inactive: 'text-slate-300 hover:text-blue-400 border-transparent hover:border-blue-500/30'
                    },
                    purple: {
                      active: 'from-purple-600 to-purple-500 text-white border-purple-400/50',
                      inactive: 'text-slate-300 hover:text-purple-400 border-transparent hover:border-purple-500/30'
                    },
                    orange: {
                      active: 'from-orange-600 to-red-500 text-white border-orange-400/50',
                      inactive: 'text-slate-300 hover:text-orange-400 border-transparent hover:border-orange-500/30'
                    }
                  }
                  
                  const classes = colorClasses[color as keyof typeof colorClasses]
                  
                  return (
                    <button
                      key={id}
                      onClick={() => { setVistaActiva(id as any); setMenuAbierto(false) }}
                      className={`group relative flex items-center space-x-2 px-5 py-3 rounded-lg font-medium text-sm transition-all ${
                        isActive 
                          ? `bg-gradient-to-r ${classes.active} shadow-lg`
                          : `backdrop-blur-sm bg-slate-800/30 ${classes.inactive} border hover:bg-slate-700/30`
                      }`}
                    >
                      {isActive && (
                        <div className="absolute inset-0 bg-gradient-to-r from-white/20 to-transparent rounded-lg"></div>
                      )}
                      <Icon className={`w-4 h-4 relative z-10 ${isActive ? 'animate-pulse' : ''}`} />
                      <span className="relative z-10">{label}</span>
                      {id === 'notificaciones' && notificacionesUrgentes.length > 0 && (
                        <div className="relative z-10 bg-white text-red-600 text-xs rounded-full w-5 h-5 flex items-center justify-center font-bold ml-1">
                          {notificacionesUrgentes.length}
                        </div>
                      )}
                    </button>
                  )
                })}
              </div>
            </nav>
          </div>
        </header>

        {/* NAVIGATION - Mobile */}
        {menuAbierto && (
          <div className="lg:hidden backdrop-blur-xl bg-slate-800/95 border-b border-slate-700/50 shadow-xl">
            <div className="max-w-7xl mx-auto px-4 py-4 space-y-2">
              {tabs.map(({ id, label, icon: Icon, color }) => {
                const isActive = vistaActiva === id
                const colorClasses = {
                  emerald: {
                    active: 'from-emerald-600 to-emerald-500 text-white',
                    inactive: 'text-slate-300 hover:text-emerald-400'
                  },
                  blue: {
                    active: 'from-blue-600 to-blue-500 text-white',
                    inactive: 'text-slate-300 hover:text-blue-400'
                  },
                  purple: {
                    active: 'from-purple-600 to-purple-500 text-white',
                    inactive: 'text-slate-300 hover:text-purple-400'
                  },
                  orange: {
                    active: 'from-orange-600 to-red-500 text-white',
                    inactive: 'text-slate-300 hover:text-orange-400'
                  }
                }
                
                const classes = colorClasses[color as keyof typeof colorClasses]
                
                return (
                  <button
                    key={id}
                    onClick={() => { setVistaActiva(id as any); setMenuAbierto(false) }}
                    className={`w-full flex items-center justify-between px-4 py-3 rounded-lg font-medium text-sm transition-all ${
                      isActive 
                        ? `bg-gradient-to-r ${classes.active} shadow-lg`
                        : `bg-slate-800/30 ${classes.inactive} hover:bg-slate-700/30`
                    }`}
                  >
                    <div className="flex items-center space-x-3">
                      <Icon className="w-5 h-5" />
                      <span>{label}</span>
                    </div>
                    {id === 'notificaciones' && notificacionesUrgentes.length > 0 && (
                      <div className="bg-white text-red-600 text-xs rounded-full w-6 h-6 flex items-center justify-center font-bold">
                        {notificacionesUrgentes.length}
                      </div>
                    )}
                  </button>
                )
              })}
            </div>
          </div>
        )}

        {/* MAIN CONTENT */}
        <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
          {loading && vistaActiva === 'clientes' ? (
            <div className="flex flex-col items-center justify-center py-20">
              <div className="relative">
                <div className="absolute inset-0 bg-gradient-to-r from-emerald-500 to-blue-500 rounded-full blur-xl opacity-50 animate-pulse"></div>
                <div className="relative animate-spin rounded-full h-12 w-12 border-4 border-slate-700 border-t-emerald-400"></div>
              </div>
              <span className="mt-4 text-slate-300 font-medium">Cargando datos...</span>
            </div>
          ) : (
            <div className="animate-fade-in">
              {renderVistaActiva()}
            </div>
          )}
        </main>

        {/* Status indicator */}
        <div className="fixed bottom-6 right-6 z-40">
          <div className="backdrop-blur-sm bg-slate-800/80 rounded-full px-4 py-2 border border-slate-700/50 shadow-xl">
            <div className="flex items-center gap-2 text-sm">
              <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></div>
              <span className="text-slate-300 font-medium">Sistema activo</span>
            </div>
          </div>
        </div>
      </div>

      {/* Custom animations */}
      <style jsx>{`
        @keyframes fade-in {
          from {
            opacity: 0;
            transform: translateY(10px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        .animate-fade-in {
          animation: fade-in 0.5s ease-out;
        }

        .animation-delay-2000 {
          animation-delay: 2s;
        }

        .animation-delay-4000 {
          animation-delay: 4s;
        }
      `}</style>
    </div>
  )
}