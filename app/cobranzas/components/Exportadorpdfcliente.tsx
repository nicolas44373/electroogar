'use client'
import { useRef, useState } from 'react'
import html2canvas from 'html2canvas'
import { jsPDF } from 'jspdf'
import { Cliente, Transaccion, Pago } from '@/app/lib/types/cobranzas'
import { hoyISO } from '@/app/lib/fechas'
import { telefonoWhatsApp } from '@/app/lib/whatsapp'
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
      const fileName = `Estado_Cuenta_${cliente.nombre}_${cliente.apellido}_${hoyISO()}.pdf`
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
      const fileName = `Estado_Cuenta_${cliente.nombre}_${cliente.apellido}_${hoyISO()}.pdf`
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
      const tel = telefonoWhatsApp(cliente.telefono)
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
        <div className={`mb-3 ${toast.tipo === 'success' ? 'alert-success' : 'alert-danger'}`}>
          {toast.tipo === 'success' ? <CheckCircle className="w-4 h-4 flex-shrink-0" /> : <AlertTriangle className="w-4 h-4 flex-shrink-0" />}
          {toast.texto}
        </div>
      )}

      <div className="card card-body">
        <h3 className="text-sm font-semibold mb-3 flex items-center gap-2 text-fg">
          <FileText className="w-5 h-5 text-primary" />
          Exportar Estado de Cuenta
        </h3>
        <div className="flex flex-wrap gap-3">
          <button onClick={() => setMostrarPreview(true)} className="btn-secondary">
            <Eye className="w-4 h-4" />
            Vista previa
          </button>
          <button onClick={descargarPDF} disabled={generando} className="btn-primary">
            {generando ? <span className="spinner" /> : <Download className="w-4 h-4" />}
            {generando ? 'Generando PDF...' : 'Descargar PDF'}
          </button>
          {cliente.telefono && (
            <button onClick={enviarPorWhatsApp} disabled={generando} className="btn-secondary">
              {generando ? <span className="spinner" /> : <Phone className="w-4 h-4" />}
              WhatsApp
            </button>
          )}
        </div>
      </div>

      {mostrarPreview && (
        <div className="fixed inset-0 bg-slate-950/50 z-50 flex items-start justify-center p-4 overflow-y-auto">
          <div className="bg-surface border border-line rounded-xl shadow-e3 w-full max-w-4xl my-4">
            <div className="sticky top-0 bg-surface rounded-t-xl border-b border-line flex items-center justify-between px-5 py-3 z-10">
              <h3 className="font-semibold text-fg flex items-center gap-2">
                <FileText className="w-5 h-5 text-primary" />
                Estado de Cuenta
              </h3>
              <div className="flex items-center gap-2">
                <button onClick={descargarPDF} disabled={generando} className="btn-primary">
                  {generando ? <span className="spinner" /> : <Download className="w-4 h-4" />}
                  {generando ? 'Generando...' : 'Descargar PDF'}
                </button>
                <button onClick={() => setMostrarPreview(false)} className="btn-icon">
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            <div ref={contenidoRef} className="bg-white p-8" style={{ fontFamily: 'var(--font-inter), Arial, sans-serif' }}>
              <div style={{ textAlign: 'center', marginBottom: 24, paddingBottom: 16, borderBottom: '3px solid #0F4C81' }}>
                <div style={{ fontSize: 22, fontWeight: 700, color: '#0B3A63', marginBottom: 6 }}>ESTADO DE CUENTA</div>
                <div style={{ fontSize: 11, color: '#64748b' }}>Generado el {fechaActual}</div>
                <div style={{ fontSize: 13, fontWeight: 600, color: '#334155', marginTop: 4 }}>ELECTRO HOGAR</div>
              </div>

              <div style={{ background: '#f8fafc', padding: 14, borderRadius: 8, borderLeft: '4px solid #0F4C81', marginBottom: 20 }}>
                <div style={{ fontWeight: 700, color: '#0B3A63', marginBottom: 8, fontSize: 13 }}>Informacion del Cliente</div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4px 16px', fontSize: 12 }}>
                  <div><span style={{ color: '#64748B', fontWeight: 600 }}>Nombre: </span><span style={{ color: '#1E293B' }}>{cliente.nombre} {cliente.apellido || ''}</span></div>
                  {cliente.documento && <div><span style={{ color: '#64748B', fontWeight: 600 }}>Documento: </span><span style={{ color: '#1E293B' }}>{cliente.documento}</span></div>}
                  {cliente.telefono && <div><span style={{ color: '#64748B', fontWeight: 600 }}>Telefono: </span><span style={{ color: '#1E293B' }}>{cliente.telefono}</span></div>}
                  {cliente.email && <div><span style={{ color: '#64748B', fontWeight: 600 }}>Email: </span><span style={{ color: '#1E293B' }}>{cliente.email}</span></div>}
                </div>
              </div>

              <div style={{ background: 'linear-gradient(135deg, #0B3A63 0%, #4f46e5 100%)', color: 'white', padding: 16, borderRadius: 8, marginBottom: 20 }}>
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
                    <div style={{ background: '#f1f5f9', padding: '12px 16px', borderLeft: '4px solid #4F46E5' }}>
                      <div style={{ fontSize: 14, fontWeight: 700, color: '#1e293b', marginBottom: 8 }}>
                        {trans.tipo_transaccion === 'venta' ? 'Venta:' : 'Prestamo:'} {tituloTransaccion(trans)}
                      </div>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '4px 12px', fontSize: 11 }}>
                        <div><span style={{ color: '#64748B' }}>Monto total: </span><strong>{fmt(trans.monto_total)}</strong></div>
                        <div><span style={{ color: '#64748B' }}>Plan: </span><strong style={{ textTransform: 'capitalize' }}>{trans.tipo_pago}</strong></div>
                        <div><span style={{ color: '#64748B' }}>Inicio: </span><strong>{fmtFecha(trans.fecha_inicio)}</strong></div>
                        <div><span style={{ color: '#64748B' }}>Cuotas: </span><strong>{cuotasPagas}/{trans.numero_cuotas}</strong></div>
                        <div><span style={{ color: '#64748B' }}>Valor cuota: </span><strong>{fmt(trans.monto_cuota)}</strong></div>
                        <div><span style={{ color: '#64748B' }}>Progreso: </span><strong>{progreso.toFixed(0)}%</strong></div>
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
                          const estadoColor = pago.estado === 'pagado' ? { bg: '#DCFCE7', text: '#166534' } : pago.estado === 'reprogramado' ? { bg: '#DBEAFE', text: '#0B3A63' } : vencido ? { bg: '#fee2e2', text: '#991b1b' } : { bg: '#fef3c7', text: '#854d0e' }
                          const diasLabel = pago.estado === 'pagado' ? 'OK' : vencido ? `Hace ${Math.abs(dv)}d` : dv === 0 ? 'Hoy' : `En ${dv}d`
                          const diasColor = pago.estado === 'pagado' ? '#16A34A' : vencido ? '#dc2626' : dv === 0 ? '#D97706' : dv <= 7 ? '#ca8a04' : '#334155'

                          return (
                            <tr key={pago.id} style={{ background: vencido ? '#fef2f2' : 'white', borderBottom: '1px solid #e2e8f0' }}>
                              <td style={{ padding: '7px 10px', fontWeight: 600 }}>#{pago.numero_cuota}</td>
                              <td style={{ padding: '7px 10px' }}>
                                {fmtFecha(pago.fecha_vencimiento)}
                                {pago.fecha_reprogramacion && <div style={{ fontSize: 10, color: '#0F4C81' }}>Rep: {fmtFecha(pago.fecha_reprogramacion)}</div>}
                              </td>
                              <td style={{ padding: '7px 10px', fontWeight: 600, color: '#0B3A63' }}>
                                {fmt(cuota)}
                                {(pago.intereses_mora || 0) > 0 && <div style={{ fontSize: 10, color: '#dc2626' }}>+{fmt(pago.intereses_mora || 0)} mora</div>}
                              </td>
                              <td style={{ padding: '7px 10px', color: '#16A34A', fontWeight: 600 }}>
                                {fmt(pago.monto_pagado || 0)}
                                {pago.fecha_pago && <div style={{ fontSize: 10, color: '#64748B' }}>{fmtFecha(pago.fecha_pago)}</div>}
                              </td>
                              <td style={{ padding: '7px 10px', fontWeight: 600, color: restante > 0 ? '#dc2626' : '#16A34A' }}>{fmt(Math.max(0, restante))}</td>
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

              <div style={{ marginTop: 32, paddingTop: 16, borderTop: '2px solid #e2e8f0', textAlign: 'center', fontSize: 10, color: '#64748B' }}>
                <div style={{ fontWeight: 600, marginBottom: 4 }}>Estado de Cuenta generado por Sistema Electro Hogar</div>
                <div>Fecha de generacion: {fechaActual}</div>
              </div>
            </div>

            <div className="border-t border-line bg-surface-2 px-5 py-3 flex flex-wrap gap-3 justify-between items-center rounded-b-xl">
              <p className="text-xs text-muted">El PDF se genera a partir de esta vista previa.</p>
              <div className="flex gap-2">
                {cliente.telefono && (
                  <button onClick={enviarPorWhatsApp} disabled={generando} className="btn-secondary">
                    <Phone className="w-4 h-4" />
                    WhatsApp
                  </button>
                )}
                <button onClick={descargarPDF} disabled={generando} className="btn-primary">
                  {generando ? <span className="spinner" /> : <Download className="w-4 h-4" />}
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