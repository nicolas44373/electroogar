import { Cliente, Transaccion, Pago } from '@/app/lib/types/cobranzas'
import { FileText, Download, Phone } from 'lucide-react'

interface ExportadorPDFClienteProps {
  cliente: Cliente
  transacciones: Transaccion[]
  pagos: { [key: string]: Pago[] }
}

export default function ExportadorPDFCliente({ 
  cliente, 
  transacciones, 
  pagos 
}: ExportadorPDFClienteProps) {
  
  const formatearFecha = (fecha: string) => {
    const [year, month, day] = fecha.split('-').map(Number)
    const fechaObj = new Date(year, month - 1, day)
    return fechaObj.toLocaleDateString('es-AR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    })
  }

  const formatearMoneda = (monto: number) => {
    return new Intl.NumberFormat('es-AR', {
      style: 'currency',
      currency: 'ARS'
    }).format(monto)
  }

  const calcularDiasVencimiento = (fechaVencimiento: string) => {
    const hoy = new Date()
    hoy.setHours(0, 0, 0, 0)
    
    const [year, month, day] = fechaVencimiento.split('-').map(Number)
    const vencimiento = new Date(year, month - 1, day)
    vencimiento.setHours(0, 0, 0, 0)
    
    return Math.floor((vencimiento.getTime() - hoy.getTime()) / (1000 * 60 * 60 * 24))
  }

  const obtenerTituloTransaccion = (transaccion: Transaccion) => {
    if (transaccion.tipo_transaccion === 'prestamo') return 'Préstamo de Dinero'
    return transaccion.producto?.nombre || 'Venta de Producto'
  }

  const calcularTotales = () => {
    let totalDeuda = 0
    let totalPagado = 0
    let cuotasVencidas = 0
    let cuotasPendientes = 0
    let cuotasPagadas = 0

    transacciones.forEach(transaccion => {
      const pagosTrans = pagos[transaccion.id] || []
      pagosTrans.forEach(pago => {
        const montoCuota = (pago.monto_cuota || transaccion.monto_cuota) + (pago.intereses_mora || 0)
        const montoRestante = montoCuota - pago.monto_pagado
        
        if (pago.estado === 'pagado') {
          cuotasPagadas++
          totalPagado += pago.monto_pagado
        } else {
          totalDeuda += montoRestante
          cuotasPendientes++
          
          const diasVencimiento = calcularDiasVencimiento(pago.fecha_vencimiento)
          if (diasVencimiento < 0) {
            cuotasVencidas++
          }
        }
      })
    })

    return { totalDeuda, totalPagado, cuotasVencidas, cuotasPendientes, cuotasPagadas }
  }

  const generarHTML = () => {
    const totales = calcularTotales()
    const fechaActual = new Date().toLocaleDateString('es-AR', {
      day: '2-digit',
      month: 'long',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })

    return `
<!DOCTYPE html>
<html lang="es">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Estado de Cuenta - ${cliente.nombre} ${cliente.apellido}</title>
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }
        
        body {
            font-family: 'Arial', sans-serif;
            font-size: 12px;
            line-height: 1.6;
            color: #333;
            padding: 20px;
        }
        
        .header {
            text-align: center;
            margin-bottom: 30px;
            padding-bottom: 20px;
            border-bottom: 3px solid #2563eb;
        }
        
        .header h1 {
            color: #1e40af;
            font-size: 24px;
            margin-bottom: 10px;
        }
        
        .header p {
            color: #64748b;
            font-size: 11px;
        }
        
        .info-cliente {
            background: #f8fafc;
            padding: 15px;
            border-radius: 8px;
            margin-bottom: 25px;
            border-left: 4px solid #2563eb;
        }
        
        .info-cliente h2 {
            color: #1e40af;
            font-size: 16px;
            margin-bottom: 10px;
        }
        
        .info-row {
            display: flex;
            padding: 5px 0;
        }
        
        .info-label {
            font-weight: bold;
            width: 150px;
            color: #475569;
        }
        
        .info-value {
            color: #1e293b;
        }
        
        .resumen-general {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            padding: 20px;
            border-radius: 8px;
            margin-bottom: 25px;
        }
        
        .resumen-general h2 {
            font-size: 18px;
            margin-bottom: 15px;
            text-align: center;
        }
        
        .stats-grid {
            display: grid;
            grid-template-columns: repeat(2, 1fr);
            gap: 15px;
        }
        
        .stat-box {
            background: rgba(255, 255, 255, 0.15);
            padding: 12px;
            border-radius: 6px;
            backdrop-filter: blur(10px);
        }
        
        .stat-label {
            font-size: 11px;
            opacity: 0.9;
            margin-bottom: 5px;
        }
        
        .stat-value {
            font-size: 20px;
            font-weight: bold;
        }
        
        .transaccion {
            margin-bottom: 30px;
            page-break-inside: avoid;
        }
        
        .transaccion-header {
            background: linear-gradient(to right, #f1f5f9, #ffffff);
            padding: 15px;
            border-radius: 8px 8px 0 0;
            border-left: 4px solid #8b5cf6;
        }
        
        .transaccion-title {
            font-size: 16px;
            font-weight: bold;
            color: #1e293b;
            margin-bottom: 8px;
        }
        
        .transaccion-info {
            display: grid;
            grid-template-columns: repeat(3, 1fr);
            gap: 10px;
            font-size: 11px;
        }
        
        .transaccion-info-item {
            color: #64748b;
        }
        
        .transaccion-info-item strong {
            color: #1e293b;
        }
        
        table {
            width: 100%;
            border-collapse: collapse;
            margin-top: 0;
            background: white;
        }
        
        thead {
            background: #f1f5f9;
        }
        
        th {
            padding: 10px 8px;
            text-align: left;
            font-size: 11px;
            font-weight: 600;
            color: #475569;
            border-bottom: 2px solid #cbd5e1;
        }
        
        td {
            padding: 10px 8px;
            border-bottom: 1px solid #e2e8f0;
            font-size: 11px;
        }
        
        tr:hover {
            background: #f8fafc;
        }
        
        .badge {
            display: inline-block;
            padding: 3px 8px;
            border-radius: 12px;
            font-size: 10px;
            font-weight: 600;
        }
        
        .badge-pagado {
            background: #dcfce7;
            color: #166534;
        }
        
        .badge-pendiente {
            background: #fef3c7;
            color: #854d0e;
        }
        
        .badge-vencido {
            background: #fee2e2;
            color: #991b1b;
        }
        
        .badge-reprogramado {
            background: #dbeafe;
            color: #1e40af;
        }
        
        .alert {
            background: #fef2f2;
            border-left: 4px solid #dc2626;
            padding: 12px;
            margin: 8px 0;
            border-radius: 4px;
            font-size: 11px;
        }
        
        .alert-warning {
            background: #fefce8;
            border-left-color: #eab308;
        }
        
        .footer {
            margin-top: 40px;
            padding-top: 20px;
            border-top: 2px solid #e2e8f0;
            text-align: center;
            font-size: 11px;
            color: #64748b;
        }
        
        .monto-destacado {
            font-weight: bold;
            color: #1e40af;
        }
        
        .monto-rojo {
            font-weight: bold;
            color: #dc2626;
        }
        
        .monto-verde {
            font-weight: bold;
            color: #16a34a;
        }
        
        @media print {
            body {
                padding: 10px;
            }
            
            .transaccion {
                page-break-inside: avoid;
            }
        }
    </style>
</head>
<body>
    <div class="header">
        <h1>📊 ESTADO DE CUENTA</h1>
        <p>Generado el ${fechaActual}</p>
    </div>
    
    <div class="info-cliente">
        <h2>👤 Información del Cliente</h2>
        <div class="info-row">
            <span class="info-label">Nombre:</span>
            <span class="info-value">${cliente.nombre} ${cliente.apellido}</span>
        </div>
        <div class="info-row">
            <span class="info-label">Documento:</span>
            <span class="info-value">${cliente.documento}</span>
        </div>
        ${cliente.telefono ? `
        <div class="info-row">
            <span class="info-label">Teléfono:</span>
            <span class="info-value">${cliente.telefono}</span>
        </div>
        ` : ''}
        ${cliente.email ? `
        <div class="info-row">
            <span class="info-label">Email:</span>
            <span class="info-value">${cliente.email}</span>
        </div>
        ` : ''}
    </div>
    
    <div class="resumen-general">
        <h2>📈 Resumen General de la Cuenta</h2>
        <div class="stats-grid">
            <div class="stat-box">
                <div class="stat-label">Total Adeudado</div>
                <div class="stat-value">${formatearMoneda(totales.totalDeuda)}</div>
            </div>
            <div class="stat-box">
                <div class="stat-label">Total Pagado</div>
                <div class="stat-value">${formatearMoneda(totales.totalPagado)}</div>
            </div>
            <div class="stat-box">
                <div class="stat-label">Cuotas Vencidas</div>
                <div class="stat-value">${totales.cuotasVencidas}</div>
            </div>
            <div class="stat-box">
                <div class="stat-label">Cuotas Pendientes</div>
                <div class="stat-value">${totales.cuotasPendientes}</div>
            </div>
        </div>
    </div>
    
    ${totales.cuotasVencidas > 0 ? `
    <div class="alert">
        <strong>⚠️ ATENCIÓN:</strong> Tienes ${totales.cuotasVencidas} cuota(s) vencida(s). 
        Por favor, comunícate con nosotros para regularizar tu situación.
    </div>
    ` : ''}
    
    ${transacciones.map(transaccion => {
      const pagosTrans = pagos[transaccion.id] || []
      const totalTransaccion = pagosTrans.reduce((sum, p) => {
        const montoCuota = (p.monto_cuota || transaccion.monto_cuota) + (p.intereses_mora || 0)
        return sum + (p.estado === 'pagado' ? 0 : montoCuota - p.monto_pagado)
      }, 0)
      
      const cuotasPagadasTrans = pagosTrans.filter(p => p.estado === 'pagado').length
      const progreso = (cuotasPagadasTrans / transaccion.numero_cuotas) * 100
      
      return `
    <div class="transaccion">
        <div class="transaccion-header">
            <div class="transaccion-title">
                ${transaccion.tipo_transaccion === 'venta' ? '🛒' : '💰'} 
                ${obtenerTituloTransaccion(transaccion)}
            </div>
            <div class="transaccion-info">
                <div class="transaccion-info-item">
                    <strong>Monto Total:</strong> ${formatearMoneda(transaccion.monto_total)}
                </div>
                <div class="transaccion-info-item">
                    <strong>Plan de Pago:</strong> ${transaccion.tipo_pago}
                </div>
                <div class="transaccion-info-item">
                    <strong>Fecha Inicio:</strong> ${formatearFecha(transaccion.fecha_inicio)}
                </div>
                <div class="transaccion-info-item">
                    <strong>Cuotas:</strong> ${transaccion.numero_cuotas}
                </div>
                <div class="transaccion-info-item">
                    <strong>Valor Cuota:</strong> ${formatearMoneda(transaccion.monto_cuota)}
                </div>
                <div class="transaccion-info-item">
                    <strong>Progreso:</strong> ${cuotasPagadasTrans}/${transaccion.numero_cuotas} (${progreso.toFixed(0)}%)
                </div>
            </div>
            ${totalTransaccion > 0 ? `
            <div style="margin-top: 10px; padding: 8px; background: rgba(220, 38, 38, 0.1); border-radius: 4px;">
                <strong style="color: #dc2626;">Saldo Pendiente de esta Deuda:</strong> 
                <span style="color: #dc2626; font-size: 16px; font-weight: bold;">${formatearMoneda(totalTransaccion)}</span>
            </div>
            ` : ''}
        </div>
        
        <table>
            <thead>
                <tr>
                    <th>Cuota</th>
                    <th>Vencimiento</th>
                    <th>Monto Total</th>
                    <th>Pagado</th>
                    <th>Restante</th>
                    <th>Estado</th>
                    <th>Días</th>
                </tr>
            </thead>
            <tbody>
                ${pagosTrans.map(pago => {
                  const diasVencimiento = calcularDiasVencimiento(pago.fecha_vencimiento)
                  const estaVencido = diasVencimiento < 0 && pago.estado !== 'pagado'
                  const montoCuota = (pago.monto_cuota || transaccion.monto_cuota) + (pago.intereses_mora || 0)
                  const montoRestante = montoCuota - pago.monto_pagado
                  
                  let estadoTexto = ''
                  let estadoClass = ''
                  
                  if (pago.estado === 'pagado') {
                    estadoTexto = 'Pagado'
                    estadoClass = 'badge-pagado'
                  } else if (pago.estado === 'reprogramado') {
                    estadoTexto = 'Reprogramado'
                    estadoClass = 'badge-reprogramado'
                  } else if (estaVencido) {
                    estadoTexto = 'Vencido'
                    estadoClass = 'badge-vencido'
                  } else {
                    estadoTexto = 'Pendiente'
                    estadoClass = 'badge-pendiente'
                  }
                  
                  let diasTexto = ''
                  if (pago.estado !== 'pagado') {
                    if (estaVencido) {
                      diasTexto = `<span style="color: #dc2626;">Vencido hace ${Math.abs(diasVencimiento)} días</span>`
                    } else if (diasVencimiento === 0) {
                      diasTexto = '<span style="color: #ea580c;">Vence hoy</span>'
                    } else if (diasVencimiento <= 7) {
                      diasTexto = `<span style="color: #ca8a04;">En ${diasVencimiento} días</span>`
                    } else {
                      diasTexto = `En ${diasVencimiento} días`
                    }
                  } else {
                    diasTexto = '✓'
                  }
                  
                  return `
                <tr style="${estaVencido ? 'background: #fef2f2;' : ''}">
                    <td><strong>#${pago.numero_cuota}</strong></td>
                    <td>
                        ${formatearFecha(pago.fecha_vencimiento)}
                        ${pago.fecha_reprogramacion ? `<br><span style="font-size: 10px; color: #2563eb;">Reprog: ${formatearFecha(pago.fecha_reprogramacion)}</span>` : ''}
                    </td>
                    <td class="monto-destacado">
                        ${formatearMoneda(montoCuota)}
                        ${(pago.intereses_mora || 0) > 0 ? `<br><span style="font-size: 10px; color: #dc2626;">(+ ${formatearMoneda(pago.intereses_mora || 0)} mora)</span>` : ''}
                    </td>
                    <td class="monto-verde">
                        ${formatearMoneda(pago.monto_pagado)}
                        ${pago.fecha_pago ? `<br><span style="font-size: 10px; color: #64748b;">${formatearFecha(pago.fecha_pago)}</span>` : ''}
                    </td>
                    <td class="${montoRestante > 0 ? 'monto-rojo' : 'monto-verde'}">
                        ${formatearMoneda(montoRestante)}
                    </td>
                    <td>
                        <span class="badge ${estadoClass}">${estadoTexto}</span>
                    </td>
                    <td>${diasTexto}</td>
                </tr>
                  `
                }).join('')}
            </tbody>
        </table>
    </div>
      `
    }).join('')}
    
    <div class="footer">
        <p><strong>Estado de Cuenta Generado Automáticamente</strong></p>
        <p>Este documento es un resumen de tu cuenta. Para consultas o aclaraciones, contáctanos.</p>
        <p style="margin-top: 10px; font-size: 10px;">
            Fecha de generación: ${fechaActual}
        </p>
    </div>
</body>
</html>
    `
  }

  const descargarPDF = () => {
    const html = generarHTML()
    
    // Crear un blob con el HTML
    const blob = new Blob([html], { type: 'text/html' })
    const url = URL.createObjectURL(blob)
    
    // Crear un enlace temporal para descargar
    const link = document.createElement('a')
    link.href = url
    link.download = `Estado_Cuenta_${cliente.nombre}_${cliente.apellido}_${new Date().toISOString().split('T')[0]}.html`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    
    // Limpiar el objeto URL
    setTimeout(() => URL.revokeObjectURL(url), 100)
    
    // Mostrar mensaje de ayuda
    setTimeout(() => {
      alert('📄 Archivo descargado!\n\nPara convertirlo a PDF:\n1. Abre el archivo HTML descargado\n2. Presiona Ctrl+P (o Cmd+P en Mac)\n3. Selecciona "Guardar como PDF"\n4. Guarda el PDF')
    }, 300)
  }

  const enviarPorWhatsApp = () => {
    const html = generarHTML()
    
    // Crear un blob con el HTML
    const blob = new Blob([html], { type: 'text/html' })
    const url = URL.createObjectURL(blob)
    
    // Crear un enlace temporal para descargar
    const link = document.createElement('a')
    link.href = url
    link.download = `Estado_Cuenta_${cliente.nombre}_${cliente.apellido}_${new Date().toISOString().split('T')[0]}.html`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    
    // Limpiar el objeto URL
    setTimeout(() => URL.revokeObjectURL(url), 100)
    
    // Abrir WhatsApp con mensaje
    const nombreCompleto = `${cliente.nombre} ${cliente.apellido}`.trim()
    const mensaje = `Hola ${nombreCompleto}, te envío tu estado de cuenta. Por favor revísalo y cualquier consulta no dudes en contactarme.`
    
    const telefono = cliente.telefono || ''
    const urlWhatsApp = `https://wa.me/${telefono.replace(/[^\d]/g, '')}?text=${encodeURIComponent(mensaje)}`
    
    // Abrir WhatsApp después de un delay
    setTimeout(() => {
      window.open(urlWhatsApp, '_blank')
      
      // Mostrar instrucciones
      setTimeout(() => {
        alert('📱 WhatsApp abierto!\n\nPasos siguientes:\n1. Abre el archivo HTML descargado\n2. Presiona Ctrl+P y guarda como PDF\n3. Regresa a WhatsApp y adjunta el PDF\n4. Envía el mensaje')
      }, 500)
    }, 800)
  }

  if (!transacciones || transacciones.length === 0) {
    return null
  }

  return (
    <div className="bg-white p-4 rounded-lg shadow mb-4">
      <h3 className="font-semibold mb-3 flex items-center gap-2">
        <FileText className="w-5 h-5" />
        Exportar Estado de Cuenta
      </h3>
      
      <div className="flex flex-wrap gap-3">
        <button
          onClick={descargarPDF}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          <Download className="w-4 h-4" />
          Descargar PDF
        </button>
        
        {cliente.telefono && (
          <button
            onClick={enviarPorWhatsApp}
            className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
          >
            <Phone className="w-4 h-4" />
            Enviar por WhatsApp
          </button>
        )}
      </div>
      
      <p className="text-xs text-gray-500 mt-3">
        💡 Se descargará un archivo HTML con el estado de cuenta. Para convertirlo a PDF, ábrelo y usa Ctrl+P (Cmd+P en Mac) → "Guardar como PDF".
        {cliente.telefono && ' El botón de WhatsApp descarga el archivo y abre WhatsApp para que lo adjuntes.'}
      </p>
    </div>
  )
}