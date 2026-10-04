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
    <div className="card card-body">
      <div className="flex items-center gap-3 mb-4">
        <div className="icon-tile bg-primary/10 text-primary">
          <Search className="w-5 h-5" />
        </div>
        <div>
          <h2 className="text-base font-semibold text-fg">Buscar cliente</h2>
          <p className="text-xs text-muted">Por nombre, apellido, documento o teléfono</p>
        </div>
      </div>

      {/* Cliente seleccionado */}
      {clienteActual && (
        <div className="mb-4 flex items-center justify-between gap-2 rounded-lg border border-primary/30 bg-primary/5 px-4 py-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className="icon-tile w-9 h-9 rounded-full bg-primary text-on-primary">
              <User className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <p className="text-sm font-semibold text-fg truncate">
                {clienteActual.nombre} {clienteActual.apellido || ''}
              </p>
              <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 mt-0.5">
                {clienteActual.documento && (
                  <span className="text-xs text-muted flex items-center gap-1 num">
                    <FileText className="w-3 h-3" />
                    {clienteActual.documento}
                  </span>
                )}
                {clienteActual.telefono && (
                  <span className="text-xs text-muted flex items-center gap-1 num">
                    <Phone className="w-3 h-3" />
                    {clienteActual.telefono}
                  </span>
                )}
              </div>
            </div>
          </div>
          <button
            onClick={limpiar}
            className="btn-icon flex-shrink-0"
            title="Cambiar cliente"
            aria-label="Cambiar cliente"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      <div className="flex flex-col sm:flex-row gap-3">
        {/* Input de búsqueda con dropdown */}
        <div className="flex-1 relative" ref={dropdownRef}>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted pointer-events-none" />
            <input
              ref={inputRef}
              type="text"
              placeholder="Escribí al menos 2 letras"
              value={busqueda}
              onChange={(e) => {
                setBusqueda(e.target.value)
                if (e.target.value.length >= 2) buscarCliente(e.target.value)
                else { setResultados([]); setMostrarDropdown(false); setSinResultados(false) }
              }}
              onKeyDown={handleKeyDown}
              className="input input-icon pr-11"
              aria-label="Buscar cliente"
            />
            {buscando && (
              <span className="spinner absolute right-3.5 top-1/2 -translate-y-1/2 text-primary" />
            )}
            {!buscando && busqueda && (
              <button
                onClick={() => { setBusqueda(''); setResultados([]); setMostrarDropdown(false); setSinResultados(false) }}
                className="absolute right-0 top-0 btn-icon"
                aria-label="Borrar búsqueda"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          {/* Dropdown de resultados */}
          {mostrarDropdown && resultados.length > 0 && (
            <div className="absolute top-full left-0 right-0 mt-1 bg-surface border border-line rounded-lg shadow-e3 z-50 max-h-72 overflow-y-auto">
              <p className="text-xs text-muted font-medium px-3 py-2 border-b border-line num">
                {resultados.length} resultado{resultados.length !== 1 ? 's' : ''}
              </p>
              {resultados.map((cliente) => (
                <button
                  key={cliente.id}
                  onClick={() => seleccionarCliente(cliente)}
                  className="w-full text-left px-3 min-h-[52px] py-2 hover:bg-surface-2 transition-colors flex items-center gap-3"
                >
                  <div className="icon-tile w-8 h-8 rounded-full bg-surface-2 text-muted">
                    <User className="w-4 h-4" />
                  </div>
                  <div className="min-w-0">
                    <p className="font-medium text-sm text-fg truncate">
                      {cliente.nombre} {cliente.apellido || ''}
                    </p>
                    <div className="flex flex-wrap gap-x-3 mt-0.5">
                      {cliente.documento && (
                        <span className="text-xs text-muted num">DNI {cliente.documento}</span>
                      )}
                      {cliente.telefono && (
                        <span className="text-xs text-muted num">Tel. {cliente.telefono}</span>
                      )}
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}

          {/* Sin resultados */}
          {sinResultados && (
            <div className="absolute top-full left-0 right-0 mt-1 bg-surface border border-line rounded-lg shadow-e2 z-50 px-4 py-4 text-center">
              <p className="text-sm text-fg">No encontramos clientes para “{busqueda}”.</p>
              <p className="text-xs text-muted mt-1">Revisá cómo está escrito o buscá por documento.</p>
            </div>
          )}
        </div>

        {/* Separador */}
        <div className="hidden sm:flex items-center text-muted text-xs font-medium">o</div>

        {/* Botón para abrir listado completo */}
        <div className="relative">
          <button
            onClick={() => setMostrarSelect(!mostrarSelect)}
            className="btn-secondary w-full sm:w-auto justify-between"
            aria-expanded={mostrarSelect}
          >
            <span>Ver todos los clientes</span>
            <ChevronDown className={`w-4 h-4 transition-transform ${mostrarSelect ? 'rotate-180' : ''}`} />
          </button>

          {mostrarSelect && (
            <div className="absolute top-full right-0 mt-1 w-full sm:w-80 bg-surface border border-line rounded-lg shadow-e3 z-50">
              <div className="p-2 border-b border-line">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted pointer-events-none" />
                  <input
                    type="text"
                    placeholder="Filtrar la lista"
                    value={filtroSelect}
                    onChange={(e) => setFiltroSelect(e.target.value)}
                    className="input input-icon"
                    autoFocus
                    aria-label="Filtrar la lista de clientes"
                  />
                </div>
              </div>
              <div className="max-h-64 overflow-y-auto py-1">
                {clientesFiltradosSelect.length > 0 ? (
                  clientesFiltradosSelect.map((cliente) => (
                    <button
                      key={cliente.id}
                      onClick={() => { seleccionarCliente(cliente); setMostrarSelect(false); setFiltroSelect('') }}
                      className={`w-full text-left px-3 min-h-[48px] py-2 transition-colors flex items-center gap-2 ${
                        cliente.id === clienteSeleccionado ? 'bg-primary/10' : 'hover:bg-surface-2'
                      }`}
                    >
                      <User className="w-4 h-4 text-muted flex-shrink-0" />
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-fg truncate">
                          {cliente.nombre} {cliente.apellido || ''}
                        </p>
                        {cliente.documento && (
                          <p className="text-xs text-muted truncate num">DNI {cliente.documento}</p>
                        )}
                      </div>
                    </button>
                  ))
                ) : (
                  <p className="text-center text-sm text-muted py-6">No hay clientes que coincidan.</p>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
