import { useState, useRef, useEffect } from 'react'
import { supabase } from '@/app/lib/supabase'
import { Cliente } from '@/app/lib/types/cobranzas'
import { Search, User, X, ChevronDown, Phone, FileText } from 'lucide-react'

interface BusquedaClienteProps {
  clientes: Cliente[]
  clienteSeleccionado: string
  onClienteSeleccionado: (clienteId: string) => void
}

export default function BusquedaCliente({
  clientes,
  clienteSeleccionado,
  onClienteSeleccionado,
}: BusquedaClienteProps) {
  const [busqueda, setBusqueda] = useState('')
  const [buscando, setBuscando] = useState(false)
  const [resultados, setResultados] = useState<Cliente[]>([])
  const [mostrarDropdown, setMostrarDropdown] = useState(false)
  const [sinResultados, setSinResultados] = useState(false)

  // Para el select alternativo
  const [mostrarSelect, setMostrarSelect] = useState(false)
  const [filtroSelect, setFiltroSelect] = useState('')

  const inputRef = useRef<HTMLInputElement>(null)
  const dropdownRef = useRef<HTMLDivElement>(null)

  const clienteActual = clientes.find((c) => c.id === clienteSeleccionado)

  // Cerrar dropdown al hacer click fuera
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setMostrarDropdown(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const buscarCliente = async (termino: string) => {
    if (!termino.trim()) {
      setResultados([])
      setMostrarDropdown(false)
      setSinResultados(false)
      return
    }

    setBuscando(true)
    setSinResultados(false)
    try {
      const pattern = `%${termino.trim()}%`
      const { data, error } = await supabase
        .from('clientes')
        .select('*')
        .or(`nombre.ilike.${pattern},apellido.ilike.${pattern},documento.ilike.${pattern},telefono.ilike.${pattern}`)
        .order('nombre')
        .limit(15)

      if (error) throw error

      if (data && data.length > 0) {
        setResultados(data)
        setMostrarDropdown(true)
        setSinResultados(false)
        if (data.length === 1) {
          seleccionarCliente(data[0])
        }
      } else {
        setResultados([])
        setMostrarDropdown(false)
        setSinResultados(true)
      }
    } catch (error) {
      console.error('Error en búsqueda:', error)
    } finally {
      setBuscando(false)
    }
  }

  const seleccionarCliente = (cliente: Cliente) => {
    onClienteSeleccionado(cliente.id)
    setBusqueda('')
    setResultados([])
    setMostrarDropdown(false)
    setSinResultados(false)
  }

  const limpiar = () => {
    onClienteSeleccionado('')
    setBusqueda('')
    setResultados([])
    setMostrarDropdown(false)
    setSinResultados(false)
    inputRef.current?.focus()
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      setMostrarDropdown(false)
      setBusqueda('')
    }
    if (e.key === 'Enter' && busqueda.trim()) {
      buscarCliente(busqueda)
    }
  }

  const clientesFiltradosSelect = filtroSelect
    ? clientes.filter(
        (c) =>
          c.nombre.toLowerCase().includes(filtroSelect.toLowerCase()) ||
          (c.apellido || '').toLowerCase().includes(filtroSelect.toLowerCase()) ||
          (c.documento || '').toLowerCase().includes(filtroSelect.toLowerCase())
      )
    : clientes

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
      <div className="flex items-center gap-2 mb-4">
        <div className="p-2 bg-blue-50 rounded-lg">
          <Search className="w-5 h-5 text-blue-600" />
        </div>
        <div>
          <h2 className="text-base font-bold text-gray-900">Buscar Cliente</h2>
          <p className="text-xs text-gray-500">Busca por nombre, apellido, documento o teléfono</p>
        </div>
      </div>

      {/* Cliente seleccionado */}
      {clienteActual && (
        <div className="mb-4 flex items-center justify-between bg-blue-50 border border-blue-200 rounded-lg px-4 py-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className="p-1.5 bg-blue-100 rounded-full flex-shrink-0">
              <User className="w-4 h-4 text-blue-600" />
            </div>
            <div className="min-w-0">
              <p className="text-sm font-bold text-blue-900 truncate">
                {clienteActual.nombre} {clienteActual.apellido || ''}
              </p>
              <div className="flex flex-wrap items-center gap-2 mt-0.5">
                {clienteActual.documento && (
                  <span className="text-xs text-blue-600 flex items-center gap-0.5">
                    <FileText className="w-3 h-3" />
                    {clienteActual.documento}
                  </span>
                )}
                {clienteActual.telefono && (
                  <span className="text-xs text-blue-600 flex items-center gap-0.5">
                    <Phone className="w-3 h-3" />
                    {clienteActual.telefono}
                  </span>
                )}
              </div>
            </div>
          </div>
          <button
            onClick={limpiar}
            className="ml-2 flex-shrink-0 p-1.5 text-blue-400 hover:text-blue-600 hover:bg-blue-100 rounded-full transition-colors"
            title="Cambiar cliente"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      <div className="flex flex-col sm:flex-row gap-3">
        {/* Input de búsqueda con dropdown */}
        <div className="flex-1 relative" ref={dropdownRef}>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
            <input
              ref={inputRef}
              type="text"
              placeholder="Buscar cliente..."
              value={busqueda}
              onChange={(e) => {
                setBusqueda(e.target.value)
                if (e.target.value.length >= 2) buscarCliente(e.target.value)
                else { setResultados([]); setMostrarDropdown(false); setSinResultados(false) }
              }}
              onKeyDown={handleKeyDown}
              className="w-full pl-9 pr-9 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
            />
            {buscando && (
              <span className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
            )}
            {!buscando && busqueda && (
              <button
                onClick={() => { setBusqueda(''); setResultados([]); setMostrarDropdown(false); setSinResultados(false) }}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          {/* Dropdown de resultados */}
          {mostrarDropdown && resultados.length > 0 && (
            <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-xl z-50 max-h-64 overflow-y-auto">
              <div className="py-1">
                <p className="text-xs text-gray-400 font-medium px-3 py-1.5 border-b">
                  {resultados.length} resultado{resultados.length !== 1 ? 's' : ''}
                </p>
                {resultados.map((cliente) => (
                  <button
                    key={cliente.id}
                    onClick={() => seleccionarCliente(cliente)}
                    className="w-full text-left px-3 py-2.5 hover:bg-blue-50 transition-colors flex items-center gap-3"
                  >
                    <div className="p-1.5 bg-gray-100 rounded-full flex-shrink-0">
                      <User className="w-3.5 h-3.5 text-gray-500" />
                    </div>
                    <div className="min-w-0">
                      <p className="font-semibold text-sm text-gray-900 truncate">
                        {cliente.nombre} {cliente.apellido || ''}
                      </p>
                      <div className="flex flex-wrap gap-2 mt-0.5">
                        {cliente.documento && (
                          <span className="text-xs text-gray-500">DNI: {cliente.documento}</span>
                        )}
                        {cliente.telefono && (
                          <span className="text-xs text-gray-500">Tel: {cliente.telefono}</span>
                        )}
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Sin resultados */}
          {sinResultados && (
            <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg z-50 px-3 py-4 text-center">
              <p className="text-sm text-gray-500">No se encontraron clientes para "{busqueda}"</p>
            </div>
          )}
        </div>

        {/* Separador */}
        <div className="hidden sm:flex items-center text-gray-300 text-xs font-medium">ó</div>

        {/* Botón para abrir listado completo */}
        <div className="relative">
          <button
            onClick={() => setMostrarSelect(!mostrarSelect)}
            className="w-full sm:w-auto flex items-center justify-between gap-2 px-4 py-2.5 border border-gray-300 rounded-lg text-sm text-gray-700 hover:bg-gray-50 hover:border-gray-400 transition-all font-medium"
          >
            <span>Ver lista completa</span>
            <ChevronDown className={`w-4 h-4 transition-transform ${mostrarSelect ? 'rotate-180' : ''}`} />
          </button>

          {mostrarSelect && (
            <div className="absolute top-full right-0 mt-1 w-80 bg-white border border-gray-200 rounded-lg shadow-xl z-50">
              <div className="p-2 border-b">
                <div className="relative">
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
                  <input
                    type="text"
                    placeholder="Filtrar lista..."
                    value={filtroSelect}
                    onChange={(e) => setFiltroSelect(e.target.value)}
                    className="w-full pl-7 pr-3 py-1.5 text-xs border border-gray-200 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500"
                    autoFocus
                  />
                </div>
              </div>
              <div className="max-h-60 overflow-y-auto py-1">
                {clientesFiltradosSelect.length > 0 ? (
                  clientesFiltradosSelect.map((cliente) => (
                    <button
                      key={cliente.id}
                      onClick={() => { seleccionarCliente(cliente); setMostrarSelect(false); setFiltroSelect('') }}
                      className={`w-full text-left px-3 py-2.5 hover:bg-blue-50 transition-colors flex items-center gap-2 ${
                        cliente.id === clienteSeleccionado ? 'bg-blue-50' : ''
                      }`}
                    >
                      <User className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-gray-900 truncate">
                          {cliente.nombre} {cliente.apellido || ''}
                        </p>
                        {cliente.documento && (
                          <p className="text-xs text-gray-500 truncate">DNI: {cliente.documento}</p>
                        )}
                      </div>
                    </button>
                  ))
                ) : (
                  <p className="text-center text-xs text-gray-400 py-4">Sin resultados</p>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
