import { useState } from 'react'
import { Cliente, Transaccion, Pago } from '@/app/lib/types/cobranzas'
import TablaPagos from './TablaPagos'
import ResumenPagos from './ResumenPagos'
import ExportadorPDFCliente from './Exportadorpdfcliente'

interface HistorialTransaccionesProps {
  cliente: Cliente
  transacciones: Transaccion[]
  pagos: { [key: string]: Pago[] }
  onPagoRegistrado: () => void
  onEliminarTransaccion?: (transaccionId: string) => Promise<void>
  loading?: boolean
}

export default function HistorialTransacciones({
  cliente,
  transacciones,
  pagos,
  onPagoRegistrado,
  onEliminarTransaccion,
  loading = false
}: HistorialTransaccionesProps) {
  const [eliminando, setEliminando] = useState<string | null>(null)
  const [mostrarConfirmacion, setMostrarConfirmacion] = useState<string | null>(null)
  
  if (loading) {
    return (
      <div className="bg-white p-6 rounded-lg shadow text-center">
        <div className="animate-pulse">
          <div className="h-4 bg-gray-200 rounded w-1/4 mx-auto mb-2"></div>
          <div className="h-4 bg-gray-200 rounded w-1/3 mx-auto"></div>
        </div>
      </div>
    )
  }
  
  if (transacciones.length === 0) {
    return (
      <div className="bg-white p-6 rounded-lg shadow text-center text-gray-500">
        <p className="text-lg mb-2">📋 No hay transacciones registradas</p>
        <p className="text-sm">Las nuevas ventas y préstamos aparecerán aquí</p>
      </div>
    )
  }

  const obtenerTituloTransaccion = (transaccion: Transaccion) => {
    if (transaccion.tipo_transaccion === 'prestamo') return 'Préstamo de Dinero'
    return transaccion.producto?.nombre || 'Venta de Producto'
  }

  const formatearFecha = (fecha: string) => {
    try {
      const [year, month, day] = fecha.split('-').map(Number)
      const fechaObj = new Date(year, month - 1, day)
      return fechaObj.toLocaleDateString('es-AR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric'
      })
    } catch {
      return fecha
    }
  }

  const handleEliminar = async (transaccionId: string) => {
    if (!onEliminarTransaccion) return
    setEliminando(transaccionId)
    try {
      await onEliminarTransaccion(transaccionId)
      setMostrarConfirmacion(null)
    } catch (error) {
      console.error('Error al eliminar transacción:', error)
      alert('Error al eliminar la transacción. Por favor intenta de nuevo.')
    } finally {
      setEliminando(null)
    }
  }

  return (
    <div className="space-y-6 px-2 sm:px-4">
      <h2 className="text-lg sm:text-xl font-semibold text-center sm:text-left">
        Historial de Compras y Préstamos
      </h2>
      
      {/* Exportador PDF */}
      <ExportadorPDFCliente 
        cliente={cliente}
        transacciones={transacciones}
        pagos={pagos}
      />
      
      {transacciones.map((transaccion) => (
        <div
          key={transaccion.id}
          className="bg-white rounded-lg shadow overflow-hidden relative"
        >
          {/* Modal */}
          {mostrarConfirmacion === transaccion.id && (
            <div className="fixed inset-0 bg-black bg-opacity-50 z-20 flex items-center justify-center p-2 sm:p-4">
              <div className="bg-white rounded-lg p-4 sm:p-6 w-full max-w-sm sm:max-w-md shadow-xl">
                <h3 className="text-base sm:text-lg font-semibold mb-3 text-red-600">
                  ⚠️ Confirmar eliminación
                </h3>
                <div className="mb-4 text-sm sm:text-base">
                  <p className="text-gray-700 mb-2">
                    ¿Estás seguro de que deseas eliminar esta transacción?
                  </p>
                  <div className="bg-gray-50 p-3 rounded text-xs sm:text-sm">
                    <p className="font-medium">{obtenerTituloTransaccion(transaccion)}</p>
                    <p className="text-gray-600">Monto: ${transaccion.monto_total.toLocaleString('es-AR')}</p>
                    <p className="text-gray-600">Cuotas: {transaccion.numero_cuotas}</p>
                  </div>
                  <p className="text-red-600 text-xs sm:text-sm mt-3 font-medium">
                    ⚠️ Esta acción eliminará permanentemente la transacción y todos sus pagos asociados.
                  </p>
                </div>
                <div className="flex gap-2 sm:gap-3 justify-end flex-wrap">
                  <button
                    onClick={() => setMostrarConfirmacion(null)}
                    className="px-3 py-2 text-gray-600 hover:text-gray-800 transition-colors text-sm"
                    disabled={eliminando === transaccion.id}
                  >
                    Cancelar
                  </button>
                  <button
                    onClick={() => handleEliminar(transaccion.id)}
                    disabled={eliminando === transaccion.id}
                    className="px-3 py-2 bg-red-600 text-white rounded hover:bg-red-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-sm flex items-center gap-2"
                  >
                    {eliminando === transaccion.id ? (
                      <>
                        <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                        </svg>
                        Eliminando...
                      </>
                    ) : (
                      'Eliminar transacción'
                    )}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Header */}
          <div className="bg-gradient-to-r from-gray-50 to-white p-4 sm:p-6">
            <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-3 sm:gap-0">
              <div>
                <h3 className="font-semibold text-base sm:text-lg flex items-center gap-2">
                  {transaccion.tipo_transaccion === 'venta' ? '🛒' : '💰'}
                  {obtenerTituloTransaccion(transaccion)}
                </h3>
                <div className="mt-1 sm:mt-2 space-y-1 text-sm sm:text-base">
                  <p className="text-gray-600">
                    Tipo: <span className="font-medium">{transaccion.tipo_transaccion === 'venta' ? 'Venta' : 'Préstamo'}</span>
                  </p>
                  <p className="text-gray-600">
                    Plan de pago: <span className="font-medium capitalize">{transaccion.tipo_pago}</span>
                  </p>
                  <p className="text-gray-600">
                    <EstadoBadge estado={transaccion.estado || 'activo'} />
                  </p>
                  <p className="text-gray-500 text-xs">
                    Inicio: {formatearFecha(transaccion.fecha_inicio)}
                  </p>
                </div>
              </div>

              <div className="text-right">
                <div className="flex flex-col sm:flex-row sm:items-start sm:gap-2">
                  <div>
                    <p className="text-2xl sm:text-3xl font-bold text-gray-800">
                      ${transaccion.monto_total.toLocaleString('es-AR')}
                    </p>
                    <p className="text-xs sm:text-sm text-gray-600 mt-1">
                      {transaccion.numero_cuotas} cuotas de ${transaccion.monto_cuota.toFixed(2)}
                    </p>

                    {transaccion.tipo_transaccion === 'prestamo' && (
                      <div className="mt-2 text-xs text-gray-500">
                        {transaccion.monto_original && (
                          <p>Monto original: ${transaccion.monto_original.toFixed(2)}</p>
                        )}
                        {transaccion.interes_porcentaje && transaccion.interes_porcentaje > 0 && (
                          <p>Interés aplicado: {transaccion.interes_porcentaje}%</p>
                        )}
                      </div>
                    )}
                  </div>

                  {onEliminarTransaccion && (
                    <button
                      onClick={() => setMostrarConfirmacion(transaccion.id)}
                      className="p-2 mt-2 sm:mt-0 text-gray-400 hover:text-red-600 transition-colors relative self-end sm:self-auto"
                      title="Eliminar transacción"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"
                        strokeWidth={1.5} stroke="currentColor" className="w-5 h-5 sm:w-6 sm:h-6">
                        <path strokeLinecap="round" strokeLinejoin="round"
                          d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 
                          0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-
                          2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-
                          2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 
                          00-7.5 0" />
                      </svg>
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Tabla pagos con scroll horizontal */}
          <div className="overflow-x-auto">
            <TablaPagos
              transaccion={transaccion}
              pagos={pagos[transaccion.id] || []}
              onPagoRegistrado={onPagoRegistrado}
            />
          </div>

          {/* Resumen */}
          <div className="px-2 sm:px-4 pb-4">
            <ResumenPagos
              transaccion={transaccion}
              pagos={pagos[transaccion.id] || []}
            />
          </div>
        </div>
      ))}
    </div>
  )
}

function EstadoBadge({ estado }: { estado: string }) {
  const estilos = {
    activo: 'bg-green-100 text-green-800',
    completado: 'bg-blue-100 text-blue-800',
    moroso: 'bg-red-100 text-red-800'
  }
  const etiquetas = {
    activo: 'Activo',
    completado: 'Completado',
    moroso: 'Moroso'
  }
  return (
    <span className={`px-2 py-1 rounded-full text-xs font-medium ${
      estilos[estado as keyof typeof estilos] || 'bg-gray-100 text-gray-800'
    }`}>
      {etiquetas[estado as keyof typeof etiquetas] || estado}
    </span>
  )
}