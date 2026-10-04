import { useState } from 'react'
import { supabase } from '@/app/lib/supabase'
import { fechaLocalISO } from '@/app/lib/fechas'
import { Producto } from '@/app/lib/types/cobranzas'
import ComprobanteTransaccion from './Comprobantetransaccion'
import ComprobanteCompra from './ComprobanteCompra'
import {
  X,
  AlertCircle,
  ShoppingCart,
  Banknote,
  FilePlus2,
  Receipt,
  Info,
  CheckCircle2,
  Check,
} from 'lucide-react'

// Solo presentación: muestra un número (o texto numérico) como $ 1.234,56
const mostrarPesos = (valor: string | number | undefined) =>
  new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', minimumFractionDigits: 2 }).format(
    Number(valor) || 0
  )

interface ToastMsg { tipo: 'error' | 'success'; texto: string }

interface FormularioVentaProps {
  clienteId: string
  productos: Producto[]
  onVentaCreada: () => void
  onCancelar: () => void
}

export default function FormularioVenta({
  clienteId,
  productos,
  onVentaCreada,
  onCancelar,
}: FormularioVentaProps) {
  const [guardando, setGuardando] = useState(false)
  const [mostrarComprobante, setMostrarComprobante] = useState(false)
  const [vistaComprobante, setVistaComprobante] = useState<'completo' | 'compra'>('completo')
  const [datosComprobante, setDatosComprobante] = useState<any>(null)
  const [errorValidacion, setErrorValidacion] = useState<string>('')

  const mostrarError = (msg: string) => {
    setErrorValidacion(msg)
    setTimeout(() => setErrorValidacion(''), 5000)
  }

  // Estado separado para controlar el tipo de transacción
  const [tipoTransaccion, setTipoTransaccion] = useState<'venta' | 'prestamo' | null>(null)

  const [formVenta, setFormVenta] = useState({
    producto_id: '',
    monto_total: '',
    tipo_pago: 'semanal' as const,
    numero_cuotas: '',
    descripcion: '',
    fecha_inicio: (() => {
      const now = new Date()
      const year = now.getFullYear()
      const month = String(now.getMonth() + 1).padStart(2, '0')
      const day = String(now.getDate()).padStart(2, '0')
      return `${year}-${month}-${day}`
    })(),
  })

  // Estado para intereses (ahora disponible para ambos tipos)
  const [interes, setInteres] = useState('')

  // Calcular monto de cuota en tiempo real (incluyendo intereses)
  const calcularMontoCuota = () => {
    if (!formVenta.monto_total || !formVenta.numero_cuotas) return '0.00'

    let montoBase = parseFloat(formVenta.monto_total)

    // Aplicar interés si está definido (para ambos tipos)
    if (interes) {
      const porcentajeInteres = parseFloat(interes) / 100
      montoBase = montoBase + montoBase * porcentajeInteres
    }

    return (montoBase / parseInt(formVenta.numero_cuotas)).toFixed(2)
  }

  const montoCuota = calcularMontoCuota()

  const handleInputChange = (field: keyof typeof formVenta, value: string) => {
    setFormVenta((prev) => ({ ...prev, [field]: value }))
  }

  const validarFormulario = (): boolean => {
    if (!tipoTransaccion) {
      mostrarError('Seleccione si es venta o préstamo')
      return false
    }
    if (tipoTransaccion === 'venta' && !formVenta.producto_id) {
      mostrarError('Seleccione un producto')
      return false
    }
    if (!formVenta.monto_total || parseFloat(formVenta.monto_total) <= 0) {
      mostrarError('Ingrese un monto válido')
      return false
    }
    if (!formVenta.numero_cuotas || parseInt(formVenta.numero_cuotas) <= 0) {
      mostrarError('Ingrese un número de cuotas válido')
      return false
    }
    return true
  }

  const crearNuevaVenta = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!validarFormulario() || !tipoTransaccion) return

    setGuardando(true)
    try {
      // Guardar monto original
      const montoOriginal = parseFloat(formVenta.monto_total)
      const porcentajeInteres = interes ? parseFloat(interes) : 0
      
      // Calcular monto total con intereses
      let montoTotalFinal = montoOriginal
      if (interes) {
        montoTotalFinal = montoOriginal + montoOriginal * (porcentajeInteres / 100)
      }

      const montoCuotaCalculado = montoTotalFinal / parseInt(formVenta.numero_cuotas)

      // Obtener datos del cliente
      const { data: clienteData } = await supabase
        .from('clientes')
        .select('*')
        .eq('id', clienteId)
        .single()

      if (!clienteData) throw new Error('Cliente no encontrado')

      // Obtener datos del producto si es venta
      let productoNombre = null
      if (tipoTransaccion === 'venta' && formVenta.producto_id) {
        const { data: productoData } = await supabase
          .from('productos')
          .select('nombre')
          .eq('id', formVenta.producto_id)
          .single()
        
        productoNombre = productoData?.nombre
      }

      // Crear transacción - IMPORTANTE: guardar monto_original e interes_porcentaje
      const { data: transData, error: transError } = await supabase
        .from('transacciones')
        .insert({
          cliente_id: clienteId,
          producto_id: tipoTransaccion === 'venta' ? formVenta.producto_id : null,
          tipo_transaccion: tipoTransaccion,
          monto_original: montoOriginal, // ✅ Guardar monto original
          monto_total: montoTotalFinal,
          interes_porcentaje: porcentajeInteres, // ✅ Guardar porcentaje de interés
          tipo_pago: formVenta.tipo_pago,
          numero_cuotas: parseInt(formVenta.numero_cuotas),
          monto_cuota: montoCuotaCalculado,
          descripcion: formVenta.descripcion || null,
          fecha_inicio: formVenta.fecha_inicio,
          estado: 'activo',
        })
        .select()
        .single()

      if (transError) throw transError

      // Crear pagos programados
      if (transData) {
        const pagosACrear: any[] = []
        const cuotasParaComprobante: any[] = []
        // Fecha local (no UTC) para que no se corra un día según la hora
        const [anioInicio, mesInicio, diaInicio] = formVenta.fecha_inicio.split('-').map(Number)
        const fechaInicio = new Date(anioInicio, mesInicio - 1, diaInicio)

        for (let i = 1; i <= parseInt(formVenta.numero_cuotas); i++) {
          const fechaVencimiento = new Date(fechaInicio)

          // La primera cuota vence el mismo día, las siguientes según el tipo de pago
          if (i !== 1) {
            if (formVenta.tipo_pago === 'semanal') {
              fechaVencimiento.setDate(fechaVencimiento.getDate() + 7 * (i - 1))
            } else if (formVenta.tipo_pago === 'quincenal') {
              fechaVencimiento.setDate(fechaVencimiento.getDate() + 15 * (i - 1))
            } else if (formVenta.tipo_pago === 'mensual') {
              // Mantener el mismo día del mes; si el mes es más corto, usar su último día
              // (ej: 31/01 → 28/02, no 03/03)
              const ultimoDia = new Date(anioInicio, mesInicio - 1 + i, 0).getDate()
              fechaVencimiento.setDate(1)
              fechaVencimiento.setMonth(fechaVencimiento.getMonth() + (i - 1))
              fechaVencimiento.setDate(Math.min(diaInicio, ultimoDia))
            }
          }

          const fechaVencimientoStr = fechaLocalISO(fechaVencimiento)

          pagosACrear.push({
            transaccion_id: transData.id,
            numero_cuota: i,
            monto_cuota: montoCuotaCalculado,
            monto_pagado: 0,
            fecha_pago: null,
            fecha_vencimiento: fechaVencimientoStr,
            estado: 'pendiente',
          })

          cuotasParaComprobante.push({
            numero: i,
            monto: montoCuotaCalculado,
            fechaVencimiento: fechaVencimientoStr
          })
        }

        const { error: pagosError } = await supabase.from('pagos').insert(pagosACrear)
        if (pagosError) throw pagosError

        // Preparar datos para el comprobante
        setDatosComprobante({
          tipo: tipoTransaccion,
          cliente: {
            nombre: clienteData.nombre,
            apellido: clienteData.apellido || '',
            telefono: clienteData.telefono,
            email: clienteData.email
          },
          transaccion: {
            numeroFactura: transData.numero_factura,
            fecha: formVenta.fecha_inicio,
            montoOriginal: montoOriginal,
            interes: porcentajeInteres,
            montoTotal: montoTotalFinal,
            numeroCuotas: parseInt(formVenta.numero_cuotas),
            montoCuota: montoCuotaCalculado,
            tipoPago: formVenta.tipo_pago,
            descripcion: formVenta.descripcion,
            productoNombre: productoNombre
          },
          cuotas: cuotasParaComprobante
        })

        // Mostrar comprobante
        setMostrarComprobante(true)
      }
    } catch (error: any) {
      mostrarError('Error al crear la transacción: ' + error.message)
      setGuardando(false)
    }
  }

  const handleCerrarComprobante = () => {
    setMostrarComprobante(false)
    setDatosComprobante(null)
    setGuardando(false)
    onVentaCreada()
  }

  // Si se está mostrando el comprobante, renderizarlo
  if (mostrarComprobante && datosComprobante) {
    return (
      <>
        <div className="fixed top-3 left-1/2 -translate-x-1/2 z-[60] flex gap-1 bg-surface border border-line rounded-lg shadow-e3 p-1 print:hidden" role="tablist" aria-label="Tipo de comprobante">
          <button
            type="button"
            onClick={() => setVistaComprobante('completo')}
            role="tab"
            aria-selected={vistaComprobante === 'completo'}
            className={`min-h-[40px] px-3 rounded-md text-xs font-semibold transition-colors ${
              vistaComprobante === 'completo' ? 'bg-primary text-on-primary' : 'text-muted hover:bg-surface-2'
            }`}
          >
            Con plan de cuotas
          </button>
          <button
            type="button"
            onClick={() => setVistaComprobante('compra')}
            role="tab"
            aria-selected={vistaComprobante === 'compra'}
            className={`min-h-[40px] px-3 rounded-md text-xs font-semibold transition-colors ${
              vistaComprobante === 'compra' ? 'bg-primary text-on-primary' : 'text-muted hover:bg-surface-2'
            }`}
          >
            Comprobante de compra
          </button>
        </div>

        {vistaComprobante === 'completo' ? (
          <ComprobanteTransaccion
            tipo={datosComprobante.tipo}
            cliente={datosComprobante.cliente}
            transaccion={datosComprobante.transaccion}
            cuotas={datosComprobante.cuotas}
            onCerrar={handleCerrarComprobante}
          />
        ) : (
          <ComprobanteCompra
            tipo={datosComprobante.tipo}
            cliente={datosComprobante.cliente}
            transaccion={datosComprobante.transaccion}
            onCerrar={handleCerrarComprobante}
          />
        )}
      </>
    )
  }

  return (
    <div className="card">
      <div className="card-header">
        <h3 className="section-title">
          {!tipoTransaccion && <><FilePlus2 className="w-5 h-5 text-primary" /> Nueva venta o préstamo</>}
          {tipoTransaccion === 'venta' && <><ShoppingCart className="w-5 h-5 text-primary" /> Nueva venta</>}
          {tipoTransaccion === 'prestamo' && <><Banknote className="w-5 h-5 text-primary" /> Nuevo préstamo</>}
        </h3>
        <button
          onClick={onCancelar}
          className="btn-icon"
          aria-label="Cerrar"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      <div className="card-body">
        {errorValidacion && (
          <div className="alert-danger mb-4" role="alert">
            <AlertCircle className="w-5 h-5 flex-shrink-0" />
            <span>{errorValidacion}</span>
          </div>
        )}

        <form onSubmit={crearNuevaVenta} className="space-y-6">
          {/* Primer paso: Seleccionar tipo de transacción */}
          <fieldset>
            <legend className="label">¿Qué vas a registrar?</legend>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setTipoTransaccion('venta')}
                aria-pressed={tipoTransaccion === 'venta'}
                className={`flex items-center gap-3 p-4 min-h-[64px] rounded-xl border-2 text-left transition-colors ${
                  tipoTransaccion === 'venta'
                    ? 'border-primary bg-primary/5'
                    : 'border-line bg-surface hover:border-primary/40'
                }`}
                disabled={guardando}
              >
                <div className={`icon-tile ${tipoTransaccion === 'venta' ? 'bg-primary text-on-primary' : 'bg-surface-2 text-muted'}`}>
                  <ShoppingCart className="w-5 h-5" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-fg">Venta de producto</p>
                  <p className="text-xs text-muted">Electrodoméstico en cuotas</p>
                </div>
              </button>
              <button
                type="button"
                onClick={() => setTipoTransaccion('prestamo')}
                aria-pressed={tipoTransaccion === 'prestamo'}
                className={`flex items-center gap-3 p-4 min-h-[64px] rounded-xl border-2 text-left transition-colors ${
                  tipoTransaccion === 'prestamo'
                    ? 'border-primary bg-primary/5'
                    : 'border-line bg-surface hover:border-primary/40'
                }`}
                disabled={guardando}
              >
                <div className={`icon-tile ${tipoTransaccion === 'prestamo' ? 'bg-primary text-on-primary' : 'bg-surface-2 text-muted'}`}>
                  <Banknote className="w-5 h-5" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-fg">Préstamo de dinero</p>
                  <p className="text-xs text-muted">Efectivo con devolución en cuotas</p>
                </div>
              </button>
            </div>
          </fieldset>

          {/* Formulario unificado para ambos tipos */}
          {tipoTransaccion && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Campo de producto (solo para ventas) */}
                {tipoTransaccion === 'venta' && (
                  <div className="md:col-span-2">
                    <label htmlFor="venta-producto" className="label">
                      Producto
                    </label>
                    <select
                      id="venta-producto"
                      value={formVenta.producto_id}
                      onChange={(e) => handleInputChange('producto_id', e.target.value)}
                      className="input"
                      required
                      disabled={guardando}
                    >
                      <option value="">Elegí un producto</option>
                      {productos.map((prod) => (
                        <option key={prod.id} value={prod.id}>
                          {prod.nombre} · {mostrarPesos(prod.precio)}
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                {/* Campo de descripción para ambos tipos */}
                <div className="md:col-span-2">
                  <label htmlFor="venta-descripcion" className="label">
                    Descripción <span className="font-normal text-muted">(opcional)</span>
                  </label>
                  <textarea
                    id="venta-descripcion"
                    value={formVenta.descripcion}
                    onChange={(e) => handleInputChange('descripcion', e.target.value)}
                    placeholder={
                      tipoTransaccion === 'venta'
                        ? 'Ej: Celular Samsung con funda incluida'
                        : 'Ej: Préstamo para pagar el alquiler'
                    }
                    className="input resize-none"
                    rows={3}
                    disabled={guardando}
                  />
                  <p className="help">Detalles que quieras recordar sobre esta operación.</p>
                </div>

                <div>
                  <label htmlFor="venta-monto" className="label">
                    {tipoTransaccion === 'venta' ? 'Precio de venta' : 'Monto prestado'}
                  </label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted font-medium pointer-events-none">$</span>
                    <input
                      id="venta-monto"
                      type="number"
                      placeholder="0,00"
                      value={formVenta.monto_total}
                      onChange={(e) => handleInputChange('monto_total', e.target.value)}
                      className="input pl-8 num"
                      step="0.01"
                      required
                      disabled={guardando}
                    />
                  </div>
                </div>

                {/* Campo de interés (disponible para ambos tipos) */}
                <div>
                  <label htmlFor="venta-interes" className="label">
                    Interés <span className="font-normal text-muted">(opcional)</span>
                  </label>
                  <div className="relative">
                    <input
                      id="venta-interes"
                      type="number"
                      placeholder="0"
                      value={interes}
                      onChange={(e) => setInteres(e.target.value)}
                      className="input pr-9 num"
                      step="0.1"
                      min="0"
                      disabled={guardando}
                    />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-muted font-medium pointer-events-none">%</span>
                  </div>
                  <p className="help">
                    {tipoTransaccion === 'venta'
                      ? 'Ej: 10 suma un 10% al precio.'
                      : 'Ej: 10 suma un 10% de interés al monto prestado.'}
                  </p>
                </div>

                <div>
                  <label htmlFor="venta-frecuencia" className="label">
                    Frecuencia de las cuotas
                  </label>
                  <select
                    id="venta-frecuencia"
                    value={formVenta.tipo_pago}
                    onChange={(e) => handleInputChange('tipo_pago', e.target.value)}
                    className="input"
                    disabled={guardando}
                  >
                    <option value="semanal">Semanal</option>
                    <option value="quincenal">Quincenal</option>
                    <option value="mensual">Mensual</option>
                  </select>
                </div>

                <div>
                  <label htmlFor="venta-cuotas" className="label">
                    Cantidad de cuotas
                  </label>
                  <input
                    id="venta-cuotas"
                    type="number"
                    placeholder="1"
                    value={formVenta.numero_cuotas}
                    onChange={(e) => handleInputChange('numero_cuotas', e.target.value)}
                    className="input num"
                    min="1"
                    required
                    disabled={guardando}
                  />
                </div>

                <div className="md:col-span-2">
                  <label htmlFor="venta-fecha" className="label">
                    Fecha de la primera cuota
                  </label>
                  <input
                    id="venta-fecha"
                    type="date"
                    value={formVenta.fecha_inicio}
                    onChange={(e) => handleInputChange('fecha_inicio', e.target.value)}
                    className="input"
                    required
                    disabled={guardando}
                  />
                  <p className="help">Las cuotas siguientes se calculan a partir de esta fecha.</p>
                </div>
              </div>

              {/* Vista previa unificada con detalles */}
              <section className="rounded-xl border border-line bg-surface-2 p-4 sm:p-5" aria-label="Resumen">
                <h4 className="text-sm font-semibold text-fg mb-4 flex items-center gap-2">
                  <Receipt className="w-4 h-4 text-primary" />
                  {tipoTransaccion === 'venta' ? 'Resumen de la venta' : 'Resumen del préstamo'}
                </h4>
                <dl className="grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <dt className="text-xs text-muted">Monto base</dt>
                    <dd className="font-semibold text-fg num">{mostrarPesos(formVenta.monto_total || '0.00')}</dd>
                  </div>
                  <div>
                    <dt className="text-xs text-muted">Interés ({interes || '0'}%)</dt>
                    <dd className="font-semibold text-fg num">
                      + {mostrarPesos(formVenta.monto_total && interes
                        ? (parseFloat(formVenta.monto_total) * parseFloat(interes) / 100).toFixed(2)
                        : '0.00')}
                    </dd>
                  </div>
                  <div className="col-span-2 rounded-lg bg-primary text-on-primary p-4">
                    <dt className="text-xs opacity-80">Total a cobrar</dt>
                    <dd className="text-2xl font-bold num">
                      {mostrarPesos(formVenta.monto_total && interes
                        ? (
                            parseFloat(formVenta.monto_total) +
                            parseFloat(formVenta.monto_total) * (parseFloat(interes) / 100)
                          ).toFixed(2)
                        : formVenta.monto_total || '0.00')}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-xs text-muted">Valor de cada cuota</dt>
                    <dd className="font-semibold text-fg num">{mostrarPesos(montoCuota)}</dd>
                  </div>
                  <div>
                    <dt className="text-xs text-muted">Frecuencia</dt>
                    <dd className="font-semibold text-fg capitalize">{formVenta.tipo_pago}</dd>
                  </div>
                  <div className="col-span-2">
                    <dt className="text-xs text-muted">Cantidad de cuotas</dt>
                    <dd className="font-semibold text-fg num">{formVenta.numero_cuotas || '0'} cuotas</dd>
                  </div>
                </dl>

                {/* Mostrar descripción si existe */}
                {formVenta.descripcion && (
                  <div className="mt-4 pt-4 border-t border-line text-sm">
                    <p className="text-xs text-muted mb-1">Descripción</p>
                    <p className="text-fg">{formVenta.descripcion}</p>
                  </div>
                )}

                {/* Información adicional según el tipo */}
                {tipoTransaccion === 'venta' && interes && (
                  <div className="alert-info mt-4">
                    <Info className="w-4 h-4 flex-shrink-0" />
                    <span>Se suma un {interes}% al precio del producto.</span>
                  </div>
                )}

                {!interes && (
                  <div className="alert-success mt-4">
                    <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
                    <span>Sin interés: se cobra el monto base dividido en cuotas.</span>
                  </div>
                )}
              </section>

              <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-3">
                <button
                  type="button"
                  onClick={onCancelar}
                  className="btn-secondary"
                  disabled={guardando}
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={guardando}
                  className="btn-primary sm:min-w-[220px]"
                >
                  {guardando ? (
                    <>
                      <span className="spinner" />
                      <span>Guardando…</span>
                    </>
                  ) : (
                    <>
                      <Check className="w-4 h-4" />
                      <span>{tipoTransaccion === 'venta' ? 'Registrar venta' : 'Registrar préstamo'}</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          )}
        </form>
      </div>
    </div>
  )
}
