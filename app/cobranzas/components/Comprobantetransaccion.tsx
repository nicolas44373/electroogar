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

  const handleImprimir = () => {
    window.print()
  }

  const handleDescargar = () => {
    const contenido = document.getElementById('comprobante-contenido')
    if (contenido) {
      const ventanaImpresion = window.open('', '', 'width=900,height=1200')
      if (ventanaImpresion) {
        const colorPrincipal = tipo === 'venta' ? '#2563eb' : '#059669'
        const colorSecundario = tipo === 'venta' ? '#dbeafe' : '#d1fae5'
        
        ventanaImpresion.document.write(`
          <html>
            <head>
              <title>Comprobante - ${tipo === 'venta' ? 'Venta' : 'Préstamo'}</title>
              <meta charSet="UTF-8">
              <style>
                * { margin: 0; padding: 0; box-sizing: border-box; }
                
                body { 
                  font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
                  line-height: 1.6;
                  color: #1f2937;
                  background: #fff;
                  padding: 30px;
                }
                
                .comprobante-wrapper {
                  max-width: 850px;
                  margin: 0 auto;
                  background: white;
                  box-shadow: 0 0 20px rgba(0,0,0,0.1);
                  border-radius: 8px;
                  overflow: hidden;
                }
                
                .header-banner {
                  background: linear-gradient(135deg, ${colorPrincipal} 0%, ${colorPrincipal}dd 100%);
                  color: white;
                  padding: 30px 40px;
                  text-align: center;
                }
                
                .header-banner h1 {
                  font-size: 32px;
                  font-weight: 700;
                  letter-spacing: 1px;
                  margin-bottom: 8px;
                  text-transform: uppercase;
                }
                
                .header-banner .numero {
                  font-size: 16px;
                  opacity: 0.95;
                  font-weight: 500;
                }
                
                .header-banner .fecha {
                  font-size: 13px;
                  opacity: 0.85;
                  margin-top: 8px;
                }
                
                .contenido {
                  padding: 40px;
                }
                
                .seccion {
                  margin-bottom: 30px;
                  page-break-inside: avoid;
                }
                
                .seccion-titulo {
                  font-size: 16px;
                  font-weight: 700;
                  color: ${colorPrincipal};
                  text-transform: uppercase;
                  letter-spacing: 0.5px;
                  border-bottom: 3px solid ${colorPrincipal};
                  padding-bottom: 8px;
                  margin-bottom: 15px;
                }
                
                .info-box {
                  background: #f9fafb;
                  border-left: 4px solid ${colorPrincipal};
                  padding: 20px;
                  border-radius: 4px;
                }
                
                .info-grid {
                  display: grid;
                  grid-template-columns: repeat(2, 1fr);
                  gap: 15px;
                }
                
                .info-item {
                  display: flex;
                  flex-direction: column;
                }
                
                .info-label {
                  font-size: 12px;
                  color: #6b7280;
                  font-weight: 600;
                  text-transform: uppercase;
                  margin-bottom: 4px;
                }
                
                .info-value {
                  font-size: 15px;
                  color: #111827;
                  font-weight: 600;
                }
                
                .detalle-box {
                  background: ${colorSecundario};
                  border: 2px solid ${colorPrincipal}33;
                  padding: 25px;
                  border-radius: 8px;
                  margin-top: 15px;
                }
                
                .detalle-row {
                  display: flex;
                  justify-content: space-between;
                  padding: 10px 0;
                  border-bottom: 1px solid ${colorPrincipal}20;
                }
                
                .detalle-row:last-child {
                  border-bottom: none;
                }
                
                .detalle-label {
                  font-size: 14px;
                  color: #374151;
                  font-weight: 500;
                }
                
                .detalle-value {
                  font-size: 14px;
                  color: #111827;
                  font-weight: 700;
                }
                
                .monto-total {
                  background: ${colorPrincipal};
                  color: white;
                  padding: 15px 25px;
                  border-radius: 8px;
                  display: flex;
                  justify-content: space-between;
                  align-items: center;
                  margin-top: 15px;
                  font-size: 18px;
                  font-weight: 700;
                }
                
                .plan-pagos-summary {
                  display: grid;
                  grid-template-columns: repeat(3, 1fr);
                  gap: 15px;
                  background: #f9fafb;
                  padding: 20px;
                  border-radius: 8px;
                  margin: 20px 0;
                  text-align: center;
                }
                
                .plan-item {
                  padding: 10px;
                }
                
                .plan-item-label {
                  font-size: 11px;
                  color: #6b7280;
                  text-transform: uppercase;
                  font-weight: 600;
                  margin-bottom: 6px;
                }
                
                .plan-item-value {
                  font-size: 18px;
                  color: #111827;
                  font-weight: 700;
                }
                
                .tabla-cuotas {
                  width: 100%;
                  border-collapse: collapse;
                  margin-top: 20px;
                  box-shadow: 0 2px 8px rgba(0,0,0,0.08);
                  border-radius: 8px;
                  overflow: hidden;
                }
                
                .tabla-cuotas thead {
                  background: ${colorPrincipal};
                  color: white;
                }
                
                .tabla-cuotas th {
                  padding: 14px 16px;
                  text-align: left;
                  font-size: 13px;
                  font-weight: 700;
                  text-transform: uppercase;
                  letter-spacing: 0.5px;
                }
                
                .tabla-cuotas tbody tr {
                  border-bottom: 1px solid #e5e7eb;
                  transition: background 0.2s;
                }
                
                .tabla-cuotas tbody tr:hover {
                  background: ${colorSecundario};
                }
                
                .tabla-cuotas tbody tr:last-child {
                  border-bottom: none;
                }
                
                .tabla-cuotas td {
                  padding: 12px 16px;
                  font-size: 13px;
                }
                
                .tabla-cuotas tfoot {
                  background: #f3f4f6;
                  font-weight: 700;
                }
                
                .tabla-cuotas tfoot td {
                  padding: 14px 16px;
                  font-size: 14px;
                }
                
                .badge {
                  display: inline-block;
                  padding: 4px 12px;
                  border-radius: 12px;
                  font-size: 11px;
                  font-weight: 600;
                  text-transform: uppercase;
                }
                
                .badge-pendiente {
                  background: #fef3c7;
                  color: #92400e;
                }
                
                .terminos {
                  background: #fef9f3;
                  border: 1px solid #fbbf24;
                  border-radius: 8px;
                  padding: 20px;
                  margin-top: 30px;
                }
                
                .terminos-titulo {
                  font-size: 13px;
                  font-weight: 700;
                  color: #92400e;
                  margin-bottom: 12px;
                  text-transform: uppercase;
                }
                
                .terminos ul {
                  list-style: none;
                  padding-left: 0;
                }
                
                .terminos li {
                  font-size: 12px;
                  color: #78350f;
                  margin-bottom: 8px;
                  padding-left: 20px;
                  position: relative;
                }
                
                .terminos li:before {
                  content: "•";
                  position: absolute;
                  left: 8px;
                  font-weight: bold;
                }
                
                .firmas {
                  display: grid;
                  grid-template-columns: repeat(2, 1fr);
                  gap: 60px;
                  margin-top: 50px;
                  padding-top: 30px;
                }
                
                .firma-box {
                  text-align: center;
                }
                
                .firma-linea {
                  border-top: 2px solid #111827;
                  margin: 60px 20px 12px 20px;
                }
                
                .firma-label {
                  font-weight: 700;
                  color: #111827;
                  font-size: 14px;
                  margin-bottom: 4px;
                }
                
                .firma-nombre {
                  font-size: 12px;
                  color: #6b7280;
                }
                
                .footer {
                  text-align: center;
                  padding: 20px;
                  background: #f9fafb;
                  border-top: 2px solid #e5e7eb;
                  margin-top: 30px;
                }
                
                .footer-text {
                  font-size: 11px;
                  color: #6b7280;
                }
                
                @media print {
                  body { padding: 0; }
                  .comprobante-wrapper { box-shadow: none; }
                  @page { margin: 1cm; }
                }
                
                @media screen and (max-width: 768px) {
                  body { padding: 15px; }
                  .contenido { padding: 25px; }
                  .info-grid { grid-template-columns: 1fr; }
                  .plan-pagos-summary { grid-template-columns: 1fr; }
                }
              </style>
            </head>
            <body>
              ${contenido.innerHTML}
            </body>
          </html>
        `)
        ventanaImpresion.document.close()
        ventanaImpresion.print()
      }
    }
  }

  const colorPrincipal = tipo === 'venta' ? 'rgb(37, 99, 235)' : 'rgb(5, 150, 105)'
  const colorSecundario = tipo === 'venta' ? 'rgb(219, 234, 254)' : 'rgb(209, 250, 229)'

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <style>{`
        .comprobante-personalizado {
          font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
          line-height: 1.6;
          color: #1f2937;
        }
        
        .comprobante-personalizado .comprobante-wrapper {
          max-width: 850px;
          margin: 0 auto;
          background: white;
          box-shadow: 0 0 20px rgba(0,0,0,0.1);
          border-radius: 8px;
          overflow: hidden;
        }
        
        .comprobante-personalizado .header-banner {
          background: linear-gradient(135deg, ${colorPrincipal} 0%, ${colorPrincipal}dd 100%);
          color: white;
          padding: 30px 40px;
          text-align: center;
        }
        
        .comprobante-personalizado .header-banner h1 {
          font-size: 32px;
          font-weight: 700;
          letter-spacing: 1px;
          margin-bottom: 8px;
          text-transform: uppercase;
        }
        
        .comprobante-personalizado .header-banner .numero {
          font-size: 16px;
          opacity: 0.95;
          font-weight: 500;
        }
        
        .comprobante-personalizado .header-banner .fecha {
          font-size: 13px;
          opacity: 0.85;
          margin-top: 8px;
        }
        
        .comprobante-personalizado .contenido {
          padding: 40px;
        }
        
        .comprobante-personalizado .seccion {
          margin-bottom: 30px;
          page-break-inside: avoid;
        }
        
        .comprobante-personalizado .seccion-titulo {
          font-size: 16px;
          font-weight: 700;
          color: ${colorPrincipal};
          text-transform: uppercase;
          letter-spacing: 0.5px;
          border-bottom: 3px solid ${colorPrincipal};
          padding-bottom: 8px;
          margin-bottom: 15px;
        }
        
        .comprobante-personalizado .info-box {
          background: #f9fafb;
          border-left: 4px solid ${colorPrincipal};
          padding: 20px;
          border-radius: 4px;
        }
        
        .comprobante-personalizado .info-grid {
          display: grid;
          grid-template-columns: repeat(2, 1fr);
          gap: 15px;
        }
        
        .comprobante-personalizado .info-item {
          display: flex;
          flex-direction: column;
        }
        
        .comprobante-personalizado .info-label {
          font-size: 12px;
          color: #6b7280;
          font-weight: 600;
          text-transform: uppercase;
          margin-bottom: 4px;
        }
        
        .comprobante-personalizado .info-value {
          font-size: 15px;
          color: #111827;
          font-weight: 600;
        }
        
        .comprobante-personalizado .detalle-box {
          background: ${colorSecundario};
          border: 2px solid ${colorPrincipal}33;
          padding: 25px;
          border-radius: 8px;
          margin-top: 15px;
        }
        
        .comprobante-personalizado .detalle-row {
          display: flex;
          justify-content: space-between;
          padding: 10px 0;
          border-bottom: 1px solid ${colorPrincipal}20;
        }
        
        .comprobante-personalizado .detalle-row:last-child {
          border-bottom: none;
        }
        
        .comprobante-personalizado .detalle-label {
          font-size: 14px;
          color: #374151;
          font-weight: 500;
        }
        
        .comprobante-personalizado .detalle-value {
          font-size: 14px;
          color: #111827;
          font-weight: 700;
        }
        
        .comprobante-personalizado .monto-total {
          background: ${colorPrincipal};
          color: white;
          padding: 15px 25px;
          border-radius: 8px;
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-top: 15px;
          font-size: 18px;
          font-weight: 700;
        }
        
        .comprobante-personalizado .plan-pagos-summary {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 15px;
          background: #f9fafb;
          padding: 20px;
          border-radius: 8px;
          margin: 20px 0;
          text-align: center;
        }
        
        .comprobante-personalizado .plan-item {
          padding: 10px;
        }
        
        .comprobante-personalizado .plan-item-label {
          font-size: 11px;
          color: #6b7280;
          text-transform: uppercase;
          font-weight: 600;
          margin-bottom: 6px;
        }
        
        .comprobante-personalizado .plan-item-value {
          font-size: 18px;
          color: #111827;
          font-weight: 700;
        }
        
        .comprobante-personalizado .tabla-cuotas {
          width: 100%;
          border-collapse: collapse;
          margin-top: 20px;
          box-shadow: 0 2px 8px rgba(0,0,0,0.08);
          border-radius: 8px;
          overflow: hidden;
        }
        
        .comprobante-personalizado .tabla-cuotas thead {
          background: ${colorPrincipal};
          color: white;
        }
        
        .comprobante-personalizado .tabla-cuotas th {
          padding: 14px 16px;
          text-align: left;
          font-size: 13px;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.5px;
        }
        
        .comprobante-personalizado .tabla-cuotas tbody tr {
          border-bottom: 1px solid #e5e7eb;
          transition: background 0.2s;
        }
        
        .comprobante-personalizado .tabla-cuotas tbody tr:hover {
          background: ${colorSecundario};
        }
        
        .comprobante-personalizado .tabla-cuotas tbody tr:last-child {
          border-bottom: none;
        }
        
        .comprobante-personalizado .tabla-cuotas td {
          padding: 12px 16px;
          font-size: 13px;
        }
        
        .comprobante-personalizado .tabla-cuotas tfoot {
          background: #f3f4f6;
          font-weight: 700;
        }
        
        .comprobante-personalizado .tabla-cuotas tfoot td {
          padding: 14px 16px;
          font-size: 14px;
        }
        
        .comprobante-personalizado .badge {
          display: inline-block;
          padding: 4px 12px;
          border-radius: 12px;
          font-size: 11px;
          font-weight: 600;
          text-transform: uppercase;
        }
        
        .comprobante-personalizado .badge-pendiente {
          background: #fef3c7;
          color: #92400e;
        }
        
        .comprobante-personalizado .terminos {
          background: #fef9f3;
          border: 1px solid #fbbf24;
          border-radius: 8px;
          padding: 20px;
          margin-top: 30px;
        }
        
        .comprobante-personalizado .terminos-titulo {
          font-size: 13px;
          font-weight: 700;
          color: #92400e;
          margin-bottom: 12px;
          text-transform: uppercase;
        }
        
        .comprobante-personalizado .terminos ul {
          list-style: none;
          padding-left: 0;
        }
        
        .comprobante-personalizado .terminos li {
          font-size: 12px;
          color: #78350f;
          margin-bottom: 8px;
          padding-left: 20px;
          position: relative;
        }
        
        .comprobante-personalizado .terminos li:before {
          content: "•";
          position: absolute;
          left: 8px;
          font-weight: bold;
        }
        
        .comprobante-personalizado .firmas {
          display: grid;
          grid-template-columns: repeat(2, 1fr);
          gap: 60px;
          margin-top: 50px;
          padding-top: 30px;
        }
        
        .comprobante-personalizado .firma-box {
          text-align: center;
        }
        
        .comprobante-personalizado .firma-linea {
          border-top: 2px solid #111827;
          margin: 60px 20px 12px 20px;
        }
        
        .comprobante-personalizado .firma-label {
          font-weight: 700;
          color: #111827;
          font-size: 14px;
          margin-bottom: 4px;
        }
        
        .comprobante-personalizado .firma-nombre {
          font-size: 12px;
          color: #6b7280;
        }
        
        .comprobante-personalizado .footer {
          text-align: center;
          padding: 20px;
          background: #f9fafb;
          border-top: 2px solid #e5e7eb;
          margin-top: 30px;
        }
        
        .comprobante-personalizado .footer-text {
          font-size: 11px;
          color: #6b7280;
        }
      `}</style>

      <div className="bg-white rounded-xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto comprobante-personalizado">
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
            onClick={onCerrar}
            className="text-white hover:bg-white/20 p-2 rounded-full transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Botones de acción */}
        <div className="flex gap-3 p-4 bg-gray-50 border-b print:hidden">
          <button
            onClick={handleImprimir}
            className="flex items-center gap-2 px-4 py-2 bg-gray-700 text-white rounded-lg hover:bg-gray-800 transition-colors"
          >
            <Printer className="w-4 h-4" />
            Imprimir
          </button>
          <button
            onClick={handleDescargar}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            <Download className="w-4 h-4" />
            Descargar PDF
          </button>
        </div>

        {/* Contenido del comprobante */}
        <div id="comprobante-contenido" className="comprobante-wrapper">
          {/* Encabezado del comprobante */}
          <div className="header-banner">
            <h1>COMPROBANTE DE {tipo === 'venta' ? 'VENTA' : 'PRÉSTAMO'}</h1>
            {transaccion.numeroFactura && (
              <div className="numero">N° {transaccion.numeroFactura}</div>
            )}
            <div className="fecha">
              Fecha de emisión: {formatearFecha(transaccion.fecha)}
            </div>
          </div>

          <div className="contenido">
            {/* Información del cliente */}
            <div className="seccion">
              <h3 className="seccion-titulo">Datos del Cliente</h3>
              <div className="info-box">
                <div className="info-grid">
                  <div className="info-item">
                    <div className="info-label">Nombre Completo</div>
                    <div className="info-value">{cliente.nombre} {cliente.apellido}</div>
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
                    <span className="detalle-value" style={{ textAlign: 'right', maxWidth: '400px' }}>
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
                  <div className="plan-item-value" style={{ textTransform: 'capitalize' }}>
                    {transaccion.tipoPago}
                  </div>
                </div>
                <div className="plan-item">
                  <div className="plan-item-label">Número de Cuotas</div>
                  <div className="plan-item-value">{transaccion.numeroCuotas}</div>
                </div>
                <div className="plan-item">
                  <div className="plan-item-label">Valor por Cuota</div>
                  <div className="plan-item-value" style={{ color: tipo === 'venta' ? '#2563eb' : '#059669' }}>
                    {formatearMoneda(transaccion.montoCuota)}
                  </div>
                </div>
              </div>

              {/* Tabla de cuotas */}
              <table className="tabla-cuotas">
                <thead>
                  <tr>
                    <th>N° Cuota</th>
                    <th>Fecha de Vencimiento</th>
                    <th style={{ textAlign: 'right' }}>Monto</th>
                    <th style={{ textAlign: 'center' }}>Estado</th>
                  </tr>
                </thead>
                <tbody>
                  {cuotas.map((cuota) => (
                    <tr key={cuota.numero}>
                      <td style={{ fontWeight: '600' }}>Cuota #{cuota.numero}</td>
                      <td>{formatearFecha(cuota.fechaVencimiento)}</td>
                      <td style={{ textAlign: 'right', fontWeight: '700' }}>
                        {formatearMoneda(cuota.monto)}
                      </td>
                      <td style={{ textAlign: 'center' }}>
                        <span className="badge badge-pendiente">Pendiente</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr>
                    <td colSpan={2} style={{ textAlign: 'right' }}>TOTAL:</td>
                    <td style={{ textAlign: 'right', color: tipo === 'venta' ? '#2563eb' : '#059669' }}>
                      {formatearMoneda(transaccion.montoTotal)}
                    </td>
                    <td></td>
                  </tr>
                </tfoot>
              </table>
            </div>

            {/* Términos y condiciones */}
            <div className="terminos">
              <div className="terminos-titulo">Términos y Condiciones</div>
              <ul>
                <li>El cliente se compromete a pagar cada cuota en la fecha indicada.</li>
                <li>Los pagos realizados fuera de fecha pueden generar intereses adicionales.</li>
                <li>Este comprobante es un documento válido para ambas partes.</li>
                <li>Conservar este comprobante como respaldo de la operación.</li>
              </ul>
            </div>

            {/* Firmas */}
            <div className="firmas">
              <div className="firma-box">
                <div className="firma-linea"></div>
                <div className="firma-label">Firma del Cliente</div>
                <div className="firma-nombre">{cliente.nombre} {cliente.apellido}</div>
              </div>
              <div className="firma-box">
                <div className="firma-linea"></div>
                <div className="firma-label">Firma del Vendedor</div>
                <div className="firma-nombre">Autorizado</div>
              </div>
            </div>

            {/* Footer */}
            <div className="footer">
              <div className="footer-text">
                Este documento ha sido generado electrónicamente • Sistema de Cobranzas
              </div>
            </div>
          </div>
        </div>

        {/* Footer con botón de cerrar */}
        <div className="p-4 bg-gray-50 border-t flex justify-end print:hidden">
          <button
            onClick={onCerrar}
            className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
          >
            Cerrar Comprobante
          </button>
        </div>
      </div>
    </div>
  )
}