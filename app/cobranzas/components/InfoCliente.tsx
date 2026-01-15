
import { Cliente } from '@/app/lib/types/cobranzas'

interface InfoClienteProps {
  cliente: Cliente
  mostrarFormulario: boolean
  onToggleFormulario: () => void
}

export default function InfoCliente({ 
  cliente, 
  mostrarFormulario, 
  onToggleFormulario 
}: InfoClienteProps) {
  return (
    <div className="bg-white p-6 rounded-lg shadow mb-6">
      <div className="flex justify-between items-start">
        <div>
          <h2 className="text-xl font-semibold mb-2">
            {cliente.nombre} {cliente.apellido}
          </h2>
          <div className="space-y-1 text-gray-600">
            <p>📄 Documento: <span className="font-mono">{cliente.documento}</span></p>
            {cliente.telefono && <p>📱 Teléfono: {cliente.telefono}</p>}
            {cliente.email && <p>✉️ Email: {cliente.email}</p>}
            {cliente.direccion && <p>📍 Dirección: {cliente.direccion}</p>}
          </div>
        </div>
        <button
          onClick={onToggleFormulario}
          className={`px-4 py-2 rounded transition-colors ${
            mostrarFormulario 
              ? 'bg-gray-500 hover:bg-gray-600' 
              : 'bg-green-500 hover:bg-green-600'
          } text-white`}
        >
          {mostrarFormulario ? 'Cancelar' : '➕ Nueva Venta/Préstamo'}
        </button>
      </div>
    </div>
  )
}