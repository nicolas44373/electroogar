'use client'

import { useRef, useState } from 'react'
import html2canvas from 'html2canvas'
import { jsPDF } from 'jspdf'
import { X, Download, Printer, ShoppingBag } from 'lucide-react'

interface ComprobanteCompraProps {
  tipo: 'venta' | 'prestamo'
  cliente: {
    nombre: string
    apellido: string
    telefono?: string
    email?: string
    documento?: string
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
  onCerrar: () => void
}

export default function ComprobanteCompra({
  tipo,
  cliente,
  transaccion,
  onCerrar,
}: ComprobanteCompraProps) {
  const contenidoRef = useRef<HTMLDivElement>(null)
  const [generando, setGenerando] = useState(false)

  const formatearMoneda = (monto: number) =>
    new Intl.NumberFormat('es-AR', {
      style: 'currency',
      currency: 'ARS',
      minimumFractionDigits: 2,
    }).format(monto)

  const formatearFecha = (fecha: string) => {
    const [year, month, day] = fecha.split('-').map(Number)
    const fechaObj = new Date(year, month - 1, day)
    return fechaObj.toLocaleDateString('es-AR', {
      day: '2-digit',
      month: 'long',
      year: 'numeric',
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
      const canvas = await html2canvas(contenidoRef.current, {
        scale: 2,
        useCORS: true,
        logging: false,
        backgroundColor: '#ffffff',
        windowWidth: contenidoRef.current.scrollWidth,
        windowHeight: contenidoRef.current.scrollHeight,
      })

      const imgData = canvas.toDataURL('image/png')

      const pdf = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4',
        compress: true,
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

      const nombreCliente = `${cliente.nombre}_${cliente.apellido}`.replace(/\s+/g, '')
      const fileName = `ComprobanteCompra_${nombreCliente}_${transaccion.fecha}.pdf`

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
  const interesMonto = transaccion.montoTotal - transaccion.montoOriginal
  const esFinanciado = transaccion.numeroCuotas > 1

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <style>{`
        .comprobante-compra {
          font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
          line-height: 1.4;
          color: #1E293B;
        }
        .comprobante-compra .cc-wrapper {
          max-width: 850px;
          margin: 0 auto;
          background: white;
          border-radius: 8px;
          overflow: hidden;
        }
        .comprobante-compra .cc-header {
          background: linear-gradient(135deg, ${colorPrincipal} 0%, ${colorPrincipal}dd 100%);
          color: white;
          padding: 16px 24px;
          text-align: center;
        }
        .comprobante-compra .cc-header h1 {
          font-size: 20px;
          font-weight: 700;
          letter-spacing: 0.3px;
          margin-bottom: 4px;
          text-transform: uppercase;
        }
        .comprobante-compra .cc-header .cc-num { font-size: 12px; opacity: 0.95; }
        .comprobante-compra .cc-header .cc-fecha { font-size: 10px; opacity: 0.85; margin-top: 4px; }
        .comprobante-compra .cc-body { padding: 20px 24px; }
        .comprobante-compra .cc-seccion { margin-bottom: 18px; }
        .comprobante-compra .cc-titulo {
          font-size: 12px;
          font-weight: 700;
          color: ${colorPrincipal};
          text-transform: uppercase;
          letter-spacing: 0.3px;
          border-bottom: 2px solid ${colorPrincipal};
          padding-bottom: 4px;
          margin-bottom: 10px;
        }
        .comprobante-compra .cc-info-box {
          background: #F5F7FA;
          border-left: 3px solid ${colorPrincipal};
          padding: 12px 14px;
          border-radius: 3px;
        }
        .comprobante-compra .cc-grid {
          display: grid;
          grid-template-columns: repeat(2, 1fr);
          gap: 10px 16px;
        }
        .comprobante-compra .cc-label {
          font-size: 9px;
          color: #64748B;
          font-weight: 600;
          text-transform: uppercase;
          margin-bottom: 2px;
        }
        .comprobante-compra .cc-value { font-size: 13px; color: #1E293B; font-weight: 600; }
        .comprobante-compra .cc-detalle {
          background: ${colorSecundario};
          border: 2px solid ${colorPrincipal}33;
          padding: 14px 16px;
          border-radius: 4px;
        }
        .comprobante-compra .cc-row {
          display: flex;
          justify-content: space-between;
          gap: 12px;
          padding: 6px 0;
          border-bottom: 1px solid ${colorPrincipal}20;
        }
        .comprobante-compra .cc-row:last-child { border-bottom: none; }
        .comprobante-compra .cc-row-label { font-size: 11px; color: #334155; font-weight: 500; }
        .comprobante-compra .cc-row-value { font-size: 11px; color: #1E293B; font-weight: 700; text-align: right; }
        .comprobante-compra .cc-total {
          background: ${colorPrincipal};
          color: white;
          padding: 10px 14px;
          border-radius: 4px;
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-top: 8px;
          font-size: 14px;
          font-weight: 700;
        }
        .comprobante-compra .cc-pago-resumen {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 10px;
          background: #F5F7FA;
          padding: 12px;
          border-radius: 4px;
          text-align: center;
        }
        .comprobante-compra .cc-pago-label {
          font-size: 8px;
          color: #64748B;
          text-transform: uppercase;
          font-weight: 600;
          margin-bottom: 4px;
        }
        .comprobante-compra .cc-pago-value { font-size: 13px; color: #1E293B; font-weight: 700; }
        .comprobante-compra .cc-firmas {
          display: grid;
          grid-template-columns: repeat(2, 1fr);
          gap: 40px;
          margin-top: 32px;
        }
        .comprobante-compra .cc-firma { text-align: center; }
        .comprobante-compra .cc-firma-linea { border-top: 1.5px solid #1E293B; margin: 36px 12px 6px 12px; }
        .comprobante-compra .cc-firma-label { font-weight: 700; color: #1E293B; font-size: 10px; }
        .comprobante-compra .cc-firma-nombre { font-size: 9px; color: #64748B; }
        .comprobante-compra .cc-footer {
          text-align: center;
          padding: 12px;
          background: #F5F7FA;
          border-top: 1px solid #E2E8F0;
          margin-top: 16px;
        }
        .comprobante-compra .cc-footer-text { font-size: 8px; color: #64748B; }
        @media print {
          body { background: #fff !important; margin: 0; padding: 0; }
          @page { size: A4; margin: 10mm; }
        }
      `}</style>

      <div className="bg-white rounded-xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto comprobante-compra">
        {/* Header con acciones */}
        <div className="sticky top-0 bg-[#0F4C81] text-white p-6 rounded-t-xl flex justify-between items-center print:hidden">
          <div>
            <h2 className="text-xl font-bold flex items-center gap-2">
              <ShoppingBag className="w-7 h-7" />
              Comprobante de Compra
            </h2>
            <p className="text-white/80 text-sm mt-1">Detalle de la compra del cliente (sin plan de cuotas)</p>
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
        <div className="flex flex-wrap gap-3 p-4 bg-surface-2 border-b border-line print:hidden">
          <button
            type="button"
            onClick={handleImprimir}
            className="btn-secondary"
          >
            <Printer className="w-4 h-4" />
            Imprimir
          </button>
          <button
            type="button"
            onClick={handleDescargar}
            disabled={generando}
            className="btn-primary"
          >
            <Download className="w-4 h-4" />
            {generando ? 'Generando...' : 'Descargar PDF'}
          </button>
        </div>

        {/* Contenido del comprobante */}
        <div ref={contenidoRef} className="cc-wrapper">
          <div className="cc-header">
            <h1>Comprobante de {tipo === 'venta' ? 'Compra' : 'Préstamo'}</h1>
            {transaccion.numeroFactura && <div className="cc-num">N° {transaccion.numeroFactura}</div>}
            <div className="cc-fecha">Fecha de emisión: {formatearFecha(transaccion.fecha)}</div>
          </div>

          <div className="cc-body">
            {/* Datos del cliente */}
            <div className="cc-seccion">
              <h3 className="cc-titulo">Datos del Cliente</h3>
              <div className="cc-info-box">
                <div className="cc-grid">
                  <div>
                    <div className="cc-label">Nombre Completo</div>
                    <div className="cc-value">{cliente.nombre} {cliente.apellido}</div>
                  </div>
                  {cliente.documento && (
                    <div>
                      <div className="cc-label">Documento</div>
                      <div className="cc-value">{cliente.documento}</div>
                    </div>
                  )}
                  {cliente.telefono && (
                    <div>
                      <div className="cc-label">Teléfono</div>
                      <div className="cc-value">{cliente.telefono}</div>
                    </div>
                  )}
                  {cliente.email && (
                    <div>
                      <div className="cc-label">Email</div>
                      <div className="cc-value">{cliente.email}</div>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Detalle de la compra */}
            <div className="cc-seccion">
              <h3 className="cc-titulo">Detalle de la {tipo === 'venta' ? 'Compra' : 'Operación'}</h3>
              <div className="cc-detalle">
                {tipo === 'venta' && transaccion.productoNombre && (
                  <div className="cc-row">
                    <span className="cc-row-label">Producto:</span>
                    <span className="cc-row-value">{transaccion.productoNombre}</span>
                  </div>
                )}
                {transaccion.descripcion && (
                  <div className="cc-row">
                    <span className="cc-row-label">Descripción:</span>
                    <span className="cc-row-value" style={{ maxWidth: 420, fontSize: 10 }}>
                      {transaccion.descripcion}
                    </span>
                  </div>
                )}
                <div className="cc-row">
                  <span className="cc-row-label">
                    {tipo === 'venta' ? 'Precio del producto:' : 'Monto original:'}
                  </span>
                  <span className="cc-row-value">{formatearMoneda(transaccion.montoOriginal)}</span>
                </div>
                {transaccion.interes > 0 && (
                  <div className="cc-row">
                    <span className="cc-row-label">Interés / recargo ({transaccion.interes}%):</span>
                    <span className="cc-row-value" style={{ color: '#D97706' }}>
                      + {formatearMoneda(interesMonto)}
                    </span>
                  </div>
                )}
                <div className="cc-total">
                  <span>TOTAL DE LA COMPRA</span>
                  <span>{formatearMoneda(transaccion.montoTotal)}</span>
                </div>
              </div>
            </div>

            {/* Forma de pago (resumen, sin tabla de cuotas) */}
            <div className="cc-seccion">
              <h3 className="cc-titulo">Forma de Pago</h3>
              {esFinanciado ? (
                <div className="cc-pago-resumen">
                  <div>
                    <div className="cc-pago-label">Modalidad</div>
                    <div className="cc-pago-value" style={{ textTransform: 'capitalize' }}>
                      {transaccion.tipoPago}
                    </div>
                  </div>
                  <div>
                    <div className="cc-pago-label">N° de Cuotas</div>
                    <div className="cc-pago-value">{transaccion.numeroCuotas}</div>
                  </div>
                  <div>
                    <div className="cc-pago-label">Valor por Cuota</div>
                    <div
                      className="cc-pago-value"
                      style={{ color: tipo === 'venta' ? '#0F4C81' : '#16A34A' }}
                    >
                      {formatearMoneda(transaccion.montoCuota)}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="cc-info-box">
                  <div className="cc-value">Pago único de {formatearMoneda(transaccion.montoTotal)}</div>
                </div>
              )}
            </div>

            {/* Firmas */}
            <div className="cc-firmas">
              <div className="cc-firma">
                <div className="cc-firma-linea"></div>
                <div className="cc-firma-label">Firma del Cliente</div>
                <div className="cc-firma-nombre">{cliente.nombre} {cliente.apellido}</div>
              </div>
              <div className="cc-firma">
                <div className="cc-firma-linea"></div>
                <div className="cc-firma-label">Firma del Vendedor</div>
                <div className="cc-firma-nombre">Autorizado</div>
              </div>
            </div>

            <div className="cc-footer">
              <div className="cc-footer-text">
                Este comprobante acredita la compra detallada • Documento generado electrónicamente
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 bg-surface-2 border-t border-line flex justify-end print:hidden">
          <button
            type="button"
            onClick={(e) => {
              e.preventDefault()
              e.stopPropagation()
              onCerrar()
            }}
            className="btn-primary"
          >
            Cerrar
          </button>
        </div>
      </div>
    </div>
  )
}
