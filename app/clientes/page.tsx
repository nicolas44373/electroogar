'use client'
import { useState, useEffect } from 'react'
import { supabase } from '@/app/lib/supabase'
import { 
  Search, 
  Plus, 
  Edit2, 
  Trash2, 
  Save, 
  X, 
  User, 
  Phone, 
  Mail, 
  MapPin,
  Navigation,
  NotebookPen,
  FileText,
  AlertTriangle,
  Check,
  Users,
  Calendar,
  Filter
} from 'lucide-react'

interface Cliente {
  id: string
  nombre: string
  apellido: string
  documento: string
  telefono: string
  direccion: string
  email: string
  observaciones?: string | null
  latitud?: number | null
  longitud?: number | null
  created_at?: string
}

export default function ClientesPage() {
  const [clientes, setClientes] = useState<Cliente[]>([])
  const [clientesFiltrados, setClientesFiltrados] = useState<Cliente[]>([])
  const [busqueda, setBusqueda] = useState('')
  const [modoEdicion, setModoEdicion] = useState(false)
  const [clienteEditando, setClienteEditando] = useState<string | null>(null)
  const [mostrarFormulario, setMostrarFormulario] = useState(false)
  const [loading, setLoading] = useState(false)
  
  const [mostrarModalEliminar, setMostrarModalEliminar] = useState(false)
  const [clienteAEliminar, setClienteAEliminar] = useState<Cliente | null>(null)
  
  const [mensaje, setMensaje] = useState<{tipo: 'exito' | 'error', texto: string} | null>(null)

  const [clienteNotas, setClienteNotas] = useState<Cliente | null>(null)
  const [textoNotas, setTextoNotas] = useState('')
  const [guardandoNotas, setGuardandoNotas] = useState(false)

  const [formData, setFormData] = useState({
    nombre: '',
    apellido: '',
    documento: '',
    telefono: '',
    direccion: '',
    email: ''
  })

  useEffect(() => {
    cargarClientes()
  }, [])

  useEffect(() => {
    if (busqueda) {
      const filtrados = clientes.filter(cliente => 
        cliente.nombre.toLowerCase().includes(busqueda.toLowerCase()) ||
        cliente.apellido.toLowerCase().includes(busqueda.toLowerCase()) ||
        cliente.documento.includes(busqueda) ||
        cliente.telefono.includes(busqueda) ||
        cliente.email.toLowerCase().includes(busqueda.toLowerCase())
      )
      setClientesFiltrados(filtrados)
    } else {
      setClientesFiltrados(clientes)
    }
  }, [busqueda, clientes])

  useEffect(() => {
    if (mensaje) {
      const timer = setTimeout(() => setMensaje(null), 4000)
      return () => clearTimeout(timer)
    }
  }, [mensaje])

  const cargarClientes = async () => {
    setLoading(true)
    try {
      const { data, error } = await supabase
        .from('clientes')
        .select('*')
        .order('created_at', { ascending: false })
      
      if (error) throw error
      if (data) {
        setClientes(data)
        setClientesFiltrados(data)
      }
    } catch (error: any) {
      setMensaje({ tipo: 'error', texto: 'Error al cargar clientes: ' + error.message })
    } finally {
      setLoading(false)
    }
  }

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target
    setFormData(prev => ({
      ...prev,
      [name]: value
    }))
  }

  const limpiarFormulario = () => {
    setFormData({
      nombre: '',
      apellido: '',
      documento: '',
      telefono: '',
      direccion: '',
      email: ''
    })
    setModoEdicion(false)
    setClienteEditando(null)
    setMostrarFormulario(false)
  }

  const validarFormulario = () => {
    if (!formData.nombre.trim()) {
      setMensaje({ tipo: 'error', texto: 'El nombre es obligatorio' })
      return false
    }
    if (!formData.apellido.trim()) {
      setMensaje({ tipo: 'error', texto: 'El apellido es obligatorio' })
      return false
    }
    if (!formData.documento.trim()) {
      setMensaje({ tipo: 'error', texto: 'El documento es obligatorio' })
      return false
    }
    if (formData.email && !formData.email.match(/^[^\s@]+@[^\s@]+\.[^\s@]+$/)) {
      setMensaje({ tipo: 'error', texto: 'El email no es válido' })
      return false
    }
    return true
  }

  const guardarCliente = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!validarFormulario()) return
    
    setLoading(true)
    try {
      if (modoEdicion && clienteEditando) {
        const { error } = await supabase
          .from('clientes')
          .update(formData)
          .eq('id', clienteEditando)
        
        if (error) throw error
        setMensaje({ tipo: 'exito', texto: 'Cliente actualizado correctamente' })
      } else {
        const { error } = await supabase
          .from('clientes')
          .insert(formData)
        
        if (error) throw error
        setMensaje({ tipo: 'exito', texto: 'Cliente creado correctamente' })
      }
      
      limpiarFormulario()
      cargarClientes()
    } catch (error: any) {
      if (error.message.includes('duplicate')) {
        setMensaje({ tipo: 'error', texto: 'Ya existe un cliente con ese documento' })
      } else {
        setMensaje({ tipo: 'error', texto: 'Error al guardar: ' + error.message })
      }
    } finally {
      setLoading(false)
    }
  }

  const iniciarEdicion = (cliente: Cliente) => {
    setFormData({
      nombre: cliente.nombre,
      apellido: cliente.apellido,
      documento: cliente.documento,
      telefono: cliente.telefono || '',
      direccion: cliente.direccion || '',
      email: cliente.email || ''
    })
    setModoEdicion(true)
    setClienteEditando(cliente.id)
    setMostrarFormulario(true)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const confirmarEliminar = (cliente: Cliente) => {
    setClienteAEliminar(cliente)
    setMostrarModalEliminar(true)
  }

  const eliminarCliente = async () => {
    if (!clienteAEliminar) return
    
    setLoading(true)
    try {
      const { data: transacciones } = await supabase
        .from('transacciones')
        .select('id')
        .eq('cliente_id', clienteAEliminar.id)
        .limit(1)
      
      if (transacciones && transacciones.length > 0) {
        setMensaje({ 
          tipo: 'error', 
          texto: 'No se puede eliminar el cliente porque tiene transacciones asociadas' 
        })
        setMostrarModalEliminar(false)
        return
      }
      
      const { error } = await supabase
        .from('clientes')
        .delete()
        .eq('id', clienteAEliminar.id)
      
      if (error) throw error
      
      setMensaje({ tipo: 'exito', texto: 'Cliente eliminado correctamente' })
      cargarClientes()
    } catch (error: any) {
      setMensaje({ tipo: 'error', texto: 'Error al eliminar: ' + error.message })
    } finally {
      setLoading(false)
      setMostrarModalEliminar(false)
      setClienteAEliminar(null)
    }
  }

  const abrirNotas = (cliente: Cliente) => {
    setClienteNotas(cliente)
    setTextoNotas(cliente.observaciones || '')
  }

  const guardarNotas = async () => {
    if (!clienteNotas) return

    setGuardandoNotas(true)
    try {
      const { error } = await supabase
        .from('clientes')
        .update({ observaciones: textoNotas.trim() ? textoNotas : null })
        .eq('id', clienteNotas.id)

      if (error) throw error
      setMensaje({ tipo: 'exito', texto: 'Notas guardadas' })
      setClienteNotas(null)
      cargarClientes()
    } catch (error: any) {
      setMensaje({ tipo: 'error', texto: 'Error al guardar las notas: ' + error.message })
    } finally {
      setGuardandoNotas(false)
    }
  }

  const formatearFecha = (fecha?: string) => {
    if (!fecha) return ''
    return new Date(fecha).toLocaleDateString('es-AR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    })
  }

  return (
    <div className="page">
      <div className="page-container">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4 mb-6">
          <div>
            <h1 className="page-title">Clientes</h1>
            <p className="page-subtitle num">
              {clientesFiltrados.length} cliente{clientesFiltrados.length !== 1 ? 's' : ''}
              {busqueda ? ' encontrados' : ' registrados'}
            </p>
          </div>

          <button
            onClick={() => {
              limpiarFormulario()
              setMostrarFormulario(!mostrarFormulario)
            }}
            className="btn-primary"
          >
            <Plus className="w-4 h-4" />
            Nuevo cliente
          </button>
        </div>

        {/* Barra de búsqueda */}
        <div className="relative mb-6">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted w-5 h-5 pointer-events-none" />
          <input
            type="text"
            placeholder="Buscar por nombre, documento, teléfono o email"
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            className="input input-icon bg-surface shadow-e1"
            aria-label="Buscar clientes"
          />
        </div>

        {/* Mensaje de éxito/error */}
        {mensaje && (
          <div className={`mb-6 ${mensaje.tipo === 'exito' ? 'alert-success' : 'alert-danger'}`} role="status">
            {mensaje.tipo === 'exito' ? (
              <Check className="w-5 h-5 flex-shrink-0" />
            ) : (
              <AlertTriangle className="w-5 h-5 flex-shrink-0" />
            )}
            <span>{mensaje.texto}</span>
          </div>
        )}

        {/* Formulario */}
        {mostrarFormulario && (
          <div className="card mb-6">
            <div className="card-header">
              <h2 className="section-title">
                <User className="w-5 h-5 text-primary" />
                {modoEdicion ? 'Editar cliente' : 'Nuevo cliente'}
              </h2>
              <button
                onClick={limpiarFormulario}
                className="btn-icon"
                aria-label="Cerrar formulario"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={guardarCliente} className="card-body grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label htmlFor="cliente-nombre" className="label">
                  Nombre <span className="text-danger" aria-hidden="true">*</span>
                </label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 text-muted w-4 h-4 pointer-events-none" />
                  <input
                    id="cliente-nombre"
                    type="text"
                    name="nombre"
                    placeholder="Ej: María"
                    value={formData.nombre}
                    onChange={handleInputChange}
                    className="input input-icon"
                    required
                  />
                </div>
              </div>

              <div>
                <label htmlFor="cliente-apellido" className="label">
                  Apellido <span className="text-danger" aria-hidden="true">*</span>
                </label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 text-muted w-4 h-4 pointer-events-none" />
                  <input
                    id="cliente-apellido"
                    type="text"
                    name="apellido"
                    placeholder="Ej: González"
                    value={formData.apellido}
                    onChange={handleInputChange}
                    className="input input-icon"
                    required
                  />
                </div>
              </div>

              <div>
                <label htmlFor="cliente-documento" className="label">
                  Documento <span className="text-danger" aria-hidden="true">*</span>
                </label>
                <div className="relative">
                  <FileText className="absolute left-3 top-1/2 -translate-y-1/2 text-muted w-4 h-4 pointer-events-none" />
                  <input
                    id="cliente-documento"
                    type="text"
                    name="documento"
                    placeholder="DNI o CUIT"
                    value={formData.documento}
                    onChange={handleInputChange}
                    className="input input-icon"
                    required
                    disabled={modoEdicion}
                  />
                </div>
                {modoEdicion && (
                  <p className="help">
                    El documento no se puede cambiar una vez creado el cliente.
                  </p>
                )}
              </div>

              <div>
                <label htmlFor="cliente-telefono" className="label">
                  Teléfono
                </label>
                <div className="relative">
                  <Phone className="absolute left-3 top-1/2 -translate-y-1/2 text-muted w-4 h-4 pointer-events-none" />
                  <input
                    id="cliente-telefono"
                    type="tel"
                    name="telefono"
                    placeholder="Ej: 381 555-1234"
                    value={formData.telefono}
                    onChange={handleInputChange}
                    className="input input-icon"
                  />
                </div>
                <p className="help">Se usa para enviar recordatorios por WhatsApp.</p>
              </div>

              <div>
                <label htmlFor="cliente-email" className="label">
                  Email
                </label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 text-muted w-4 h-4 pointer-events-none" />
                  <input
                    id="cliente-email"
                    type="email"
                    name="email"
                    placeholder="correo@ejemplo.com"
                    value={formData.email}
                    onChange={handleInputChange}
                    className="input input-icon"
                  />
                </div>
              </div>

              <div>
                <label htmlFor="cliente-direccion" className="label">
                  Dirección
                </label>
                <div className="relative">
                  <MapPin className="absolute left-3 top-3 text-muted w-4 h-4 pointer-events-none" />
                  <textarea
                    id="cliente-direccion"
                    name="direccion"
                    placeholder="Calle, número, barrio, ciudad"
                    value={formData.direccion}
                    onChange={handleInputChange}
                    className="input input-icon resize-none"
                    rows={2}
                  />
                </div>
              </div>

              <div className="md:col-span-2 flex flex-col-reverse sm:flex-row sm:items-center sm:justify-between gap-3 pt-2">
                <p className="text-xs text-muted"><span className="text-danger">*</span> Campos obligatorios</p>
                <div className="flex gap-3 justify-end">
                  <button
                    type="button"
                    onClick={limpiarFormulario}
                    className="btn-secondary"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={loading}
                    className="btn-primary"
                  >
                    {loading ? (
                      <>
                        <span className="spinner" />
                        Guardando…
                      </>
                    ) : (
                      <>
                        <Save className="w-4 h-4" />
                        {modoEdicion ? 'Guardar cambios' : 'Crear cliente'}
                      </>
                    )}
                  </button>
                </div>
              </div>
            </form>
          </div>
        )}

        {/* Tabla de clientes */}
        <div className="card overflow-hidden">
          {loading && clientesFiltrados.length === 0 ? (
            <div className="p-4 space-y-3" role="status" aria-live="polite">
              <span className="sr-only">Cargando clientes…</span>
              {[0, 1, 2, 3, 4].map((i) => (
                <div key={i} className="flex items-center gap-4 py-2">
                  <div className="skeleton h-9 w-9 rounded-full" />
                  <div className="flex-1 space-y-2">
                    <div className="skeleton h-4 w-1/3" />
                    <div className="skeleton h-3 w-1/4" />
                  </div>
                  <div className="skeleton h-8 w-24" />
                </div>
              ))}
            </div>
          ) : clientesFiltrados.length > 0 ? (
            <>
              {/* Vista de tarjetas (celular) */}
              <ul className="md:hidden divide-y divide-line">
                {clientesFiltrados.map((cliente) => (
                  <li key={cliente.id} className="p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="font-semibold text-fg">
                          {cliente.nombre} {cliente.apellido}
                        </p>
                        <p className="text-xs text-muted mt-0.5 num">DNI {cliente.documento}</p>
                        {cliente.telefono && (
                          <p className="text-sm text-muted mt-1 flex items-center gap-1.5">
                            <Phone className="w-3.5 h-3.5" />
                            {cliente.telefono}
                          </p>
                        )}
                        {cliente.direccion && (
                          <p className="text-sm text-muted mt-1 flex items-center gap-1.5">
                            <MapPin className="w-3.5 h-3.5 flex-shrink-0" />
                            <span className="truncate">{cliente.direccion}</span>
                          </p>
                        )}
                      </div>
                    </div>
                    {cliente.observaciones && (
                      <button
                        onClick={() => abrirNotas(cliente)}
                        className="mt-2 w-full min-h-[44px] flex items-center gap-2 px-3 py-2 rounded-lg bg-warning-soft text-warning-text text-xs text-left"
                      >
                        <NotebookPen className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
                        <span className="line-clamp-2">{cliente.observaciones}</span>
                      </button>
                    )}
                    <div className="flex items-center gap-1 mt-2 -ml-2">
                      {cliente.latitud != null && cliente.longitud != null && (
                        <a
                          href={`https://www.google.com/maps/dir/?api=1&destination=${cliente.latitud},${cliente.longitud}&travelmode=driving`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="btn-icon text-success-text"
                          title="Cómo llegar"
                          aria-label={`Cómo llegar a la casa de ${cliente.nombre}`}
                        >
                          <Navigation className="w-5 h-5" />
                        </a>
                      )}
                      <button
                        onClick={() => abrirNotas(cliente)}
                        className="btn-icon"
                        title="Bloc de notas"
                        aria-label={`Notas de ${cliente.nombre}`}
                      >
                        <NotebookPen className="w-5 h-5" />
                      </button>
                      <button
                        onClick={() => iniciarEdicion(cliente)}
                        className="btn-icon"
                        title="Editar"
                        aria-label={`Editar a ${cliente.nombre}`}
                      >
                        <Edit2 className="w-5 h-5" />
                      </button>
                      <button
                        onClick={() => confirmarEliminar(cliente)}
                        className="btn-icon hover:!text-danger hover:!bg-danger-soft"
                        title="Eliminar"
                        aria-label={`Eliminar a ${cliente.nombre}`}
                      >
                        <Trash2 className="w-5 h-5" />
                      </button>
                    </div>
                  </li>
                ))}
              </ul>

              {/* Vista de tabla (tablet y escritorio) */}
              <div className="hidden md:block overflow-x-auto">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Cliente</th>
                      <th>Documento</th>
                      <th>Teléfono</th>
                      <th className="hidden lg:table-cell">Email</th>
                      <th className="hidden lg:table-cell">Dirección</th>
                      <th className="hidden xl:table-cell">Alta</th>
                      <th className="!text-right">Acciones</th>
                    </tr>
                  </thead>
                  <tbody>
                    {clientesFiltrados.map((cliente) => (
                      <tr key={cliente.id}>
                        <td>
                          <div className="font-medium text-fg">
                            {cliente.nombre} {cliente.apellido}
                          </div>
                          {cliente.observaciones && (
                            <button
                              onClick={() => abrirNotas(cliente)}
                              className="mt-1 flex items-center gap-1 text-xs text-warning-text hover:underline text-left"
                            >
                              <NotebookPen className="w-3 h-3 flex-shrink-0" />
                              <span className="truncate max-w-[14rem]">{cliente.observaciones}</span>
                            </button>
                          )}
                        </td>
                        <td>
                          <span className="text-muted num whitespace-nowrap">
                            {cliente.documento}
                          </span>
                        </td>
                        <td className="whitespace-nowrap">
                          {cliente.telefono ? (
                            <span className="text-fg num">{cliente.telefono}</span>
                          ) : (
                            <span className="text-muted">—</span>
                          )}
                        </td>
                        <td className="hidden lg:table-cell">
                          {cliente.email ? (
                            <span className="block truncate max-w-[14rem] text-muted">{cliente.email}</span>
                          ) : (
                            <span className="text-muted">—</span>
                          )}
                        </td>
                        <td className="hidden lg:table-cell">
                          {cliente.direccion ? (
                            <span className="block truncate max-w-[14rem] text-muted" title={cliente.direccion}>
                              {cliente.direccion}
                            </span>
                          ) : (
                            <span className="text-muted">—</span>
                          )}
                        </td>
                        <td className="text-muted hidden xl:table-cell num whitespace-nowrap">
                          {formatearFecha(cliente.created_at)}
                        </td>
                        <td>
                          <div className="flex items-center justify-end gap-0.5">
                            {cliente.latitud != null && cliente.longitud != null && (
                              <a
                                href={`https://www.google.com/maps/dir/?api=1&destination=${cliente.latitud},${cliente.longitud}&travelmode=driving`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="btn-icon text-success-text"
                                title="Cómo llegar"
                                aria-label={`Cómo llegar a la casa de ${cliente.nombre}`}
                              >
                                <Navigation className="w-4 h-4" />
                              </a>
                            )}
                            <button
                              onClick={() => abrirNotas(cliente)}
                              className="btn-icon"
                              title="Bloc de notas"
                              aria-label={`Notas de ${cliente.nombre}`}
                            >
                              <NotebookPen className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => iniciarEdicion(cliente)}
                              className="btn-icon"
                              title="Editar"
                              aria-label={`Editar a ${cliente.nombre}`}
                            >
                              <Edit2 className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => confirmarEliminar(cliente)}
                              className="btn-icon hover:!text-danger hover:!bg-danger-soft"
                              title="Eliminar"
                              aria-label={`Eliminar a ${cliente.nombre}`}
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          ) : (
            <div className="empty-state">
              <Users className="w-10 h-10 text-muted/60 mb-3" />
              <h3 className="text-base font-semibold text-fg mb-1">
                {busqueda ? 'No encontramos clientes' : 'Todavía no hay clientes'}
              </h3>
              <p className="text-sm">
                {busqueda
                  ? 'Probá con otro nombre, documento o teléfono.'
                  : 'Tocá “Nuevo cliente” para cargar el primero.'
                }
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Modal de bloc de notas */}
      {clienteNotas && (
        <div className="modal-backdrop">
          <div className="modal max-w-lg" role="dialog" aria-modal="true" aria-labelledby="titulo-notas">
            <div className="modal-header justify-between">
              <h3 id="titulo-notas" className="text-base font-semibold text-fg flex items-center gap-2">
                <NotebookPen className="w-5 h-5 text-warning" />
                Notas de {clienteNotas.nombre} {clienteNotas.apellido}
              </h3>
              <button
                onClick={() => setClienteNotas(null)}
                className="btn-icon"
                aria-label="Cerrar"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="modal-body">
              <textarea
                value={textoNotas}
                onChange={(e) => setTextoNotas(e.target.value)}
                rows={8}
                autoFocus
                placeholder="Ej: Cobrar después de las 18 hs. Casa con portón verde. Preguntar por la hermana."
                className="input resize-y"
                aria-label="Notas del cliente"
              />
            </div>

            <div className="modal-footer">
              <button
                onClick={() => setClienteNotas(null)}
                className="btn-secondary"
                disabled={guardandoNotas}
              >
                Cancelar
              </button>
              <button
                onClick={guardarNotas}
                className="btn-primary"
                disabled={guardandoNotas || textoNotas === (clienteNotas.observaciones || '')}
              >
                {guardandoNotas ? (
                  <span className="spinner" />
                ) : (
                  <Save className="w-4 h-4" />
                )}
                Guardar notas
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de confirmación de eliminación */}
      {mostrarModalEliminar && clienteAEliminar && (
        <div className="modal-backdrop">
          <div className="modal" role="alertdialog" aria-modal="true" aria-labelledby="titulo-eliminar">
            <div className="modal-body">
              <div className="flex items-start gap-4">
                <div className="icon-tile w-11 h-11 bg-danger-soft text-danger-text">
                  <AlertTriangle className="w-5 h-5" />
                </div>
                <div className="flex-1">
                  <h3 id="titulo-eliminar" className="text-base font-semibold text-fg">
                    ¿Eliminar a {clienteAEliminar.nombre} {clienteAEliminar.apellido}?
                  </h3>
                  <p className="text-sm text-muted mt-1">
                    Se va a borrar el cliente de forma permanente. Esta acción no se puede deshacer.
                  </p>
                </div>
              </div>
              <dl className="rounded-lg bg-surface-2 p-3 space-y-1 text-sm">
                <div className="flex gap-2"><dt className="text-muted">Documento:</dt><dd className="text-fg num">{clienteAEliminar.documento}</dd></div>
                {clienteAEliminar.telefono && (
                  <div className="flex gap-2"><dt className="text-muted">Teléfono:</dt><dd className="text-fg num">{clienteAEliminar.telefono}</dd></div>
                )}
                {clienteAEliminar.email && (
                  <div className="flex gap-2"><dt className="text-muted">Email:</dt><dd className="text-fg">{clienteAEliminar.email}</dd></div>
                )}
              </dl>
            </div>

            <div className="modal-footer">
              <button
                onClick={() => {
                  setMostrarModalEliminar(false)
                  setClienteAEliminar(null)
                }}
                className="btn-secondary"
                disabled={loading}
              >
                Cancelar
              </button>
              <button
                onClick={eliminarCliente}
                className="btn-danger"
                disabled={loading}
              >
                {loading ? (
                  <>
                    <span className="spinner" />
                    Eliminando…
                  </>
                ) : (
                  <>
                    <Trash2 className="w-4 h-4" />
                    Eliminar cliente
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
