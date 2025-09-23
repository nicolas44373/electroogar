import { useState, useEffect } from 'react'
import { Calendar, DollarSign, FileText, TrendingUp, TrendingDown } from 'lucide-react'
import { Transaccion, Pago } from '@/app/lib/types/cobranzas'
import { supabase } from '@/app/lib/supabase' // Asegurate de tener tu cliente supabase

interface MovimientoCuentaCorriente {
  id: string
  fecha: string
  tipo: 'venta' | 'pago'
  descripcion: string
  debe: number
  haber: number
  saldo: number
  referencia?: string
  estado?: string
}

interface CuentaCorrienteProps {
  clienteId: string
  transacciones: Transaccion[]
  pagos: { [key: string]: Pago[] }
}

export default function CuentaCorriente({ clienteId, transacciones, pagos }: CuentaCorrienteProps) {
  const [movimientos, setMovimientos] = useState<MovimientoCuentaCorriente[]>([])
  const [filtroTipo, setFiltroTipo] = useState<'todos' | 'ventas' | 'pagos'>('todos')
  const [fechaDesde, setFechaDesde] = useState('')
  const [fechaHasta, setFechaHasta] = useState('')

  // Estados para modal de pagos
  const [modalPagoAbierto, setModalPagoAbierto] = useState(false)
  const [ventaSeleccionada, setVentaSeleccionada] = useState<MovimientoCuentaCorriente | null>(null)
  const [montoPago, setMontoPago] = useState<number>(0)
  const [fechaPago, setFechaPago] = useState<string>('')

  useEffect(() => {
    generarMovimientos()
  }, [transacciones, pagos])

  const formatearMoneda = (monto: number) => {
    return new Intl.NumberFormat('es-AR', {
      style: 'currency',
      currency: 'ARS'
    }).format(monto)
  }

  const formatearFecha = (fecha: string) => {
    return new Date(fecha).toLocaleDateString('es-AR')
  }

  const generarMovimientos = () => {
    const movimientosTemp: MovimientoCuentaCorriente[] = []

    transacciones.forEach(transaccion => {
      movimientosTemp.push({
        id: `venta-${transaccion.id}`,
        fecha: transaccion.created_at,
        tipo: 'venta',
        descripcion: `Venta - ${transaccion.producto?.nombre || 'Producto'}`,
        debe: transaccion.monto_total,
        haber: 0,
        saldo: 0,
        referencia: `Fact. ${transaccion.numero_factura || transaccion.id.slice(0, 8)}`,
        estado: transaccion.estado
      })

      const pagosTransaccion = pagos[transaccion.id] || []
      pagosTransaccion
        .filter(pago => pago.estado === 'pagado' && pago.fecha_pago)
        .forEach(pago => {
          movimientosTemp.push({
            id: `pago-${pago.id}`,
            fecha: pago.fecha_pago!,
            tipo: 'pago',
            descripcion: `Pago cuota ${pago.numero_cuota} - ${transaccion.producto?.nombre || 'Producto'}`,
            debe: 0,
            haber: pago.monto_pagado,
            saldo: 0,
            referencia: `Recibo ${pago.numero_recibo || pago.id.slice(0, 8)}`,
            estado: pago.estado
          })
        })
    })

    movimientosTemp.sort((a, b) => new Date(a.fecha).getTime() - new Date(b.fecha).getTime())

    let saldoAcumulado = 0
    movimientosTemp.forEach(mov => {
      saldoAcumulado += mov.debe - mov.haber
      mov.saldo = saldoAcumulado
    })

    setMovimientos(movimientosTemp)
  }

  const movimientosFiltrados = movimientos.filter(mov => {
    if (filtroTipo !== 'todos') {
      if (filtroTipo === 'ventas' && mov.tipo !== 'venta') return false
      if (filtroTipo === 'pagos' && mov.tipo !== 'pago') return false
    }
    if (fechaDesde && new Date(mov.fecha) < new Date(fechaDesde)) return false
    if (fechaHasta && new Date(mov.fecha) > new Date(fechaHasta)) return false
    return true
  })

  const saldoActual = movimientos.length > 0 ? movimientos[movimientos.length - 1].saldo : 0
  const totalVentas = movimientos.reduce((sum, mov) => sum + mov.debe, 0)
  const totalPagos = movimientos.reduce((sum, mov) => sum + mov.haber, 0)

  // Funciones para modal
  const abrirModalPago = (mov: MovimientoCuentaCorriente) => {
    setVentaSeleccionada(mov)
    setMontoPago(0)
    setFechaPago(new Date().toISOString().split('T')[0])
    setModalPagoAbierto(true)
  }

  const cerrarModalPago = () => setModalPagoAbierto(false)

  const registrarPago = async () => {
    if (!ventaSeleccionada) return

    const { data, error } = await supabase
      .from('pagos')
      .insert({
        transaccion_id: ventaSeleccionada.id.replace('venta-', ''),
        numero_cuota: 1,
        monto_pagado: montoPago,
        fecha_pago: fechaPago,
        fecha_vencimiento: fechaPago,
        estado: 'pagado',
        metodo_pago: 'efectivo'
      })

    if (error) {
      alert('Error al registrar el pago: ' + error.message)
    } else {
      alert('Pago registrado correctamente')
      cerrarModalPago()
      generarMovimientos()
    }
  }

  return (
    <div className="bg-white rounded-lg shadow-sm border">
      <div className="p-6 border-b">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-900 flex items-center">
            <FileText className="w-5 h-5 mr-2" />
            Cuenta Corriente
          </h3>
        </div>

        {/* Resumen de saldos */}
        <div className="grid grid-cols-3 gap-4 mb-4">
          <div className="text-center p-3 bg-blue-50 rounded-lg">
            <div className="flex items-center justify-center mb-1">
              <TrendingUp className="w-4 h-4 text-blue-600" />
            </div>
            <div className="text-sm text-blue-600 font-medium">Total Ventas</div>
            <div className="text-lg font-bold text-blue-700">{formatearMoneda(totalVentas)}</div>
          </div>
          <div className="text-center p-3 bg-green-50 rounded-lg">
            <div className="flex items-center justify-center mb-1">
              <TrendingDown className="w-4 h-4 text-green-600" />
            </div>
            <div className="text-sm text-green-600 font-medium">Total Pagos</div>
            <div className="text-lg font-bold text-green-700">{formatearMoneda(totalPagos)}</div>
          </div>
          <div className="text-center p-3 bg-gray-50 rounded-lg">
            <div className="flex items-center justify-center mb-1">
              <DollarSign className="w-4 h-4 text-gray-600" />
            </div>
            <div className="text-sm text-gray-600 font-medium">Saldo Actual</div>
            <div className={`text-lg font-bold ${saldoActual > 0 ? 'text-red-700' : saldoActual < 0 ? 'text-green-700' : 'text-gray-700'}`}>
              {formatearMoneda(Math.abs(saldoActual))}
              {saldoActual > 0 && <span className="text-xs ml-1">(Debe)</span>}
              {saldoActual < 0 && <span className="text-xs ml-1">(Favor)</span>}
            </div>
          </div>
        </div>

        {/* Filtros */}
        <div className="flex flex-wrap gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Tipo</label>
            <select
              value={filtroTipo}
              onChange={(e) => setFiltroTipo(e.target.value as any)}
              className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
            >
              <option value="todos">Todos</option>
              <option value="ventas">Solo Ventas</option>
              <option value="pagos">Solo Pagos</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Desde</label>
            <input
              type="date"
              value={fechaDesde}
              onChange={(e) => setFechaDesde(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Hasta</label>
            <input
              type="date"
              value={fechaHasta}
              onChange={(e) => setFechaHasta(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
            />
          </div>
          {(fechaDesde || fechaHasta || filtroTipo !== 'todos') && (
            <div className="flex items-end">
              <button
                onClick={() => {
                  setFechaDesde('')
                  setFechaHasta('')
                  setFiltroTipo('todos')
                }}
                className="px-3 py-2 text-sm text-gray-600 hover:text-gray-800 underline"
              >
                Limpiar filtros
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Tabla de movimientos */}
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Fecha</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Descripción</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Referencia</th>
              <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Debe</th>
              <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Haber</th>
              <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Saldo</th>
              <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Acción</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {movimientosFiltrados.length > 0 ? (
              movimientosFiltrados.map((movimiento, index) => (
                <tr key={movimiento.id} className={index % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                  <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900">
                    <div className="flex items-center">
                      <Calendar className="w-4 h-4 text-gray-400 mr-2" />
                      {formatearFecha(movimiento.fecha)}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-900">
                    <div>
                      <div className="font-medium">{movimiento.descripcion}</div>
                      {movimiento.tipo === 'venta' && (
                        <div className="text-xs text-blue-600 flex items-center mt-1">
                          <TrendingUp className="w-3 h-3 mr-1" />
                          Venta
                        </div>
                      )}
                      {movimiento.tipo === 'pago' && (
                        <div className="text-xs text-green-600 flex items-center mt-1">
                          <TrendingDown className="w-3 h-3 mr-1" />
                          Pago
                        </div>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500">{movimiento.referencia}</td>
                  <td className="px-4 py-3 whitespace-nowrap text-sm text-right">
                    {movimiento.debe > 0 && (
                      <span className="text-red-600 font-medium">{formatearMoneda(movimiento.debe)}</span>
                    )}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-sm text-right">
                    {movimiento.haber > 0 && (
                      <span className="text-green-600 font-medium">{formatearMoneda(movimiento.haber)}</span>
                    )}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-sm text-right font-medium">
                    <span className={movimiento.saldo > 0 ? 'text-red-600' : movimiento.saldo < 0 ? 'text-green-600' : 'text-gray-600'}>
                      {formatearMoneda(Math.abs(movimiento.saldo))}
                      {movimiento.saldo > 0 && <span className="text-xs ml-1">D</span>}
                      {movimiento.saldo < 0 && <span className="text-xs ml-1">F</span>}
                    </span>
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-sm text-right">
                    {movimiento.tipo === 'venta' && (
                      <button
                        onClick={() => abrirModalPago(movimiento)}
                        className="px-2 py-1 bg-green-600 text-white rounded text-xs hover:bg-green-700"
                      >
                        Registrar Pago
                      </button>
                    )}
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-gray-500">
                  No hay movimientos para mostrar
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Pie con saldo final */}
      <div className="p-4 border-t bg-gray-50">
        <div className="flex justify-between items-center">
          <div className="text-sm text-gray-600">Total de movimientos: {movimientosFiltrados.length}</div>
          <div className="text-right">
            <div className="text-sm text-gray-600">Saldo Final</div>
            <div className={`text-xl font-bold ${saldoActual > 0 ? 'text-red-600' : saldoActual < 0 ? 'text-green-600' : 'text-gray-600'}`}>
              {formatearMoneda(Math.abs(saldoActual))}
              {saldoActual > 0 && <span className="text-sm ml-1">(A favor del comercio)</span>}
              {saldoActual < 0 && <span className="text-sm ml-1">(A favor del cliente)</span>}
              {saldoActual === 0 && <span className="text-sm ml-1">(Cuenta saldada)</span>}
            </div>
          </div>
        </div>
      </div>

      {/* Modal de registro de pago */}
      {modalPagoAbierto && ventaSeleccionada && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-80">
            <h3 className="text-lg font-semibold mb-4">Registrar pago</h3>
            <div className="mb-3">
              <label className="block text-sm font-medium text-gray-700">Monto</label>
              <input
                type="number"
                value={montoPago}
                onChange={(e) => setMontoPago(parseFloat(e.target.value))}
                className="w-full border px-2 py-1 rounded"
              />
            </div>
            <div className="mb-3">
              <label className="block text-sm font-medium text-gray-700">Fecha</label>
              <input
                type="date"
                value={fechaPago}
                onChange={(e) => setFechaPago(e.target.value)}
                className="w-full border px-2 py-1 rounded"
              />
            </div>
            <div className="flex justify-end gap-2">
              <button onClick={cerrarModalPago} className="px-3 py-1 bg-gray-300 rounded">Cancelar</button>
              <button onClick={registrarPago} className="px-3 py-1 bg-green-600 text-white rounded">Registrar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
