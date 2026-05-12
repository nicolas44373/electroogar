'use client'
import { useState, useEffect, useRef, useCallback } from 'react'
import html2canvas from 'html2canvas'
import { jsPDF } from 'jspdf'
import { supabase } from '@/app/lib/supabase'
import { Cliente, Transaccion, Pago } from '@/app/lib/types/cobranzas'
import {
  FileText, Download, Eye, Search, DollarSign, CheckCircle,
  User, X, Phone, Mail, AlertTriangle, Filter, MessageCircle
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
  const [fechaPago, setFechaPago] = useState(new Date().toISOString().split('T')[0])
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
    setFechaPago(new Date().toISOString().split('T')[0])
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

  const fmt = (n: number) => new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', minimumFractionDigits: 0 }).format(n)

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
    if (pago.estado === 'pagado')       return { label: 'Pagado',    cls: 'bg-green-100 text-green-800' }
    if (pago.estado === 'parcial')      return { label: 'Parcial',   cls: 'bg-yellow-100 text-yellow-800' }
    if (pago.estado === 'reprogramado') return { label: 'Reprog.',   cls: 'bg-purple-100 text-purple-800' }
    if (vencido)                        return { label: 'Vencido',   cls: 'bg-red-100 text-red-800' }
                                        return { label: 'Pendiente', cls: 'bg-gray-100 text-gray-700' }
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
    <div className="min-h-screen bg-gray-50 p-2 sm:p-4 md:p-6">
      <div className="max-w-7xl mx-auto space-y-4 sm:space-y-6">

        {/* Toast */}
        {toast && (
          <div className={`fixed top-4 right-4 z-[60] flex items-center gap-3 px-4 py-3 rounded-xl shadow-lg text-sm font-medium max-w-sm transition-all ${
            toast.tipo === 'success' ? 'bg-green-50 border border-green-200 text-green-800' :
            toast.tipo === 'error'   ? 'bg-red-50 border border-red-200 text-red-800' :
                                       'bg-blue-50 border border-blue-200 text-blue-800'
          }`}>
            {toast.tipo === 'success' ? <CheckCircle className="w-4 h-4 flex-shrink-0 text-green-600" /> :
             toast.tipo === 'error'   ? <AlertTriangle className="w-4 h-4 flex-shrink-0 text-red-600" /> :
                                        <Eye className="w-4 h-4 flex-shrink-0 text-blue-600" />}
            {toast.texto}
          </div>
        )}

        {/* Header + buscador */}
        <div className="bg-white rounded-xl shadow-sm border p-4 sm:p-6">
          <div className="flex items-start justify-between gap-4 mb-5">
            <div>
              <h1 className="text-xl sm:text-2xl font-bold text-gray-900 flex items-center gap-2">
                <FileText className="w-6 h-6 text-blue-600" />
                Recibos y Pagos
              </h1>
              <p className="text-sm text-gray-500 mt-1">Busca un cliente, registra pagos y descarga recibos</p>
            </div>
          </div>

          <div className="relative" ref={searchWrapperRef}>
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400 pointer-events-none" />
            <input
              type="text"
              placeholder="Buscar por nombre, apellido, documento o telefono..."
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Escape') { setClientesEncontrados([]); setBusqueda('') } }}
              autoComplete="off"
              className="w-full pl-10 pr-10 py-3 border-2 border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
            />
            {busqueda.length > 0 && (
              <button type="button" onClick={() => { setBusqueda(''); setClientesEncontrados([]) }}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors">
                {loading ? (
                  <span className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin inline-block" />
                ) : (
                  <X className="w-4 h-4" />
                )}
              </button>
            )}

            {clientesEncontrados.length > 0 && (
              <div className="absolute z-20 w-full mt-2 bg-white rounded-xl shadow-xl border max-h-80 overflow-y-auto">
                {clientesEncontrados.map((cliente) => (
                  <button key={cliente.id} type="button" onClick={() => seleccionarCliente(cliente)}
                    className="w-full p-3 hover:bg-gray-50 border-b last:border-0 text-left transition-colors">
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-2 min-w-0">
                        <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center flex-shrink-0">
                          <User className="w-4 h-4 text-blue-600" />
                        </div>
                        <div className="min-w-0">
                          <div className="font-semibold text-gray-900 text-sm truncate">
                            {cliente.nombre} {cliente.apellido || ''}
                          </div>
                          <div className="text-xs text-gray-500 flex gap-2">
                            {cliente.documento && <span>{cliente.documento}</span>}
                            {cliente.telefono && <span>{cliente.telefono}</span>}
                          </div>
                        </div>
                      </div>
                      <div className="text-right flex-shrink-0">
                        <div className="text-sm font-bold text-red-600">{fmt(cliente.total_deuda)}</div>
                        <div className="text-xs text-gray-400">{cliente.transacciones_activas} transac.</div>
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
          <div className="bg-white rounded-xl shadow-sm border p-10 text-center">
            <Search className="w-14 h-14 text-gray-200 mx-auto mb-3" />
            <h3 className="text-lg font-semibold text-gray-700 mb-1">Busca un cliente para comenzar</h3>
            <p className="text-sm text-gray-400">Utiliza el buscador para encontrar clientes y gestionar sus pagos</p>
          </div>
        )}

        {/* Cliente seleccionado */}
        {clienteSeleccionado && (
          <>
            {/* Card cliente */}
            <div className="bg-white rounded-xl shadow-sm border p-4 sm:p-6">
              <div className="flex items-start justify-between gap-4 mb-4">
                <div className="flex items-start gap-3 flex-1">
                  <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center flex-shrink-0">
                    <User className="w-5 h-5 text-blue-600" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h2 className="text-lg font-bold text-gray-900">
                      {clienteSeleccionado.nombre} {clienteSeleccionado.apellido || ''}
                    </h2>
                    <div className="flex flex-wrap gap-3 mt-1 text-sm text-gray-500">
                      {clienteSeleccionado.documento && <span>DNI {clienteSeleccionado.documento}</span>}
                      {clienteSeleccionado.telefono && <span className="flex items-center gap-1"><Phone className="w-3 h-3" />{clienteSeleccionado.telefono}</span>}
                      {clienteSeleccionado.email && <span className="flex items-center gap-1"><Mail className="w-3 h-3" />{clienteSeleccionado.email}</span>}
                    </div>
                  </div>
                </div>
                <button type="button" onClick={() => { setClienteSeleccionado(null); setDeudasCliente([]) }}
                  className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-full transition-colors">
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Stats */}
              <div className="grid grid-cols-3 gap-3">
                <div className="bg-red-50 border border-red-100 rounded-xl p-3 text-center">
                  <div className="text-xs text-red-500 font-medium mb-1">Deuda total</div>
                  <div className="text-lg font-bold text-red-700">{fmt(totalDeudaCliente)}</div>
                </div>
                <div className="bg-amber-50 border border-amber-100 rounded-xl p-3 text-center">
                  <div className="text-xs text-amber-600 font-medium mb-1">Cuotas pendientes</div>
                  <div className="text-lg font-bold text-amber-700">{totalCuotasPendientes}</div>
                </div>
                <div className={`rounded-xl p-3 text-center border ${totalVencidas > 0 ? 'bg-red-50 border-red-200' : 'bg-green-50 border-green-100'}`}>
                  <div className={`text-xs font-medium mb-1 ${totalVencidas > 0 ? 'text-red-500' : 'text-green-600'}`}>Vencidas</div>
                  <div className={`text-lg font-bold ${totalVencidas > 0 ? 'text-red-700' : 'text-green-700'}`}>{totalVencidas}</div>
                </div>
              </div>
            </div>

            {/* Barra de filtros */}
            <div className="bg-white rounded-xl shadow-sm border p-4">
              <div className="flex flex-col sm:flex-row gap-3">
                {/* Filtro por estado */}
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2 text-xs font-semibold text-gray-500 uppercase tracking-wide">
                    <Filter className="w-3.5 h-3.5" /> Estado de cuotas
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {([
                      { key: 'todas',    label: 'Todas' },
                      { key: 'pendiente',label: 'Pendientes' },
                      { key: 'vencida',  label: 'Vencidas' },
                      { key: 'parcial',  label: 'Parciales' },
                      { key: 'pagada',   label: 'Pagadas' },
                    ] as { key: FiltroEstado; label: string }[]).map(({ key, label }) => {
                      const count = contarPorEstado(key)
                      const active = filtroEstado === key
                      const colorMap: Record<FiltroEstado, string> = {
                        todas:    active ? 'bg-gray-800 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200',
                        pendiente:active ? 'bg-amber-500 text-white' : 'bg-amber-50 text-amber-700 hover:bg-amber-100',
                        vencida:  active ? 'bg-red-600 text-white'   : 'bg-red-50 text-red-700 hover:bg-red-100',
                        parcial:  active ? 'bg-blue-600 text-white'  : 'bg-blue-50 text-blue-700 hover:bg-blue-100',
                        pagada:   active ? 'bg-green-600 text-white' : 'bg-green-50 text-green-700 hover:bg-green-100',
                      }
                      return (
                        <button key={key} type="button" onClick={() => setFiltroEstado(key)}
                          className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors flex items-center gap-1.5 ${colorMap[key]}`}>
                          {label}
                          <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${active ? 'bg-white/25' : 'bg-white shadow-sm'}`}>
                            {count}
                          </span>
                        </button>
                      )
                    })}
                  </div>
                </div>

                {/* Filtro por tipo */}
                <div>
                  <div className="flex items-center gap-2 mb-2 text-xs font-semibold text-gray-500 uppercase tracking-wide">
                    Tipo
                  </div>
                  <div className="flex gap-2">
                    {([
                      { key: 'todas',   label: 'Todas' },
                      { key: 'venta',   label: 'Ventas' },
                      { key: 'prestamo',label: 'Prestamos' },
                    ] as { key: FiltroTipo; label: string }[]).map(({ key, label }) => (
                      <button key={key} type="button" onClick={() => setFiltroTipo(key)}
                        className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                          filtroTipo === key ? 'bg-indigo-600 text-white' : 'bg-indigo-50 text-indigo-700 hover:bg-indigo-100'
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
              <div className="bg-white rounded-xl border p-8 text-center">
                <span className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin inline-block" />
                <p className="text-sm text-gray-500 mt-3">Cargando...</p>
              </div>
            ) : deudasFiltradas.length === 0 ? (
              <div className="bg-white rounded-xl border p-8 text-center">
                <CheckCircle className="w-10 h-10 text-green-400 mx-auto mb-2" />
                <p className="text-gray-600 font-medium">No hay cuotas que coincidan con el filtro</p>
              </div>
            ) : (
              <div className="space-y-4">
                {deudasFiltradas.map((deuda) => (
                  <div key={deuda.transaccion.id} className="bg-white rounded-xl shadow-sm border overflow-hidden">
                    {/* Header transaccion */}
                    <div className="bg-gradient-to-r from-slate-50 to-white p-4 border-b">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1">
                          <h3 className="font-semibold text-gray-900 flex items-center gap-2 text-sm sm:text-base">
                            <span>{deuda.transaccion.tipo_transaccion === 'venta' ? '🛒' : '💵'}</span>
                            {deuda.transaccion.tipo_transaccion === 'prestamo'
                              ? 'Prestamo de Dinero'
                              : (deuda.transaccion as any).producto?.nombre || 'Venta'}
                          </h3>
                          {deuda.transaccion.descripcion && (
                            <div className="mt-1.5 bg-blue-50 border-l-4 border-blue-400 p-2 rounded text-xs text-gray-700">
                              {deuda.transaccion.descripcion}
                            </div>
                          )}
                          <div className="flex flex-wrap gap-3 mt-1.5 text-xs text-gray-500">
                            <span>Inicio: {fmtFecha(deuda.transaccion.fecha_inicio)}</span>
                            <span>{deuda.cuotasPendientes}/{deuda.cuotasTotales} cuotas pendientes</span>
                          </div>
                        </div>
                        <div className="text-right flex-shrink-0">
                          <div className="text-xs text-gray-500">Saldo pendiente</div>
                          <div className="text-lg font-bold text-red-600">{fmt(deuda.saldoPendiente)}</div>
                        </div>
                      </div>
                    </div>

                    {/* Tabla cuotas */}
                    <div className="overflow-x-auto">
                      <table className="w-full text-xs sm:text-sm">
                        <thead className="bg-gray-50 border-b">
                          <tr>
                            <th className="text-left p-2 sm:p-3 font-semibold text-gray-600">Cuota</th>
                            <th className="text-left p-2 sm:p-3 font-semibold text-gray-600">Vencimiento</th>
                            <th className="text-right p-2 sm:p-3 font-semibold text-gray-600">Monto</th>
                            <th className="text-right p-2 sm:p-3 font-semibold text-gray-600">Pagado</th>
                            <th className="text-center p-2 sm:p-3 font-semibold text-gray-600">Estado</th>
                            <th className="text-center p-2 sm:p-3 font-semibold text-gray-600 min-w-[110px]">Acciones</th>
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
                              <tr key={pago.id} className={`border-b last:border-0 hover:bg-gray-50 transition-colors ${estaVencido ? 'bg-red-50/30' : ''}`}>
                                <td className="p-2 sm:p-3 font-semibold text-gray-800">#{pago.numero_cuota}</td>
                                <td className="p-2 sm:p-3">
                                  <div>{fmtFecha(pago.fecha_vencimiento)}</div>
                                  {pago.estado !== 'pagado' && (
                                    <div className={`text-[10px] mt-0.5 ${estaVencido ? 'text-red-600 font-medium' : dv === 0 ? 'text-orange-600' : dv <= 7 ? 'text-yellow-600' : 'text-gray-400'}`}>
                                      {estaVencido ? `Vencido hace ${Math.abs(dv)}d` : dv === 0 ? 'Vence hoy' : `Vence en ${dv}d`}
                                    </div>
                                  )}
                                  {pago.fecha_reprogramacion && (
                                    <div className="text-[10px] text-purple-600 mt-0.5">Rep: {fmtFecha(pago.fecha_reprogramacion)}</div>
                                  )}
                                </td>
                                <td className="p-2 sm:p-3 text-right">
                                  <div className="font-semibold text-gray-800">{fmt(montoTotal)}</div>
                                  {mora > 0 && <div className="text-[10px] text-red-500">+{fmt(mora)} mora</div>}
                                </td>
                                <td className="p-2 sm:p-3 text-right">
                                  <div className="font-medium text-green-600">{fmt(montoPag)}</div>
                                  {pago.fecha_pago && <div className="text-[10px] text-gray-400">{fmtFecha(pago.fecha_pago)}</div>}
                                </td>
                                <td className="p-2 sm:p-3 text-center">
                                  <span className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-semibold ${badge.cls}`}>
                                    {badge.label}
                                  </span>
                                </td>
                                <td className="p-2 sm:p-3">
                                  <div className="flex justify-center gap-1 flex-wrap">
                                    {pago.estado !== 'pagado' && (
                                      <button type="button" onClick={() => abrirModalPago(pago, deuda.transaccion)}
                                        className="px-2 py-1 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors flex items-center gap-1 text-[10px] sm:text-xs font-medium">
                                        <DollarSign className="w-3 h-3" />
                                        <span className="hidden sm:inline">Pagar</span>
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
                                          className="px-2 py-1 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-1 text-[10px] sm:text-xs font-medium">
                                          <Eye className="w-3 h-3" />
                                          <span className="hidden sm:inline">Ver</span>
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
                                          className="px-2 py-1 bg-gray-700 text-white rounded-lg hover:bg-gray-800 transition-colors flex items-center gap-1 text-[10px] sm:text-xs font-medium">
                                          <Download className="w-3 h-3" />
                                          <span className="hidden sm:inline">PDF</span>
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
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl max-w-md w-full p-5 max-h-[90vh] overflow-y-auto shadow-2xl">
            <div className="flex items-center justify-between mb-5">
              <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                <DollarSign className="w-5 h-5 text-green-600" />
                Registrar Pago
              </h3>
              <button type="button" onClick={() => setModalPagoAbierto(false)} className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"><X className="w-5 h-5" /></button>
            </div>

            <div className="bg-gradient-to-br from-slate-50 to-gray-50 rounded-xl p-4 mb-4 border">
              <div className="font-semibold text-gray-900 text-sm mb-0.5">{clienteSeleccionado.nombre} {clienteSeleccionado.apellido || ''}</div>
              <div className="text-xs text-gray-500 mb-3">
                {transaccionPago.tipo_transaccion === 'prestamo' ? 'Prestamo de Dinero' : (transaccionPago as any).producto?.nombre || 'Venta'}
                {transaccionPago.descripcion && ` — ${transaccionPago.descripcion}`}
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Cuota <strong>#{pagoSeleccionado.numero_cuota}</strong></span>
                <div className="text-right">
                  <div className="font-bold text-gray-900">{fmt((pagoSeleccionado.monto_cuota || transaccionPago.monto_cuota) + (pagoSeleccionado.intereses_mora || 0))}</div>
                  {(pagoSeleccionado.intereses_mora || 0) > 0 && <div className="text-xs text-red-500">incl. {fmt(pagoSeleccionado.intereses_mora || 0)} mora</div>}
                  {(pagoSeleccionado.monto_pagado || 0) > 0 && <div className="text-xs text-green-600">ya pago: {fmt(pagoSeleccionado.monto_pagado || 0)}</div>}
                </div>
              </div>
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">Monto a pagar</label>
                <div className="relative">
                  <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input type="number" step="0.01" value={montoPago} onChange={(e) => setMontoPago(e.target.value)}
                    className="w-full pl-9 pr-3 py-2.5 border-2 border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent text-sm font-semibold" />
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">Fecha de pago</label>
                <input type="date" value={fechaPago} onChange={(e) => setFechaPago(e.target.value)}
                  className="w-full px-3 py-2.5 border-2 border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent text-sm" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">Metodo de pago</label>
                <select value={metodoPago} onChange={(e) => setMetodoPago(e.target.value as any)}
                  className="w-full px-3 py-2.5 border-2 border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent text-sm">
                  <option value="efectivo">💵 Efectivo</option>
                  <option value="transferencia">🏦 Transferencia</option>
                  <option value="cheque">📝 Cheque</option>
                  <option value="tarjeta">💳 Tarjeta</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">Observaciones (opcional)</label>
                <textarea value={observaciones} onChange={(e) => setObservaciones(e.target.value)} rows={2}
                  className="w-full px-3 py-2.5 border-2 border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent text-sm resize-none"
                  placeholder="Observaciones adicionales..." />
              </div>
            </div>

            <div className="flex gap-3 mt-5">
              <button type="button" onClick={() => setModalPagoAbierto(false)}
                className="flex-1 py-2.5 border-2 border-gray-200 rounded-xl text-gray-700 hover:bg-gray-50 transition-colors text-sm font-medium">
                Cancelar
              </button>
              <button type="button" onClick={registrarPago} disabled={loading || !montoPago || parseFloat(montoPago) <= 0}
                className="flex-1 py-2.5 bg-green-600 text-white rounded-xl hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-sm font-medium flex items-center justify-center gap-2">
                {loading ? <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> : <CheckCircle className="w-4 h-4" />}
                {loading ? 'Procesando...' : 'Confirmar Pago'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Modal recibo ──────────────────────────────────────────── */}
      {mostrarRecibo && reciboGenerado && (
        <div className="fixed inset-0 bg-black/60 flex items-start justify-center p-4 z-50 overflow-y-auto">
          <div className="bg-white rounded-2xl max-w-xl w-full my-4 shadow-2xl">
            {/* Header modal */}
            <div className="flex items-center justify-between px-5 py-4 border-b">
              <h3 className="font-bold text-gray-900 flex items-center gap-2">
                <FileText className="w-5 h-5 text-blue-600" />
                Recibo de Pago
              </h3>
              <div className="flex items-center gap-2">
                <button type="button" onClick={descargarPDF} disabled={generandoPDF}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-60 transition-colors text-xs font-medium">
                  {generandoPDF ? <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" /> : <Download className="w-3.5 h-3.5" />}
                  PDF
                </button>
                {reciboGenerado.cliente?.telefono && (
                  <button type="button" onClick={enviarPorWhatsApp} disabled={generandoPDF}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-60 transition-colors text-xs font-medium">
                    <MessageCircle className="w-3.5 h-3.5" />
                    WhatsApp
                  </button>
                )}
                <button type="button" onClick={() => setMostrarRecibo(false)} className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"><X className="w-5 h-5" /></button>
              </div>
            </div>

            {/* Contenido imprimible */}
            <div ref={reciboRef} className="bg-white p-6">
              {/* Header recibo */}
              <div className="flex items-start justify-between mb-6 pb-4 border-b-2 border-blue-600">
                <div>
                  <div className="text-2xl font-black text-gray-900">ELECTRO HOGAR</div>
                  <div className="text-xs text-gray-500 mt-0.5">Las Talitas, Tucuman — Parque Logistico 1300</div>
                  <div className="text-xs text-gray-500">Tel: (381) 446-1795</div>
                </div>
                <div className="text-right">
                  <div className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Recibo de Pago</div>
                  <div className="text-lg font-bold text-blue-600 mt-0.5">{reciboGenerado.numero_recibo}</div>
                  <div className="text-xs text-gray-500 mt-0.5">{fmtFechaLarga(reciboGenerado.fecha_pago)}</div>
                </div>
              </div>

              {/* Info cliente / pago */}
              <div className="grid grid-cols-2 gap-6 mb-5">
                <div>
                  <div className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Cliente</div>
                  <div className="font-semibold text-gray-900 text-sm">{reciboGenerado.cliente.nombre} {reciboGenerado.cliente.apellido || ''}</div>
                  {reciboGenerado.cliente.documento && <div className="text-xs text-gray-500">DNI: {reciboGenerado.cliente.documento}</div>}
                  {reciboGenerado.cliente.telefono && <div className="text-xs text-gray-500">Tel: {reciboGenerado.cliente.telefono}</div>}
                </div>
                <div>
                  <div className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Datos del pago</div>
                  <div className="text-xs text-gray-700 space-y-0.5">
                    <div><span className="font-semibold">Metodo:</span> {(reciboGenerado.pago.metodo_pago || 'efectivo').toUpperCase()}</div>
                    <div><span className="font-semibold">Cuota N°:</span> {reciboGenerado.pago.numero_cuota}</div>
                    <div><span className="font-semibold">Estado:</span> {reciboGenerado.es_pago_parcial ? 'Pago parcial' : 'Pagado'}</div>
                  </div>
                </div>
              </div>

              {/* Tabla detalle */}
              <div className="border rounded-xl overflow-hidden mb-5">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="text-left py-2.5 px-4 text-xs font-semibold text-gray-600">Concepto</th>
                      <th className="text-center py-2.5 px-4 text-xs font-semibold text-gray-600">Cuota</th>
                      <th className="text-right py-2.5 px-4 text-xs font-semibold text-gray-600">Monto</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td className="py-3 px-4 text-gray-900 text-sm">
                        {reciboGenerado.transaccion.tipo_transaccion === 'prestamo' ? 'Prestamo de dinero' : reciboGenerado.transaccion.producto?.nombre || 'Venta'}
                        {reciboGenerado.transaccion.descripcion && (
                          <div className="text-xs text-gray-500 mt-0.5">{reciboGenerado.transaccion.descripcion}</div>
                        )}
                      </td>
                      <td className="py-3 px-4 text-center text-gray-900 font-semibold">#{reciboGenerado.pago.numero_cuota}</td>
                      <td className="py-3 px-4 text-right font-bold text-gray-900">{fmt(reciboGenerado.monto_pagado)}</td>
                    </tr>
                  </tbody>
                </table>
              </div>

              {/* Aviso pago parcial */}
              {reciboGenerado.es_pago_parcial && (
                <div className="mb-5 bg-amber-50 border border-amber-200 rounded-xl p-3">
                  <div className="text-xs font-bold text-amber-800 mb-1">Pago Parcial</div>
                  <div className="text-xs text-amber-700 space-y-0.5">
                    <div>Total abonado en esta cuota: <strong>{fmt(reciboGenerado.pago.monto_total_pagado || reciboGenerado.monto_pagado)}</strong></div>
                    <div>Pendiente de esta cuota: <strong>{fmt(reciboGenerado.monto_pendiente_cuota || 0)}</strong></div>
                  </div>
                </div>
              )}

              {/* Total destacado */}
              <div className={`flex items-center justify-between rounded-xl p-4 mb-4 ${reciboGenerado.es_pago_parcial ? 'bg-amber-50 border border-amber-200' : 'bg-blue-50 border border-blue-200'}`}>
                <div className={`text-sm font-semibold ${reciboGenerado.es_pago_parcial ? 'text-amber-700' : 'text-blue-700'}`}>
                  {reciboGenerado.es_pago_parcial ? 'Monto de este pago' : 'Total pagado'}
                </div>
                <div className={`text-2xl font-black ${reciboGenerado.es_pago_parcial ? 'text-amber-800' : 'text-blue-800'}`}>
                  {fmt(reciboGenerado.monto_pagado)}
                </div>
              </div>

              {/* Observaciones */}
              {reciboGenerado.pago.observaciones && (
                <div className="mb-4 bg-gray-50 rounded-xl p-3 text-xs text-gray-600">
                  <strong className="text-gray-700">Observaciones:</strong> {reciboGenerado.pago.observaciones}
                </div>
              )}

              {/* Footer recibo */}
              <div className="text-center pt-4 border-t text-xs text-gray-400 space-y-0.5">
                <div>Comprobante valido de pago — Sistema Electro Hogar</div>
                <div>Generado el {fmtFechaLarga(new Date().toISOString().split('T')[0])}</div>
              </div>
            </div>

            {/* Footer modal */}
            <div className="border-t bg-gray-50 px-5 py-3 flex gap-3 rounded-b-2xl">
              <button type="button" onClick={descargarPDF} disabled={generandoPDF}
                className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-blue-600 text-white rounded-xl hover:bg-blue-700 disabled:opacity-60 transition-colors text-sm font-medium">
                {generandoPDF ? <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> : <Download className="w-4 h-4" />}
                {generandoPDF ? 'Generando...' : 'Descargar PDF'}
              </button>
              {reciboGenerado.cliente?.telefono && (
                <button type="button" onClick={enviarPorWhatsApp} disabled={generandoPDF}
                  className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-green-600 text-white rounded-xl hover:bg-green-700 disabled:opacity-60 transition-colors text-sm font-medium">
                  <MessageCircle className="w-4 h-4" />
                  WhatsApp
                </button>
              )}
              <button type="button" onClick={() => setMostrarRecibo(false)}
                className="px-5 py-2.5 bg-white text-gray-700 border-2 border-gray-200 rounded-xl hover:bg-gray-50 transition-colors text-sm font-medium">
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}