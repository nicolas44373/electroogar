'use client'
import { useState, useEffect, useRef, useCallback } from 'react'
import html2canvas from 'html2canvas'
import { jsPDF } from 'jspdf'
import { supabase } from '@/app/lib/supabase'
import { hoyISO } from '@/app/lib/fechas'
import { Cliente, Transaccion, Pago } from '@/app/lib/types/cobranzas'
import {
  FileText, Download, Eye, Search, DollarSign, CheckCircle,
  User, X, Phone, Mail, AlertTriangle, Filter, MessageCircle,
  CircleDashed, CalendarClock, Circle, ShoppingCart, Banknote
} from 'lucide-react'

interface DeudaCliente {
  transaccion: Transaccion
  pagos: Pago[]
  saldoPendiente: number
  cuotasPendientes: number
  cuotasTotales: number
}

interface BusquedaClienteItem extends Cliente {
  total_deuda: number
  transacciones_activas: number
}

type FiltroEstado = 'todas' | 'pendiente' | 'vencida' | 'parcial' | 'pagada'
type FiltroTipo   = 'todas' | 'venta' | 'prestamo'

interface GeneradorRecibosProps {
  clientes?: Cliente[]
  transacciones?: Transaccion[]
  pagos?: { [key: string]: Pago[] }
}

