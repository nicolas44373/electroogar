'use client'
import { useRef, useState } from 'react'
import html2canvas from 'html2canvas'
import { jsPDF } from 'jspdf'
import { Cliente, Transaccion, Pago } from '@/app/lib/types/cobranzas'
import { FileText, Download, Phone, X, Eye, CheckCircle, AlertTriangle } from 'lucide-react'

interface ExportadorPDFClienteProps {
  cliente: Cliente
  transacciones: Transaccion[]
  pagos: { [key: string]: Pago[] }
}

export default function ExportadorPDFCliente({
  cliente,
  transacciones,
  pagos,
}: ExportadorPDFClienteProps) {
  const contenidoRef = useRef<HTMLDivElement>(null)
  const [generando, setGenerando] = useState(false)
  const [mostrarPreview, setMostrarPreview] = useState(false)
  const [toast, setToast] = useState<{ tipo: 'success' | 'error'; texto: string } | null>(null)

  const mostrarToast = (tipo: 'success' | 'error', texto: string) => {
    setToast({ tipo, texto })
    setTimeout(() => setToast(null), 4000)
  }

  const fmt = (n: number) =>
    new Intl.NumberFormat('es-AR', {
      style: 'currency',
      currency: 'ARS',
      minimumFractionDigits: 0,
    }).format(n)

  const fmtFecha = (fecha: string) => {
    const [y, m, d] = fecha.split('-').map(Number)
    return new Date(y, m - 1, d).toLocaleDateString('es-AR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    })
  }

  const diasVenc = (fechaVencimiento: string) => {
    const hoy = new Date()
    hoy.setHours(0, 0, 0, 0)
    const [y, m, d] = fechaVencimiento.split('-').map(Number)
    const venc = new Date(y, m - 1, d)
    venc.setHours(0, 0, 0, 0)
    return Math.floor((venc.getTime() - hoy.getTime()) / (1000 * 60 * 60 * 24))
  }

  const tituloTransaccion = (t: Transaccion) =>
    t.tipo_transaccion === 'prestamo' ? 'Prestamo de Dinero' : t.producto?.nombre || 'Venta de Producto'

  const totales = () => {
    let deuda = 0, pagado = 0, vencidas = 0, pendientes = 0, pagas = 0
    transacciones.forEach((t) => {
      ;(pagos[t.id] || []).forEach((p) => {
        const cuota = (p.monto_cuota || t.monto_cuota) + (p.intereses_mora || 0)
        if (p.estado === 'pagado') {
          pagas++
          pagado += p.monto_pagado
        } else {
          pendientes++
          deuda += cuota - (p.monto_pagado || 0)
          if (diasVenc(p.fecha_vencimiento) < 0) vencidas++
        }
      })
    })
    return { deuda, pagado, vencidas, pendientes, pagas }
  }

  const generarPDF = async (): Promise<Blob | null> => {
    if (!contenidoRef.current) return null

    await new Promise<void>((r) => requestAnimationFrame(() => r()))

    const canvas = await html2canvas(contenidoRef.current, {
      scale: 2,
      useCORS: true,
      logging: false,
      backgroundColor: '#ffffff',
    })

    const imgData = canvas.toDataURL('image/png')
    const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4', compress: true })

    const pageW = 210
    const pageH = 297
    const imgH = (canvas.height * pageW) / canvas.width
    let heightLeft = imgH
    let pos = 0

    pdf.addImage(imgData, 'PNG', 0, pos, pageW, imgH, undefined, 'FAST')
    heightLeft -= pageH

    while (heightLeft > 0) {
      pos -= pageH
      pdf.addPage()
      pdf.addImage(imgData, 'PNG', 0, pos, pageW, imgH, undefined, 'FAST')
      heightLeft -= pageH
    }

    return pdf.output('blob')
  }

  const descargarPDF = async () => {
    if (generando) return
    if (!mostrarPreview) {
      setMostrarPreview(true)
      await new Promise<void>((r) => requestAnimationFrame(() => requestAnimationFrame(() => r())))
    }
    setGenerando(true)
    try {
      const blob = await generarPDF()
      if (!blob) throw new Error('No se pudo generar el PDF')
      const fileName = `Estado_Cuenta_${cliente.nombre}_${cliente.apellido}_${new Date().toISOString().split('T')[0]}.pdf`
      const blobUrl = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = blobUrl
      a.download = fileName
      a.rel = 'noopener'
      a.style.display = 'none'
      document.body.appendChild(a)
      a.click()
      setTimeout(() => { URL.revokeObjectURL(blobUrl); document.body.removeChild(a) }, 0)
      mostrarToast('success', 'PDF descargado correctamente')
    } catch (err) {
      console.error('Error generando PDF:', err)
      mostrarToast('error', 'Error al generar el PDF. Intenta de nuevo.')
    } finally {
      setGenerando(false)
    }
  }

  const enviarPorWhatsApp = async () => {
    if (generando) return
    if (!mostrarPreview) {
      setMostrarPreview(true)
      await new Promise<void>((r) => requestAnimationFrame(() => requestAnimationFrame(() => r())))
    }
    setGenerando(true)
    try {
      const blob = await generarPDF()
      if (!blob) throw new Error('No se pudo generar el PDF')
      const fileName = `Estado_Cuenta_${cliente.nombre}_${cliente.apellido}_${new Date().toISOString().split('T')[0]}.pdf`
      const blobUrl = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = blobUrl
      a.download = fileName
      a.rel = 'noopener'
      a.style.display = 'none'
      document.body.appendChild(a)
      a.click()
      setTimeout(() => { URL.revokeObjectURL(blobUrl); document.body.removeChild(a) }, 0)
      const nombre = `${cliente.nombre} ${cliente.apellido}`.trim()
      const msg = encodeURIComponent(`Hola ${nombre}, te envio tu estado de cuenta actualizado. Cualquier consulta estoy a disposicion.`)
      const tel = (cliente.telefono || '').replace(/[^\d]/g, '')
      setTimeout(() => window.open(`https://wa.me/${tel}?text=${msg}`, '_blank'), 400)
      mostrarToast('success', 'PDF descargado - adjuntalo en WhatsApp')
    } catch (err) {
      console.error('Error:', err)
      mostrarToast('error', 'Error al generar el PDF')
    } finally {
      setGenerando(false)
    }
  }

  if (!transacciones || transacciones.length === 0) return null

  const tot = totales()
  const fechaActual = new Date().toLocaleDateString('es-AR', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })

  return (
    <>
      {toast && (
        <div className={`mb-3 flex items-center gap-2 px-4 py-3 rounded-lg text-sm font-medium ${toast.tipo === 'success' ? 'bg-green-50 border border-green-200 text-green-800' : 'bg-red-50 border border-red-200 text-red-800'}`}>
          {toast.tipo === 'success' ? <CheckCircle className="w-4 h-4 flex-shrink-0 text-green-600" /> : <AlertTriangle className="w-4 h-4 flex-shrink-0 text-red-600" />}
          {toast.texto}
        </div>
      )}

      <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-200 mb-4">
        <h3 className="font-semibold mb-3 flex items-center gap-2 text-gray-800">
          <FileText className="w-5 h-5 text-blue-600" />
          Exportar Estado de Cuenta
        </h3>
        <div className="flex flex-wrap gap-3">
          <button onClick={() => setMostrarPreview(true)} className="flex items-center gap-2 px-4 py-2 bg-gray-100 text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-200 transition-colors text-sm font-medium">
            <Eye className="w-4 h-4" />
            Vista previa
          </button>
          <button onClick={descargarPDF} disabled={generando} className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-60 disabled:cursor-not-allowed transition-colors text-sm font-medium">
            {generando ? <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> : <Download className="w-4 h-4" />}
            {generando ? 'Generando PDF...' : 'Descargar PDF'}
          </button>
          {cliente.telefono && (
            <button onClick={enviarPorWhatsApp} disabled={generando} className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-60 disabled:cursor-not-allowed transition-colors text-sm font-medium">
              {generando ? <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> : <Phone className="w-4 h-4" />}
              WhatsApp
            </button>
          )}
        </div>
      </div>

      {mostrarPreview && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-start justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-4xl my-4">
            <div className="sticky top-0 bg-white rounded-t-xl border-b flex items-center justify-between px-5 py-3 z-10">
              <h3 className="font-bold text-gray-800 flex items-center gap-2">
                <FileText className="w-5 h-5 text-blue-600" />
                Estado de Cuenta
              </h3>
              <div className="flex items-center gap-2">
                <button onClick={descargarPDF} disabled={generando} className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-60 transition-colors text-sm font-medium">
                  {generando ? <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> : <Download className="w-4 h-4" />}
                  {generando ? 'Generando...' : 'Descargar PDF'}
                </button>
                <button onClick={() => setMostrarPreview(false)} className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors">
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            <div ref={contenidoRef} className="bg-white p-8" style={{ fontFamily: 'Arial, sans-serif' }}>
              <div style={{ textAlign: 'center', marginBottom: 24, paddingBottom: 16, borderBottom: '3px solid #2563eb' }}>
                <div style={{ fontSize: 22, fontWeight: 700, color: '#1e40af', marginBottom: 6 }}>ESTADO DE CUENTA</div>
                <div style={{ fontSize: 11, color: '#64748b' }}>Generado el {fechaActual}</div>
                <div style={{ fontSize: 13, fontWeight: 600, color: '#374151', marginTop: 4 }}>ELECTRO HOGAR</div>
              </div>

              <div style={{ background: '#f8fafc', padding: 14, borderRadius: 8, borderLeft: '4px solid #2563eb', marginBottom: 20 }}>
                <div style={{ fontWeight: 700, color: '#1e40af', marginBottom: 8, fontSize: 13 }}>Informacion del Cliente</div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4px 16px', fontSize: 12 }}>
                  <div><span style={{ color: '#6b7280', fontWeight: 600 }}>Nombre: </span><span style={{ color: '#111827' }}>{cliente.nombre} {cliente.apellido || ''}</span></div>
                  {cliente.documento && <div><span style={{ color: '#6b7280', fontWeight: 600 }}>Documento: </span><span style={{ color: '#111827' }}>{cliente.documento}</span></div>}
                  {cliente.telefono && <div><span style={{ color: '#6b7280', fontWeight: 600 }}>Telefono: </span><span style={{ color: '#111827' }}>{cliente.telefono}</span></div>}
                  {cliente.email && <div><span style={{ color: '#6b7280', fontWeight: 600 }}>Email: </span><span style={{ color: '#111827' }}>{cliente.email}</span></div>}
                </div>
              </div>

              <div style={{ background: 'linear-gradient(135deg, #1e40af 0%, #4f46e5 100%)', color: 'white', padding: 16, borderRadius: 8, marginBottom: 20 }}>
                <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 12, textAlign: 'center' }}>Resumen General de la Cuenta</div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10 }}>
                  {[
                    { label: 'Total Adeudado', value: fmt(tot.deuda), color: '#fca5a5' },
                    { label: 'Total Pagado', value: fmt(tot.pagado), color: '#86efac' },
                    { label: 'Cuotas Vencidas', value: String(tot.vencidas), color: '#fca5a5' },
                    { label: 'Cuotas Pendientes', value: String(tot.pendientes), color: '#fde68a' },
                  ].map((s) => (
                    <div key={s.label} style={{ background: 'rgba(255,255,255,0.15)', padding: '10px 12px', borderRadius: 6, textAlign: 'center' }}>
                      <div style={{ fontSize: 10, opacity: 0.85, marginBottom: 4 }}>{s.label}</div>
                      <div style={{ fontSize: 16, fontWeight: 700, color: s.color }}>{s.value}</div>
                    </div>
                  ))}
                </div>
              </div>

              {tot.vencidas > 0 && (
                <div style={{ background: '#fef2f2', borderLeft: '4px solid #dc2626', padding: '10px 14px', borderRadius: 4, marginBottom: 16, fontSize: 12 }}>
                  <strong style={{ color: '#dc2626' }}>ATENCION: </strong>
                  <span style={{ color: '#7f1d1d' }}>Tiene {tot.vencidas} cuota(s) vencida(s). Comuniquese con nosotros para regularizar su situacion.</span>
                </div>
              )}

              {transacciones.map((trans) => {
                const pagosTrans = pagos[trans.id] || []
                const saldoTrans = pagosTrans.reduce((s, p) => {
                  if (p.estado === 'pagado') return s
                  return s + (p.monto_cuota || trans.monto_cuota) + (p.intereses_mora || 0) - (p.monto_pagado || 0)
                }, 0)
                const cuotasPagas = pagosTrans.filter((p) => p.estado === 'pagado').length
                const progreso = trans.numero_cuotas > 0 ? (cuotasPagas / trans.numero_cuotas) * 100 : 0

                return (
                  <div key={trans.id} style={{ marginBottom: 28, border: '1px solid #e2e8f0', borderRadius: 8, overflow: 'hidden' }}>
                    <div style={{ background: '#f1f5f9', padding: '12px 16px', borderLeft: '4px solid #7c3aed' }}>
                      <div style={{ fontSize: 14, fontWeight: 700, color: '#1e293b', marginBottom: 8 }}>
                        {trans.tipo_transaccion === 'venta' ? 'Venta:' : 'Prestamo:'} {tituloTransaccion(trans)}
                      </div>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '4px 12px', fontSize: 11 }}>
                        <div><span style={{ color: '#6b7280' }}>Monto total: </span><strong>{fmt(trans.monto_total)}</strong></div>
                        <div><span style={{ color: '#6b7280' }}>Plan: </span><strong style={{ textTransform: 'capitalize' }}>{trans.tipo_pago}</strong></div>
                        <div><span style={{ color: '#6b7280' }}>Inicio: </span><strong>{fmtFecha(trans.fecha_inicio)}</strong></div>
                        <div><span style={{ color: '#6b7280' }}>Cuotas: </span><strong>{cuotasPagas}/{trans.numero_cuotas}</strong></div>
                        <div><span style={{ color: '#6b7280' }}>Valor cuota: </span><strong>{fmt(trans.monto_cuota)}</strong></div>
                        <div><span style={{ color: '#6b7280' }}>Progreso: </span><strong>{progreso.toFixed(0)}%</strong></div>
                      </div>
                      {saldoTrans > 0 && (
                        <div style={{ marginTop: 8, padding: '6px 10px', background: 'rgba(220,38,38,0.08)', borderRadius: 4, fontSize: 12 }}>
                          <strong style={{ color: '#dc2626' }}>Saldo pendiente: </strong>
                          <span style={{ color: '#dc2626', fontWeight: 700, fontSize: 14 }}>{fmt(saldoTrans)}</span>
                        </div>
                      )}
                    </div>

                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11 }}>
                      <thead style={{ background: '#f8fafc' }}>
                        <tr>
                          {['Cuota', 'Vencimiento', 'Monto', 'Pagado', 'Restante', 'Estado', 'Dias'].map((h) => (
                            <th key={h} style={{ padding: '8px 10px', textAlign: 'left', fontWeight: 600, color: '#475569', borderBottom: '1px solid #cbd5e1', fontSize: 10, textTransform: 'uppercase' }}>{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {pagosTrans.map((pago) => {
                          const dv = diasVenc(pago.fecha_vencimiento)
                          const vencido = dv < 0 && pago.estado !== 'pagado'
                          const cuota = (pago.monto_cuota || trans.monto_cuota) + (pago.intereses_mora || 0)
                          const restante = cuota - (pago.monto_pagado || 0)
                          const estadoLabel = pago.estado === 'pagado' ? 'Pagado' : pago.estado === 'reprogramado' ? 'Reprog.' : vencido ? 'Vencido' : 'Pendiente'
                          const estadoColor = pago.estado === 'pagado' ? { bg: '#dcfce7', text: '#166534' } : pago.estado === 'reprogramado' ? { bg: '#dbeafe', text: '#1e40af' } : vencido ? { bg: '#fee2e2', text: '#991b1b' } : { bg: '#fef3c7', text: '#854d0e' }
                          const diasLabel = pago.estado === 'pagado' ? 'OK' : vencido ? `Hace ${Math.abs(dv)}d` : dv === 0 ? 'Hoy' : `En ${dv}d`
                          const diasColor = pago.estado === 'pagado' ? '#16a34a' : vencido ? '#dc2626' : dv === 0 ? '#ea580c' : dv <= 7 ? '#ca8a04' : '#374151'

                          return (
                            <tr key={pago.id} style={{ background: vencido ? '#fef2f2' : 'white', borderBottom: '1px solid #e2e8f0' }}>
                              <td style={{ padding: '7px 10px', fontWeight: 600 }}>#{pago.numero_cuota}</td>
                              <td style={{ padding: '7px 10px' }}>
                                {fmtFecha(pago.fecha_vencimiento)}
                                {pago.fecha_reprogramacion && <div style={{ fontSize: 10, color: '#2563eb' }}>Rep: {fmtFecha(pago.fecha_reprogramacion)}</div>}
                              </td>
                              <td style={{ padding: '7px 10px', fontWeight: 600, color: '#1e40af' }}>
                                {fmt(cuota)}
                                {(pago.intereses_mora || 0) > 0 && <div style={{ fontSize: 10, color: '#dc2626' }}>+{fmt(pago.intereses_mora || 0)} mora</div>}
                              </td>
                              <td style={{ padding: '7px 10px', color: '#16a34a', fontWeight: 600 }}>
                                {fmt(pago.monto_pagado || 0)}
                                {pago.fecha_pago && <div style={{ fontSize: 10, color: '#6b7280' }}>{fmtFecha(pago.fecha_pago)}</div>}
                              </td>
                              <td style={{ padding: '7px 10px', fontWeight: 600, color: restante > 0 ? '#dc2626' : '#16a34a' }}>{fmt(Math.max(0, restante))}</td>
                              <td style={{ padding: '7px 10px' }}>
                                <span style={{ background: estadoColor.bg, color: estadoColor.text, padding: '2px 8px', borderRadius: 10, fontSize: 10, fontWeight: 600 }}>{estadoLabel}</span>
                              </td>
                              <td style={{ padding: '7px 10px', color: diasColor, fontSize: 11 }}>{diasLabel}</td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>
                )
              })}

              <div style={{ marginTop: 32, paddingTop: 16, borderTop: '2px solid #e2e8f0', textAlign: 'center', fontSize: 10, color: '#6b7280' }}>
                <div style={{ fontWeight: 600, marginBottom: 4 }}>Estado de Cuenta generado por Sistema Electro Hogar</div>
                <div>Fecha de generacion: {fechaActual}</div>
              </div>
            </div>

            <div className="border-t bg-gray-50 px-5 py-3 flex justify-between items-center rounded-b-xl">
              <p className="text-xs text-gray-500">El PDF se genera a partir de esta vista previa.</p>
              <div className="flex gap-2">
                {cliente.telefono && (
                  <button onClick={enviarPorWhatsApp} disabled={generando} className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-60 transition-colors text-sm font-medium">
                    <Phone className="w-4 h-4" />
                    WhatsApp
                  </button>
                )}
                <button onClick={descargarPDF} disabled={generando} className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-60 transition-colors text-sm font-medium">
                  {generando ? <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> : <Download className="w-4 h-4" />}
                  {generando ? 'Generando...' : 'Descargar PDF'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  )
}