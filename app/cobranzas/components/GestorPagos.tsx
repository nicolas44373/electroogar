import { useState, useEffect } from 'react'
import { supabase } from '@/app/lib/supabase'
import { Cliente, Pago, Transaccion } from '@/app/lib/types/cobranzas'
import { Search, CreditCard, Calendar, DollarSign, Check, AlertTriangle, Filter } from 'lucide-react'

// Definir PagoExtendido sin extender Pago para evitar conflictos de tipos
interface PagoExtendido {
  id: string
  transaccion_id: string
  numero_cuota: number
  monto_pagado: number
  monto_cuota?: number
  fecha_pago: string | null
  fecha_vencimiento: string
  numero_recibo?: string
  metodo_pago?: 'efectivo' | 'transferencia' | 'cheque' | 'tarjeta'
  observaciones?: string
  usuario_registro?: string
  comprobante_url?: string
  referencia_externa?: string
  estado: 'pendiente' | 'parcial' | 'pagado'
  created_at: string
  transaccion: {
    cliente: Cliente
    producto: { nombre: string } | null  // Permitir null para préstamos
    monto_total: number
    monto_cuota: number  // Agregar monto_cuota de la transacción
    numero_factura?: string
    tipo_transaccion: string  // Agregar tipo de transacción
  }
}

interface GestorPagosProps {
  clientes: Cliente[]
  onPagoRegistrado: () => void
}