export default function GeneradorRecibos({ clientes: _c, transacciones: _t, pagos: _p }: GeneradorRecibosProps = {}) {
  const [busqueda, setBusqueda] = useState('')
  const [clientesEncontrados, setClientesEncontrados] = useState<BusquedaClienteItem[]>([])
  const [clienteSeleccionado, setClienteSeleccionado] = useState<Cliente | null>(null)
  const [deudasCliente, setDeudasCliente] = useState<DeudaCliente[]>([])
  const [loading, setLoading] = useState(false)

  // Filtros
  const [filtroEstado, setFiltroEstado] = useState<FiltroEstado>('todas')
  const [filtroTipo, setFiltroTipo] = useState<FiltroTipo>('todas')

  // Modal de pago
  const [modalPagoAbierto, setModalPagoAbierto] = useState(false)
  const [pagoSeleccionado, setPagoSeleccionado] = useState<Pago | null>(null)
  const [transaccionPago, setTransaccionPago] = useState<Transaccion | null>(null)
  const [montoPago, setMontoPago] = useState('')
  const [fechaPago, setFechaPago] = useState(hoyISO())
  const [metodoPago, setMetodoPago] = useState<'efectivo' | 'transferencia' | 'cheque' | 'tarjeta'>('efectivo')
  const [observaciones, setObservaciones] = useState('')

  // Recibo
  const [reciboGenerado, setReciboGenerado] = useState<any>(null)
  const [mostrarRecibo, setMostrarRecibo] = useState(false)
  const [generandoPDF, setGenerandoPDF] = useState(false)
  const reciboRef = useRef<HTMLDivElement>(null)

  // Buscador: debounce + cierre al click afuera + cancelación de stale requests
  const debounceTimer  = useRef<ReturnType<typeof setTimeout> | null>(null)
  const activeQuery    = useRef<string>('')
  const searchWrapperRef = useRef<HTMLDivElement>(null)

  // Cerrar dropdown al hacer click fuera
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (searchWrapperRef.current && !searchWrapperRef.current.contains(e.target as Node)) {
        setClientesEncontrados([])
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  // Toast
  const [toast, setToast] = useState<{ tipo: 'success' | 'error' | 'info'; texto: string } | null>(null)
  const mostrarToast = (tipo: 'success' | 'error' | 'info', texto: string) => {
    setToast({ tipo, texto })
    setTimeout(() => setToast(null), 4500)
  }

  const buscarClientes = useCallback(async (termino: string) => {
    // Marcar qué consulta está activa para ignorar respuestas obsoletas
    activeQuery.current = termino
    setLoading(true)
    try {
      const { data: clientes, error } = await supabase
        .from('clientes')
        .select(`*, transacciones(id, monto_total, estado, pagos(id, estado, monto_cuota, monto_pagado, intereses_mora))`)
        .or(`nombre.ilike.%${termino}%,apellido.ilike.%${termino}%,documento.ilike.%${termino}%,telefono.ilike.%${termino}%`)
        .limit(10)
      if (error) throw error
      // Descartar si el usuario ya escribió algo diferente
      if (activeQuery.current !== termino) return
      const clientesConDeuda = (clientes || []).map((cliente) => {
        let totalDeuda = 0
        let transaccionesActivas = 0
        ;(cliente as any).transacciones?.forEach((trans: any) => {
          if (trans.estado !== 'completado') {
            transaccionesActivas++
            trans.pagos?.forEach((pago: any) => {
              if (pago.estado !== 'pagado') {
                totalDeuda += (pago.monto_cuota || 0) + (pago.intereses_mora || 0) - (pago.monto_pagado || 0)
              }
            })
          }
        })
        return { ...cliente, total_deuda: Math.max(0, totalDeuda), transacciones_activas: transaccionesActivas }
      })
      setClientesEncontrados(clientesConDeuda)
    } catch (error) {
      console.error('Error buscando clientes:', error)
    } finally {
      if (activeQuery.current === termino) setLoading(false)
    }
  }, [])

  // Debounce: espera 350ms después del último keystroke antes de llamar a Supabase
  useEffect(() => {
    if (debounceTimer.current) clearTimeout(debounceTimer.current)
    if (busqueda.trim().length < 2) {
      setClientesEncontrados([])
      setLoading(false)
      activeQuery.current = ''
      return
    }
    setLoading(true) // indicador visual inmediato
    debounceTimer.current = setTimeout(() => {
      void buscarClientes(busqueda.trim())
    }, 350)
    return () => {
      if (debounceTimer.current) clearTimeout(debounceTimer.current)
    }
  }, [busqueda, buscarClientes])

  const seleccionarCliente = async (cliente: Cliente) => {
    // Cancel any pending search before loading the client
    if (debounceTimer.current) clearTimeout(debounceTimer.current)
    activeQuery.current = ''
    setClienteSeleccionado(cliente)
    setClientesEncontrados([])
    setBusqueda('')
    setFiltroEstado('todas')
    setFiltroTipo('todas')
    await cargarDeudasCliente(cliente.id)
  }

  const cargarDeudasCliente = async (clienteId: string) => {
    setLoading(true)
    try {
      const { data: transacciones, error } = await supabase
        .from('transacciones')
        .select(`*, producto:productos(nombre, precio_unitario), pagos(*)`)
        .eq('cliente_id', clienteId)
        .in('estado', ['activo', 'moroso'])
        .order('fecha_inicio', { ascending: false })
      if (error) throw error
      const deudas: DeudaCliente[] = (transacciones || []).map((trans) => {
        const pagos = (((trans as any).pagos || []) as Pago[]).sort((a, b) => (a.numero_cuota || 0) - (b.numero_cuota || 0))
        const cuotasPendientes = pagos.filter((p) => p.estado !== 'pagado').length
        let saldoPendiente = 0
        pagos.forEach((p) => {
          if (p.estado !== 'pagado') {
            saldoPendiente += (p.monto_cuota || trans.monto_cuota) + (p.intereses_mora || 0) - (p.monto_pagado || 0)
          }
        })
        return { transaccion: trans, pagos, saldoPendiente, cuotasPendientes, cuotasTotales: trans.numero_cuotas }
      })
      setDeudasCliente(deudas)
    } catch (error) {
      console.error('Error cargando deudas:', error)
      mostrarToast('error', 'Error al cargar los datos del cliente')
    } finally {
      setLoading(false)
    }
  }

  const diasVencimiento = (fechaVenc: string) => {
    const hoy = new Date(); hoy.setHours(0, 0, 0, 0)
    const [y, m, d] = fechaVenc.split('-').map(Number)
    const v = new Date(y, m - 1, d); v.setHours(0, 0, 0, 0)
    return Math.floor((v.getTime() - hoy.getTime()) / 86400000)
  }

  const abrirModalPago = (pago: Pago, transaccion: Transaccion) => {
    setPagoSeleccionado(pago)
    setTransaccionPago(transaccion)
    const montoCuota = pago.monto_cuota || transaccion.monto_cuota
    const mora = pago.intereses_mora || 0
    const restante = montoCuota + mora - (pago.monto_pagado || 0)
    setMontoPago(restante.toFixed(2))
    setFechaPago(hoyISO())
    setMetodoPago('efectivo')
    setObservaciones('')
    setModalPagoAbierto(true)
  }

  const registrarPago = async () => {
    if (!pagoSeleccionado || !transaccionPago || !clienteSeleccionado) return
    setLoading(true)
    try {
      const montoNum = parseFloat(montoPago)
      const montoCuota = pagoSeleccionado.monto_cuota || transaccionPago.monto_cuota
      const mora = pagoSeleccionado.intereses_mora || 0
      const pagadoActual = pagoSeleccionado.monto_pagado || 0
      const montoTotal = montoCuota + mora
      const restante = montoTotal - pagadoActual

      const nuevoEstado: 'pendiente' | 'parcial' | 'pagado' = montoNum >= restante ? 'pagado' : 'parcial'
      const nuevoMontoPagado = nuevoEstado === 'pagado' ? montoTotal : pagadoActual + montoNum
      const numeroRecibo = `REC-${Date.now()}`

      const { error } = await supabase.from('pagos').update({
        estado: nuevoEstado,
        monto_pagado: nuevoMontoPagado,
        fecha_pago: fechaPago,
        metodo_pago: metodoPago,
        observaciones,
        numero_recibo: numeroRecibo,
      }).eq('id', pagoSeleccionado.id)
      if (error) throw error

      const datosRecibo = {
        numero_recibo: numeroRecibo,
        fecha_pago: fechaPago,
        cliente: clienteSeleccionado,
        transaccion: transaccionPago,
        pago: { ...pagoSeleccionado, monto_pagado: montoNum, monto_total_pagado: nuevoMontoPagado, metodo_pago: metodoPago, observaciones, estado: nuevoEstado },
        monto_pagado: montoNum,
        es_pago_parcial: nuevoEstado === 'parcial',
        monto_pendiente_cuota: montoTotal - nuevoMontoPagado,
      }

      setReciboGenerado(datosRecibo)
      setMostrarRecibo(true)
      setModalPagoAbierto(false)
      mostrarToast('success', `Pago de ${fmt(montoNum)} registrado correctamente`)
      await cargarDeudasCliente(clienteSeleccionado.id)
    } catch (error) {
      console.error('Error registrando pago:', error)
      mostrarToast('error', 'Error al registrar el pago. Intenta de nuevo.')
    } finally {
      setLoading(false)
    }
  }

  const generarPDFBlob = async (): Promise<Blob | null> => {
    if (!reciboRef.current) return null
    await new Promise<void>((r) => requestAnimationFrame(() => r()))
    const canvas = await html2canvas(reciboRef.current, { scale: 2, useCORS: true, logging: false, backgroundColor: '#ffffff' })
    const imgData = canvas.toDataURL('image/png')
    const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4', compress: true })
    const pageW = 210; const pageH = 297
    const imgH = (canvas.height * pageW) / canvas.width
    let heightLeft = imgH; let pos = 0
    pdf.addImage(imgData, 'PNG', 0, pos, pageW, imgH, undefined, 'FAST')
    heightLeft -= pageH
    while (heightLeft > 0) { pos -= pageH; pdf.addPage(); pdf.addImage(imgData, 'PNG', 0, pos, pageW, imgH, undefined, 'FAST'); heightLeft -= pageH }
    return pdf.output('blob')
  }

  const descargarPDF = async () => {
    if (generandoPDF || !reciboGenerado) return
    setGenerandoPDF(true)
    try {
      await new Promise<void>((r) => requestAnimationFrame(() => requestAnimationFrame(() => r())))
      const blob = await generarPDFBlob()
      if (!blob) throw new Error('No se pudo generar')
      const fileName = `Recibo_${reciboGenerado.numero_recibo}.pdf`
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url; a.download = fileName; a.rel = 'noopener'; a.style.display = 'none'
      document.body.appendChild(a); a.click()
      setTimeout(() => { URL.revokeObjectURL(url); document.body.removeChild(a) }, 0)
      mostrarToast('success', 'PDF descargado correctamente')
    } catch (err) {
      console.error('Error PDF:', err)
      mostrarToast('error', 'Error al generar el PDF')
    } finally {
      setGenerandoPDF(false)
    }
  }

  const enviarPorWhatsApp = async () => {
    if (generandoPDF || !reciboGenerado) return
    setGenerandoPDF(true)
    try {
      await new Promise<void>((r) => requestAnimationFrame(() => requestAnimationFrame(() => r())))
      const blob = await generarPDFBlob()
      if (!blob) throw new Error('No se pudo generar')
      const fileName = `Recibo_${reciboGenerado.numero_recibo}.pdf`
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url; a.download = fileName; a.rel = 'noopener'; a.style.display = 'none'
      document.body.appendChild(a); a.click()
      setTimeout(() => { URL.revokeObjectURL(url); document.body.removeChild(a) }, 0)
      const nombre = `${reciboGenerado.cliente.nombre} ${reciboGenerado.cliente.apellido || ''}`.trim()
      const msg = encodeURIComponent(`Hola ${nombre}, te envio tu recibo de pago N° ${reciboGenerado.numero_recibo} por ${fmt(reciboGenerado.monto_pagado)}. Gracias!`)
      const tel = (reciboGenerado.cliente.telefono || '').replace(/[^\d]/g, '')
      setTimeout(() => window.open(`https://wa.me/${tel}?text=${msg}`, '_blank'), 400)
      mostrarToast('success', 'PDF descargado - adjuntalo en WhatsApp')
    } catch (err) {
      console.error('Error:', err)
      mostrarToast('error', 'Error al generar el PDF')
    } finally {
      setGenerandoPDF(false)
    }
  }

  // ── Helpers ──────────────────────────────────────────────────────────────────

  const fmt = (n: number) => new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', minimumFractionDigits: 2 }).format(n)

  const fmtFecha = (f: string) => {
    const [y, m, d] = f.split('-').map(Number)
    return new Date(y, m - 1, d).toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' })
  }

  const fmtFechaLarga = (f: string) => {
    const [y, m, d] = f.split('-').map(Number)
    return new Date(y, m - 1, d).toLocaleDateString('es-AR', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })
  }

  const estadoBadge = (pago: Pago) => {
    const dv = diasVencimiento(pago.fecha_vencimiento)
    const vencido = dv < 0 && pago.estado !== 'pagado'
    if (pago.estado === 'pagado')       return { label: 'Pagada',       cls: 'badge-success', icono: CheckCircle }
    if (pago.estado === 'parcial')      return { label: 'Pago parcial', cls: 'badge-info',    icono: CircleDashed }
    if (pago.estado === 'reprogramado') return { label: 'Reprogramada', cls: 'badge-reprog',  icono: CalendarClock }
    if (vencido)                        return { label: 'Vencida',      cls: 'badge-danger',  icono: AlertTriangle }
                                        return { label: 'Pendiente',    cls: 'badge-primary', icono: Circle }
  }

  // ── Filtros ───────────────────────────────────────────────────────────────────

  const pagoMatchEstado = (pago: Pago): boolean => {
    if (filtroEstado === 'todas') return true
    const dv = diasVencimiento(pago.fecha_vencimiento)
    const vencido = dv < 0 && pago.estado !== 'pagado'
    if (filtroEstado === 'pendiente') return pago.estado === 'pendiente' && !vencido
    if (filtroEstado === 'vencida')   return vencido || pago.estado === 'reprogramado'
    if (filtroEstado === 'parcial')   return pago.estado === 'parcial'
    if (filtroEstado === 'pagada')    return pago.estado === 'pagado'
    return true
  }

  const deudasFiltradas = deudasCliente
    .filter((d) => filtroTipo === 'todas' || d.transaccion.tipo_transaccion === filtroTipo)
    .map((d) => ({ ...d, pagos: d.pagos.filter(pagoMatchEstado) }))
    .filter((d) => filtroEstado === 'todas' || d.pagos.length > 0)

  // ── Contadores para filtros ───────────────────────────────────────────────────

  const contarPorEstado = (estado: FiltroEstado) => {
    return deudasCliente
      .filter((d) => filtroTipo === 'todas' || d.transaccion.tipo_transaccion === filtroTipo)
      .flatMap((d) => d.pagos)
      .filter((p) => {
        if (estado === 'todas') return true
        const dv = diasVencimiento(p.fecha_vencimiento)
        const vencido = dv < 0 && p.estado !== 'pagado'
        if (estado === 'pendiente') return p.estado === 'pendiente' && !vencido
        if (estado === 'vencida')   return vencido || p.estado === 'reprogramado'
        if (estado === 'parcial')   return p.estado === 'parcial'
        if (estado === 'pagada')    return p.estado === 'pagado'
        return true
      }).length
  }

  const totalDeudaCliente = deudasCliente.reduce((s, d) => s + d.saldoPendiente, 0)
  const totalCuotasPendientes = deudasCliente.reduce((s, d) => s + d.cuotasPendientes, 0)
  const totalVencidas = deudasCliente.flatMap((d) => d.pagos).filter((p) => {
    const dv = diasVencimiento(p.fecha_vencimiento)
    return dv < 0 && p.estado !== 'pagado'
  }).length

  // ── JSX ───────────────────────────────────────────────────────────────────────

  return (
    <div>
      <div className="space-y-4">

        {/* Toast */}
        {toast && (
          <div className={`fixed top-20 right-4 left-4 sm:left-auto z-[60] max-w-sm shadow-e3 ${
            toast.tipo === 'success' ? 'alert-success' :
            toast.tipo === 'error'   ? 'alert-danger' :
                                       'alert-info'
          }`} role="status">
            {toast.tipo === 'success' ? <CheckCircle className="w-4 h-4 flex-shrink-0" /> :
             toast.tipo === 'error'   ? <AlertTriangle className="w-4 h-4 flex-shrink-0" /> :
                                        <Eye className="w-4 h-4 flex-shrink-0" />}
            {toast.texto}
          </div>
        )}

        {/* Header + buscador */}
        <div className="card card-body">
          <div className="mb-4">
            <h1 className="section-title">
              <FileText className="w-5 h-5 text-primary" />
              Recibos y pagos
            </h1>
            <p className="text-sm text-muted mt-1">Buscá un cliente para registrar pagos y descargar recibos.</p>
          </div>

          <div className="relative" ref={searchWrapperRef}>
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted pointer-events-none" />
            <input
              type="text"
              placeholder="Nombre, apellido, documento o teléfono"
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Escape') { setClientesEncontrados([]); setBusqueda('') } }}
              autoComplete="off"
              className="input input-icon pr-11"
              aria-label="Buscar cliente"
            />
            {busqueda.length > 0 && (
              <button type="button" onClick={() => { setBusqueda(''); setClientesEncontrados([]) }}
                className="absolute right-0 top-0 btn-icon" aria-label="Borrar búsqueda">
                {loading ? (
                  <span className="spinner text-primary" />
                ) : (
                  <X className="w-4 h-4" />
                )}
              </button>
            )}

            {clientesEncontrados.length > 0 && (
              <div className="absolute z-20 w-full mt-1 bg-surface rounded-lg shadow-e3 border border-line max-h-80 overflow-y-auto">
                {clientesEncontrados.map((cliente) => (
                  <button key={cliente.id} type="button" onClick={() => seleccionarCliente(cliente)}
                    className="w-full px-3 py-2.5 min-h-[56px] hover:bg-surface-2 border-b border-line last:border-0 text-left transition-colors">
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="icon-tile w-8 h-8 rounded-full bg-surface-2 text-muted">
                          <User className="w-4 h-4" />
                        </div>
                        <div className="min-w-0">
                          <div className="font-medium text-fg text-sm truncate">
                            {cliente.nombre} {cliente.apellido || ''}
                          </div>
                          <div className="text-xs text-muted flex gap-3 num">
                            {cliente.documento && <span>DNI {cliente.documento}</span>}
                            {cliente.telefono && <span>{cliente.telefono}</span>}
                          </div>
                        </div>
                      </div>
                      <div className="text-right flex-shrink-0">
                        <div className="text-sm font-semibold text-danger-text num">{fmt(cliente.total_deuda)}</div>
                        <div className="text-xs text-muted num">{cliente.transacciones_activas} activas</div>
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Estado inicial sin cliente */}
        {!clienteSeleccionado && !loading && (
          <div className="card empty-state">
            <Search className="w-10 h-10 text-muted/50 mb-3" />
            <h3 className="text-base font-semibold text-fg mb-1">Buscá un cliente para empezar</h3>
            <p className="text-sm">Vas a ver sus cuotas, registrar pagos y generar recibos.</p>
          </div>
        )}

        {/* Cliente seleccionado */}
        {clienteSeleccionado && (
          <>
            {/* Card cliente */}
            <div className="card card-body">
              <div className="flex items-start justify-between gap-4 mb-4">
                <div className="flex items-start gap-3 flex-1 min-w-0">
                  <div className="icon-tile w-10 h-10 rounded-full bg-primary text-on-primary">
                    <User className="w-5 h-5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h2 className="text-lg font-semibold text-fg">
                      {clienteSeleccionado.nombre} {clienteSeleccionado.apellido || ''}
                    </h2>
                    <div className="flex flex-wrap gap-x-4 gap-y-1 mt-1 text-sm text-muted num">
                      {clienteSeleccionado.documento && <span>DNI {clienteSeleccionado.documento}</span>}
                      {clienteSeleccionado.telefono && <span className="flex items-center gap-1"><Phone className="w-3.5 h-3.5" />{clienteSeleccionado.telefono}</span>}
                      {clienteSeleccionado.email && <span className="flex items-center gap-1"><Mail className="w-3.5 h-3.5" />{clienteSeleccionado.email}</span>}
                    </div>
                  </div>
                </div>
                <button type="button" onClick={() => { setClienteSeleccionado(null); setDeudasCliente([]) }}
                  className="btn-icon" aria-label="Cambiar de cliente" title="Cambiar de cliente">
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Stats */}
              <dl className="grid grid-cols-3 gap-3">
                <div className="rounded-lg bg-surface-2 p-3">
                  <dt className="text-xs text-muted font-medium">Saldo total</dt>
                  <dd className="text-lg font-bold text-fg num mt-0.5">{fmt(totalDeudaCliente)}</dd>
                </div>
                <div className="rounded-lg bg-surface-2 p-3">
                  <dt className="text-xs text-muted font-medium">Cuotas pendientes</dt>
                  <dd className="text-lg font-bold text-fg num mt-0.5">{totalCuotasPendientes}</dd>
                </div>
                <div className={`rounded-lg p-3 ${totalVencidas > 0 ? 'bg-danger-soft' : 'bg-success-soft'}`}>
                  <dt className={`text-xs font-medium flex items-center gap-1 ${totalVencidas > 0 ? 'text-danger-text' : 'text-success-text'}`}>
                    {totalVencidas > 0 ? <AlertTriangle className="w-3.5 h-3.5" /> : <CheckCircle className="w-3.5 h-3.5" />}
                    Vencidas
                  </dt>
                  <dd className={`text-lg font-bold num mt-0.5 ${totalVencidas > 0 ? 'text-danger-text' : 'text-success-text'}`}>{totalVencidas}</dd>
                </div>
              </dl>
            </div>

            {/* Barra de filtros */}
            <div className="card card-body">
              <div className="flex flex-col lg:flex-row gap-4">
                {/* Filtro por estado */}
                <div className="flex-1">
                  <p className="flex items-center gap-1.5 mb-2 text-xs font-semibold text-muted uppercase tracking-wide">
                    <Filter className="w-3.5 h-3.5" /> Estado de las cuotas
                  </p>
                  <div className="flex flex-wrap gap-2" role="group" aria-label="Filtrar por estado">
                    {([
                      { key: 'todas',    label: 'Todas' },
                      { key: 'pendiente',label: 'Pendientes' },
                      { key: 'vencida',  label: 'Vencidas' },
                      { key: 'parcial',  label: 'Pago parcial' },
                      { key: 'pagada',   label: 'Pagadas' },
                    ] as { key: FiltroEstado; label: string }[]).map(({ key, label }) => {
                      const count = contarPorEstado(key)
                      const active = filtroEstado === key
                      const colorMap: Record<FiltroEstado, string> = {
                        todas:    active ? 'bg-fg text-canvas border-fg' : 'bg-surface text-fg border-line hover:bg-surface-2',
                        pendiente:active ? 'bg-primary text-on-primary border-primary' : 'bg-surface text-fg border-line hover:bg-surface-2',
                        vencida:  active ? 'bg-danger text-white border-danger'   : 'bg-surface text-fg border-line hover:bg-surface-2',
                        parcial:  active ? 'bg-info text-white border-info'  : 'bg-surface text-fg border-line hover:bg-surface-2',
                        pagada:   active ? 'bg-success text-white border-success' : 'bg-surface text-fg border-line hover:bg-surface-2',
                      }
                      return (
                        <button key={key} type="button" onClick={() => setFiltroEstado(key)} aria-pressed={active}
                          className={`min-h-[40px] px-3 rounded-lg border text-xs font-semibold transition-colors flex items-center gap-2 ${colorMap[key]}`}>
                          {label}
                          <span className={`min-w-[20px] text-[11px] px-1.5 py-0.5 rounded-full num ${active ? 'bg-white/25' : 'bg-surface-2 text-muted'}`}>
                            {count}
                          </span>
                        </button>
                      )
                    })}
                  </div>
                </div>

                {/* Filtro por tipo */}
                <div>
                  <p className="mb-2 text-xs font-semibold text-muted uppercase tracking-wide">
                    Tipo
                  </p>
                  <div className="inline-flex rounded-lg border border-line p-0.5 bg-surface-2" role="group" aria-label="Filtrar por tipo">
                    {([
                      { key: 'todas',   label: 'Todas' },
                      { key: 'venta',   label: 'Ventas' },
                      { key: 'prestamo',label: 'Préstamos' },
                    ] as { key: FiltroTipo; label: string }[]).map(({ key, label }) => (
                      <button key={key} type="button" onClick={() => setFiltroTipo(key)} aria-pressed={filtroTipo === key}
                        className={`min-h-[36px] px-3 rounded-md text-xs font-semibold transition-colors ${
                          filtroTipo === key ? 'bg-surface text-primary shadow-e1' : 'text-muted hover:text-fg'
                        }`}>
                        {label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* Transacciones filtradas */}
            {loading ? (
              <div className="card p-5 space-y-3" role="status" aria-live="polite">
                <span className="sr-only">Cargando…</span>
                <div className="skeleton h-5 w-1/3" />
                <div className="skeleton h-4 w-full" />
                <div className="skeleton h-4 w-5/6" />
                <div className="skeleton h-4 w-2/3" />
              </div>
            ) : deudasFiltradas.length === 0 ? (
              <div className="card empty-state">
                <CheckCircle className="w-10 h-10 text-success mb-2" />
                <p className="text-sm font-medium text-fg">No hay cuotas con este filtro</p>
                <p className="text-xs mt-1">Elegí otro estado o tipo para ver más cuotas.</p>
              </div>
            ) : (
              <div className="space-y-4">
                {deudasFiltradas.map((deuda) => (
                  <div key={deuda.transaccion.id} className="card overflow-hidden">
                    {/* Header transaccion */}
                    <div className="p-4 sm:px-5 border-b border-line">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1 min-w-0">
                          <h3 className="font-semibold text-fg flex items-center gap-2 text-base">
                            <span className="text-primary">{deuda.transaccion.tipo_transaccion === 'venta' ? <ShoppingCart className="w-4 h-4" /> : <Banknote className="w-4 h-4" />}</span>
                            {deuda.transaccion.tipo_transaccion === 'prestamo'
                              ? 'Préstamo de dinero'
                              : (deuda.transaccion as any).producto?.nombre || 'Venta'}
                          </h3>
                          {deuda.transaccion.descripcion && (
                            <p className="mt-1.5 text-xs text-muted border-l-2 border-primary/40 pl-2">
                              {deuda.transaccion.descripcion}
                            </p>
                          )}
                          <div className="flex flex-wrap gap-x-4 gap-y-1 mt-1.5 text-xs text-muted num">
                            <span>Inicio {fmtFecha(deuda.transaccion.fecha_inicio)}</span>
                            <span>{deuda.cuotasPendientes} de {deuda.cuotasTotales} cuotas pendientes</span>
                          </div>
                        </div>
                        <div className="text-right flex-shrink-0">
                          <div className="text-xs text-muted">Saldo</div>
                          <div className="text-lg font-bold text-fg num">{fmt(deuda.saldoPendiente)}</div>
                        </div>
                      </div>
                    </div>

                    {/* Tabla cuotas */}
                    <div className="overflow-x-auto">
                      <table className="data-table min-w-[640px]">
                        <thead>
                          <tr>
                            <th>Cuota</th>
                            <th>Vencimiento</th>
                            <th className="!text-right">Importe</th>
                            <th className="!text-right">Pagado</th>
                            <th className="!text-center">Estado</th>
                            <th className="!text-right min-w-[110px]">Acciones</th>
                          </tr>
                        </thead>
                        <tbody>
                          {deuda.pagos.map((pago) => {
                            const dv = diasVencimiento(pago.fecha_vencimiento)
                            const estaVencido = dv < 0 && pago.estado !== 'pagado'
                            const montoCuota = pago.monto_cuota || deuda.transaccion.monto_cuota
                            const mora = pago.intereses_mora || 0
                            const montoTotal = montoCuota + mora
                            const montoPag = pago.monto_pagado || 0
                            const badge = estadoBadge(pago)

                            return (
                              <tr key={pago.id} className={estaVencido ? '!bg-danger-soft/30' : ''}>
                                <td className="font-semibold text-fg num">{pago.numero_cuota}</td>
                                <td>
                                  <div className="num whitespace-nowrap">{fmtFecha(pago.fecha_vencimiento)}</div>
                                  {pago.estado !== 'pagado' && (
                                    <div className={`text-xs mt-0.5 font-medium ${estaVencido ? 'text-danger-text' : dv === 0 ? 'text-warning-text' : dv <= 7 ? 'text-warning-text' : 'text-muted'}`}>
                                      {estaVencido ? `Vencida hace ${Math.abs(dv)} d` : dv === 0 ? 'Vence hoy' : `Vence en ${dv} d`}
                                    </div>
                                  )}
                                  {pago.fecha_reprogramacion && (
                                    <div className="text-xs text-reprog-text mt-0.5 num">Reprogramada el {fmtFecha(pago.fecha_reprogramacion)}</div>
                                  )}
                                </td>
                                <td className="text-right">
                                  <div className="font-semibold text-fg num whitespace-nowrap">{fmt(montoTotal)}</div>
                                  {mora > 0 && <div className="text-xs text-danger-text num whitespace-nowrap">+{fmt(mora)} mora</div>}
                                </td>
                                <td className="text-right">
                                  <div className="font-medium text-success-text num whitespace-nowrap">{fmt(montoPag)}</div>
                                  {pago.fecha_pago && <div className="text-xs text-muted num">{fmtFecha(pago.fecha_pago)}</div>}
                                </td>
                                <td className="text-center">
                                  <span className={badge.cls}>
                                    <badge.icono className="w-3.5 h-3.5" aria-hidden="true" />
                                    {badge.label}
                                  </span>
                                </td>
                                <td>
                                  <div className="flex justify-end gap-1.5 flex-wrap">
                                    {pago.estado !== 'pagado' && (
                                      <button type="button" onClick={() => abrirModalPago(pago, deuda.transaccion)}
                                        className="btn-accent btn-sm">
                                        <DollarSign className="w-3.5 h-3.5" />
                                        Cobrar
                                      </button>
                                    )}
                                    {(pago.estado === 'pagado' || pago.estado === 'parcial') && (pago as any).numero_recibo && (
                                      <>
                                        <button type="button" onClick={() => {
                                          const mc = pago.monto_cuota || deuda.transaccion.monto_cuota
                                          const mi = pago.intereses_mora || 0
                                          const mp = pago.monto_pagado || 0
                                          setReciboGenerado({
                                            numero_recibo: (pago as any).numero_recibo,
                                            fecha_pago: pago.fecha_pago,
                                            cliente: clienteSeleccionado,
                                            transaccion: deuda.transaccion,
                                            pago: { ...pago, monto_total_pagado: mp },
                                            monto_pagado: mp,
                                            es_pago_parcial: pago.estado === 'parcial',
                                            monto_pendiente_cuota: mc + mi - mp,
                                          })
                                          setMostrarRecibo(true)
                                        }}
                                          className="btn-secondary btn-sm" title="Ver recibo">
                                          <Eye className="w-3.5 h-3.5" />
                                          Ver recibo
                                        </button>
                                        <button type="button" onClick={async () => {
                                          const mc = pago.monto_cuota || deuda.transaccion.monto_cuota
                                          const mi = pago.intereses_mora || 0
                                          const mp = pago.monto_pagado || 0
                                          setReciboGenerado({
                                            numero_recibo: (pago as any).numero_recibo,
                                            fecha_pago: pago.fecha_pago,
                                            cliente: clienteSeleccionado,
                                            transaccion: deuda.transaccion,
                                            pago: { ...pago, monto_total_pagado: mp },
                                            monto_pagado: mp,
                                            es_pago_parcial: pago.estado === 'parcial',
                                            monto_pendiente_cuota: mc + mi - mp,
                                          })
                                          setMostrarRecibo(true)
                                          setTimeout(() => void descargarPDF(), 300)
                                        }}
                                          className="btn-icon" title="Descargar recibo en PDF" aria-label="Descargar recibo en PDF">
                                          <Download className="w-4 h-4" />
                                        </button>
                                      </>
                                    )}
                                  </div>
                                </td>
                              </tr>
                            )
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>

      {/* ── Modal registrar pago ───────────────────────────────────── */}
      {modalPagoAbierto && pagoSeleccionado && transaccionPago && clienteSeleccionado && (
        <div className="modal-backdrop">
          <div className="modal" role="dialog" aria-modal="true" aria-labelledby="rec-titulo-pago">
            <div className="modal-header justify-between">
              <h3 id="rec-titulo-pago" className="text-base font-semibold text-fg flex items-center gap-2">
                <DollarSign className="w-5 h-5 text-accent-strong" />
                Registrar pago
              </h3>
              <button type="button" onClick={() => setModalPagoAbierto(false)} className="btn-icon" aria-label="Cerrar"><X className="w-5 h-5" /></button>
            </div>

            <div className="modal-body">
              <div className="rounded-lg bg-surface-2 p-4">
                <div className="font-semibold text-fg text-sm">{clienteSeleccionado.nombre} {clienteSeleccionado.apellido || ''}</div>
                <div className="text-xs text-muted mb-3">
                  {transaccionPago.tipo_transaccion === 'prestamo' ? 'Préstamo de dinero' : (transaccionPago as any).producto?.nombre || 'Venta'}
                  {transaccionPago.descripcion && ` — ${transaccionPago.descripcion}`}
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted">Cuota <strong className="text-fg num">{pagoSeleccionado.numero_cuota}</strong></span>
                  <div className="text-right num">
                    <div className="font-bold text-fg">{fmt((pagoSeleccionado.monto_cuota || transaccionPago.monto_cuota) + (pagoSeleccionado.intereses_mora || 0))}</div>
                    {(pagoSeleccionado.intereses_mora || 0) > 0 && <div className="text-xs text-danger-text">incluye {fmt(pagoSeleccionado.intereses_mora || 0)} de mora</div>}
                    {(pagoSeleccionado.monto_pagado || 0) > 0 && <div className="text-xs text-success-text">ya pagó {fmt(pagoSeleccionado.monto_pagado || 0)}</div>}
                  </div>
                </div>
              </div>

              <div>
                <label htmlFor="rec-monto" className="label">Monto recibido</label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted font-medium pointer-events-none">$</span>
                  <input id="rec-monto" type="number" step="0.01" value={montoPago} onChange={(e) => setMontoPago(e.target.value)}
                    className="input pl-8 font-semibold num" />
                </div>
                <p className="help">Si es menor al importe de la cuota, queda como pago parcial.</p>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label htmlFor="rec-fecha" className="label">Fecha del pago</label>
                  <input id="rec-fecha" type="date" value={fechaPago} onChange={(e) => setFechaPago(e.target.value)}
                    className="input" />
                </div>
                <div>
                  <label htmlFor="rec-metodo" className="label">Medio de pago</label>
                  <select id="rec-metodo" value={metodoPago} onChange={(e) => setMetodoPago(e.target.value as any)}
                    className="input">
                    <option value="efectivo">Efectivo</option>
                    <option value="transferencia">Transferencia</option>
                    <option value="cheque">Cheque</option>
                    <option value="tarjeta">Tarjeta</option>
                  </select>
                </div>
              </div>
              <div>
                <label htmlFor="rec-observaciones" className="label">Observaciones <span className="font-normal text-muted">(opcional)</span></label>
                <textarea id="rec-observaciones" value={observaciones} onChange={(e) => setObservaciones(e.target.value)} rows={2}
                  className="input resize-none"
                  placeholder="Aparece impresa en el recibo" />
              </div>
            </div>

            <div className="modal-footer">
              <button type="button" onClick={() => setModalPagoAbierto(false)}
                className="btn-secondary flex-1 sm:flex-none">
                Cancelar
              </button>
              <button type="button" onClick={registrarPago} disabled={loading || !montoPago || parseFloat(montoPago) <= 0}
                className="btn-accent flex-1 sm:flex-none">
                {loading ? <span className="spinner" /> : <CheckCircle className="w-4 h-4" />}
                {loading ? 'Guardando…' : 'Confirmar pago'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Modal recibo ──────────────────────────────────────────── */}
      {mostrarRecibo && reciboGenerado && (
        <div className="fixed inset-0 bg-slate-950/50 flex items-start justify-center p-4 z-50 overflow-y-auto">
          <div className="bg-surface border border-line rounded-xl max-w-xl w-full my-4 shadow-e3" role="dialog" aria-modal="true" aria-labelledby="rec-titulo-recibo">
            {/* Header modal */}
            <div className="modal-header justify-between">
              <h3 id="rec-titulo-recibo" className="font-semibold text-fg flex items-center gap-2">
                <FileText className="w-5 h-5 text-primary" />
                Recibo de pago
              </h3>
              <button type="button" onClick={() => setMostrarRecibo(false)} className="btn-icon" aria-label="Cerrar"><X className="w-5 h-5" /></button>
            </div>

            {/* Contenido imprimible (colores fijos: se exporta a PDF sobre fondo blanco) */}
            <div className="p-3 sm:p-4 bg-surface-2">
            <div ref={reciboRef} className="bg-white text-[#1E293B] p-6 rounded-lg">
              {/* Header recibo */}
              <div className="flex items-start justify-between mb-6 pb-4 border-b-2 border-[#0F4C81]">
                <div>
                  <div className="text-2xl font-extrabold text-[#0F4C81] tracking-tight">ELECTRO HOGAR</div>
                  <div className="text-xs text-[#64748B] mt-0.5">Las Talitas, Tucumán — Parque Logístico 1300</div>
                  <div className="text-xs text-[#64748B]">Tel: (381) 446-1795</div>
                </div>
                <div className="text-right">
                  <div className="text-xs font-semibold text-[#64748B] uppercase tracking-wider">Recibo de pago</div>
                  <div className="text-lg font-bold text-[#0F4C81] mt-0.5 num">{reciboGenerado.numero_recibo}</div>
                  <div className="text-xs text-[#64748B] mt-0.5 first-letter:uppercase">{fmtFechaLarga(reciboGenerado.fecha_pago)}</div>
                </div>
              </div>

              {/* Info cliente / pago */}
              <div className="grid grid-cols-2 gap-6 mb-5">
                <div>
                  <div className="text-xs font-semibold text-[#64748B] uppercase tracking-wider mb-2">Cliente</div>
                  <div className="font-semibold text-sm">{reciboGenerado.cliente.nombre} {reciboGenerado.cliente.apellido || ''}</div>
                  {reciboGenerado.cliente.documento && <div className="text-xs text-[#64748B] num">DNI: {reciboGenerado.cliente.documento}</div>}
                  {reciboGenerado.cliente.telefono && <div className="text-xs text-[#64748B] num">Tel: {reciboGenerado.cliente.telefono}</div>}
                </div>
                <div>
                  <div className="text-xs font-semibold text-[#64748B] uppercase tracking-wider mb-2">Datos del pago</div>
                  <div className="text-xs space-y-0.5">
                    <div><span className="font-semibold">Medio de pago:</span> {(reciboGenerado.pago.metodo_pago || 'efectivo').toUpperCase()}</div>
                    <div><span className="font-semibold">Cuota N°:</span> {reciboGenerado.pago.numero_cuota}</div>
                    <div><span className="font-semibold">Estado:</span> {reciboGenerado.es_pago_parcial ? 'Pago parcial' : 'Pagada'}</div>
                  </div>
                </div>
              </div>

              {/* Tabla detalle */}
              <div className="border border-[#E2E8F0] rounded-lg overflow-hidden mb-5">
                <table className="w-full text-sm">
                  <thead className="bg-[#F5F7FA]">
                    <tr>
                      <th className="text-left py-2.5 px-4 text-xs font-semibold text-[#64748B]">Concepto</th>
                      <th className="text-center py-2.5 px-4 text-xs font-semibold text-[#64748B]">Cuota</th>
                      <th className="text-right py-2.5 px-4 text-xs font-semibold text-[#64748B]">Importe</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td className="py-3 px-4 text-sm">
                        {reciboGenerado.transaccion.tipo_transaccion === 'prestamo' ? 'Préstamo de dinero' : reciboGenerado.transaccion.producto?.nombre || 'Venta'}
                        {reciboGenerado.transaccion.descripcion && (
                          <div className="text-xs text-[#64748B] mt-0.5">{reciboGenerado.transaccion.descripcion}</div>
                        )}
                      </td>
                      <td className="py-3 px-4 text-center font-semibold num">{reciboGenerado.pago.numero_cuota}</td>
                      <td className="py-3 px-4 text-right font-bold num">{fmt(reciboGenerado.monto_pagado)}</td>
                    </tr>
                  </tbody>
                </table>
              </div>

              {/* Aviso pago parcial */}
              {reciboGenerado.es_pago_parcial && (
                <div className="mb-5 bg-[#DBEAFE] border border-[#2563EB]/30 rounded-lg p-3">
                  <div className="text-xs font-bold text-[#1E40AF] mb-1">Pago parcial</div>
                  <div className="text-xs text-[#1E40AF] space-y-0.5 num">
                    <div>Total abonado en esta cuota: <strong>{fmt(reciboGenerado.pago.monto_total_pagado || reciboGenerado.monto_pagado)}</strong></div>
                    <div>Saldo de esta cuota: <strong>{fmt(reciboGenerado.monto_pendiente_cuota || 0)}</strong></div>
                  </div>
                </div>
              )}

              {/* Total destacado */}
              <div className={`flex items-center justify-between rounded-lg p-4 mb-4 ${reciboGenerado.es_pago_parcial ? 'bg-[#DBEAFE]' : 'bg-[#0F4C81]'}`}>
                <div className={`text-sm font-semibold ${reciboGenerado.es_pago_parcial ? 'text-[#1E40AF]' : 'text-white/90'}`}>
                  {reciboGenerado.es_pago_parcial ? 'Importe de este pago' : 'Total pagado'}
                </div>
                <div className={`text-2xl font-extrabold num ${reciboGenerado.es_pago_parcial ? 'text-[#1E40AF]' : 'text-white'}`}>
                  {fmt(reciboGenerado.monto_pagado)}
                </div>
              </div>

              {/* Observaciones */}
              {reciboGenerado.pago.observaciones && (
                <div className="mb-4 bg-[#F5F7FA] rounded-lg p-3 text-xs text-[#475569]">
                  <strong className="text-[#1E293B]">Observaciones:</strong> {reciboGenerado.pago.observaciones}
                </div>
              )}

              {/* Footer recibo */}
              <div className="text-center pt-4 border-t border-[#E2E8F0] text-xs text-[#64748B] space-y-0.5">
                <div>Comprobante válido de pago — Electro Hogar</div>
                <div>Generado el {fmtFechaLarga(hoyISO())}</div>
              </div>
            </div>
            </div>

            {/* Footer modal */}
            <div className="modal-footer flex-wrap">
              <button type="button" onClick={() => setMostrarRecibo(false)}
                className="btn-secondary">
                Cerrar
              </button>
              {reciboGenerado.cliente?.telefono && (
                <button type="button" onClick={enviarPorWhatsApp} disabled={generandoPDF}
                  className="btn-secondary">
                  <MessageCircle className="w-4 h-4" />
                  Enviar por WhatsApp
                </button>
              )}
              <button type="button" onClick={descargarPDF} disabled={generandoPDF}
                className="btn-primary">
                {generandoPDF ? <span className="spinner" /> : <Download className="w-4 h-4" />}
                {generandoPDF ? 'Generando…' : 'Descargar PDF'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
