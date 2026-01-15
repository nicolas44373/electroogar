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
  const [busqueda, setBusqueda] = useState('')
  const [buscando, setBuscando] = useState(false)
  const [resultadosBusqueda, setResultadosBusqueda] = useState<Cliente[]>([])
  const [mostrarResultados, setMostrarResultados] = useState(false)

  const buscarCliente = async () => {
    if (!busqueda.trim()) {
      alert('Por favor ingrese un término de búsqueda')
      return
    }
    
    setBuscando(true)
    setResultadosBusqueda([])
    
    try {
      const terminoBusqueda = busqueda.trim()
      
      // Intentar búsqueda por ID primero (búsqueda exacta)
      let { data, error } = await supabase
        .from('clientes')
        .select('*')
        .eq('id', terminoBusqueda)
      
      // Si no se encontró por ID, buscar por otros campos
      if (!data || data.length === 0) {
        const busquedaPattern = `%${terminoBusqueda}%`
        
        const response = await supabase
          .from('clientes')
          .select('*')
          .or(`nombre.ilike.${busquedaPattern},apellido.ilike.${busquedaPattern},documento.ilike.${busquedaPattern}`)
        
        data = response.data
        error = response.error
      }
      
      if (error) throw error
      
      if (data && data.length > 0) {
        setResultadosBusqueda(data)
        setMostrarResultados(true)
        
        // Si solo hay un resultado, seleccionarlo automáticamente
        if (data.length === 1) {
          onClienteSeleccionado(data[0].id)
          setBusqueda('')
          setMostrarResultados(false)
          setResultadosBusqueda([])
        }
      } else {
        alert('No se encontraron clientes con ese criterio de búsqueda')
      }
    } catch (error) {
      console.error('Error en búsqueda:', error)
      alert('Error al buscar cliente. Por favor intenta de nuevo.')
    } finally {
      setBuscando(false)
    }
  }

  const seleccionarCliente = (cliente: Cliente) => {
    onClienteSeleccionado(cliente.id)
    setBusqueda('')
    setMostrarResultados(false)
    setResultadosBusqueda([])
  }

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      buscarCliente()
    }
    if (e.key === 'Escape') {
      setMostrarResultados(false)
      setResultadosBusqueda([])
    }
  }

  return (
    <div className="bg-white p-4 sm:p-6 rounded-lg shadow mb-6">
      <h2 className="text-lg sm:text-xl font-semibold mb-4">Buscar Cliente</h2>
      
      {/* Contenedor principal - Stack en móvil, row en desktop */}
      <div className="flex flex-col lg:flex-row gap-3 lg:gap-4">
        
        {/* Grupo de búsqueda - Se mantiene junto */}
        <div className="flex flex-col sm:flex-row gap-3 flex-1 relative">
          {/* Input de búsqueda */}
          <div className="flex-1 relative">
            <input
              type="text"
              placeholder="Buscar por nombre, apellido, documento o ID..."
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              onKeyPress={handleKeyPress}
              className="border p-2 rounded w-full text-sm sm:text-base pr-8"
              disabled={buscando}
            />
            {busqueda && !buscando && (
              <button
                onClick={() => {
                  setBusqueda('')
                  setMostrarResultados(false)
                  setResultadosBusqueda([])
                }}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
              >
                ✕
              </button>
            )}
          </div>
          
          {/* Botón de búsqueda */}
          <button
            onClick={buscarCliente}
            disabled={buscando || !busqueda.trim()}
            className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed w-full sm:w-auto text-sm sm:text-base font-medium transition-colors"
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

          {/* Resultados de búsqueda */}
          {mostrarResultados && resultadosBusqueda.length > 1 && (
            <div className="absolute top-full left-0 right-0 mt-2 bg-white border rounded-lg shadow-lg z-50 max-h-60 overflow-y-auto">
              <div className="p-2">
                <div className="flex items-center justify-between mb-2 px-2">
                  <p className="text-sm font-medium text-gray-700">
                    {resultadosBusqueda.length} resultados encontrados
                  </p>
                  <button
                    onClick={() => setMostrarResultados(false)}
                    className="text-gray-400 hover:text-gray-600"
                  >
                    ✕
                  </button>
                </div>
                {resultadosBusqueda.map((cliente) => (
                  <button
                    key={cliente.id}
                    onClick={() => seleccionarCliente(cliente)}
                    className="w-full text-left px-3 py-2 hover:bg-blue-50 rounded transition-colors"
                  >
                    <div className="font-medium text-gray-900">
                      {cliente.nombre} {cliente.apellido}
                    </div>
                    <div className="text-sm text-gray-600">
                      Doc: {cliente.documento}
                      {cliente.telefono && ` • Tel: ${cliente.telefono}`}
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}
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
      
      {/* Texto de ayuda */}
      <div className="mt-3 flex items-start gap-2 text-xs text-gray-500">
        <span>💡</span>
        <div>
          <p className="font-medium">Búsqueda inteligente:</p>
          <p>Busca por nombre, apellido, documento o ID. Si hay múltiples resultados, podrás elegir.</p>
        </div>
      </div>
    </div>
  )
}