export default function GestorPagos({ clientes, onPagoRegistrado }: GestorPagosProps) {
  const [pagosPendientes, setPagosPendientes] = useState<PagoExtendido[]>([])
  const [pagoSeleccionado, setPagoSeleccionado] = useState<PagoExtendido | null>(null)
  const [mostrarModal, setMostrarModal] = useState(false)
  const [loading, setLoading] = useState(false)
  const [busqueda, setBusqueda] = useState('')
  const [filtroEstado, setFiltroEstado] = useState<'todos' | 'pendiente' | 'parcial' | 'vencido'>('todos')
  const [filtroFecha, setFiltroFecha] = useState<'todos' | 'hoy' | 'semana' | 'mes' | 'vencidos'>('todos')
  
  // Datos del formulario de pago
  const [montoPago, setMontoPago] = useState('')
  const [fechaPago, setFechaPago] = useState(new Date().toISOString().split('T')[0])
  const [metodoPago, setMetodoPago] = useState<'efectivo' | 'transferencia' | 'cheque' | 'tarjeta'>('efectivo')
  const [observaciones, setObservaciones] = useState('')

  useEffect(() => {
    cargarPagosPendientes()
  }, [])

  const cargarPagosPendientes = async () => {
    setLoading(true)
    try {
      const { data } = await supabase
        .from('pagos')
        .select(`
          *,
          transaccion:transacciones(
            monto_total,
            monto_cuota,
            numero_factura,
            tipo_transaccion,
            cliente:clientes(id, nombre, apellido, email, telefono),
            producto:productos(nombre)
          )
        `)
        .in('estado', ['pendiente', 'parcial'])
        .order('fecha_vencimiento')

      if (data) {
        setPagosPendientes(data as PagoExtendido[])
      }
    } catch (error) {
      console.error('Error cargando pagos:', error)
    } finally {
      setLoading(false)
    }
  }

  // Función centralizada para calcular diferencia de días (evita problemas de timezone)
  const calcularDiasVencimiento = (fechaVencimiento: string) => {
    // Crear fechas forzando interpretación local
    const hoy = new Date()
    hoy.setHours(0, 0, 0, 0)
    
    // Parsear fecha como local usando split para evitar conversión UTC
    const [year, month, day] = fechaVencimiento.split('-').map(Number)
    const vencimiento = new Date(year, month - 1, day) // month - 1 porque los meses en JS van de 0-11
    vencimiento.setHours(0, 0, 0, 0)
    
    const diferencia = Math.floor((vencimiento.getTime() - hoy.getTime()) / (1000 * 60 * 60 * 24))
    return diferencia
  }

  // Función para obtener el monto de cuota correcto
  const obtenerMontoCuota = (pago: PagoExtendido) => {
    // Si el pago tiene monto_cuota propio (ej: reprogramado con intereses), usarlo
    if (pago.monto_cuota && pago.monto_cuota > 0) {
      return pago.monto_cuota
    }
    // Si no, usar el monto_cuota de la transacción
    return pago.transaccion.monto_cuota || 0
  }

  // Función para obtener el nombre del producto o tipo de transacción
  const obtenerNombreTransaccion = (transaccion: PagoExtendido['transaccion']) => {
    if (transaccion.producto?.nombre) {
      return transaccion.producto.nombre
    }
    
    // Si no hay producto, es un préstamo
    return transaccion.tipo_transaccion === 'prestamo' ? 'Préstamo de Dinero' : 'Venta'
  }

  const formatearMoneda = (monto: number) => {
    return new Intl.NumberFormat('es-AR', {
      style: 'currency',
      currency: 'ARS'
    }).format(monto)
  }

  const formatearFecha = (fecha: string) => {
    // Parsear fecha como local para evitar conversión UTC
    const [year, month, day] = fecha.split('-').map(Number)
    const fechaObj = new Date(year, month - 1, day)
    return fechaObj.toLocaleDateString('es-AR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    })
  }

  const obtenerEstadoVencimiento = (fechaVencimiento: string) => {
    const diferenciaDias = calcularDiasVencimiento(fechaVencimiento)

    if (diferenciaDias < 0) return { estado: 'vencido', dias: Math.abs(diferenciaDias), texto: `Vencido hace ${Math.abs(diferenciaDias)} días` }
    if (diferenciaDias === 0) return { estado: 'hoy', dias: 0, texto: 'Vence hoy' }
    if (diferenciaDias <= 7) return { estado: 'proximo', dias: diferenciaDias, texto: `Vence en ${diferenciaDias} días` }
    return { estado: 'futuro', dias: diferenciaDias, texto: `Vence en ${diferenciaDias} días` }
  }

  const filtrarPagos = () => {
    let pagosFiltrados = pagosPendientes

    // Filtro por búsqueda
    if (busqueda) {
      pagosFiltrados = pagosFiltrados.filter(pago =>
        pago.transaccion.cliente.nombre.toLowerCase().includes(busqueda.toLowerCase()) ||
        obtenerNombreTransaccion(pago.transaccion).toLowerCase().includes(busqueda.toLowerCase())
      )
    }

    // Filtro por estado
    if (filtroEstado !== 'todos') {
      if (filtroEstado === 'vencido') {
        pagosFiltrados = pagosFiltrados.filter(pago =>
          obtenerEstadoVencimiento(pago.fecha_vencimiento).estado === 'vencido'
        )
      } else {
        pagosFiltrados = pagosFiltrados.filter(pago => pago.estado === filtroEstado)
      }
    }

    // Filtro por fecha - usando la función centralizada
    if (filtroFecha !== 'todos') {
      pagosFiltrados = pagosFiltrados.filter(pago => {
        const diferenciaDias = calcularDiasVencimiento(pago.fecha_vencimiento)

        switch (filtroFecha) {
          case 'hoy':
            return diferenciaDias === 0
          case 'semana':
            return diferenciaDias >= 0 && diferenciaDias <= 7
          case 'mes':
            return diferenciaDias >= 0 && diferenciaDias <= 30
          case 'vencidos':
            return diferenciaDias < 0
          default:
            return true
        }
      })
    }

    return pagosFiltrados
  }

  const abrirModalPago = (pago: PagoExtendido) => {
    setPagoSeleccionado(pago)
    // Usar la función helper para obtener el monto correcto
    const montoRestante = obtenerMontoCuota(pago) - (pago.monto_pagado || 0)
    setMontoPago(montoRestante.toString())
    setFechaPago(new Date().toISOString().split('T')[0])
    setObservaciones('')
    setMostrarModal(true)
  }

  const registrarPago = async () => {
    if (!pagoSeleccionado) return

    setLoading(true)
    try {
      const montoNumerico = parseFloat(montoPago)
      const montoCuota = obtenerMontoCuota(pagoSeleccionado)  // Usar función helper
      const montoPagado = pagoSeleccionado.monto_pagado || 0
      const montoRestante = montoCuota - montoPagado
      
      let nuevoEstado: 'pendiente' | 'parcial' | 'pagado'
      let nuevoMontoPagado: number

      if (montoNumerico >= montoRestante) {
        nuevoEstado = 'pagado'
        nuevoMontoPagado = montoCuota
      } else {
        nuevoEstado = 'parcial'
        nuevoMontoPagado = montoPagado + montoNumerico
      }

      // Actualizar el pago
      const { error } = await supabase
        .from('pagos')
        .update({
          estado: nuevoEstado,
          monto_pagado: nuevoMontoPagado,
          fecha_pago: fechaPago,  // Ya está en formato correcto YYYY-MM-DD
          metodo_pago: metodoPago,
          observaciones: observaciones,
          numero_recibo: `REC-${Date.now()}`
        })
        .eq('id', pagoSeleccionado.id)

      if (error) throw error

      setMostrarModal(false)
      setPagoSeleccionado(null)
      await cargarPagosPendientes()
      onPagoRegistrado()
      
      // Mostrar mensaje de éxito
      alert('Pago registrado correctamente')
    } catch (error) {
      console.error('Error registrando pago:', error)
      alert('Error al registrar el pago')
    } finally {
      setLoading(false)
    }
  }

  const pagosFiltrados = filtrarPagos()

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-lg shadow-sm border p-6">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-semibold text-gray-900 flex items-center">
            <CreditCard className="w-6 h-6 mr-2" />
            Gestión de Pagos
          </h2>
        </div>

        {/* Filtros y búsqueda */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <div className="relative">
            <Search className="absolute left-3 top-3 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Buscar cliente o producto..."
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              className="pl-10 pr-4 py-2 w-full border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <select
            value={filtroEstado}
            onChange={(e) => setFiltroEstado(e.target.value as any)}
            className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="todos">Todos los estados</option>
            <option value="pendiente">Pendientes</option>
            <option value="parcial">Pagos parciales</option>
            <option value="vencido">Vencidos</option>
          </select>

          <select
            value={filtroFecha}
            onChange={(e) => setFiltroFecha(e.target.value as any)}
            className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="todos">Todas las fechas</option>
            <option value="vencidos">Vencidos</option>
            <option value="hoy">Vencen hoy</option>
            <option value="semana">Próximos 7 días</option>
            <option value="mes">Próximo mes</option>
          </select>

          <div className="flex items-center space-x-2">
            <Filter className="w-4 h-4 text-gray-400" />
            <span className="text-sm text-gray-600">
              {pagosFiltrados.length} de {pagosPendientes.length} pagos
            </span>
          </div>
        </div>

        {/* Lista de pagos */}
        <div className="space-y-3">
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
              <span className="ml-2 text-gray-600">Cargando pagos...</span>
            </div>
          ) : pagosFiltrados.length > 0 ? (
            pagosFiltrados.map((pago) => {
              const estadoVencimiento = obtenerEstadoVencimiento(pago.fecha_vencimiento)
              const montoCuota = obtenerMontoCuota(pago)  // Usar la función helper
              const montoPagado = pago.monto_pagado || 0
              const montoRestante = montoCuota - montoPagado

              return (
                <div
                  key={pago.id}
                  className={`border rounded-lg p-4 transition-all hover:shadow-md ${
                    estadoVencimiento.estado === 'vencido' ? 'border-red-200 bg-red-50' :
                    estadoVencimiento.estado === 'hoy' ? 'border-orange-200 bg-orange-50' :
                    'border-gray-200 bg-white'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <div className="flex items-center space-x-4">
                        <div>
                          <h3 className="font-medium text-gray-900">
                            {pago.transaccion.cliente.nombre} {pago.transaccion.cliente.apellido || ''}
                          </h3>
                          <p className="text-sm text-gray-600">
                            {obtenerNombreTransaccion(pago.transaccion)} - Cuota {pago.numero_cuota}
                          </p>
                        </div>
                        
                        <div className="text-center">
                          <div className="text-sm text-gray-500">Monto</div>
                          <div className="font-semibold">
                            {formatearMoneda(montoRestante)}
                          </div>
                          {montoPagado > 0 && (
                            <div className="text-xs text-green-600">
                              Pagado: {formatearMoneda(montoPagado)}
                            </div>
                          )}
                        </div>

                        <div className="text-center">
                          <div className="text-sm text-gray-500">Vencimiento</div>
                          <div className="font-medium">
                            {formatearFecha(pago.fecha_vencimiento)}
                          </div>
                          <div className={`text-xs ${
                            estadoVencimiento.estado === 'vencido' ? 'text-red-600' :
                            estadoVencimiento.estado === 'hoy' ? 'text-orange-600' :
                            'text-gray-500'
                          }`}>
                            {estadoVencimiento.texto}
                          </div>
                        </div>

                        <div className="flex items-center">
                          {estadoVencimiento.estado === 'vencido' && (
                            <AlertTriangle className="w-5 h-5 text-red-500 mr-2" />
                          )}
                          {estadoVencimiento.estado === 'hoy' && (
                            <Calendar className="w-5 h-5 text-orange-500 mr-2" />
                          )}
                          <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                            pago.estado === 'pendiente' ? 'bg-red-100 text-red-800' :
                            pago.estado === 'parcial' ? 'bg-yellow-100 text-yellow-800' :
                            'bg-green-100 text-green-800'
                          }`}>
                            {pago.estado === 'pendiente' ? 'Pendiente' :
                             pago.estado === 'parcial' ? 'Parcial' : 'Pagado'}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center space-x-2">
                      <button
                        onClick={() => abrirModalPago(pago)}
                        className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors flex items-center space-x-2"
                      >
                        <DollarSign className="w-4 h-4" />
                        <span>Registrar Pago</span>
                      </button>
                    </div>
                  </div>
                </div>
              )
            })
          ) : (
            <div className="text-center py-8 text-gray-500">
              No se encontraron pagos pendientes con los filtros aplicados
            </div>
          )}
        </div>
      </div>

      {/* Modal de registro de pago */}
      {mostrarModal && pagoSeleccionado && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg max-w-md w-full p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900">Registrar Pago</h3>
              <button
                onClick={() => setMostrarModal(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                ✕
              </button>
            </div>

            <div className="space-y-4">
              {/* Información del pago */}
              <div className="bg-gray-50 rounded-lg p-4">
                <div className="text-sm text-gray-600 mb-2">Cliente:</div>
                <div className="font-medium">
                  {pagoSeleccionado.transaccion.cliente.nombre} {pagoSeleccionado.transaccion.cliente.apellido || ''}
                </div>
                
                <div className="text-sm text-gray-600 mb-2 mt-3">Concepto:</div>
                <div className="font-medium">{obtenerNombreTransaccion(pagoSeleccionado.transaccion)}</div>
                
                <div className="flex justify-between mt-3">
                  <div>
                    <div className="text-sm text-gray-600">Cuota:</div>
                    <div className="font-medium">{pagoSeleccionado.numero_cuota}</div>
                  </div>
                  <div className="text-right">
                    <div className="text-sm text-gray-600">Monto total:</div>
                    <div className="font-bold">{formatearMoneda(obtenerMontoCuota(pagoSeleccionado))}</div>
                  </div>
                </div>
                
                {(pagoSeleccionado.monto_pagado || 0) > 0 && (
                  <div className="mt-2 text-right">
                    <div className="text-sm text-gray-600">Pagado anteriormente:</div>
                    <div className="text-green-600 font-medium">
                      {formatearMoneda(pagoSeleccionado.monto_pagado || 0)}
                    </div>
                    <div className="text-sm text-gray-600">Restante:</div>
                    <div className="font-bold text-red-600">
                      {formatearMoneda(obtenerMontoCuota(pagoSeleccionado) - (pagoSeleccionado.monto_pagado || 0))}
                    </div>
                  </div>
                )}
              </div>

              {/* Formulario de pago */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Monto a pagar
                </label>
                <input
                  type="number"
                  step="0.01"
                  value={montoPago}
                  onChange={(e) => setMontoPago(e.target.value)}
                  max={obtenerMontoCuota(pagoSeleccionado) - (pagoSeleccionado.monto_pagado || 0)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Fecha de pago
                </label>
                <input
                  type="date"
                  value={fechaPago}
                  onChange={(e) => setFechaPago(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Método de pago
                </label>
                <select
                  value={metodoPago}
                  onChange={(e) => setMetodoPago(e.target.value as any)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="efectivo">Efectivo</option>
                  <option value="transferencia">Transferencia</option>
                  <option value="cheque">Cheque</option>
                  <option value="tarjeta">Tarjeta</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Observaciones (opcional)
                </label>
                <textarea
                  value={observaciones}
                  onChange={(e) => setObservaciones(e.target.value)}
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                  placeholder="Observaciones adicionales..."
                />
              </div>
            </div>

            <div className="flex space-x-3 mt-6">
              <button
                onClick={() => setMostrarModal(false)}
                className="flex-1 px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50 transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={registrarPago}
                disabled={loading || !montoPago || parseFloat(montoPago) <= 0}
                className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors disabled:bg-gray-400 disabled:cursor-not-allowed flex items-center justify-center space-x-2"
              >
                {loading ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                    <span>Procesando...</span>
                  </>
                ) : (
                  <>
                    <Check className="w-4 h-4" />
                    <span>Confirmar Pago</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}