'use client'

import { useRef, useState } from 'react'
import { X, Download, Printer, CheckCircle } from 'lucide-react'

interface Cuota {
  numero: number
  monto: number
  fechaVencimiento: string
}

interface ComprobanteTransaccionProps {
  tipo: 'venta' | 'prestamo'
  cliente: {
    nombre: string
    apellido: string
    telefono?: string
    email?: string
  }
  transaccion: {
    numeroFactura?: string
    fecha: string
    montoOriginal: number
    interes: number
    montoTotal: number
    numeroCuotas: number
    montoCuota: number
    tipoPago: string
    descripcion?: string
    productoNombre?: string
  }
  cuotas: Cuota[]
  onCerrar: () => void
}

export default function ComprobanteTransaccion({
  tipo,
  cliente,
  transaccion,
  cuotas,
  onCerrar
}: ComprobanteTransaccionProps) {
  const contenidoRef = useRef<HTMLDivElement>(null)
  const [generando, setGenerando] = useState(false)

  const formatearMoneda = (monto: number) => {
    return new Intl.NumberFormat('es-AR', {
      style: 'currency',
      currency: 'ARS',
      minimumFractionDigits: 2
    }).format(monto)
  }

  const formatearFecha = (fecha: string) => {
    const [year, month, day] = fecha.split('-').map(Number)
    const fechaObj = new Date(year, month - 1, day)
    return fechaObj.toLocaleDateString('es-AR', {
      day: '2-digit',
      month: 'long',
      year: 'numeric'
    })
  }

  const handleImprimir = (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    window.print()
  }

  const handleDescargar = async (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()

    if (!contenidoRef.current || generando) return

    setGenerando(true)
    try {
      const html2canvas = (await import('html2canvas')).default
      const { jsPDF } = await import('jspdf')

      const canvas = await html2canvas(contenidoRef.current, {
        scale: 2,
        useCORS: true,
        logging: false,
        backgroundColor: '#ffffff',
        windowWidth: contenidoRef.current.scrollWidth,
        windowHeight: contenidoRef.current.scrollHeight
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

      const fileName = `Comprobante_${tipo}_${transaccion.numeroFactura || 'SIN-NUM'}_${transaccion.fecha}.pdf`

      const pdfBlob = pdf.output('blob')
      const blobUrl = URL.createObjectURL(pdfBlob)

      const link = document.createElement('a')
      link.href = blobUrl
      link.download = fileName
      link.style.display = 'none'
      document.body.appendChild(link)
      link.click()

      setTimeout(() => {
        document.body.removeChild(link)
        URL.revokeObjectURL(blobUrl)
      }, 0)
    } catch (err) {
      console.error('Error generando PDF:', err)
      alert('No se pudo generar el PDF. Revisá consola y dependencias html2canvas/jspdf.')
    } finally {
      setGenerando(false)
    }
  }

  const colorPrincipal = tipo === 'venta' ? 'rgb(37, 99, 235)' : 'rgb(5, 150, 105)'
  const colorSecundario = tipo === 'venta' ? 'rgb(219, 234, 254)' : 'rgb(209, 250, 229)'

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <style>{`
        .comprobante-ultra-compacto {
          font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
          line-height: 1.3;
          color: #1f2937;
        }

        .comprobante-ultra-compacto .comprobante-wrapper {
          max-width: 850px;
          margin: 0 auto;
          background: white;
          box-shadow: 0 0 20px rgba(0,0,0,0.1);
          border-radius: 8px;
          overflow: hidden;
        }

        /* ===== HEADER ===== */
        .comprobante-ultra-compacto .header-banner {
          background: linear-gradient(135deg, ${colorPrincipal} 0%, ${colorPrincipal}dd 100%);
          color: white;
          padding: 12px 20px;
          text-align: center;
        }

        .comprobante-ultra-compacto .header-banner h1 {
          font-size: 18px;
          font-weight: 700;
          letter-spacing: 0.3px;
          margin-bottom: 3px;
          text-transform: uppercase;
        }

        .comprobante-ultra-compacto .header-banner .numero {
          font-size: 11px;
          opacity: 0.95;
          font-weight: 500;
        }

        .comprobante-ultra-compacto .header-banner .fecha {
          font-size: 9px;
          opacity: 0.85;
          margin-top: 3px;
        }

        /* ===== CONTENIDO ===== */
        .comprobante-ultra-compacto .contenido {
          padding: 12px 15px;
        }

        .comprobante-ultra-compacto .seccion {
          margin-bottom: 10px;
          page-break-inside: avoid;
        }

        .comprobante-ultra-compacto .seccion-titulo {
          font-size: 11px;
          font-weight: 700;
          color: ${colorPrincipal};
          text-transform: uppercase;
          letter-spacing: 0.2px;
          border-bottom: 2px solid ${colorPrincipal};
          padding-bottom: 3px;
          margin-bottom: 6px;
        }

        /* ===== INFO BOXES ===== */
        .comprobante-ultra-compacto .info-box {
          background: #f9fafb;
          border-left: 3px solid ${colorPrincipal};
          padding: 8px 10px;
          border-radius: 3px;
        }

        .comprobante-ultra-compacto .info-grid {
          display: grid;
          grid-template-columns: repeat(2, 1fr);
          gap: 8px;
        }

        .comprobante-ultra-compacto .info-item {
          display: flex;
          flex-direction: column;
        }

        .comprobante-ultra-compacto .info-label {
          font-size: 8px;
          color: #6b7280;
          font-weight: 600;
          text-transform: uppercase;
          margin-bottom: 2px;
        }

        .comprobante-ultra-compacto .info-value {
          font-size: 11px;
          color: #111827;
          font-weight: 600;
        }

        /* ===== DETALLE ===== */
        .comprobante-ultra-compacto .detalle-box {
          background: ${colorSecundario};
          border: 2px solid ${colorPrincipal}33;
          padding: 10px 12px;
          border-radius: 4px;
          margin-top: 6px;
        }

        .comprobante-ultra-compacto .detalle-row {
          display: flex;
          justify-content: space-between;
          gap: 12px;
          padding: 4px 0;
          border-bottom: 1px solid ${colorPrincipal}20;
        }

        .comprobante-ultra-compacto .detalle-row:last-child {
          border-bottom: none;
        }

        .comprobante-ultra-compacto .detalle-label {
          font-size: 10px;
          color: #374151;
          font-weight: 500;
        }

        .comprobante-ultra-compacto .detalle-value {
          font-size: 10px;
          color: #111827;
          font-weight: 700;
          text-align: right;
        }

        .comprobante-ultra-compacto .monto-total {
          background: ${colorPrincipal};
          color: white;
          padding: 8px 12px;
          border-radius: 4px;
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-top: 6px;
          font-size: 13px;
          font-weight: 700;
        }

        /* ===== PLAN DE PAGOS ===== */
        .comprobante-ultra-compacto .plan-pagos-summary {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 8px;
          background: #f9fafb;
          padding: 8px;
          border-radius: 4px;
          margin: 8px 0;
          text-align: center;
        }

        .comprobante-ultra-compacto .plan-item {
          padding: 4px;
        }

        .comprobante-ultra-compacto .plan-item-label {
          font-size: 7px;
          color: #6b7280;
          text-transform: uppercase;
          font-weight: 600;
          margin-bottom: 3px;
        }

        .comprobante-ultra-compacto .plan-item-value {
          font-size: 12px;
          color: #111827;
          font-weight: 700;
        }

        /* ===== TABLA DE CUOTAS ===== */
        .comprobante-ultra-compacto .tabla-cuotas {
          width: 100%;
          border-collapse: collapse;
          margin-top: 8px;
          box-shadow: 0 1px 4px rgba(0,0,0,0.08);
          border-radius: 4px;
          overflow: hidden;
          page-break-inside: avoid;
        }

        .comprobante-ultra-compacto .tabla-cuotas thead {
          background: ${colorPrincipal};
          color: white;
        }

        .comprobante-ultra-compacto .tabla-cuotas th {
          padding: 6px 8px;
          text-align: left;
          font-size: 9px;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.2px;
        }

        .comprobante-ultra-compacto .tabla-cuotas tbody tr {
          border-bottom: 1px solid #e5e7eb;
        }

        .comprobante-ultra-compacto .tabla-cuotas td {
          padding: 6px 8px;
          font-size: 9px;
        }

        .comprobante-ultra-compacto .tabla-cuotas tfoot {
          background: #f3f4f6;
          font-weight: 700;
        }

        .comprobante-ultra-compacto .tabla-cuotas tfoot td {
          padding: 6px 8px;
          font-size: 10px;
        }

        .comprobante-ultra-compacto .badge {
          display: inline-block;
          padding: 2px 6px;
          border-radius: 8px;
          font-size: 7px;
          font-weight: 600;
          text-transform: uppercase;
        }

        .comprobante-ultra-compacto .badge-pendiente {
          background: #fef3c7;
          color: #92400e;
        }

        /* ===== TÉRMINOS ===== */
        .comprobante-ultra-compacto .terminos {
          background: #fef9f3;
          border: 1px solid #fbbf24;
          border-radius: 4px;
          padding: 8px 10px;
          margin-top: 10px;
          page-break-inside: avoid;
        }

        .comprobante-ultra-compacto .terminos-titulo {
          font-size: 9px;
          font-weight: 700;
          color: #92400e;
          margin-bottom: 5px;
          text-transform: uppercase;
        }

        .comprobante-ultra-compacto .terminos ul {
          list-style: none;
          padding-left: 0;
          margin: 0;
        }

        .comprobante-ultra-compacto .terminos li {
          font-size: 8px;
          color: #78350f;
          margin-bottom: 3px;
          padding-left: 12px;
          position: relative;
          line-height: 1.3;
        }

        .comprobante-ultra-compacto .terminos li:before {
          content: "•";
          position: absolute;
          left: 4px;
          font-weight: bold;
        }

        /* ===== FIRMAS ===== */
        .comprobante-ultra-compacto .firmas {
          display: grid;
          grid-template-columns: repeat(2, 1fr);
          gap: 30px;
          margin-top: 20px;
          padding-top: 12px;
          page-break-inside: avoid;
        }

        .comprobante-ultra-compacto .firma-box {
          text-align: center;
        }

        .comprobante-ultra-compacto .firma-linea {
          border-top: 1.5px solid #111827;
          margin: 30px 10px 6px 10px;
        }

        .comprobante-ultra-compacto .firma-label {
          font-weight: 700;
          color: #111827;
          font-size: 10px;
          margin-bottom: 2px;
        }

        .comprobante-ultra-compacto .firma-nombre {
          font-size: 8px;
          color: #6b7280;
        }

        /* ===== FOOTER ===== */
        .comprobante-ultra-compacto .footer {
          text-align: center;
          padding: 8px;
          background: #f9fafb;
          border-top: 1px solid #e5e7eb;
          margin-top: 12px;
        }

        .comprobante-ultra-compacto .footer-text {
          font-size: 7px;
          color: #6b7280;
        }

        /* ===== PRINT STYLES ===== */
        @media print {
          body { 
            background: #fff !important; 
            margin: 0;
            padding: 0;
          }
          
          .comprobante-ultra-compacto .comprobante-wrapper {
            box-shadow: none;
            border-radius: 0;
            max-width: 100%;
          }
          
          .comprobante-ultra-compacto .contenido {
            padding: 8mm 10mm;
          }
          
          .comprobante-ultra-compacto .seccion {
            page-break-inside: avoid;
          }
          
          .comprobante-ultra-compacto .tabla-cuotas {
            page-break-inside: avoid;
          }
          
          .comprobante-ultra-compacto .terminos {
            page-break-inside: avoid;
          }
          
          .comprobante-ultra-compacto .firmas {
            page-break-inside: avoid;
          }
          
          @page {
            size: A4;
            margin: 8mm;
          }
        }
      `}</style>

      <div className="bg-white rounded-xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto comprobante-ultra-compacto">
        {/* Header con acciones */}
        <div className="sticky top-0 bg-gradient-to-r from-blue-600 to-blue-700 text-white p-6 rounded-t-xl flex justify-between items-center print:hidden">
          <div>
            <h2 className="text-2xl font-bold flex items-center gap-2">
              <CheckCircle className="w-8 h-8" />
              ¡{tipo === 'venta' ? 'Venta' : 'Préstamo'} Creado Exitosamente!
            </h2>
            <p className="text-blue-100 text-sm mt-1">
              Comprobante generado el {formatearFecha(transaccion.fecha)}
            </p>
          </div>

          <button
            type="button"
            onClick={(e) => {
              e.preventDefault()
              e.stopPropagation()
              onCerrar()
            }}
            className="text-white hover:bg-white/20 p-2 rounded-full transition-colors"
            aria-label="Cerrar"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Botones de acción */}
        <div className="flex gap-3 p-4 bg-gray-50 border-b print:hidden">
          <button
            type="button"
            onClick={handleImprimir}
            className="flex items-center gap-2 px-4 py-2 bg-gray-700 text-white rounded-lg hover:bg-gray-800 transition-colors"
          >
            <Printer className="w-4 h-4" />
            Imprimir
          </button>

          <button
            type="button"
            onClick={handleDescargar}
            disabled={generando}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
          >
            <Download className="w-4 h-4" />
            {generando ? 'Generando...' : 'Descargar PDF'}
          </button>
        </div>

        {/* Contenido del comprobante */}
        <div ref={contenidoRef} id="comprobante-contenido" className="comprobante-wrapper">
          <div className="header-banner">
            <h1>COMPROBANTE DE {tipo === 'venta' ? 'VENTA' : 'PRÉSTAMO'}</h1>
            {transaccion.numeroFactura && <div className="numero">N° {transaccion.numeroFactura}</div>}
            <div className="fecha">Fecha de emisión: {formatearFecha(transaccion.fecha)}</div>
          </div>

          <div className="contenido">
            {/* Información del cliente */}
            <div className="seccion">
              <h3 className="seccion-titulo">Datos del Cliente</h3>
              <div className="info-box">
                <div className="info-grid">
                  <div className="info-item">
                    <div className="info-label">Nombre Completo</div>
                    <div className="info-value">
                      {cliente.nombre} {cliente.apellido}
                    </div>
                  </div>

                  {cliente.telefono && (
                    <div className="info-item">
                      <div className="info-label">Teléfono</div>
                      <div className="info-value">{cliente.telefono}</div>
                    </div>
                  )}

                  {cliente.email && (
                    <div className="info-item" style={{ gridColumn: 'span 2' }}>
                      <div className="info-label">Email</div>
                      <div className="info-value">{cliente.email}</div>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Detalle de la transacción */}
            <div className="seccion">
              <h3 className="seccion-titulo">Detalle de la {tipo === 'venta' ? 'Venta' : 'Operación'}</h3>
              <div className="detalle-box">
                {tipo === 'venta' && transaccion.productoNombre && (
                  <div className="detalle-row">
                    <span className="detalle-label">Producto:</span>
                    <span className="detalle-value">{transaccion.productoNombre}</span>
                  </div>
                )}

                {transaccion.descripcion && (
                  <div className="detalle-row">
                    <span className="detalle-label">Descripción:</span>
                    <span className="detalle-value" style={{ maxWidth: '380px', fontSize: '9px' }}>
                      {transaccion.descripcion}
                    </span>
                  </div>
                )}

                <div className="detalle-row">
                  <span className="detalle-label">Monto Original:</span>
                  <span className="detalle-value">{formatearMoneda(transaccion.montoOriginal)}</span>
                </div>

                {transaccion.interes > 0 && (
                  <div className="detalle-row">
                    <span className="detalle-label">Interés ({transaccion.interes}%):</span>
                    <span className="detalle-value" style={{ color: '#ea580c' }}>
                      + {formatearMoneda(transaccion.montoTotal - transaccion.montoOriginal)}
                    </span>
                  </div>
                )}

                <div className="monto-total">
                  <span>MONTO TOTAL A PAGAR</span>
                  <span>{formatearMoneda(transaccion.montoTotal)}</span>
                </div>
              </div>
            </div>

            {/* Plan de pagos */}
            <div className="seccion">
              <h3 className="seccion-titulo">Plan de Pagos</h3>

              <div className="plan-pagos-summary">
                <div className="plan-item">
                  <div className="plan-item-label">Modalidad</div>
                  <div className="plan-item-value" style={{ textTransform: 'capitalize', fontSize: '11px' }}>
                    {transaccion.tipoPago}
                  </div>
                </div>
                <div className="plan-item">
                  <div className="plan-item-label">Nº Cuotas</div>
                  <div className="plan-item-value">{transaccion.numeroCuotas}</div>
                </div>
                <div className="plan-item">
                  <div className="plan-item-label">Valor Cuota</div>
                  <div
                    className="plan-item-value"
                    style={{ color: tipo === 'venta' ? '#2563eb' : '#059669', fontSize: '11px' }}
                  >
                    {formatearMoneda(transaccion.montoCuota)}
                  </div>
                </div>
              </div>

              <table className="tabla-cuotas">
                <thead>
                  <tr>
                    <th>N° Cuota</th>
                    <th>Fecha Vencimiento</th>
                    <th style={{ textAlign: 'right' }}>Monto</th>
                    <th style={{ textAlign: 'center' }}>Estado</th>
                  </tr>
                </thead>
                <tbody>
                  {cuotas.map((cuota) => (
                    <tr key={cuota.numero}>
                      <td style={{ fontWeight: 600 }}>#{cuota.numero}</td>
                      <td>{formatearFecha(cuota.fechaVencimiento)}</td>
                      <td style={{ textAlign: 'right', fontWeight: 700 }}>
                        {formatearMoneda(cuota.monto)}
                      </td>
                      <td style={{ textAlign: 'center' }}>
                        <span className="badge badge-pendiente">PENDIENTE</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr>
                    <td colSpan={2} style={{ textAlign: 'right' }}>
                      TOTAL:
                    </td>
                    <td
                      style={{
                        textAlign: 'right',
                        color: tipo === 'venta' ? '#2563eb' : '#059669'
                      }}
                    >
                      {formatearMoneda(transaccion.montoTotal)}
                    </td>
                    <td />
                  </tr>
                </tfoot>
              </table>
            </div>

            <div className="terminos">
              <div className="terminos-titulo">Términos y Condiciones</div>
              <ul>
                <li>El cliente se compromete a pagar cada cuota en la fecha indicada.</li>
                <li>Los pagos realizados fuera de fecha pueden generar intereses adicionales.</li>
                <li>Este comprobante es un documento válido para ambas partes.</li>
                <li>Conservar este comprobante como respaldo de la operación.</li>
              </ul>
            </div>

            <div className="firmas">
              <div className="firma-box">
                <div className="firma-linea"></div>
                <div className="firma-label">Firma del Cliente</div>
                <div className="firma-nombre">
                  {cliente.nombre} {cliente.apellido}
                </div>
              </div>
              <div className="firma-box">
                <div className="firma-linea"></div>
                <div className="firma-label">Firma del Vendedor</div>
                <div className="firma-nombre">Autorizado</div>
              </div>
            </div>

            <div className="footer">
              <div className="footer-text">
                Este documento ha sido generado electrónicamente • Sistema de Cobranzas
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 bg-gray-50 border-t flex justify-end print:hidden">
          <button
            type="button"
            onClick={(e) => {
              e.preventDefault()
              e.stopPropagation()
              onCerrar()
            }}
            className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
          >
            Cerrar Comprobante
          </button>
        </div>
      </div>
    </div>
  )
}