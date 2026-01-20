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
      alert('⚠️ Seleccione si es venta o préstamo')
      return false
    }

    if (tipoTransaccion === 'venta' && !formVenta.producto_id) {
      alert('⚠️ Seleccione un producto')
      return false
    }

    if (!formVenta.monto_total || parseFloat(formVenta.monto_total) <= 0) {
      alert('⚠️ Ingrese un monto válido')
      return false
    }
    if (!formVenta.numero_cuotas || parseInt(formVenta.numero_cuotas) <= 0) {
      alert('⚠️ Ingrese un número de cuotas válido')
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
      alert('❌ Error al crear la transacción: ' + error.message)
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
    <div className="bg-white p-4 sm:p-6 rounded-xl shadow-lg mb-6 border border-gray-100">
      <div className="flex justify-between items-center mb-6">
        <h3 className="text-lg sm:text-xl font-bold text-gray-800 flex items-center gap-2">
          {!tipoTransaccion && '💼 Crear Nueva Transacción'}
          {tipoTransaccion === 'venta' && '🛒 Crear Nueva Venta'}
          {tipoTransaccion === 'prestamo' && '💰 Crear Nuevo Préstamo'}
        </h3>
        <button 
          onClick={onCancelar} 
          className="text-gray-400 hover:text-gray-600 hover:bg-gray-100 p-2 rounded-full transition-all" 
          aria-label="Cerrar"
        >
          ✖
        </button>
      </div>

      <form onSubmit={crearNuevaVenta} className="space-y-5">
        {/* Primer paso: Seleccionar tipo de transacción */}
        <div className="bg-gradient-to-br from-gray-50 to-gray-100 p-4 sm:p-5 rounded-xl border border-gray-200">
          <label className="block text-sm font-semibold mb-3 text-gray-700 flex items-center gap-2">
            ❓ ¿Qué tipo de transacción es?
          </label>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
            <button
              type="button"
              onClick={() => setTipoTransaccion('venta')}
              className={`p-3 sm:p-4 rounded-xl border-2 text-sm font-semibold transition-all transform hover:scale-105 ${
                tipoTransaccion === 'venta'
                  ? 'border-blue-500 bg-blue-50 text-blue-700 shadow-lg shadow-blue-200'
                  : 'border-gray-300 bg-white hover:border-blue-300 hover:bg-blue-50'
              }`}
              disabled={guardando}
            >
              <div className="flex items-center justify-center gap-2">
                <span className="text-xl sm:text-2xl">🛒</span>
                <span>Venta de Producto</span>
              </div>
            </button>
            <button
              type="button"
              onClick={() => setTipoTransaccion('prestamo')}
              className={`p-3 sm:p-4 rounded-xl border-2 text-sm font-semibold transition-all transform hover:scale-105 ${
                tipoTransaccion === 'prestamo'
                  ? 'border-green-500 bg-green-50 text-green-700 shadow-lg shadow-green-200'
                  : 'border-gray-300 bg-white hover:border-green-300 hover:bg-green-50'
              }`}
              disabled={guardando}
            >
              <div className="flex items-center justify-center gap-2">
                <span className="text-xl sm:text-2xl">💰</span>
                <span>Préstamo de Dinero</span>
              </div>
            </button>
          </div>
        </div>

        {/* Formulario unificado para ambos tipos */}
        {tipoTransaccion && (
          <div className="space-y-5">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-5">
              {/* Campo de producto (solo para ventas) */}
              {tipoTransaccion === 'venta' && (
                <div className="md:col-span-2">
                  <label className="block text-sm font-semibold mb-2 text-gray-700 flex items-center gap-2">
                    📦 Producto
                  </label>
                  <select
                    value={formVenta.producto_id}
                    onChange={(e) => handleInputChange('producto_id', e.target.value)}
                    className="border-2 border-gray-300 p-3 rounded-lg w-full focus:border-blue-500 focus:ring-2 focus:ring-blue-200 transition-all text-sm sm:text-base"
                    required
                    disabled={guardando}
                  >
                    <option value="">🔍 Seleccionar producto...</option>
                    {productos.map((prod) => (
                      <option key={prod.id} value={prod.id}>
                        {prod.nombre} - ${prod.precio}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* Campo de descripción para ambos tipos */}
              <div className="md:col-span-2">
                <label className="block text-sm font-semibold mb-2 text-gray-700 flex items-center gap-2">
                  📝 Descripción 
                  <span className="text-gray-400 font-normal text-xs">- Opcional</span>
                </label>
                <textarea
                  value={formVenta.descripcion}
                  onChange={(e) => handleInputChange('descripcion', e.target.value)}
                  placeholder={
                    tipoTransaccion === 'venta'
                      ? '💡 Ej: Venta de celular Samsung con funda incluida'
                      : '💡 Ej: Préstamo para pago de alquiler'
                  }
                  className="border-2 border-gray-300 p-3 rounded-lg w-full resize-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200 transition-all text-sm sm:text-base"
                  rows={3}
                  disabled={guardando}
                />
                <p className="text-xs text-gray-500 mt-1 flex items-center gap-1">
                  💬 Agrega notas o detalles adicionales sobre esta transacción
                </p>
              </div>

              <div>
                <label className="block text-sm font-semibold mb-2 text-gray-700 flex items-center gap-2">
                  💵 {tipoTransaccion === 'venta' ? 'Monto Total de Venta' : 'Monto del Préstamo'}
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-500 font-bold">$</span>
                  <input
                    type="number"
                    placeholder="0.00"
                    value={formVenta.monto_total}
                    onChange={(e) => handleInputChange('monto_total', e.target.value)}
                    className="border-2 border-gray-300 p-3 pl-8 rounded-lg w-full focus:border-blue-500 focus:ring-2 focus:ring-blue-200 transition-all text-sm sm:text-base"
                    step="0.01"
                    required
                    disabled={guardando}
                  />
                </div>
              </div>

              {/* Campo de interés (disponible para ambos tipos) */}
              <div>
                <label className="block text-sm font-semibold mb-2 text-gray-700 flex items-center gap-2">
                  📈 Interés (%) 
                  <span className="text-gray-400 font-normal text-xs">- Opcional</span>
                </label>
                <div className="relative">
                  <input
                    type="number"
                    placeholder="0"
                    value={interes}
                    onChange={(e) => setInteres(e.target.value)}
                    className="border-2 border-gray-300 p-3 pr-8 rounded-lg w-full focus:border-blue-500 focus:ring-2 focus:ring-blue-200 transition-all text-sm sm:text-base"
                    step="0.1"
                    min="0"
                    disabled={guardando}
                  />
                  <span className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-500 font-bold">%</span>
                </div>
                <p className="text-xs text-gray-500 mt-1">
                  {tipoTransaccion === 'venta'
                    ? '💡 Ej: 10 para 10% adicional al precio'
                    : '💡 Ej: 10 para 10% de interés'}
                </p>
              </div>

              <div>
                <label className="block text-sm font-semibold mb-2 text-gray-700 flex items-center gap-2">
                  🔄 Método de Pago
                </label>
                <select
                  value={formVenta.tipo_pago}
                  onChange={(e) => handleInputChange('tipo_pago', e.target.value)}
                  className="border-2 border-gray-300 p-3 rounded-lg w-full focus:border-blue-500 focus:ring-2 focus:ring-blue-200 transition-all text-sm sm:text-base"
                  disabled={guardando}
                >
                  <option value="semanal">📅 Semanal</option>
                  <option value="quincenal">📅 Quincenal</option>
                  <option value="mensual">📅 Mensual</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-semibold mb-2 text-gray-700 flex items-center gap-2">
                  🔢 Número de Cuotas
                </label>
                <input
                  type="number"
                  placeholder="1"
                  value={formVenta.numero_cuotas}
                  onChange={(e) => handleInputChange('numero_cuotas', e.target.value)}
                  className="border-2 border-gray-300 p-3 rounded-lg w-full focus:border-blue-500 focus:ring-2 focus:ring-blue-200 transition-all text-sm sm:text-base"
                  min="1"
                  required
                  disabled={guardando}
                />
              </div>

              <div className="md:col-span-2">
                <label className="block text-sm font-semibold mb-2 text-gray-700 flex items-center gap-2">
                  📆 Fecha de Inicio
                </label>
                <input
                  type="date"
                  value={formVenta.fecha_inicio}
                  onChange={(e) => handleInputChange('fecha_inicio', e.target.value)}
                  className="border-2 border-gray-300 p-3 rounded-lg w-full focus:border-blue-500 focus:ring-2 focus:ring-blue-200 transition-all text-sm sm:text-base"
                  required
                  disabled={guardando}
                />
              </div>
            </div>

            {/* Vista previa unificada con detalles */}
            <div
              className={`${
                tipoTransaccion === 'venta'
                  ? 'bg-gradient-to-br from-blue-50 to-blue-100 border-blue-300'
                  : 'bg-gradient-to-br from-green-50 to-green-100 border-green-300'
              } p-4 sm:p-5 rounded-xl border-2 shadow-md`}
            >
              <h4
                className={`font-bold mb-4 text-base sm:text-lg flex items-center gap-2 ${
                  tipoTransaccion === 'venta' ? 'text-blue-800' : 'text-green-800'
                }`}
              >
                {tipoTransaccion === 'venta' ? '🛒 Resumen de la Venta' : '💰 Resumen del Préstamo'}
              </h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
                <div className="bg-white bg-opacity-50 p-3 rounded-lg">
                  <p className="text-gray-600 text-xs mb-1">💵 Monto original</p>
                  <p className="font-bold text-base sm:text-lg">${formVenta.monto_total || '0.00'}</p>
                </div>
                <div className="bg-white bg-opacity-50 p-3 rounded-lg">
                  <p className="text-gray-600 text-xs mb-1">📈 Interés ({interes || '0'}%)</p>
                  <p className="font-bold text-base sm:text-lg text-orange-600">
                    +${formVenta.monto_total && interes
                      ? (parseFloat(formVenta.monto_total) * parseFloat(interes) / 100).toFixed(2)
                      : '0.00'}
                  </p>
                </div>
                <div className={`${
                  tipoTransaccion === 'venta' ? 'bg-blue-600' : 'bg-green-600'
                } text-white p-3 rounded-lg md:col-span-2`}>
                  <p className="text-xs mb-1 opacity-90">💎 Monto total a cobrar</p>
                  <p className="font-bold text-xl sm:text-2xl">
                    ${formVenta.monto_total && interes
                      ? (
                          parseFloat(formVenta.monto_total) +
                          parseFloat(formVenta.monto_total) * (parseFloat(interes) / 100)
                        ).toFixed(2)
                      : formVenta.monto_total || '0.00'}
                  </p>
                </div>
                <div className="bg-white bg-opacity-50 p-3 rounded-lg">
                  <p className="text-gray-600 text-xs mb-1">💰 Cuotas de</p>
                  <p className="font-bold text-base sm:text-lg">${montoCuota} c/u</p>
                </div>
                <div className="bg-white bg-opacity-50 p-3 rounded-lg">
                  <p className="text-gray-600 text-xs mb-1">🔄 Frecuencia</p>
                  <p className="font-bold text-base sm:text-lg capitalize">{formVenta.tipo_pago}</p>
                </div>
                <div className="bg-white bg-opacity-50 p-3 rounded-lg md:col-span-2">
                  <p className="text-gray-600 text-xs mb-1">🔢 Total de cuotas</p>
                  <p className="font-bold text-base sm:text-lg">{formVenta.numero_cuotas || '0'} cuotas</p>
                </div>
              </div>

              {/* Mostrar descripción si existe */}
              {formVenta.descripcion && (
                <div className="mt-4 pt-4 border-t border-gray-300">
                  <p className="text-xs sm:text-sm text-gray-700 bg-white bg-opacity-60 p-3 rounded-lg">
                    <strong className="flex items-center gap-1 mb-1">
                      📝 Descripción:
                    </strong>
                    {formVenta.descripcion}
                  </p>
                </div>
              )}

              {/* Información adicional según el tipo */}
              {tipoTransaccion === 'venta' && interes && (
                <div className="mt-4 pt-4 border-t border-blue-300">
                  <p className="text-xs text-blue-700 bg-blue-200 bg-opacity-50 p-2 rounded-lg flex items-center gap-2">
                    <span>ℹ️</span>
                    <span>Se está aplicando un {interes}% adicional al precio del producto</span>
                  </p>
                </div>
              )}

              {!interes && (
                <div className="mt-4 pt-4 border-t border-gray-300">
                  <p className="text-xs text-gray-600 bg-white bg-opacity-60 p-2 rounded-lg flex items-center gap-2">
                    <span>✅</span>
                    <span>Sin intereses - Se cobrará el monto original dividido en cuotas</span>
                  </p>
                </div>
              )}
            </div>

            <button
              type="submit"
              disabled={guardando}
              className={`p-3 sm:p-4 rounded-xl hover:opacity-90 w-full disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold text-base sm:text-lg shadow-lg transition-all transform hover:scale-105 flex items-center justify-center gap-2 ${
                tipoTransaccion === 'venta'
                  ? 'bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 shadow-blue-300'
                  : 'bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700 shadow-green-300'
              }`}
            >
              {guardando ? (
                <>
                  <span className="animate-spin">⏳</span>
                  <span>Guardando...</span>
                </>
              ) : (
                <>
                  <span>{tipoTransaccion === 'venta' ? '🛒' : '💰'}</span>
                  <span>Crear {tipoTransaccion === 'venta' ? 'Venta' : 'Préstamo'}</span>
                  <span>✨</span>
                </>
              )}
            </button>
          </div>
        )}
      </form>
    </div>
  )
}