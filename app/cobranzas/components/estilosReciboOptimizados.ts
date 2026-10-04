// Estilos CSS optimizados para recibos - Insertar en el componente GeneradorRecibos

const estilosReciboOptimizados = `
  .recibo-optimizado {
    font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
    line-height: 1.4;
    color: #1E293B;
    font-size: 12px;
  }

  .recibo-optimizado .contenedor-recibo {
    background: white;
    padding: 15mm 12mm;
    max-width: 210mm;
    margin: 0 auto;
  }

  /* ===== ENCABEZADO ===== */
  .recibo-optimizado .encabezado-recibo {
    text-align: center;
    margin-bottom: 15px;
    padding-bottom: 12px;
    border-bottom: 2px solid #E2E8F0;
  }

  .recibo-optimizado .titulo-recibo {
    font-size: 20px;
    font-weight: 700;
    color: #1E293B;
    margin-bottom: 6px;
    text-transform: uppercase;
    letter-spacing: 0.5px;
  }

  .recibo-optimizado .numero-recibo {
    font-size: 14px;
    font-weight: 600;
    color: #0F4C81;
    margin-bottom: 4px;
  }

  /* ===== DATOS DEL COMERCIO ===== */
  .recibo-optimizado .datos-comercio {
    background: #F5F7FA;
    border-radius: 6px;
    padding: 12px 15px;
    margin-bottom: 15px;
  }

  .recibo-optimizado .titulo-seccion {
    font-size: 11px;
    font-weight: 700;
    color: #334155;
    margin-bottom: 8px;
    text-transform: uppercase;
    letter-spacing: 0.3px;
  }

  .recibo-optimizado .info-comercio {
    font-size: 10px;
    color: #64748B;
    line-height: 1.5;
  }

  .recibo-optimizado .info-comercio div {
    margin-bottom: 3px;
  }

  /* ===== GRID DE DATOS ===== */
  .recibo-optimizado .grid-datos {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: 15px;
    margin-bottom: 15px;
  }

  .recibo-optimizado .bloque-info {
    background: white;
    border: 1px solid #E2E8F0;
    border-radius: 6px;
    padding: 12px;
  }

  .recibo-optimizado .item-info {
    margin-bottom: 6px;
    font-size: 10px;
  }

  .recibo-optimizado .item-info:last-child {
    margin-bottom: 0;
  }

  .recibo-optimizado .label-info {
    font-weight: 600;
    color: #334155;
  }

  .recibo-optimizado .valor-info {
    color: #1E293B;
  }

  /* ===== TABLA DE DETALLE ===== */
  .recibo-optimizado .tabla-detalle {
    width: 100%;
    border-collapse: collapse;
    margin: 15px 0;
    border: 1px solid #E2E8F0;
    border-radius: 6px;
    overflow: hidden;
  }

  .recibo-optimizado .tabla-detalle thead {
    background: #F5F7FA;
  }

  .recibo-optimizado .tabla-detalle th {
    padding: 8px 10px;
    text-align: left;
    font-size: 10px;
    font-weight: 700;
    color: #334155;
    text-transform: uppercase;
    border-bottom: 2px solid #E2E8F0;
  }

  .recibo-optimizado .tabla-detalle td {
    padding: 10px;
    font-size: 10px;
    border-bottom: 1px solid #F5F7FA;
  }

  .recibo-optimizado .tabla-detalle tbody tr:last-child td {
    border-bottom: none;
  }

  .recibo-optimizado .descripcion-concepto {
    font-size: 9px;
    color: #64748B;
    margin-top: 3px;
  }

  /* ===== ALERTA DE PAGO PARCIAL ===== */
  .recibo-optimizado .alerta-parcial {
    background: #fffbeb;
    border: 1px solid #D97706;
    border-left: 4px solid #D97706;
    border-radius: 6px;
    padding: 12px;
    margin: 15px 0;
  }

  .recibo-optimizado .alerta-parcial-header {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-bottom: 8px;
  }

  .recibo-optimizado .alerta-parcial-titulo {
    font-size: 11px;
    font-weight: 700;
    color: #92400e;
  }

  .recibo-optimizado .alerta-parcial-contenido {
    font-size: 10px;
    color: #78350f;
    line-height: 1.5;
  }

  .recibo-optimizado .alerta-parcial-contenido p {
    margin: 4px 0;
  }

  /* ===== TOTAL ===== */
  .recibo-optimizado .contenedor-total {
    display: flex;
    justify-content: flex-end;
    margin: 15px 0;
  }

  .recibo-optimizado .caja-total {
    background: #DBEAFE;
    border: 2px solid #0F4C81;
    border-radius: 6px;
    padding: 12px 18px;
    min-width: 200px;
    text-align: right;
  }

  .recibo-optimizado .caja-total.parcial {
    background: #fef3c7;
    border-color: #D97706;
  }

  .recibo-optimizado .label-total {
    font-size: 10px;
    color: #64748B;
    margin-bottom: 4px;
  }

  .recibo-optimizado .monto-total {
    font-size: 20px;
    font-weight: 700;
    color: #0F4C81;
  }

  .recibo-optimizado .caja-total.parcial .monto-total {
    color: #d97706;
  }

  .recibo-optimizado .estado-pago {
    font-size: 9px;
    color: #64748B;
    margin-top: 4px;
  }

  .recibo-optimizado .estado-pago span {
    font-weight: 600;
    color: #d97706;
  }

  /* ===== OBSERVACIONES ===== */
  .recibo-optimizado .observaciones {
    background: #F5F7FA;
    border: 1px solid #E2E8F0;
    border-radius: 6px;
    padding: 12px;
    margin: 15px 0;
  }

  .recibo-optimizado .observaciones-texto {
    font-size: 10px;
    color: #64748B;
    line-height: 1.5;
    word-wrap: break-word;
  }

  /* ===== FOOTER ===== */
  .recibo-optimizado .footer-recibo {
    text-align: center;
    margin-top: 20px;
    padding-top: 12px;
    border-top: 1px solid #E2E8F0;
  }

  .recibo-optimizado .footer-texto {
    font-size: 9px;
    color: #94A3B8;
    line-height: 1.4;
  }

  /* ===== PRINT STYLES ===== */
  @media print {
    body {
      margin: 0;
      padding: 0;
      background: white;
    }

    .recibo-optimizado .contenedor-recibo {
      max-width: 100%;
      padding: 10mm 8mm;
    }

    .recibo-optimizado .encabezado-recibo,
    .recibo-optimizado .datos-comercio,
    .recibo-optimizado .grid-datos,
    .recibo-optimizado .tabla-detalle,
    .recibo-optimizado .alerta-parcial,
    .recibo-optimizado .contenedor-total,
    .recibo-optimizado .observaciones,
    .recibo-optimizado .footer-recibo {
      page-break-inside: avoid;
    }

    @page {
      size: A4;
      margin: 10mm;
    }
  }

  /* ===== RESPONSIVE ===== */
  @media (max-width: 640px) {
    .recibo-optimizado .contenedor-recibo {
      padding: 15px;
    }

    .recibo-optimizado .grid-datos {
      grid-template-columns: 1fr;
      gap: 10px;
    }

    .recibo-optimizado .tabla-detalle th,
    .recibo-optimizado .tabla-detalle td {
      padding: 6px 8px;
      font-size: 9px;
    }
  }
`

export default estilosReciboOptimizados