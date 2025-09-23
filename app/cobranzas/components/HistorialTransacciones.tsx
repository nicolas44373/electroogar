import { Cliente, Transaccion, Pago } from '@/app/lib/types/cobranzas'
import TablaPagos from './TablaPagos'
import ResumenPagos from './ResumenPagos'

interface HistorialTransaccionesProps {
  cliente: Cliente
  transacciones: Transaccion[]
  pagos: { [key: string]: Pago[] }
  onPagoRegistrado: () => void
  loading?: boolean
}

export default function HistorialTransacciones({
  cliente,
  transacciones,
  pagos,
  onPagoRegistrado,
  loading = false
}: HistorialTransaccionesProps) {
  
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

  // Función para obtener el título de la transacción
  const obtenerTituloTransaccion = (transaccion: Transaccion) => {
    if (transaccion.tipo_transaccion === 'prestamo') {
      return 'Préstamo de Dinero'
    }
    
    // Para ventas, mostrar el producto si existe
    return transaccion.producto?.nombre || 'Venta de Producto'
  }

  // Función para formatear fecha correctamente
  const formatearFecha = (fecha: string) => {
    try {
      // Parsear fecha como local para evitar conversión UTC
      const [year, month, day] = fecha.split('-').map(Number)
      const fechaObj = new Date(year, month - 1, day) // month - 1 porque los meses en JS van de 0-11
      return fechaObj.toLocaleDateString('es-AR', {
        day: '2-digit',
        month: '2-digit', 
        year: 'numeric'
      })
    } catch {
      return fecha
    }
  }

  return (
    <div className="space-y-6">
      <h2 className="text-xl font-semibold">Historial de Compras y Préstamos</h2>
      
      {transacciones.map((transaccion) => (
        <div key={transaccion.id} className="bg-white rounded-lg shadow overflow-hidden">
          {/* Header de la transacción */}
          <div className="bg-gradient-to-r from-gray-50 to-white p-6">
            <div className="flex justify-between items-start">
              <div>
                <h3 className="font-semibold text-lg flex items-center gap-2">
                  {transaccion.tipo_transaccion === 'venta' ? '🛒' : '💰'}
                  {obtenerTituloTransaccion(transaccion)}
                </h3>
                <div className="mt-2 space-y-1">
                  <p className="text-gray-600 text-sm">
                    Tipo: <span className="font-medium">
                      {transaccion.tipo_transaccion === 'venta' ? 'Venta' : 'Préstamo'}
                    </span>
                  </p>
                  <p className="text-gray-600 text-sm">
                    Plan de pago: <span className="font-medium capitalize">
                      {transaccion.tipo_pago}
                    </span>
                  </p>
                  <p className="text-gray-600 text-sm">
                    <EstadoBadge estado={transaccion.estado || 'activo'} />
                  </p>
                  <p className="text-gray-500 text-xs">
                    Inicio: {formatearFecha(transaccion.fecha_inicio)}
                  </p>
                </div>
              </div>
              <div className="text-right">
                <p className="text-3xl font-bold text-gray-800">
                  ${transaccion.monto_total.toLocaleString('es-AR')}
                </p>
                <p className="text-sm text-gray-600 mt-1">
                  {transaccion.numero_cuotas} cuotas de ${transaccion.monto_cuota.toFixed(2)}
                </p>
                
                {/* Mostrar información adicional para préstamos */}
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
            </div>
          </div>
          
          {/* Tabla de pagos */}
          <TablaPagos
            transaccion={transaccion}
            pagos={pagos[transaccion.id] || []}
            onPagoRegistrado={onPagoRegistrado}
          />
          
          {/* Resumen */}
          <ResumenPagos
            transaccion={transaccion}
            pagos={pagos[transaccion.id] || []}
          />
        </div>
      ))}
    </div>
  )
}

// Componente auxiliar para el badge de estado
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