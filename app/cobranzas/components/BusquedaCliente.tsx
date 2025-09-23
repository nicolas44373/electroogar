
import { useState } from 'react'
import { supabase } from '@/app/lib/supabase'
import { Cliente } from '@/app/lib/types/cobranzas'

interface BusquedaClienteProps {
  clientes: Cliente[]
  clienteSeleccionado: string
  onClienteSeleccionado: (clienteId: string) => void
}

export default function BusquedaCliente({ 
  clientes, 
  clienteSeleccionado, 
  onClienteSeleccionado 
}: BusquedaClienteProps) {
  const [busquedaDocumento, setBusquedaDocumento] = useState('')
  const [buscando, setBuscando] = useState(false)

  const buscarPorDocumento = async () => {
    if (!busquedaDocumento.trim()) {
      alert('Por favor ingrese un documento')
      return
    }
    
    setBuscando(true)
    try {
      const { data, error } = await supabase
        .from('clientes')
        .select('*')
        .eq('documento', busquedaDocumento.trim())
        .single()
      
      if (error) throw error
      
      if (data) {
        onClienteSeleccionado(data.id)
        setBusquedaDocumento('')
      }
    } catch (error) {
      alert('Cliente no encontrado')
    } finally {
      setBuscando(false)
    }
  }

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      buscarPorDocumento()
    }
  }

  return (
    <div className="bg-white p-6 rounded-lg shadow mb-6">
      <h2 className="text-xl font-semibold mb-4">Buscar Cliente</h2>
      <div className="flex gap-4">
        <input
          type="text"
          placeholder="Buscar por documento/ID"
          value={busquedaDocumento}
          onChange={(e) => setBusquedaDocumento(e.target.value)}
          onKeyPress={handleKeyPress}
          className="border p-2 rounded flex-1"
          disabled={buscando}
        />
        <button
          onClick={buscarPorDocumento}
          disabled={buscando}
          className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600 disabled:opacity-50"
        >
          {buscando ? 'Buscando...' : 'Buscar'}
        </button>
        <select
          value={clienteSeleccionado}
          onChange={(e) => onClienteSeleccionado(e.target.value)}
          className="border p-2 rounded min-w-[250px]"
        >
          <option value="">Seleccionar cliente...</option>
          {clientes.map(cliente => (
            <option key={cliente.id} value={cliente.id}>
              {cliente.nombre} {cliente.apellido} - {cliente.documento}
            </option>
          ))}
        </select>
      </div>
    </div>
  )
}