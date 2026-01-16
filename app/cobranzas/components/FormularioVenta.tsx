import { useState } from 'react'
import { supabase } from '@/app/lib/supabase'
import { Producto } from '@/app/lib/types/cobranzas'
import ComprobanteTransaccion from './Comprobantetransaccion'

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
  const [datosComprobante, setDatosComprobante] = useState<any>(null)

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
      alert('Seleccione si es venta o préstamo')
      return false
    }

    if (tipoTransaccion === 'venta' && !formVenta.producto_id) {
      alert('Seleccione un producto')
      return false
    }

    if (!formVenta.monto_total || parseFloat(formVenta.monto_total) <= 0) {
      alert('Ingrese un monto válido')
      return false
    }
    if (!formVenta.numero_cuotas || parseInt(formVenta.numero_cuotas) <= 0) {
      alert('Ingrese un número de cuotas válido')
      return false
    }
    return true
  }

  const crearNuevaVenta = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!validarFormulario() || !tipoTransaccion) return

    setGuardando(true)
    try {
      // Calcular monto total con intereses
      let montoTotalFinal = parseFloat(formVenta.monto_total)
      const porcentajeInteres = interes ? parseFloat(interes) : 0
      
      if (interes) {
        montoTotalFinal = montoTotalFinal + montoTotalFinal * (porcentajeInteres / 100)
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

      // Crear transacción
      const { data: transData, error: transError } = await supabase
        .from('transacciones')
        .insert({
          cliente_id: clienteId,
          producto_id: tipoTransaccion === 'venta' ? formVenta.producto_id : null,
          tipo_transaccion: tipoTransaccion,
          monto_total: montoTotalFinal,
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
        const fechaInicio = new Date(formVenta.fecha_inicio)

        for (let i = 1; i <= parseInt(formVenta.numero_cuotas); i++) {
          const fechaVencimiento = new Date(fechaInicio)

          // La primera cuota vence el mismo día, las siguientes según el tipo de pago
          if (i !== 1) {
            if (formVenta.tipo_pago === 'semanal') {
              fechaVencimiento.setDate(fechaVencimiento.getDate() + 7 * (i - 1))
            } else if (formVenta.tipo_pago === 'quincenal') {
              fechaVencimiento.setDate(fechaVencimiento.getDate() + 15 * (i - 1))
            } else if (formVenta.tipo_pago === 'mensual') {
              // Para pagos mensuales, mantener el mismo día del mes
              fechaVencimiento.setMonth(fechaVencimiento.getMonth() + (i - 1))
            }
          }

          const fechaVencimientoStr = fechaVencimiento.toISOString().split('T')[0]

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
            montoOriginal: parseFloat(formVenta.monto_total),
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
      alert('Error al crear la transacción: ' + error.message)
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
      <ComprobanteTransaccion
        tipo={datosComprobante.tipo}
        cliente={datosComprobante.cliente}
        transaccion={datosComprobante.transaccion}
        cuotas={datosComprobante.cuotas}
        onCerrar={handleCerrarComprobante}
      />
    )
  }

  return (
    <div className="bg-white p-6 rounded-lg shadow mb-6">
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-lg font-semibold">
          {!tipoTransaccion
            ? 'Crear Nueva Transacción'
            : tipoTransaccion === 'venta'
            ? 'Crear Nueva Venta'
            : 'Crear Nuevo Préstamo'}
        </h3>
        <button onClick={onCancelar} className="text-gray-500 hover:text-gray-700" aria-label="Cerrar">
          ✖
        </button>
      </div>

      <form onSubmit={crearNuevaVenta} className="space-y-4">
        {/* Primer paso: Seleccionar tipo de transacción */}
        <div className="bg-gray-50 p-4 rounded-lg">
          <label className="block text-sm font-medium mb-2">¿Qué tipo de transacción es?</label>
          <div className="grid grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => setTipoTransaccion('venta')}
              className={`p-3 rounded-lg border-2 text-sm font-medium transition-all ${
                tipoTransaccion === 'venta'
                  ? 'border-blue-500 bg-blue-50 text-blue-700'
                  : 'border-gray-300 bg-white hover:border-gray-400'
              }`}
              disabled={guardando}
            >
              Venta de Producto
            </button>
            <button
              type="button"
              onClick={() => setTipoTransaccion('prestamo')}
              className={`p-3 rounded-lg border-2 text-sm font-medium transition-all ${
                tipoTransaccion === 'prestamo'
                  ? 'border-green-500 bg-green-50 text-green-700'
                  : 'border-gray-300 bg-white hover:border-gray-400'
              }`}
              disabled={guardando}
            >
              Préstamo de Dinero
            </button>
          </div>
        </div>

        {/* Formulario unificado para ambos tipos */}
        {tipoTransaccion && (
          <div className="grid grid-cols-2 gap-4">
            {/* Campo de producto (solo para ventas) */}
            {tipoTransaccion === 'venta' && (
              <div className="col-span-2">
                <label className="block text-sm font-medium mb-1">Producto</label>
                <select
                  value={formVenta.producto_id}
                  onChange={(e) => handleInputChange('producto_id', e.target.value)}
                  className="border p-2 rounded w-full"
                  required
                  disabled={guardando}
                >
                  <option value="">Seleccionar producto...</option>
                  {productos.map((prod) => (
                    <option key={prod.id} value={prod.id}>
                      {prod.nombre} - ${prod.precio}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* Campo de descripción para ambos tipos */}
            <div className="col-span-2">
              <label className="block text-sm font-medium mb-1">
                Descripción <span className="text-gray-500 font-normal ml-1">- Opcional</span>
              </label>
              <textarea
                value={formVenta.descripcion}
                onChange={(e) => handleInputChange('descripcion', e.target.value)}
                placeholder={
                  tipoTransaccion === 'venta'
                    ? 'Ej: Venta de celular Samsung con funda incluida'
                    : 'Ej: Préstamo para pago de alquiler'
                }
                className="border p-2 rounded w-full resize-none"
                rows={2}
                disabled={guardando}
              />
              <p className="text-xs text-gray-500 mt-1">
                Agrega notas o detalles adicionales sobre esta transacción
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">
                {tipoTransaccion === 'venta' ? 'Monto Total de Venta' : 'Monto del Préstamo'}
              </label>
              <input
                type="number"
                placeholder="0.00"
                value={formVenta.monto_total}
                onChange={(e) => handleInputChange('monto_total', e.target.value)}
                className="border p-2 rounded w-full"
                step="0.01"
                required
                disabled={guardando}
              />
            </div>

            {/* Campo de interés (disponible para ambos tipos) */}
            <div>
              <label className="block text-sm font-medium mb-1">
                Interés (%) <span className="text-gray-500 font-normal">- Opcional</span>
              </label>
              <input
                type="number"
                placeholder="0"
                value={interes}
                onChange={(e) => setInteres(e.target.value)}
                className="border p-2 rounded w-full"
                step="0.1"
                min="0"
                disabled={guardando}
              />
              <p className="text-xs text-gray-500 mt-1">
                {tipoTransaccion === 'venta'
                  ? 'Ej: 10 para 10% adicional al precio'
                  : 'Ej: 10 para 10% de interés'}
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">Método de Pago</label>
              <select
                value={formVenta.tipo_pago}
                onChange={(e) => handleInputChange('tipo_pago', e.target.value)}
                className="border p-2 rounded w-full"
                disabled={guardando}
              >
                <option value="semanal">Semanal</option>
                <option value="quincenal">Quincenal</option>
                <option value="mensual">Mensual</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">Número de Cuotas</label>
              <input
                type="number"
                placeholder="1"
                value={formVenta.numero_cuotas}
                onChange={(e) => handleInputChange('numero_cuotas', e.target.value)}
                className="border p-2 rounded w-full"
                min="1"
                required
                disabled={guardando}
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">Fecha de Inicio</label>
              <input
                type="date"
                value={formVenta.fecha_inicio}
                onChange={(e) => handleInputChange('fecha_inicio', e.target.value)}
                className="border p-2 rounded w-full"
                required
                disabled={guardando}
              />
            </div>

            {/* Vista previa unificada con detalles */}
            <div className="col-span-2">
              <div
                className={`${
                  tipoTransaccion === 'venta'
                    ? 'bg-blue-50 border-blue-200'
                    : 'bg-green-50 border-green-200'
                } p-4 rounded-lg border`}
              >
                <h4
                  className={`font-medium mb-2 ${
                    tipoTransaccion === 'venta' ? 'text-blue-800' : 'text-green-800'
                  }`}
                >
                  {tipoTransaccion === 'venta' ? 'Resumen de la Venta:' : 'Resumen del Préstamo:'}
                </h4>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <p>
                    <strong>Monto original:</strong> ${formVenta.monto_total || '0'}
                  </p>
                  <p>
                    <strong>Interés ({interes || '0'}%):</strong> $
                    {formVenta.monto_total && interes
                      ? (parseFloat(formVenta.monto_total) * parseFloat(interes) / 100).toFixed(2)
                      : '0.00'}
                  </p>
                  <p>
                    <strong>Monto total a cobrar:</strong> $
                    {formVenta.monto_total && interes
                      ? (
                          parseFloat(formVenta.monto_total) +
                          parseFloat(formVenta.monto_total) * (parseFloat(interes) / 100)
                        ).toFixed(2)
                      : formVenta.monto_total || '0'}
                  </p>
                  <p>
                    <strong>Cuotas de:</strong> ${montoCuota} cada una
                  </p>
                  <p>
                    <strong>Frecuencia:</strong> {formVenta.tipo_pago}
                  </p>
                  <p>
                    <strong>Total de cuotas:</strong> {formVenta.numero_cuotas || '0'}
                  </p>
                </div>

                {/* Mostrar descripción si existe */}
                {formVenta.descripcion && (
                  <div className="mt-2 pt-2 border-t border-gray-300">
                    <p className="text-xs text-gray-700">
                      <strong>Descripción:</strong> {formVenta.descripcion}
                    </p>
                  </div>
                )}

                {/* Información adicional según el tipo */}
                {tipoTransaccion === 'venta' && interes && (
                  <div className="mt-2 pt-2 border-t border-blue-200">
                    <p className="text-xs text-blue-600">
                      Se está aplicando un {interes}% adicional al precio del producto
                    </p>
                  </div>
                )}

                {!interes && (
                  <div className="mt-2 pt-2 border-t border-gray-200">
                    <p className="text-xs text-gray-600">
                      Sin intereses - Se cobrará el monto original dividido en cuotas
                    </p>
                  </div>
                )}
              </div>
            </div>

            <button
              type="submit"
              disabled={guardando}
              className={`p-2 rounded hover:opacity-90 col-span-2 disabled:opacity-50 text-white font-medium ${
                tipoTransaccion === 'venta'
                  ? 'bg-blue-500 hover:bg-blue-600'
                  : 'bg-green-500 hover:bg-green-600'
              }`}
            >
              {guardando ? 'Guardando...' : `Crear ${tipoTransaccion === 'venta' ? 'Venta' : 'Préstamo'}`}
            </button>
          </div>
        )}
      </form>
    </div>
  )
}