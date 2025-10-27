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
import { Bell, CreditCard, FileText, Users, DollarSign, AlertTriangle, Menu } from 'lucide-react'

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

  const cargarNotificaciones = async () => {
    const hoy = new Date()
    hoy.setHours(0, 0, 0, 0)
    const fechaLimite = new Date()
    fechaLimite.setDate(hoy.getDate() + 15)
    const { data } = await supabase
      .from('pagos')
      .select(`
        *,
        transaccion:transacciones(
          id,
          cliente_id,
          numero_factura,
          monto_total,
          monto_cuota,
          tipo_transaccion,
          cliente:clientes(id, nombre, apellido, telefono, email),
          producto:productos(nombre)
        )
      `)
      .in('estado', ['pendiente', 'parcial'])
      .lte('fecha_vencimiento', fechaLimite.toISOString().split('T')[0])
      .order('fecha_vencimiento')
    if (data) {
      const saldosPorCliente = new Map<string, number>()
      data.forEach(pago => {
        const clienteId = pago.transaccion?.cliente?.id
        if (clienteId) {
          const montoCuota = pago.monto_cuota || pago.transaccion?.monto_cuota || 0
          const montoPagado = pago.monto_pagado || 0
          const montoRestante = montoCuota - montoPagado
          const saldoActual = saldosPorCliente.get(clienteId) || 0
          saldosPorCliente.set(clienteId, saldoActual + montoRestante)
        }
      })
      const notificacionesMapeadas: NotificacionVencimiento[] = data.map(pago => {
        const [y, m, d] = pago.fecha_vencimiento.split('-').map(Number)
        const fechaVenc = new Date(y, m - 1, d)
        fechaVenc.setHours(0, 0, 0, 0)
        const diff = Math.floor((fechaVenc.getTime() - hoy.getTime()) / (1000 * 60 * 60 * 24))
        let tipo: 'vencido' | 'por_vencer' | 'hoy'
        if (diff < 0) tipo = 'vencido'
        else if (diff === 0) tipo = 'hoy'
        else tipo = 'por_vencer'
        const clienteId = pago.transaccion?.cliente?.id || ''
        const montoCuota = pago.monto_cuota || 0
        const montoPagado = pago.monto_pagado || 0
        const montoRestante = montoCuota - montoPagado
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
          producto_nombre: pago.transaccion?.producto?.nombre || 'Préstamo de Dinero',
          transaccion_id: pago.transaccion?.id || '',
          saldo_total_cliente: saldosPorCliente.get(clienteId) || 0,
          tipo_transaccion: pago.transaccion?.tipo_transaccion || 'venta',
          numero_factura: pago.transaccion?.numero_factura
        }
      })
      setNotificaciones(notificacionesMapeadas)
    }
  }

  const cargarEstadisticas = async () => {
    const hoy = new Date()
    const inicioMes = new Date(hoy.getFullYear(), hoy.getMonth(), 1)
    try {
      const { count: totalClientes } = await supabase.from('clientes').select('*', { count: 'exact', head: true })
      const { data: ventasMes } = await supabase.from('transacciones').select('monto_total').gte('created_at', inicioMes.toISOString())
      const { data: cobrosMes } = await supabase.from('pagos').select('monto_pagado').eq('estado', 'pagado').gte('fecha_pago', inicioMes.toISOString().split('T')[0])
      const { count: clientesVencidos } = await supabase.from('pagos').select('transaccion_id', { count: 'exact', head: true }).eq('estado', 'pendiente').lt('fecha_vencimiento', hoy.toISOString().split('T')[0])
      const { data: montosPendientes } = await supabase.from('pagos').select('monto_cuota').in('estado', ['pendiente', 'parcial'])
      setEstadisticas({
        totalClientes: totalClientes || 0,
        ventasDelMes: ventasMes?.reduce((s, v) => s + v.monto_total, 0) || 0,
        cobrosDelMes: cobrosMes?.reduce((s, v) => s + v.monto_pagado, 0) || 0,
        clientesVencidos: clientesVencidos || 0,
        montoTotalPendiente: montosPendientes?.reduce((s, p) => s + p.monto_cuota, 0) || 0
      })
    } catch (err) {
      console.error('Error cargando estadísticas:', err)
    }
  }

  const clienteActual = clientes.find(c => c.id === clienteSeleccionado)
  const notificacionesUrgentes = notificaciones.filter(n => n.tipo === 'vencido' || n.tipo === 'hoy')

  const renderVistaActiva = () => {
    switch (vistaActiva) {
      case 'dashboard':
        return <Dashboard estadisticas={estadisticas} notificaciones={notificaciones} onVerNotificaciones={() => setVistaActiva('notificaciones')} onRegistrarPago={() => setVistaActiva('pagos')} onNuevaVenta={() => { setVistaActiva('clientes'); setMostrarNuevaVenta(true) }} />
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
      case 'notificaciones': return <PanelNotificaciones notificaciones={notificaciones} onActualizar={cargarNotificaciones} />
      default: return null
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* HEADER */}
      <header className="bg-white shadow-sm border-b sticky top-0 z-50">
        <div className="flex items-center justify-between px-4 py-3 sm:px-6 lg:px-8">
          <div className="flex items-center space-x-2">
            <button className="lg:hidden p-2 rounded-md text-gray-700 hover:bg-gray-100" onClick={() => setMenuAbierto(!menuAbierto)}>
              <Menu className="w-6 h-6" />
            </button>
            <div>
              <h1 className="text-xl sm:text-2xl font-bold text-gray-900">Sistema de Cobranzas</h1>
              <p className="text-xs sm:text-sm text-gray-500">Gestión profesional de cobranzas y cuentas corrientes</p>
            </div>
          </div>
          {notificacionesUrgentes.length > 0 && (
            <button onClick={() => setVistaActiva('notificaciones')} className="relative p-2 text-red-600 hover:bg-red-50 rounded-full">
              <Bell className="w-6 h-6" />
              <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">{notificacionesUrgentes.length}</span>
            </button>
          )}
        </div>
      </header>

      {/* NAVIGATION */}
      <nav className={`bg-white shadow-sm lg:block ${menuAbierto ? 'block' : 'hidden'}`}>
        <div className="overflow-x-auto lg:overflow-visible">
          <div className="flex lg:justify-center space-x-4 px-4">
            {[
              { id: 'dashboard', label: 'Dashboard', icon: DollarSign },
              { id: 'clientes', label: 'Clientes', icon: Users },
              { id: 'pagos', label: 'Pagos', icon: CreditCard },
              { id: 'recibos', label: 'Recibos', icon: FileText },
              { id: 'notificaciones', label: 'Notificaciones', icon: AlertTriangle }
            ].map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                onClick={() => { setVistaActiva(id as any); setMenuAbierto(false) }}
                className={`flex items-center space-x-2 py-3 px-3 border-b-2 font-medium text-sm transition-colors whitespace-nowrap ${
                  vistaActiva === id
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                <Icon className="w-4 h-4" />
                <span>{label}</span>
                {id === 'notificaciones' && notificacionesUrgentes.length > 0 && (
                  <span className="bg-red-500 text-white text-xs rounded-full w-4 h-4 flex items-center justify-center">
                    {notificacionesUrgentes.length}
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>
      </nav>

      {/* MAIN CONTENT */}
      <main className="flex-1 max-w-7xl mx-auto w-full py-6 px-4 sm:px-6 lg:px-8">
        {loading && vistaActiva === 'clientes' ? (
          <div className="flex items-center justify-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            <span className="ml-2 text-gray-600">Cargando...</span>
          </div>
        ) : (
          renderVistaActiva()
        )}
      </main>
    </div>
  )
}
