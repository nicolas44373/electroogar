import { useState, useEffect, useRef } from 'react'
import { supabase } from '@/app/lib/supabase'
import { Cliente, Transaccion, Pago } from '@/app/lib/types/cobranzas'
import {
  FileText,
  Download,
  Eye,
  Search,
  DollarSign,
  CheckCircle,
  User,
  X,
  Phone,
  Mail
} from 'lucide-react'

interface DeudaCliente {
  transaccion: Transaccion
  pagos: Pago[]
  saldoPendiente: number
  cuotasPendientes: number
  cuotasTotales: number
}

interface BusquedaCliente extends Cliente {
  total_deuda: number
  transacciones_activas: number
}

interface GeneradorRecibosProps {
  clientes?: Cliente[]
  transacciones?: Transaccion[]
  pagos?: { [key: string]: Pago[] }
}

export default function GeneradorRecibos({
  clientes: _c,
  transacciones: _t,
  pagos: _p
}: GeneradorRecibosProps = {}) {
  const [busqueda, setBusqueda] = useState('')
  const [clientesEncontrados, setClientesEncontrados] = useState<BusquedaCliente[]>([])
  const [clienteSeleccionado, setClienteSeleccionado] = useState<Cliente | null>(null)
  const [deudasCliente, setDeudasCliente] = useState<DeudaCliente[]>([])
  const [loading, setLoading] = useState(false)

  // Estados para registro de pago
  const [modalPagoAbierto, setModalPagoAbierto] = useState(false)
  const [pagoSeleccionado, setPagoSeleccionado] = useState<Pago | null>(null)
  const [transaccionPago, setTransaccionPago] = useState<Transaccion | null>(null)
  const [montoPago, setMontoPago] = useState('')
  const [fechaPago, setFechaPago] = useState(new Date().toISOString().split('T')[0])
  const [metodoPago, setMetodoPago] = useState<'efectivo' | 'transferencia' | 'cheque' | 'tarjeta'>(
    'efectivo'
  )
  const [observaciones, setObservaciones] = useState('')

  // Estado para vista previa de recibo
  const [reciboGenerado, setReciboGenerado] = useState<any>(null)
  const [mostrarRecibo, setMostrarRecibo] = useState(false)

  // Ref para el contenido del recibo
  const reciboRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (busqueda.length >= 2) buscarClientes()
    else setClientesEncontrados([])
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [busqueda])

  const buscarClientes = async () => {
    setLoading(true)
    try {
      const { data: clientes, error } = await supabase
        .from('clientes')
        .select(
          `
          *,
          transacciones(
            id,
            monto_total,
            estado,
            pagos(
              id,
              estado,
              monto_cuota,
              monto_pagado
            )
          )
        `
        )
        .or(
          `nombre.ilike.%${busqueda}%,apellido.ilike.%${busqueda}%,documento.ilike.%${busqueda}%,telefono.ilike.%${busqueda}%`
        )
        .limit(10)

      if (error) throw error

      const clientesConDeuda =
        clientes?.map((cliente) => {
          let totalDeuda = 0
          let transaccionesActivas = 0

          ;(cliente as any).transacciones?.forEach((trans: any) => {
            if (trans.estado !== 'completado') {
              transaccionesActivas++
              trans.pagos?.forEach((pago: any) => {
                if (pago.estado !== 'pagado') {
                  const montoCuota = pago.monto_cuota || 0
                  const montoPagado = pago.monto_pagado || 0
                  totalDeuda += montoCuota - montoPagado
                }
              })
            }
          })

          return {
            ...cliente,
            total_deuda: totalDeuda,
            transacciones_activas: transaccionesActivas
          }
        }) || []

      setClientesEncontrados(clientesConDeuda)
    } catch (error) {
      console.error('Error buscando clientes:', error)
    } finally {
      setLoading(false)
    }
  }

  const seleccionarCliente = async (cliente: Cliente) => {
    setClienteSeleccionado(cliente)
    setClientesEncontrados([])
    setBusqueda('')
    await cargarDeudasCliente(cliente.id)
  }

  const cargarDeudasCliente = async (clienteId: string) => {
    setLoading(true)
    try {
      const { data: transacciones, error: transError } = await supabase
        .from('transacciones')
        .select(
          `
          *,
          producto:productos(nombre, precio_unitario),
          pagos(*)
        `
        )
        .eq('cliente_id', clienteId)
        .in('estado', ['activo', 'moroso'])
        .order('fecha_inicio', { ascending: false })

      if (transError) throw transError

      const deudas: DeudaCliente[] = (transacciones || []).map((trans) => {
        const pagos = (((trans as any).pagos || []) as Pago[]).sort((a, b) => {
          return (a.numero_cuota || 0) - (b.numero_cuota || 0)
        })

        const cuotasPendientes = pagos.filter((p) => p.estado !== 'pagado').length

        let saldoPendiente = 0
        pagos.forEach((pago) => {
          if (pago.estado !== 'pagado') {
            const montoCuota = pago.monto_cuota || trans.monto_cuota
            const montoPagado = pago.monto_pagado || 0
            const interesesMora = pago.intereses_mora || 0
            saldoPendiente += montoCuota + interesesMora - montoPagado
          }
        })

        return {
          transaccion: trans,
          pagos,
          saldoPendiente,
          cuotasPendientes,
          cuotasTotales: trans.numero_cuotas
        }
      })

      setDeudasCliente(deudas)
    } catch (error) {
      console.error('Error cargando deudas:', error)
    } finally {
      setLoading(false)
    }
  }

  const abrirModalPago = (pago: Pago, transaccion: Transaccion) => {
    setPagoSeleccionado(pago)
    setTransaccionPago(transaccion)
    const montoCuota = pago.monto_cuota || transaccion.monto_cuota
    const interesesMora = pago.intereses_mora || 0
    const montoRestante = montoCuota + interesesMora - (pago.monto_pagado || 0)
    setMontoPago(montoRestante.toFixed(2))
    setFechaPago(new Date().toISOString().split('T')[0])
    setMetodoPago('efectivo')
    setObservaciones('')
    setModalPagoAbierto(true)
  }

  const registrarPago = async () => {
    if (!pagoSeleccionado || !transaccionPago || !clienteSeleccionado) return

    setLoading(true)
    try {
      const montoNumerico = parseFloat(montoPago)
      const montoCuota = pagoSeleccionado.monto_cuota || transaccionPago.monto_cuota
      const interesesMora = pagoSeleccionado.intereses_mora || 0
      const montoPagadoActual = pagoSeleccionado.monto_pagado || 0
      const montoTotal = montoCuota + interesesMora
      const montoRestante = montoTotal - montoPagadoActual

      let nuevoEstado: 'pendiente' | 'parcial' | 'pagado'
      let nuevoMontoPagado: number

      if (montoNumerico >= montoRestante) {
        nuevoEstado = 'pagado'
        nuevoMontoPagado = montoTotal
      } else {
        nuevoEstado = 'parcial'
        nuevoMontoPagado = montoPagadoActual + montoNumerico
      }

      const numeroRecibo = `REC-${Date.now()}`

      const { error } = await supabase
        .from('pagos')
        .update({
          estado: nuevoEstado,
          monto_pagado: nuevoMontoPagado,
          fecha_pago: fechaPago,
          metodo_pago: metodoPago,
          observaciones: observaciones,
          numero_recibo: numeroRecibo
        })
        .eq('id', pagoSeleccionado.id)

      if (error) throw error

      const datosRecibo = {
        numero_recibo: numeroRecibo,
        fecha_pago: fechaPago,
        cliente: clienteSeleccionado,
        transaccion: transaccionPago,
        pago: {
          ...pagoSeleccionado,
          monto_pagado: montoNumerico,
          monto_total_pagado: nuevoMontoPagado,
          metodo_pago: metodoPago,
          observaciones: observaciones,
          estado: nuevoEstado
        },
        monto_pagado: montoNumerico,
        es_pago_parcial: nuevoEstado === 'parcial',
        monto_pendiente_cuota: montoTotal - nuevoMontoPagado
      }

      setReciboGenerado(datosRecibo)
      setMostrarRecibo(true)
      setModalPagoAbierto(false)

      await cargarDeudasCliente(clienteSeleccionado.id)
    } catch (error) {
      console.error('Error registrando pago:', error)
      alert('Error al registrar el pago')
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

  const formatearFechaCompleta = (fecha: string) => {
    const [year, month, day] = fecha.split('-').map(Number)
    const fechaObj = new Date(year, month - 1, day)
    return fechaObj.toLocaleDateString('es-AR', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    })
  }

  const calcularDiasVencimiento = (fechaVencimiento: string) => {
    const hoy = new Date()
    hoy.setHours(0, 0, 0, 0)

    const [year, month, day] = fechaVencimiento.split('-').map(Number)
    const vencimiento = new Date(year, month - 1, day)
    vencimiento.setHours(0, 0, 0, 0)

    return Math.floor((vencimiento.getTime() - hoy.getTime()) / (1000 * 60 * 60 * 24))
  }

  // =========================
  // ✅ DESCARGA DIRECTA (SIN IMPRESIÓN)
  // =========================

  const isIOS = () => {
    if (typeof navigator === 'undefined') return false
    const ua = navigator.userAgent || ''
    const iOSDevice = /iPad|iPhone|iPod/.test(ua)
    const isMSStream = (window as any).MSStream
    return iOSDevice && !isMSStream
  }

  const waitNextFrame = () =>
    new Promise<void>((resolve) => requestAnimationFrame(() => resolve()))

  const descargarPDF = async () => {
    if (!reciboRef.current || !reciboGenerado) return

    setLoading(true)
    try {
      const html2canvas = (await import('html2canvas')).default
      const { jsPDF } = await import('jspdf')

      // Espera 1 frame para asegurar layout final (útil si abriste modal recién)
      await waitNextFrame()

      const canvas = await html2canvas(reciboRef.current, {
        scale: 2,
        useCORS: true,
        logging: false,
        backgroundColor: '#ffffff'
      })

      const imgData = canvas.toDataURL('image/png')

      const pdf = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4',
        compress: true
      })

      const pageWidth = 210
      const pageHeight = 297

      const imgWidth = pageWidth
      const imgHeight = (canvas.height * imgWidth) / canvas.width

      let heightLeft = imgHeight
      let position = 0

      pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight, undefined, 'FAST')
      heightLeft -= pageHeight

      while (heightLeft > 0) {
        position -= pageHeight
        pdf.addPage()
        pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight, undefined, 'FAST')
        heightLeft -= pageHeight
      }

      const fileName = `Recibo_${reciboGenerado.numero_recibo}.pdf`

      const pdfBlob = pdf.output('blob')
      const blobUrl = URL.createObjectURL(pdfBlob)

      // iOS Safari no respeta download de forma silenciosa
      if (isIOS()) {
        window.open(blobUrl, '_blank', 'noopener,noreferrer')
        setTimeout(() => URL.revokeObjectURL(blobUrl), 60_000)
        return
      }

      // ✅ Descarga directa (sin print / sin preview)
      const link = document.createElement('a')
      link.href = blobUrl
      link.download = fileName
      link.rel = 'noopener'
      link.style.display = 'none'

      document.body.appendChild(link)
      link.click()

      setTimeout(() => {
        URL.revokeObjectURL(blobUrl)
        document.body.removeChild(link)
      }, 0)
    } catch (error) {
      console.error('❌ Error generando PDF:', error)
      alert('Error al generar PDF.')
    } finally {
      setLoading(false)
    }
  }

  // Para cuando abrís el modal y querés descargar “al toque”
  const descargarPDFTrasRender = async () => {
    // espera 2 frames para que el modal y fuentes terminen de asentarse
    await waitNextFrame()
    await waitNextFrame()
    await descargarPDF()
  }

  const totalDeudaCliente = deudasCliente.reduce((sum, d) => sum + d.saldoPendiente, 0)

  return (
    <div className="min-h-screen bg-gray-50 p-2 sm:p-4 md:p-6">
      <div className="max-w-7xl mx-auto space-y-4 sm:space-y-6">
        {/* Header */}
        <div className="bg-white rounded-lg shadow-sm border p-4 sm:p-6">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
            <div>
              <h1 className="text-xl sm:text-2xl font-bold text-gray-900 flex items-center gap-2">
                <FileText className="w-6 h-6 sm:w-7 sm:h-7" />
                Sistema de Recibos y Pagos
              </h1>
              <p className="text-sm text-gray-600 mt-1">
                Busca clientes, registra pagos y genera recibos automáticamente
              </p>
            </div>
          </div>

          {/* Buscador de clientes */}
          <div className="relative">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                type="text"
                placeholder="Buscar cliente por nombre, apellido, documento o teléfono..."
                value={busqueda}
                onChange={(e) => setBusqueda(e.target.value)}
                className="w-full pl-10 pr-4 py-3 border-2 border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm sm:text-base"
              />
            </div>

            {clientesEncontrados.length > 0 && (
              <div className="absolute z-10 w-full mt-2 bg-white rounded-lg shadow-lg border max-h-96 overflow-y-auto">
                {clientesEncontrados.map((cliente) => (
                  <button
                    key={cliente.id}
                    type="button"
                    onClick={() => seleccionarCliente(cliente)}
                    className="w-full p-3 sm:p-4 hover:bg-gray-50 border-b last:border-b-0 text-left transition-colors"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <User className="w-4 h-4 text-gray-400 flex-shrink-0" />
                          <span className="font-semibold text-gray-900 text-sm sm:text-base">
                            {cliente.nombre} {cliente.apellido || ''}
                          </span>
                        </div>
                        <div className="space-y-0.5 text-xs sm:text-sm text-gray-600">
                          {cliente.documento && <p>📄 {cliente.documento}</p>}
                          {cliente.telefono && <p>📞 {cliente.telefono}</p>}
                        </div>
                      </div>
                      <div className="text-right flex-shrink-0">
                        <div className="text-xs text-gray-500">Deuda Total</div>
                        <div className="text-base sm:text-lg font-bold text-red-600">
                          {formatearMoneda(cliente.total_deuda)}
                        </div>
                        <div className="text-xs text-gray-500 mt-1">
                          {cliente.transacciones_activas} transacción(es)
                        </div>
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {clienteSeleccionado && (
          <>
            <div className="bg-white rounded-lg shadow-sm border p-4 sm:p-6">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-4">
                <div className="flex items-start gap-3 flex-1">
                  <div className="p-2 sm:p-3 bg-blue-100 rounded-lg">
                    <User className="w-5 h-5 sm:w-6 sm:h-6 text-blue-600" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h2 className="text-lg sm:text-xl font-bold text-gray-900 break-words">
                      {clienteSeleccionado.nombre} {clienteSeleccionado.apellido || ''}
                    </h2>
                    <div className="flex flex-wrap items-center gap-2 mt-2 text-xs sm:text-sm text-gray-600">
                      {clienteSeleccionado.documento && (
                        <>
                          <span>📄 {clienteSeleccionado.documento}</span>
                          <span className="hidden sm:inline">•</span>
                        </>
                      )}
                      {clienteSeleccionado.telefono && (
                        <>
                          <span className="flex items-center gap-1">
                            <Phone className="w-3 h-3" />
                            {clienteSeleccionado.telefono}
                          </span>
                          <span className="hidden sm:inline">•</span>
                        </>
                      )}
                      {clienteSeleccionado.email && (
                        <span className="flex items-center gap-1 break-all">
                          <Mail className="w-3 h-3" />
                          {clienteSeleccionado.email}
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    setClienteSeleccionado(null)
                    setDeudasCliente([])
                  }}
                  className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-full transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
                <div className="bg-red-50 rounded-lg p-3 sm:p-4 border border-red-200">
                  <div className="text-xs sm:text-sm text-red-600 font-medium">Deuda Total</div>
                  <div className="text-xl sm:text-2xl font-bold text-red-700 break-all">
                    {formatearMoneda(totalDeudaCliente)}
                  </div>
                </div>
                <div className="bg-blue-50 rounded-lg p-3 sm:p-4 border border-blue-200">
                  <div className="text-xs sm:text-sm text-blue-600 font-medium">Transacciones Activas</div>
                  <div className="text-xl sm:text-2xl font-bold text-blue-700">{deudasCliente.length}</div>
                </div>
                <div className="bg-orange-50 rounded-lg p-3 sm:p-4 border border-orange-200">
                  <div className="text-xs sm:text-sm text-orange-600 font-medium">Cuotas Pendientes</div>
                  <div className="text-xl sm:text-2xl font-bold text-orange-700">
                    {deudasCliente.reduce((sum, d) => sum + d.cuotasPendientes, 0)}
                  </div>
                </div>
              </div>
            </div>

            {/* Lista de deudas y cuotas */}
            <div className="space-y-4">
              {deudasCliente.map((deuda) => (
                <div key={deuda.transaccion.id} className="bg-white rounded-lg shadow-sm border overflow-hidden">
                  <div className="bg-gradient-to-r from-gray-50 to-white p-4 sm:p-6 border-b">
                    <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                      <div className="flex-1">
                        <h3 className="font-semibold text-base sm:text-lg flex items-center gap-2 mb-2">
                          {deuda.transaccion.tipo_transaccion === 'venta' ? '🛒' : '💵'}
                          {deuda.transaccion.tipo_transaccion === 'prestamo'
                            ? 'Préstamo de Dinero'
                            : (deuda.transaccion as any).producto?.nombre || 'Venta'}
                        </h3>
                        {deuda.transaccion.descripcion && (
                          <div className="mt-2 bg-blue-50 border-l-4 border-blue-400 p-2 rounded text-xs sm:text-sm">
                            <p className="text-gray-700">
                              <span className="font-medium text-blue-700">📝 Descripción:</span>{' '}
                              {deuda.transaccion.descripcion}
                            </p>
                          </div>
                        )}
                        <div className="flex flex-wrap items-center gap-2 mt-2 text-xs sm:text-sm text-gray-600">
                          <span>Inicio: {formatearFecha(deuda.transaccion.fecha_inicio)}</span>
                          <span className="hidden sm:inline">•</span>
                          <span>
                            {deuda.cuotasPendientes}/{deuda.cuotasTotales} cuotas pendientes
                          </span>
                        </div>
                      </div>
                      <div className="text-left sm:text-right">
                        <div className="text-xs sm:text-sm text-gray-600">Saldo Pendiente</div>
                        <div className="text-xl sm:text-2xl font-bold text-red-600 break-all">
                          {formatearMoneda(deuda.saldoPendiente)}
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="overflow-x-auto">
                    <table className="w-full text-xs sm:text-sm">
                      <thead className="bg-gray-50 border-b">
                        <tr>
                          <th className="text-left p-2 sm:p-3 font-medium text-gray-700">Cuota</th>
                          <th className="text-left p-2 sm:p-3 font-medium text-gray-700">Vencimiento</th>
                          <th className="text-right p-2 sm:p-3 font-medium text-gray-700">Monto</th>
                          <th className="text-right p-2 sm:p-3 font-medium text-gray-700">Pagado</th>
                          <th className="text-center p-2 sm:p-3 font-medium text-gray-700">Estado</th>
                          <th className="text-center p-2 sm:p-3 font-medium text-gray-700 min-w-[100px] sm:min-w-[140px]">
                            Acciones
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {deuda.pagos.map((pago) => {
                          const diasVenc = calcularDiasVencimiento(pago.fecha_vencimiento)
                          const estaVencido = diasVenc < 0 && pago.estado !== 'pagado'
                          const montoCuota = pago.monto_cuota || deuda.transaccion.monto_cuota
                          const intereses = pago.intereses_mora || 0
                          const montoTotal = montoCuota + intereses
                          const montoPagado = pago.monto_pagado || 0

                          return (
                            <tr key={pago.id} className="border-b hover:bg-gray-50">
                              <td className="p-2 sm:p-3">
                                <span className="font-medium">#{pago.numero_cuota}</span>
                              </td>
                              <td className="p-2 sm:p-3">
                                <div className="text-xs sm:text-sm">
                                  <p>{formatearFecha(pago.fecha_vencimiento)}</p>
                                  {pago.estado !== 'pagado' && (
                                    <p
                                      className={`text-[10px] sm:text-xs mt-0.5 ${
                                        estaVencido
                                          ? 'text-red-600'
                                          : diasVenc === 0
                                          ? 'text-orange-600'
                                          : diasVenc <= 7
                                          ? 'text-yellow-600'
                                          : 'text-gray-500'
                                      }`}
                                    >
                                      {estaVencido
                                        ? `Vencido hace ${Math.abs(diasVenc)} días`
                                        : diasVenc === 0
                                        ? 'Vence hoy'
                                        : `Vence en ${diasVenc} días`}
                                    </p>
                                  )}
                                </div>
                              </td>
                              <td className="p-2 sm:p-3 text-right">
                                <div className="text-xs sm:text-sm">
                                  <p className="font-medium">{formatearMoneda(montoTotal)}</p>
                                  {intereses > 0 && (
                                    <p className="text-[10px] sm:text-xs text-red-600">
                                      (+{formatearMoneda(intereses)} mora)
                                    </p>
                                  )}
                                </div>
                              </td>
                              <td className="p-2 sm:p-3 text-right">
                                <div className="text-xs sm:text-sm">
                                  <p className="font-medium text-green-600">{formatearMoneda(montoPagado)}</p>
                                  {pago.fecha_pago && (
                                    <p className="text-[10px] sm:text-xs text-gray-500">
                                      {formatearFecha(pago.fecha_pago)}
                                    </p>
                                  )}
                                </div>
                              </td>
                              <td className="p-2 sm:p-3 text-center">
                                <span
                                  className={`inline-block px-2 py-1 rounded-full text-[10px] sm:text-xs font-medium ${
                                    pago.estado === 'pagado'
                                      ? 'bg-green-100 text-green-800'
                                      : pago.estado === 'parcial'
                                      ? 'bg-yellow-100 text-yellow-800'
                                      : estaVencido
                                      ? 'bg-red-100 text-red-800'
                                      : 'bg-gray-100 text-gray-800'
                                  }`}
                                >
                                  {pago.estado === 'pagado'
                                    ? 'Pagado'
                                    : pago.estado === 'parcial'
                                    ? 'Parcial'
                                    : estaVencido
                                    ? 'Vencido'
                                    : 'Pendiente'}
                                </span>
                              </td>
                              <td className="p-2 sm:p-3">
                                {pago.estado !== 'pagado' && (
                                  <div className="flex justify-center">
                                    <button
                                      type="button"
                                      onClick={() => abrirModalPago(pago, deuda.transaccion)}
                                      className="px-2 sm:px-3 py-1 bg-green-600 text-white rounded-md hover:bg-green-700 transition-colors flex items-center justify-center gap-1 text-[10px] sm:text-xs"
                                    >
                                      <DollarSign className="w-3 h-3" />
                                      <span className="hidden sm:inline">Pagar</span>
                                    </button>
                                  </div>
                                )}

                                {(pago.estado === 'pagado' || pago.estado === 'parcial') &&
                                  (pago as any).numero_recibo && (
                                    <div className="flex flex-wrap justify-center gap-1">
                                      <button
                                        type="button"
                                        onClick={() => {
                                          const montoCuota = pago.monto_cuota || deuda.transaccion.monto_cuota
                                          const intereses = pago.intereses_mora || 0
                                          const montoTotal = montoCuota + intereses
                                          const montoPagado = pago.monto_pagado || 0

                                          const datosRecibo = {
                                            numero_recibo: (pago as any).numero_recibo,
                                            fecha_pago: pago.fecha_pago,
                                            cliente: clienteSeleccionado,
                                            transaccion: deuda.transaccion,
                                            pago: { ...pago, monto_total_pagado: montoPagado },
                                            monto_pagado: montoPagado,
                                            es_pago_parcial: pago.estado === 'parcial',
                                            monto_pendiente_cuota: montoTotal - montoPagado
                                          }

                                          setReciboGenerado(datosRecibo)
                                          setMostrarRecibo(true)
                                        }}
                                        className="px-2 py-1 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors flex items-center gap-1 text-[10px] sm:text-xs"
                                        title="Ver recibo"
                                      >
                                        <Eye className="w-3 h-3" />
                                        <span className="hidden sm:inline">Ver</span>
                                      </button>

                                      <button
                                        type="button"
                                        onClick={async (e) => {
                                          e.preventDefault()

                                          const montoCuota = pago.monto_cuota || deuda.transaccion.monto_cuota
                                          const intereses = pago.intereses_mora || 0
                                          const montoTotal = montoCuota + intereses
                                          const montoPagado = pago.monto_pagado || 0

                                          const datosRecibo = {
                                            numero_recibo: (pago as any).numero_recibo,
                                            fecha_pago: pago.fecha_pago,
                                            cliente: clienteSeleccionado,
                                            transaccion: deuda.transaccion,
                                            pago: { ...pago, monto_total_pagado: montoPagado },
                                            monto_pagado: montoPagado,
                                            es_pago_parcial: pago.estado === 'parcial',
                                            monto_pendiente_cuota: montoTotal - montoPagado
                                          }

                                          setReciboGenerado(datosRecibo)
                                          setMostrarRecibo(true)

                                          // ✅ descarga cuando ya se renderizó el recibo
                                          setTimeout(() => {
                                            void descargarPDFTrasRender()
                                          }, 0)
                                        }}
                                        className="px-2 py-1 bg-green-600 text-white rounded-md hover:bg-green-700 transition-colors flex items-center gap-1 text-[10px] sm:text-xs"
                                        title="Descargar PDF"
                                      >
                                        <Download className="w-3 h-3" />
                                        <span className="hidden sm:inline">PDF</span>
                                      </button>
                                    </div>
                                  )}
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
          </>
        )}

        {!clienteSeleccionado && !loading && (
          <div className="bg-white rounded-lg shadow-sm border p-8 sm:p-12 text-center">
            <Search className="w-12 h-12 sm:w-16 sm:h-16 text-gray-300 mx-auto mb-4" />
            <h3 className="text-lg sm:text-xl font-semibold text-gray-900 mb-2">
              Busca un cliente para comenzar
            </h3>
            <p className="text-sm sm:text-base text-gray-600">
              Utiliza el buscador para encontrar clientes y gestionar sus pagos
            </p>
          </div>
        )}
      </div>

      {/* Modal de registro de pago */}
      {modalPagoAbierto && pagoSeleccionado && transaccionPago && clienteSeleccionado && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg max-w-md w-full p-4 sm:p-6 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-base sm:text-lg font-semibold text-gray-900">Registrar Pago</h3>
              <button
                type="button"
                onClick={() => setModalPagoAbierto(false)}
                className="text-gray-400 hover:text-gray-600 text-xl"
              >
                ✕
              </button>
            </div>

            <div className="space-y-4">
              <div className="bg-gray-50 rounded-lg p-3 sm:p-4">
                <div className="text-xs sm:text-sm text-gray-600 mb-2">Cliente:</div>
                <div className="text-sm sm:text-base font-medium break-words">
                  {clienteSeleccionado.nombre} {clienteSeleccionado.apellido || ''}
                </div>

                <div className="text-xs sm:text-sm text-gray-600 mb-2 mt-3">Concepto:</div>
                <div className="text-sm sm:text-base font-medium break-words">
                  {transaccionPago.tipo_transaccion === 'prestamo'
                    ? 'Préstamo de Dinero'
                    : (transaccionPago as any).producto?.nombre || 'Venta'}
                </div>

                {transaccionPago.descripcion && (
                  <div className="mt-2 bg-blue-50 border-l-2 border-blue-400 p-2 rounded">
                    <p className="text-xs text-gray-700">📝 {transaccionPago.descripcion}</p>
                  </div>
                )}

                <div className="flex justify-between mt-3">
                  <div>
                    <div className="text-xs sm:text-sm text-gray-600">Cuota:</div>
                    <div className="text-sm sm:text-base font-medium">#{pagoSeleccionado.numero_cuota}</div>
                  </div>
                  <div className="text-right">
                    <div className="text-xs sm:text-sm text-gray-600">Monto cuota:</div>
                    <div className="text-sm sm:text-base font-bold break-all">
                      {formatearMoneda(
                        (pagoSeleccionado.monto_cuota || transaccionPago.monto_cuota) +
                          (pagoSeleccionado.intereses_mora || 0)
                      )}
                    </div>
                  </div>
                </div>

                {(pagoSeleccionado.monto_pagado || 0) > 0 && (
                  <div className="mt-2 text-right">
                    <div className="text-xs sm:text-sm text-gray-600">Pagado anteriormente:</div>
                    <div className="text-sm sm:text-base text-green-600 font-medium break-all">
                      {formatearMoneda(pagoSeleccionado.monto_pagado || 0)}
                    </div>
                  </div>
                )}
              </div>

              <div>
                <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1">Monto a pagar</label>
                <div className="relative">
                  <DollarSign className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input
                    type="number"
                    step="0.01"
                    value={montoPago}
                    onChange={(e) => setMontoPago(e.target.value)}
                    className="w-full pl-10 pr-3 py-2 text-sm sm:text-base border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1">Fecha de pago</label>
                <input
                  type="date"
                  value={fechaPago}
                  onChange={(e) => setFechaPago(e.target.value)}
                  className="w-full px-3 py-2 text-sm sm:text-base border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1">Método de pago</label>
                <select
                  value={metodoPago}
                  onChange={(e) => setMetodoPago(e.target.value as any)}
                  className="w-full px-3 py-2 text-sm sm:text-base border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="efectivo">💵 Efectivo</option>
                  <option value="transferencia">🏦 Transferencia</option>
                  <option value="cheque">📝 Cheque</option>
                  <option value="tarjeta">💳 Tarjeta</option>
                </select>
              </div>

              <div>
                <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1">
                  Observaciones (opcional)
                </label>
                <textarea
                  value={observaciones}
                  onChange={(e) => setObservaciones(e.target.value)}
                  rows={3}
                  className="w-full px-3 py-2 text-sm sm:text-base border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                  placeholder="Observaciones adicionales..."
                />
              </div>
            </div>

            <div className="flex flex-col sm:flex-row gap-3 mt-6">
              <button
                type="button"
                onClick={() => setModalPagoAbierto(false)}
                className="flex-1 px-4 py-2 text-sm sm:text-base border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50 transition-colors"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={registrarPago}
                disabled={loading || !montoPago || parseFloat(montoPago) <= 0}
                className="flex-1 px-4 py-2 text-sm sm:text-base bg-green-600 text-white rounded-md hover:bg-green-700 transition-colors disabled:bg-gray-400 disabled:cursor-not-allowed flex items-center justify-center space-x-2"
              >
                {loading ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                    <span>Procesando...</span>
                  </>
                ) : (
                  <>
                    <CheckCircle className="w-4 h-4" />
                    <span>Confirmar Pago</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de recibo generado */}
      {mostrarRecibo && reciboGenerado && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50 overflow-y-auto">
          <div className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-4 sm:p-6">
              <div className="flex items-center justify-between mb-4 print:hidden">
                <h3 className="text-base sm:text-lg font-semibold text-gray-900">Recibo de Pago</h3>
                <div className="flex space-x-2">
                  <button
                    type="button"
                    onClick={(e) => {
                      e.preventDefault()
                      void descargarPDFTrasRender()
                    }}
                    disabled={loading}
                    className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors flex items-center space-x-2 text-sm font-medium shadow-sm disabled:bg-gray-400"
                    title="Descargar PDF"
                  >
                    <Download className="w-4 h-4" />
                    <span>Descargar PDF</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setMostrarRecibo(false)}
                    className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                    title="Cerrar"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
              </div>

              {/* Contenido del recibo */}
              <div ref={reciboRef} className="bg-white p-4 sm:p-8 border print:border-0">
                <div className="text-center mb-6 sm:mb-8">
                  <h1 className="text-xl sm:text-2xl font-bold text-gray-900 mb-2">RECIBO DE PAGO</h1>
                  <div className="text-base sm:text-lg font-semibold text-blue-600">N° {reciboGenerado.numero_recibo}</div>
                </div>

                <div className="mb-4 sm:mb-6 p-3 sm:p-4 bg-gray-50 rounded">
                  <h3 className="font-semibold text-gray-900 mb-2 text-sm sm:text-base">Datos del Comercio:</h3>
                  <div className="text-xs sm:text-sm text-gray-700 space-y-0.5">
                    <div>ELECTRO HOGAR</div>
                    <div>Las talitas - Tucumán, Parque Logistico 1300 - Ruta 9</div>
                    <div>Teléfono: (381) 446-1795</div>
                    <div className="break-all">Gmail: lopezrodrigoalejandro2025@gmail.com</div>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6 mb-4 sm:mb-6">
                  <div>
                    <h3 className="font-semibold text-gray-900 mb-2 text-sm sm:text-base">Cliente:</h3>
                    <div className="text-xs sm:text-sm text-gray-700 space-y-1">
                      <div className="break-words">
                        <strong>Nombre:</strong> {reciboGenerado.cliente.nombre} {reciboGenerado.cliente.apellido || ''}
                      </div>
                      {reciboGenerado.cliente.documento && (
                        <div>
                          <strong>Documento:</strong> {reciboGenerado.cliente.documento}
                        </div>
                      )}
                      {reciboGenerado.cliente.telefono && (
                        <div>
                          <strong>Teléfono:</strong> {reciboGenerado.cliente.telefono}
                        </div>
                      )}
                    </div>
                  </div>

                  <div>
                    <h3 className="font-semibold text-gray-900 mb-2 text-sm sm:text-base">Datos del Pago:</h3>
                    <div className="text-xs sm:text-sm text-gray-700 space-y-1">
                      <div className="break-words">
                        <strong>Fecha:</strong> {formatearFechaCompleta(reciboGenerado.fecha_pago)}
                      </div>
                      <div>
                        <strong>Método:</strong> {reciboGenerado.pago.metodo_pago?.toUpperCase()}
                      </div>
                      <div>
                        <strong>Cuota:</strong> #{reciboGenerado.pago.numero_cuota}
                      </div>
                    </div>
                  </div>
                </div>

                <div className="mb-4 sm:mb-6">
                  <h3 className="font-semibold text-gray-900 mb-3 text-sm sm:text-base">Detalle:</h3>
                  <div className="border rounded overflow-hidden">
                    <table className="w-full text-xs sm:text-sm">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="text-left py-2 px-2 sm:px-4 font-medium text-gray-700">Concepto</th>
                          <th className="text-center py-2 px-2 sm:px-4 font-medium text-gray-700">Cuota</th>
                          <th className="text-right py-2 px-2 sm:px-4 font-medium text-gray-700">Monto</th>
                        </tr>
                      </thead>
                      <tbody>
                        <tr>
                          <td className="py-3 px-2 sm:px-4 text-gray-900 break-words">
                            {reciboGenerado.transaccion.tipo_transaccion === 'prestamo'
                              ? 'Préstamo de dinero'
                              : reciboGenerado.transaccion.producto?.nombre || 'Venta'}
                            {reciboGenerado.transaccion.descripcion && (
                              <div className="text-[10px] sm:text-xs text-gray-600 mt-1">
                                {reciboGenerado.transaccion.descripcion}
                              </div>
                            )}
                          </td>
                          <td className="py-3 px-2 sm:px-4 text-center text-gray-900">
                            {reciboGenerado.pago.numero_cuota}
                          </td>
                          <td className="py-3 px-2 sm:px-4 text-right font-semibold text-gray-900 break-all">
                            {formatearMoneda(reciboGenerado.monto_pagado)}
                          </td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>

                {reciboGenerado.es_pago_parcial && (
                  <div className="mb-4 sm:mb-6 bg-yellow-50 border-l-4 border-yellow-400 p-4 rounded">
                    <div className="flex items-start">
                      <div className="flex-shrink-0">
                        <svg className="h-5 w-5 text-yellow-400" viewBox="0 0 20 20" fill="currentColor">
                          <path
                            fillRule="evenodd"
                            d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z"
                            clipRule="evenodd"
                          />
                        </svg>
                      </div>
                      <div className="ml-3">
                        <h3 className="text-sm font-medium text-yellow-800">Pago Parcial</h3>
                        <div className="mt-2 text-sm text-yellow-700">
                          <p>Este es un recibo de pago parcial.</p>
                          <p className="mt-1">
                            <strong>Monto de este pago:</strong> {formatearMoneda(reciboGenerado.monto_pagado)}
                          </p>
                          <p>
                            <strong>Total pagado en esta cuota:</strong>{' '}
                            {formatearMoneda(reciboGenerado.pago.monto_total_pagado || reciboGenerado.monto_pagado)}
                          </p>
                          <p>
                            <strong>Pendiente de esta cuota:</strong> {formatearMoneda(reciboGenerado.monto_pendiente_cuota || 0)}
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                <div className="flex justify-end mb-4 sm:mb-6">
                  <div className={`p-3 sm:p-4 rounded ${reciboGenerado.es_pago_parcial ? 'bg-yellow-50' : 'bg-blue-50'}`}>
                    <div className="text-right">
                      <div className="text-xs sm:text-sm text-gray-600">
                        {reciboGenerado.es_pago_parcial ? 'Monto de Este Pago:' : 'Total Pagado:'}
                      </div>
                      <div className={`text-xl sm:text-2xl font-bold break-all ${reciboGenerado.es_pago_parcial ? 'text-yellow-700' : 'text-blue-700'}`}>
                        {formatearMoneda(reciboGenerado.monto_pagado)}
                      </div>
                      {reciboGenerado.es_pago_parcial && (
                        <div className="text-xs text-gray-600 mt-1">
                          Estado: <span className="font-semibold text-yellow-700">Pago Parcial</span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {reciboGenerado.pago.observaciones && (
                  <div className="mb-4 sm:mb-6">
                    <h3 className="font-semibold text-gray-900 mb-2 text-sm sm:text-base">Observaciones:</h3>
                    <div className="text-xs sm:text-sm text-gray-700 bg-gray-50 p-3 rounded break-words">
                      {reciboGenerado.pago.observaciones}
                    </div>
                  </div>
                )}

                <div className="text-center text-[10px] sm:text-xs text-gray-500 mt-6 sm:mt-8 pt-4 border-t">
                  <div>Este es un comprobante válido de pago</div>
                  <div>Recibo generado el {formatearFechaCompleta(new Date().toISOString().split('T')[0])}</div>
                </div>
              </div>

              <div className="p-4 sm:p-6 bg-gray-50 border-t flex flex-col sm:flex-row gap-3 print:hidden">
                <button
                  type="button"
                  onClick={(e) => {
                    e.preventDefault()
                    void descargarPDFTrasRender()
                  }}
                  disabled={loading}
                  className="flex-1 px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors flex items-center justify-center gap-2 font-medium shadow-sm disabled:bg-gray-400"
                >
                  <Download className="w-5 h-5" />
                  <span>Descargar PDF</span>
                </button>
                <button
                  type="button"
                  onClick={() => setMostrarRecibo(false)}
                  className="sm:flex-none px-6 py-3 bg-white text-gray-700 border-2 border-gray-300 rounded-lg hover:bg-gray-50 transition-colors font-medium"
                >
                  Cerrar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
