'use client'
import { useState, useEffect } from 'react'
import { supabase } from '@/app/lib/supabase'
import { fechaLocalISO } from '@/app/lib/fechas'
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
  Users,
  FileText,
  AlertTriangle,
} from 'lucide-react'

export default function CobranzasPage() {
  const [clientes, setClientes] = useState<Cliente[]>([])
  const [clienteSeleccionado, setClienteSeleccionado] = useState<string>('')
  const [transacciones, setTransacciones] = useState<Transaccion[]>([])
  const [pagos, setPagos] = useState<{ [key: string]: Pago[] }>({})
  const [productos, setProductos] = useState<Producto[]>([])
  const [notificaciones, setNotificaciones] = useState<NotificacionVencimiento[]>([])
  const [notificacionesCargadas, setNotificacionesCargadas] = useState(false)
  const [mostrarNuevaVenta, setMostrarNuevaVenta] = useState(false)
  const [vistaActiva, setVistaActiva] = useState<'dashboard' | 'clientes' | 'pagos' | 'recibos' | 'notificaciones'>('dashboard')
  const [loading, setLoading] = useState(false)
  const [menuAbierto, setMenuAbierto] = useState(false)

  const [estadisticas, setEstadisticas] = useState({
    totalClientes: 0,
    ventasDelMes: 0,
    cobrosDelMes: 0,
    clientesVencidos: 0,
    pagosVencidosCount: 0,
    pagosHoyCount: 0,
    montoTotalPendiente: 0,
    montoVencido: 0,
    montoHoy: 0,
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
    // Desde "Registrar pago" se llama sin cliente elegido: no hay historial que recargar
    if (!clienteId) return
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
        .order('fecha_vencimiento')
      
      if (!notificacionesRango) { setNotificacionesCargadas(true); return }

      const transaccionIds = [...new Set(notificacionesRango
        .map(p => p.transaccion?.id)
        .filter(Boolean))]

      // Se consulta en lotes: con cientos de ids la URL queda demasiado larga y Supabase
      // responde 400. Cada lote se pagina porque Supabase devuelve como máximo 1000 filas.
      const LOTE_IDS = 100
      const POR_PAGINA = 1000
      const lotes: string[][] = []
      for (let i = 0; i < transaccionIds.length; i += LOTE_IDS) lotes.push(transaccionIds.slice(i, i + LOTE_IDS))
      // Los lotes se piden en paralelo para que cargue más rápido
      const resultadosLotes = await Promise.all(lotes.map(async (lote) => {
        const filas: any[] = []
        for (let desde = 0; ; desde += POR_PAGINA) {
          const { data: pagina, error } = await supabase
            .from('pagos')
            .select('transaccion_id, estado, monto_cuota, intereses_mora, monto_pagado')
            .in('transaccion_id', lote)
            .range(desde, desde + POR_PAGINA - 1)
          if (error) throw error
          if (!pagina || pagina.length === 0) break
          filas.push(...pagina)
          if (pagina.length < POR_PAGINA) break
        }
        return filas
      }))
      const todosPagosCompletos: any[] = resultadosLotes.flat()

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
      setNotificacionesCargadas(true)
    } catch (error) {
      console.error('Error cargando notificaciones:', error)
      setNotificacionesCargadas(true)
    }
  }

  const cargarEstadisticas = async () => {
    const hoy = new Date()
    hoy.setHours(0, 0, 0, 0)
    const inicioMes = new Date(hoy.getFullYear(), hoy.getMonth(), 1)
    const y = hoy.getFullYear()
    const m = String(hoy.getMonth() + 1).padStart(2, '0')
    const d = String(hoy.getDate()).padStart(2, '0')
    const hoyStr = `${y}-${m}-${d}`

    try {
      // Consultas independientes en paralelo (conteos exactos via DB)
      const [
        { count: totalClientes },
        { data: ventasMes },
        { data: cobrosMes },
        { count: pagosVencidosCount },
        { count: pagosHoyCount },
      ] = await Promise.all([
        supabase.from('clientes').select('*', { count: 'exact', head: true }),
        supabase.from('transacciones').select('monto_total').gte('created_at', inicioMes.toISOString()),
        supabase.from('pagos').select('monto_pagado').eq('estado', 'pagado').gte('fecha_pago', fechaLocalISO(inicioMes)),
        supabase.from('pagos').select('*', { count: 'exact', head: true })
          .in('estado', ['pendiente', 'parcial', 'reprogramado'])
          .lt('fecha_vencimiento', hoyStr),
        supabase.from('pagos').select('*', { count: 'exact', head: true })
          .in('estado', ['pendiente', 'parcial', 'reprogramado'])
          .eq('fecha_vencimiento', hoyStr),
      ])

      // Paginar TODOS los pagos pendientes para montos y clientes únicos en mora.
      // LEFT JOIN (sin !inner) para incluir pagos con monto_cuota propio aunque
      // el join con transacciones no resuelva (evita subcuenta).
      let allPendientes: any[] = []
      let from = 0
      while (true) {
        const { data: page } = await supabase
          .from('pagos')
          .select('monto_cuota, monto_pagado, intereses_mora, fecha_vencimiento, transaccion_id, transaccion:transacciones(monto_cuota, cliente_id)')
          .in('estado', ['pendiente', 'parcial', 'reprogramado'])
          .range(from, from + 999)
        if (!page || page.length === 0) break
        allPendientes = allPendientes.concat(page)
        if (page.length < 1000) break
        from += 1000
      }

      const calcularMonto = (lista: any[]) =>
        lista.reduce((sum, p: any) => {
          const t = Array.isArray(p.transaccion) ? p.transaccion[0] : p.transaccion
          const cuotaBase = (p.monto_cuota && p.monto_cuota > 0) ? p.monto_cuota : (t?.monto_cuota || 0)
          const cuota = cuotaBase + (p.intereses_mora || 0)
          const pagado = p.monto_pagado || 0
          return sum + Math.max(0, cuota - pagado)
        }, 0)

      const vencidos = allPendientes.filter((p: any) => p.fecha_vencimiento < hoyStr)
      const hoys    = allPendientes.filter((p: any) => p.fecha_vencimiento === hoyStr)

      // Clientes únicos con al menos un pago vencido
      const clientesVencidosUnicos = new Set<string>()
      vencidos.forEach((p: any) => {
        const t = Array.isArray(p.transaccion) ? p.transaccion[0] : p.transaccion
        if (t?.cliente_id) clientesVencidosUnicos.add(t.cliente_id)
      })

      setEstadisticas({
        totalClientes:       totalClientes || 0,
        ventasDelMes:        ventasMes?.reduce((s, v) => s + v.monto_total, 0) || 0,
        cobrosDelMes:        cobrosMes?.reduce((s, v) => s + v.monto_pagado, 0) || 0,
        clientesVencidos:    clientesVencidosUnicos.size,
        pagosVencidosCount:  pagosVencidosCount || 0,
        pagosHoyCount:       pagosHoyCount || 0,
        montoTotalPendiente: calcularMonto(allPendientes),
        montoVencido:        calcularMonto(vencidos),
        montoHoy:            calcularMonto(hoys),
      })

    } catch (err) {
      console.error('Error cargando estadísticas:', err)
    }
  }

  const clienteActual = clientes.find(c => c.id === clienteSeleccionado)
  const notificacionesUrgentes = notificaciones.filter(n => n.tipo === 'vencido' || n.tipo === 'hoy')

  const eliminarTransaccion = async (transaccionId: string): Promise<void> => {
    // Revert all paid pagos back to pending first
    await supabase
      .from('pagos')
      .update({ estado: 'pendiente', fecha_pago: null, monto_pagado: 0, numero_recibo: null, metodo_pago: null })
      .eq('transaccion_id', transaccionId)
      .eq('estado', 'pagado')

    // Delete all pagos for this transaction
    await supabase.from('pagos').delete().eq('transaccion_id', transaccionId)

    // Delete the transaction
    await supabase.from('transacciones').delete().eq('id', transaccionId)

    // Reload data
    await cargarHistorial(clienteSeleccionado)
    await cargarEstadisticas()
  }

  const verCuentaCliente = (clienteId: string) => {
    setClienteSeleccionado(clienteId)
    setVistaActiva('clientes')
    setMostrarNuevaVenta(false)
  }

  const renderVistaActiva = () => {
    switch (vistaActiva) {
      case 'dashboard':
        return <Dashboard
          estadisticas={estadisticas}
          notificaciones={notificaciones}
          cargandoNotificaciones={!notificacionesCargadas}
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
                <InfoCliente cliente={clienteActual} mostrarFormulario={mostrarNuevaVenta} onToggleFormulario={() => setMostrarNuevaVenta(!mostrarNuevaVenta)} onClienteActualizado={cargarClientes} />
                {mostrarNuevaVenta && <FormularioVenta clienteId={clienteSeleccionado} productos={productos} onVentaCreada={() => { setMostrarNuevaVenta(false); cargarHistorial(clienteSeleccionado) }} onCancelar={() => setMostrarNuevaVenta(false)} />}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  {/* En el celular, primero las ventas/préstamos; en escritorio, cuenta corriente a la izquierda */}
                  <div className="order-2 lg:order-1 min-w-0"><CuentaCorriente clienteId={clienteSeleccionado} transacciones={transacciones} pagos={pagos} onTransaccionesUpdate={() => cargarHistorial(clienteSeleccionado)} /></div>
                  <div className="order-1 lg:order-2 min-w-0"><HistorialTransacciones cliente={clienteActual} transacciones={transacciones} pagos={pagos} onPagoRegistrado={() => cargarHistorial(clienteSeleccionado)} onEliminarTransaccion={eliminarTransaccion} loading={loading} /></div>
                </div>
              </>
            )}
          </div>
        )
      case 'pagos': return <GestorPagos clientes={clientes} onPagoRegistrado={() => cargarHistorial(clienteSeleccionado)} />
      case 'recibos': return <GeneradorRecibos clientes={clientes} transacciones={transacciones} pagos={pagos} />
      case 'notificaciones': return <PanelNotificaciones onActualizar={cargarNotificaciones} onVerCuentaCliente={verCuentaCliente} />
      default: return null
    }
  }

  const tabs = [
    { id: 'dashboard', label: 'Resumen', icon: LayoutDashboard, color: 'emerald' },
    { id: 'clientes', label: 'Clientes', icon: Users, color: 'blue' },
    { id: 'recibos', label: 'Recibos', icon: FileText, color: 'purple' },
    { id: 'notificaciones', label: 'Notificaciones', icon: AlertTriangle, color: 'orange' }
  ]

  return (
    <div className="page">
      {/* HEADER */}
      <header className="bg-surface border-b border-line">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between gap-3 pt-5 pb-3">
            <div className="flex items-center gap-3 min-w-0">
              <div className="icon-tile bg-primary/10 text-primary">
                <span className="emoji text-xl" aria-hidden="true">💰</span>
              </div>
              <div className="min-w-0">
                <h1 className="text-lg font-semibold text-fg">Cobranzas</h1>
                <p className="text-xs text-muted hidden sm:block">Cuotas, pagos, recibos y vencimientos</p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              {/* Notificaciones */}
              {notificacionesUrgentes.length > 0 && (
                <button
                  onClick={() => setVistaActiva('notificaciones')}
                  className="relative btn-icon text-danger hover:text-danger hover:bg-danger-soft"
                  aria-label={`${notificacionesUrgentes.length} cuotas vencidas o que vencen hoy`}
                  title="Cuotas vencidas o que vencen hoy"
                >
                  <Bell className="w-5 h-5" />
                  <span className="absolute top-1 right-1 min-w-[20px] h-5 px-1 rounded-full bg-danger text-white text-xs font-bold flex items-center justify-center num">
                    {notificacionesUrgentes.length}
                  </span>
                </button>
              )}

              <button
                className="lg:hidden btn-icon"
                onClick={() => setMenuAbierto(!menuAbierto)}
                aria-label={menuAbierto ? 'Cerrar secciones' : 'Ver secciones'}
                aria-expanded={menuAbierto}
              >
                {menuAbierto ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
              </button>
            </div>
          </div>

          {/* NAVIGATION - Desktop */}
          <nav className="hidden lg:block" aria-label="Secciones de cobranzas">
            <div className="flex gap-1 -mb-px">
              {tabs.map(({ id, label, icon: Icon }) => {
                const isActive = vistaActiva === id
                return (
                  <button
                    key={id}
                    onClick={() => { setVistaActiva(id as any); setMenuAbierto(false) }}
                    aria-current={isActive ? 'page' : undefined}
                    className={`flex items-center gap-2 min-h-[44px] px-4 border-b-2 text-sm font-medium transition-colors ${
                      isActive
                        ? 'border-primary text-primary'
                        : 'border-transparent text-muted hover:text-fg hover:border-line'
                    }`}
                  >
                    <Icon className="w-4 h-4" />
                    <span>{label}</span>
                    {id === 'notificaciones' && notificacionesUrgentes.length > 0 && (
                      <span className="badge-danger !px-2 !py-0.5 num">
                        {notificacionesUrgentes.length}
                      </span>
                    )}
                  </button>
                )
              })}
            </div>
          </nav>
        </div>

        {/* NAVIGATION - Mobile */}
        {menuAbierto && (
          <div className="lg:hidden border-t border-line">
            <div className="max-w-7xl mx-auto px-4 py-3 space-y-1">
              {tabs.map(({ id, label, icon: Icon }) => {
                const isActive = vistaActiva === id
                return (
                  <button
                    key={id}
                    onClick={() => { setVistaActiva(id as any); setMenuAbierto(false) }}
                    aria-current={isActive ? 'page' : undefined}
                    className={`w-full flex items-center justify-between min-h-[48px] px-3 rounded-lg text-sm font-medium transition-colors ${
                      isActive
                        ? 'bg-primary/10 text-primary'
                        : 'text-fg hover:bg-surface-2'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <Icon className="w-5 h-5" />
                      <span>{label}</span>
                    </div>
                    {id === 'notificaciones' && notificacionesUrgentes.length > 0 && (
                      <span className="badge-danger num">
                        {notificacionesUrgentes.length}
                      </span>
                    )}
                  </button>
                )
              })}
            </div>
          </div>
        )}
      </header>

      {/* MAIN CONTENT */}
      <main className="page-container">
        {loading && vistaActiva === 'clientes' ? (
          <div className="space-y-4" role="status" aria-live="polite">
            <span className="sr-only">Cargando datos…</span>
            <div className="card p-5 space-y-3">
              <div className="skeleton h-5 w-48" />
              <div className="skeleton h-11 w-full" />
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {[0, 1].map((i) => (
                <div key={i} className="card p-5 space-y-3">
                  <div className="skeleton h-5 w-40" />
                  <div className="skeleton h-4 w-full" />
                  <div className="skeleton h-4 w-5/6" />
                  <div className="skeleton h-4 w-2/3" />
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div>
            {renderVistaActiva()}
          </div>
        )}
      </main>
    </div>
  )
}
