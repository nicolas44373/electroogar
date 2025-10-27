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
    <div className="bg-white p-4 sm:p-6 rounded-lg shadow mb-6">
      <h2 className="text-lg sm:text-xl font-semibold mb-4">Buscar Cliente</h2>
      
      {/* Contenedor principal - Stack en móvil, row en desktop */}
      <div className="flex flex-col lg:flex-row gap-3 lg:gap-4">
        
        {/* Grupo de búsqueda - Se mantiene junto */}
        <div className="flex flex-col sm:flex-row gap-3 flex-1">
          {/* Input de búsqueda */}
          <input
            type="text"
            placeholder="Buscar por documento/ID"
            value={busquedaDocumento}
            onChange={(e) => setBusquedaDocumento(e.target.value)}
            onKeyPress={handleKeyPress}
            className="border p-2 rounded flex-1 w-full text-sm sm:text-base"
            disabled={buscando}
          />
          
          {/* Botón de búsqueda */}
          <button
            onClick={buscarPorDocumento}
            disabled={buscando}
            className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600 disabled:opacity-50 w-full sm:w-auto text-sm sm:text-base font-medium transition-colors"
          >
            {buscando ? (
              <span className="flex items-center justify-center gap-2">
                <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
                Buscando...
              </span>
            ) : (
              <span className="flex items-center justify-center gap-2">
                <span className="sm:hidden">🔍</span>
                <span>Buscar</span>
              </span>
            )}
          </button>
        </div>
        
        {/* Separador visual en móvil */}
        <div className="relative block lg:hidden">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-gray-300"></div>
          </div>
          <div className="relative flex justify-center text-sm">
            <span className="px-2 bg-white text-gray-500">o</span>
          </div>
        </div>
        
        {/* Select de clientes */}
        <select
          value={clienteSeleccionado}
          onChange={(e) => onClienteSeleccionado(e.target.value)}
          className="border p-2 rounded w-full lg:w-auto lg:min-w-[250px] text-sm sm:text-base bg-white"
        >
          <option value="">Seleccionar cliente...</option>
          {clientes.map(cliente => (
            <option key={cliente.id} value={cliente.id}>
              {cliente.nombre} {cliente.apellido} - {cliente.documento}
            </option>
          ))}
        </select>
      </div>
      
      {/* Texto de ayuda en móvil */}
      <p className="text-xs text-gray-500 mt-3 sm:hidden">
        💡 Puedes buscar por documento o seleccionar de la lista
      </p>
    </div>
  )
}