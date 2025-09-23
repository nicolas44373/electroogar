import { useState, useEffect } from 'react'
import { supabase } from '@/app/lib/supabase'
import { Cliente, Transaccion, Pago } from '@/app/lib/types/cobranzas'
import { FileText, Download, Eye, Printer, Search, Calendar, Filter } from 'lucide-react'

// Definir PagoConDetalles actualizado para manejar préstamos
interface PagoConDetalles {
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
    producto: { nombre: string; precio_unitario: number } | null
    monto_total: number
    numero_factura?: string
    fecha_venta: string
    tipo_transaccion: string
  }
}

interface GeneradorRecibosProps {
  clientes: Cliente[]
  transacciones: Transaccion[]
  pagos: { [key: string]: Pago[] }
}

export default function GeneradorRecibos({ clientes }: GeneradorRecibosProps) {
  const [pagosPagados, setPagosPagados] = useState<PagoConDetalles[]>([])
  const [clienteSeleccionado, setClienteSeleccionado] = useState('')
  const [fechaDesde, setFechaDesde] = useState('')
  const [fechaHasta, setFechaHasta] = useState('')
  const [busqueda, setBusqueda] = useState('')
  const [loading, setLoading] = useState(false)
  const [reciboSeleccionado, setReciboSeleccionado] = useState<PagoConDetalles | null>(null)
  const [mostrarVistaPrevia, setMostrarVistaPrevia] = useState(false)

  useEffect(() => {
    cargarPagosPagados()
  }, [])

  const cargarPagosPagados = async () => {
    setLoading(true)
    try {
      const { data } = await supabase
        .from('pagos')
        .select(`
          *,
          transaccion:transacciones(
            monto_total,
            numero_factura,
            tipo_transaccion,
            fecha_venta:created_at,
            cliente:clientes(id, nombre, email, telefono, direccion, documento),
            producto:productos(nombre, precio_unitario)
          )
        `)
        .eq('estado', 'pagado')
        .not('fecha_pago', 'is', null)
        .order('fecha_pago', { ascending: false })

      if (data) {
        setPagosPagados(data as PagoConDetalles[])
      }
    } catch (error) {
      console.error('Error cargando pagos:', error)
    } finally {
      setLoading(false)
    }
  }

  const formatearMoneda = (monto: number) => {
    return new Intl.NumberFormat('es-AR', {
      style: 'currency',
      currency: 'ARS'
    }).format(monto)
  }

  const formatearFecha = (fecha: string) => {
    return new Date(fecha).toLocaleDateString('es-AR')
  }

  const formatearFechaCompleta = (fecha: string) => {
    return new Date(fecha).toLocaleDateString('es-AR', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    })
  }

  const filtrarPagos = () => {
    let pagosFiltrados = pagosPagados

    // Filtro por cliente
    if (clienteSeleccionado) {
      pagosFiltrados = pagosFiltrados.filter(pago =>
        pago.transaccion.cliente.id === clienteSeleccionado
      )
    }

    // Filtro por búsqueda - manejo seguro para productos nulos
    if (busqueda) {
      pagosFiltrados = pagosFiltrados.filter(pago =>
        pago.transaccion.cliente.nombre.toLowerCase().includes(busqueda.toLowerCase()) ||
        (pago.transaccion.producto?.nombre?.toLowerCase().includes(busqueda.toLowerCase())) ||
        (pago.numero_recibo && pago.numero_recibo.toLowerCase().includes(busqueda.toLowerCase()))
      )
    }

    // Filtro por fecha
    if (fechaDesde) {
      pagosFiltrados = pagosFiltrados.filter(pago =>
        pago.fecha_pago && pago.fecha_pago >= fechaDesde
      )
    }
    if (fechaHasta) {
      pagosFiltrados = pagosFiltrados.filter(pago =>
        pago.fecha_pago && pago.fecha_pago <= fechaHasta
      )
    }

    return pagosFiltrados
  }

  const generarReciboPDF = (pago: PagoConDetalles) => {
    // Aquí implementarías la generación del PDF
    // Por ahora, mostraremos la vista previa
    setReciboSeleccionado(pago)
    setMostrarVistaPrevia(true)
  }

  const imprimirRecibo = (pago: PagoConDetalles) => {
    setReciboSeleccionado(pago)
    setMostrarVistaPrevia(true)
    // Esperar un momento para que se renderice la vista previa
    setTimeout(() => {
      window.print()
    }, 100)
  }

  const enviarReciboPorEmail = async (pago: PagoConDetalles) => {
    if (!pago.transaccion.cliente.email) {
      alert('El cliente no tiene email registrado')
      return
    }

    const subject = encodeURIComponent(`Recibo de Pago - ${pago.numero_recibo || 'Sin número'}`)
    const body = encodeURIComponent(`Estimado/a ${pago.transaccion.cliente.nombre},

Adjunto encontrarás el recibo de tu pago realizado el ${formatearFechaCompleta(pago.fecha_pago!)}.

Detalles del pago:
- ${pago.transaccion.tipo_transaccion === 'prestamo' ? 'Préstamo' : 'Producto'}: ${pago.transaccion.producto?.nombre || 'Préstamo de dinero'}
- Cuota: ${pago.numero_cuota}
- Monto: ${formatearMoneda(pago.monto_pagado)}
- Método: ${pago.metodo_pago?.toUpperCase()}

Gracias por tu pago.

Saludos cordiales.`)

    const url = `mailto:${pago.transaccion.cliente.email}?subject=${subject}&body=${body}`
    window.location.href = url
  }

  const pagosFiltrados = filtrarPagos()

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-lg shadow-sm border p-6">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-semibold text-gray-900 flex items-center">
            <FileText className="w-6 h-6 mr-2" />
            Generador de Recibos
          </h2>
        </div>

        {/* Filtros */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <div className="relative">
            <Search className="absolute left-3 top-3 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Buscar por cliente, producto o recibo..."
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              className="pl-10 pr-4 py-2 w-full border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <select
            value={clienteSeleccionado}
            onChange={(e) => setClienteSeleccionado(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">Todos los clientes</option>
            {clientes.map(cliente => (
              <option key={cliente.id} value={cliente.id}>
                {cliente.nombre}
              </option>
            ))}
          </select>

          <input
            type="date"
            value={fechaDesde}
            onChange={(e) => setFechaDesde(e.target.value)}
            placeholder="Fecha desde"
            className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          />

          <input
            type="date"
            value={fechaHasta}
            onChange={(e) => setFechaHasta(e.target.value)}
            placeholder="Fecha hasta"
            className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        {/* Estadísticas */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <div className="bg-blue-50 rounded-lg p-4 border border-blue-200">
            <div className="text-sm text-blue-600 font-medium">Total Recibos</div>
            <div className="text-2xl font-bold text-blue-700">{pagosFiltrados.length}</div>
          </div>
          <div className="bg-green-50 rounded-lg p-4 border border-green-200">
            <div className="text-sm text-green-600 font-medium">Monto Total</div>
            <div className="text-xl font-bold text-green-700">
              {formatearMoneda(pagosFiltrados.reduce((sum, p) => sum + p.monto_pagado, 0))}
            </div>
          </div>
          <div className="bg-purple-50 rounded-lg p-4 border border-purple-200">
            <div className="text-sm text-purple-600 font-medium">Este Mes</div>
            <div className="text-xl font-bold text-purple-700">
              {pagosFiltrados.filter(p => {
                const fechaPago = new Date(p.fecha_pago!)
                const hoy = new Date()
                return fechaPago.getMonth() === hoy.getMonth() && 
                       fechaPago.getFullYear() === hoy.getFullYear()
              }).length}
            </div>
          </div>
        </div>

        {/* Lista de recibos */}
        <div className="space-y-3">
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
              <span className="ml-2 text-gray-600">Cargando recibos...</span>
            </div>
          ) : pagosFiltrados.length > 0 ? (
            pagosFiltrados.map((pago) => (
              <div
                key={pago.id}
                className="border rounded-lg p-4 hover:shadow-md transition-all bg-white"
              >
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <div className="flex items-center space-x-4">
                      <div className="flex-shrink-0">
                        <FileText className="w-8 h-8 text-blue-500" />
                      </div>
                      
                      <div>
                        <div className="flex items-center space-x-2">
                          <h3 className="font-semibold text-gray-900">
                            {pago.numero_recibo || `REC-${pago.id.slice(0, 8)}`}
                          </h3>
                          <span className="text-sm text-gray-500">•</span>
                          <span className="font-medium text-gray-700">
                            {pago.transaccion.cliente.nombre}
                          </span>
                          {pago.transaccion.tipo_transaccion === 'prestamo' && (
                            <span className="px-2 py-1 bg-green-100 text-green-800 text-xs rounded-full">
                              Préstamo
                            </span>
                          )}
                        </div>
                        
                        <div className="flex items-center space-x-4 mt-1 text-sm text-gray-600">
                          <span>{pago.transaccion.producto?.nombre || 'Préstamo de dinero'}</span>
                          <span>•</span>
                          <span>Cuota {pago.numero_cuota}</span>
                          <span>•</span>
                          <span>Pagado: {formatearFecha(pago.fecha_pago!)}</span>
                          <span>•</span>
                          <span className="font-medium text-green-600">
                            {formatearMoneda(pago.monto_pagado)}
                          </span>
                        </div>

                        <div className="flex items-center space-x-4 mt-1 text-xs text-gray-500">
                          <span>Método: {pago.metodo_pago?.toUpperCase()}</span>
                          {pago.observaciones && (
                            <>
                              <span>•</span>
                              <span>Obs: {pago.observaciones}</span>
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center space-x-2">
                    <button
                      onClick={() => generarReciboPDF(pago)}
                      className="p-2 text-blue-600 hover:bg-blue-100 rounded-full transition-colors"
                      title="Vista previa"
                    >
                      <Eye className="w-4 h-4" />
                    </button>

                    <button
                      onClick={() => imprimirRecibo(pago)}
                      className="p-2 text-gray-600 hover:bg-gray-100 rounded-full transition-colors"
                      title="Imprimir"
                    >
                      <Printer className="w-4 h-4" />
                    </button>

                    <button
                      onClick={() => generarReciboPDF(pago)}
                      className="p-2 text-green-600 hover:bg-green-100 rounded-full transition-colors"
                      title="Descargar PDF"
                    >
                      <Download className="w-4 h-4" />
                    </button>

                    {pago.transaccion.cliente.email && (
                      <button
                        onClick={() => enviarReciboPorEmail(pago)}
                        className="px-3 py-1 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
                      >
                        Enviar
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))
          ) : (
            <div className="text-center py-8 text-gray-500">
              No se encontraron recibos con los filtros aplicados
            </div>
          )}
        </div>
      </div>

      {/* Modal de vista previa del recibo */}
      {mostrarVistaPrevia && reciboSeleccionado && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex items-center justify-between mb-4 print:hidden">
                <h3 className="text-lg font-semibold text-gray-900">Vista Previa del Recibo</h3>
                <div className="flex space-x-2">
                  <button
                    onClick={() => window.print()}
                    className="px-3 py-1 bg-gray-600 text-white rounded hover:bg-gray-700 transition-colors flex items-center space-x-1"
                  >
                    <Printer className="w-4 h-4" />
                    <span>Imprimir</span>
                  </button>
                  <button
                    onClick={() => setMostrarVistaPrevia(false)}
                    className="text-gray-400 hover:text-gray-600"
                  >
                    ✕
                  </button>
                </div>
              </div>

              {/* Contenido del recibo */}
              <div className="bg-white p-8 border print:border-0">
                {/* Header */}
                <div className="text-center mb-8">
                  <h1 className="text-2xl font-bold text-gray-900 mb-2">RECIBO DE PAGO</h1>
                  <div className="text-lg font-semibold text-blue-600">
                    N° {reciboSeleccionado.numero_recibo || `REC-${reciboSeleccionado.id.slice(0, 8)}`}
                  </div>
                  {reciboSeleccionado.transaccion.tipo_transaccion === 'prestamo' && (
                    <div className="mt-2">
                      <span className="px-3 py-1 bg-green-100 text-green-800 text-sm rounded-full">
                        PRÉSTAMO
                      </span>
                    </div>
                  )}
                </div>

                {/* Información de la empresa */}
                <div className="mb-6 p-4 bg-gray-50 rounded">
                  <h3 className="font-semibold text-gray-900 mb-2">Datos del Comercio:</h3>
                  <div className="text-sm text-gray-700">
                    <div>Tu Empresa S.A.</div>
                    <div>Dirección de tu empresa</div>
                    <div>Teléfono: (123) 456-7890</div>
                    <div>Email: info@tuempresa.com</div>
                  </div>
                </div>

                {/* Información del cliente */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                  <div>
                    <h3 className="font-semibold text-gray-900 mb-2">Cliente:</h3>
                    <div className="text-sm text-gray-700 space-y-1">
                      <div><strong>Nombre:</strong> {reciboSeleccionado.transaccion.cliente.nombre}</div>
                      {reciboSeleccionado.transaccion.cliente.documento && (
                        <div><strong>Documento:</strong> {reciboSeleccionado.transaccion.cliente.documento}</div>
                      )}
                      {reciboSeleccionado.transaccion.cliente.telefono && (
                        <div><strong>Teléfono:</strong> {reciboSeleccionado.transaccion.cliente.telefono}</div>
                      )}
                      {reciboSeleccionado.transaccion.cliente.email && (
                        <div><strong>Email:</strong> {reciboSeleccionado.transaccion.cliente.email}</div>
                      )}
                    </div>
                  </div>

                  <div>
                    <h3 className="font-semibold text-gray-900 mb-2">Datos del Pago:</h3>
                    <div className="text-sm text-gray-700 space-y-1">
                      <div><strong>Fecha de Pago:</strong> {formatearFechaCompleta(reciboSeleccionado.fecha_pago!)}</div>
                      <div><strong>Método:</strong> {reciboSeleccionado.metodo_pago?.toUpperCase()}</div>
                      <div><strong>Cuota:</strong> {reciboSeleccionado.numero_cuota}</div>
                      <div><strong>Tipo:</strong> {reciboSeleccionado.transaccion.tipo_transaccion === 'prestamo' ? 'Préstamo' : 'Venta'}</div>
                    </div>
                  </div>
                </div>

                {/* Detalle del producto/servicio */}
                <div className="mb-6">
                  <h3 className="font-semibold text-gray-900 mb-3">Detalle:</h3>
                  <div className="border rounded overflow-hidden">
                    <table className="w-full">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="text-left py-2 px-4 text-sm font-medium text-gray-700">Concepto</th>
                          <th className="text-center py-2 px-4 text-sm font-medium text-gray-700">Cuota</th>
                          <th className="text-right py-2 px-4 text-sm font-medium text-gray-700">Monto</th>
                        </tr>
                      </thead>
                      <tbody>
                        <tr>
                          <td className="py-3 px-4 text-sm text-gray-900">
                            {reciboSeleccionado.transaccion.producto?.nombre || 'Préstamo de dinero'}
                          </td>
                          <td className="py-3 px-4 text-sm text-center text-gray-900">
                            {reciboSeleccionado.numero_cuota}
                          </td>
                          <td className="py-3 px-4 text-sm text-right font-semibold text-gray-900">
                            {formatearMoneda(reciboSeleccionado.monto_pagado)}
                          </td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Total */}
                <div className="flex justify-end mb-6">
                  <div className="bg-blue-50 p-4 rounded">
                    <div className="text-right">
                      <div className="text-sm text-gray-600">Total Pagado:</div>
                      <div className="text-2xl font-bold text-blue-700">
                        {formatearMoneda(reciboSeleccionado.monto_pagado)}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Observaciones */}
                {reciboSeleccionado.observaciones && (
                  <div className="mb-6">
                    <h3 className="font-semibold text-gray-900 mb-2">Observaciones:</h3>
                    <div className="text-sm text-gray-700 bg-gray-50 p-3 rounded">
                      {reciboSeleccionado.observaciones}
                    </div>
                  </div>
                )}

                {/* Footer */}
                <div className="text-center text-xs text-gray-500 mt-8 pt-4 border-t">
                  <div>Este es un comprobante válido de pago</div>
                  <div>Recibo generado el {formatearFechaCompleta(new Date().toISOString())}</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}