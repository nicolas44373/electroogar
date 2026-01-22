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

  const formatearFecha = (fecha?: string) => {
    if (!fecha) return ''
    return new Date(fecha).toLocaleDateString('es-AR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    })
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-slate-800 relative overflow-hidden">
      {/* Animated background pattern */}
      <div className="absolute inset-0 overflow-hidden opacity-10">
        <div className="absolute inset-0" style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23ffffff' fill-opacity='0.4'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`,
        }}></div>
      </div>

      {/* Floating shapes */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-20 left-10 w-64 h-64 bg-blue-500/10 rounded-full blur-3xl animate-pulse"></div>
        <div className="absolute bottom-20 right-10 w-80 h-80 bg-purple-500/10 rounded-full blur-3xl animate-pulse animation-delay-2000"></div>
        <div className="absolute top-1/2 right-1/3 w-96 h-96 bg-emerald-500/10 rounded-full blur-3xl animate-pulse animation-delay-4000"></div>
      </div>

      <div className="relative max-w-7xl mx-auto p-4 sm:p-6 lg:p-8">
        {/* Header */}
        <div className="backdrop-blur-xl bg-slate-800/40 rounded-xl border border-slate-700/50 shadow-2xl p-6 mb-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="relative">
                <div className="absolute inset-0 bg-gradient-to-r from-blue-500 to-purple-500 rounded-xl blur opacity-50"></div>
                <div className="relative bg-gradient-to-br from-blue-600 to-purple-600 p-4 rounded-xl">
                  <Users className="w-8 h-8 text-white" />
                </div>
              </div>
              <div>
                <h1 className="text-2xl sm:text-3xl font-bold text-white">Gestión de Clientes</h1>
                <p className="text-slate-300 mt-1">
                  Total: {clientesFiltrados.length} cliente{clientesFiltrados.length !== 1 ? 's' : ''}
                </p>
              </div>
            </div>
            
            <button
              onClick={() => {
                limpiarFormulario()
                setMostrarFormulario(!mostrarFormulario)
              }}
              className="group relative px-6 py-3 bg-gradient-to-r from-emerald-600 to-blue-600 text-white rounded-xl font-semibold shadow-lg hover:shadow-xl transition-all duration-300"
            >
              <div className="absolute inset-0 bg-gradient-to-r from-white/20 to-transparent rounded-xl opacity-0 group-hover:opacity-100 transition-opacity"></div>
              <div className="relative flex items-center gap-2">
                <Plus className="w-5 h-5" />
                Nuevo Cliente
              </div>
            </button>
          </div>

          {/* Barra de búsqueda */}
          <div className="mt-6">
            <div className="relative">
              <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 text-slate-400 w-5 h-5" />
              <input
                type="text"
                placeholder="Buscar por nombre, documento, teléfono o email..."
                value={busqueda}
                onChange={(e) => setBusqueda(e.target.value)}
                className="w-full pl-12 pr-4 py-3 bg-slate-700/50 border border-slate-600 rounded-xl text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent backdrop-blur-sm"
              />
            </div>
          </div>
        </div>

        {/* Mensaje de éxito/error */}
        {mensaje && (
          <div className={`mb-6 backdrop-blur-xl rounded-xl p-4 flex items-center gap-3 shadow-lg animate-fade-in ${
            mensaje.tipo === 'exito' 
              ? 'bg-emerald-500/20 border border-emerald-500/50 text-emerald-100'
              : 'bg-red-500/20 border border-red-500/50 text-red-100'
          }`}>
            {mensaje.tipo === 'exito' ? (
              <Check className="w-5 h-5 flex-shrink-0" />
            ) : (
              <AlertTriangle className="w-5 h-5 flex-shrink-0" />
            )}
            <span className="font-medium">{mensaje.texto}</span>
          </div>
        )}

        {/* Formulario */}
        {mostrarFormulario && (
          <div className="backdrop-blur-xl bg-slate-800/40 rounded-xl border border-slate-700/50 shadow-2xl p-6 mb-6 animate-fade-in">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-bold text-white flex items-center gap-2">
                <User className="w-6 h-6 text-blue-400" />
                {modoEdicion ? 'Editar Cliente' : 'Nuevo Cliente'}
              </h2>
              <button
                onClick={limpiarFormulario}
                className="p-2 text-slate-400 hover:text-white hover:bg-slate-700/50 rounded-lg transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <form onSubmit={guardarCliente} className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  Nombre *
                </label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 w-4 h-4" />
                  <input
                    type="text"
                    name="nombre"
                    placeholder="Ingrese el nombre"
                    value={formData.nombre}
                    onChange={handleInputChange}
                    className="w-full pl-10 pr-4 py-3 bg-slate-700/50 border border-slate-600 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    required
                  />
                </div>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  Apellido *
                </label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 w-4 h-4" />
                  <input
                    type="text"
                    name="apellido"
                    placeholder="Ingrese el apellido"
                    value={formData.apellido}
                    onChange={handleInputChange}
                    className="w-full pl-10 pr-4 py-3 bg-slate-700/50 border border-slate-600 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    required
                  />
                </div>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  Documento *
                </label>
                <div className="relative">
                  <FileText className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 w-4 h-4" />
                  <input
                    type="text"
                    name="documento"
                    placeholder="DNI / CUIT / ID"
                    value={formData.documento}
                    onChange={handleInputChange}
                    className="w-full pl-10 pr-4 py-3 bg-slate-700/50 border border-slate-600 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
                    required
                    disabled={modoEdicion}
                  />
                </div>
                {modoEdicion && (
                  <p className="text-xs text-slate-400 mt-1">
                    El documento no se puede modificar
                  </p>
                )}
              </div>
              
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  Teléfono
                </label>
                <div className="relative">
                  <Phone className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 w-4 h-4" />
                  <input
                    type="tel"
                    name="telefono"
                    placeholder="Ej: 11-1234-5678"
                    value={formData.telefono}
                    onChange={handleInputChange}
                    className="w-full pl-10 pr-4 py-3 bg-slate-700/50 border border-slate-600 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  Email
                </label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 w-4 h-4" />
                  <input
                    type="email"
                    name="email"
                    placeholder="correo@ejemplo.com"
                    value={formData.email}
                    onChange={handleInputChange}
                    className="w-full pl-10 pr-4 py-3 bg-slate-700/50 border border-slate-600 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  Dirección
                </label>
                <div className="relative">
                  <MapPin className="absolute left-3 top-3 text-slate-400 w-4 h-4" />
                  <textarea
                    name="direccion"
                    placeholder="Calle, número, ciudad..."
                    value={formData.direccion}
                    onChange={handleInputChange}
                    className="w-full pl-10 pr-4 py-3 bg-slate-700/50 border border-slate-600 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                    rows={2}
                  />
                </div>
              </div>
              
              <div className="md:col-span-2 flex justify-end gap-3 mt-4">
                <button
                  type="button"
                  onClick={limpiarFormulario}
                  className="px-6 py-3 border border-slate-600 rounded-xl text-slate-300 hover:bg-slate-700/50 transition-colors font-medium"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="px-6 py-3 bg-gradient-to-r from-emerald-600 to-blue-600 text-white rounded-xl hover:shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 font-medium"
                >
                  {loading ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent"></div>
                      Guardando...
                    </>
                  ) : (
                    <>
                      <Save className="w-4 h-4" />
                      {modoEdicion ? 'Actualizar' : 'Guardar'}
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Tabla de clientes */}
        <div className="backdrop-blur-xl bg-slate-800/40 rounded-xl border border-slate-700/50 shadow-2xl overflow-hidden">
          <div className="p-4 border-b border-slate-700/50 bg-slate-800/60">
            <h2 className="text-lg font-bold text-white flex items-center gap-2">
              <Users className="w-5 h-5 text-blue-400" />
              Lista de Clientes
            </h2>
          </div>
          
          {loading && clientesFiltrados.length === 0 ? (
            <div className="p-12 text-center">
              <div className="inline-block animate-spin rounded-full h-12 w-12 border-4 border-slate-600 border-t-blue-500 mb-4"></div>
              <p className="text-slate-300 font-medium">Cargando clientes...</p>
            </div>
          ) : clientesFiltrados.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-slate-800/60 border-b border-slate-700/50">
                  <tr>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-slate-300 uppercase tracking-wider">
                      Documento
                    </th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-slate-300 uppercase tracking-wider">
                      Nombre Completo
                    </th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-slate-300 uppercase tracking-wider hidden sm:table-cell">
                      Teléfono
                    </th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-slate-300 uppercase tracking-wider hidden md:table-cell">
                      Email
                    </th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-slate-300 uppercase tracking-wider hidden lg:table-cell">
                      Dirección
                    </th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-slate-300 uppercase tracking-wider hidden xl:table-cell">
                      Registrado
                    </th>
                    <th className="text-center px-4 py-3 text-xs font-semibold text-slate-300 uppercase tracking-wider">
                      Acciones
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-700/50">
                  {clientesFiltrados.map((cliente) => (
                    <tr key={cliente.id} className="hover:bg-slate-700/30 transition-colors">
                      <td className="px-4 py-3">
                        <span className="font-mono text-sm bg-slate-700/50 text-blue-300 px-3 py-1 rounded-lg">
                          {cliente.documento}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div>
                          <div className="font-semibold text-white">
                            {cliente.nombre} {cliente.apellido}
                          </div>
                          <div className="text-sm text-slate-400 sm:hidden">
                            {cliente.telefono}
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3 hidden sm:table-cell">
                        {cliente.telefono ? (
                          <div className="flex items-center gap-2 text-sm text-slate-300">
                            <Phone className="w-3 h-3 text-slate-400" />
                            {cliente.telefono}
                          </div>
                        ) : (
                          <span className="text-slate-500 text-sm">-</span>
                        )}
                      </td>
                      <td className="px-4 py-3 hidden md:table-cell">
                        {cliente.email ? (
                          <div className="flex items-center gap-2 text-sm text-slate-300">
                            <Mail className="w-3 h-3 text-slate-400" />
                            <span className="truncate max-w-xs">{cliente.email}</span>
                          </div>
                        ) : (
                          <span className="text-slate-500 text-sm">-</span>
                        )}
                      </td>
                      <td className="px-4 py-3 hidden lg:table-cell">
                        {cliente.direccion ? (
                          <div className="flex items-center gap-2 text-sm text-slate-300">
                            <MapPin className="w-3 h-3 text-slate-400" />
                            <span className="truncate max-w-xs" title={cliente.direccion}>
                              {cliente.direccion}
                            </span>
                          </div>
                        ) : (
                          <span className="text-slate-500 text-sm">-</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-sm text-slate-400 hidden xl:table-cell">
                        <div className="flex items-center gap-2">
                          <Calendar className="w-3 h-3" />
                          {formatearFecha(cliente.created_at)}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-center gap-2">
                          <button
                            onClick={() => iniciarEdicion(cliente)}
                            className="p-2 text-blue-400 hover:bg-blue-500/20 rounded-lg transition-colors"
                            title="Editar"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => confirmarEliminar(cliente)}
                            className="p-2 text-red-400 hover:bg-red-500/20 rounded-lg transition-colors"
                            title="Eliminar"
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
          ) : (
            <div className="p-12 text-center">
              <Users className="w-16 h-16 text-slate-600 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-white mb-2">
                {busqueda ? 'No se encontraron clientes' : 'No hay clientes registrados'}
              </h3>
              <p className="text-slate-400">
                {busqueda 
                  ? 'Intenta con otros términos de búsqueda'
                  : 'Comienza agregando tu primer cliente'
                }
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Modal de confirmación de eliminación */}
      {mostrarModalEliminar && clienteAEliminar && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="backdrop-blur-xl bg-slate-800/95 border border-slate-700/50 rounded-xl max-w-md w-full p-6 shadow-2xl animate-fade-in">
            <div className="flex items-start gap-4 mb-6">
              <div className="flex-shrink-0 w-12 h-12 bg-red-500/20 rounded-xl flex items-center justify-center">
                <AlertTriangle className="w-6 h-6 text-red-400" />
              </div>
              <div className="flex-1">
                <h3 className="text-lg font-bold text-white mb-2">
                  Confirmar eliminación
                </h3>
                <p className="text-slate-300 mb-4">
                  ¿Estás seguro de que deseas eliminar al cliente <strong className="text-white">
                    {clienteAEliminar.nombre} {clienteAEliminar.apellido}
                  </strong>?
                </p>
                <div className="bg-amber-500/10 border border-amber-500/30 rounded-lg p-3 mb-4">
                  <p className="text-sm text-amber-200">
                    <strong>⚠️ Advertencia:</strong> Esta acción no se puede deshacer.
                  </p>
                </div>
                <div className="bg-slate-700/50 rounded-lg p-3 space-y-1 text-sm text-slate-300">
                  <p><strong>Documento:</strong> {clienteAEliminar.documento}</p>
                  {clienteAEliminar.telefono && (
                    <p><strong>Teléfono:</strong> {clienteAEliminar.telefono}</p>
                  )}
                  {clienteAEliminar.email && (
                    <p><strong>Email:</strong> {clienteAEliminar.email}</p>
                  )}
                </div>
              </div>
            </div>
            
            <div className="flex justify-end gap-3">
              <button
                onClick={() => {
                  setMostrarModalEliminar(false)
                  setClienteAEliminar(null)
                }}
                className="px-4 py-2 border border-slate-600 rounded-lg text-slate-300 hover:bg-slate-700/50 transition-colors"
                disabled={loading}
              >
                Cancelar
              </button>
              <button
                onClick={eliminarCliente}
                className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                disabled={loading}
              >
                {loading ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent"></div>
                    Eliminando...
                  </>
                ) : (
                  <>
                    <Trash2 className="w-4 h-4" />
                    Eliminar Cliente
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Custom animations */}
      <style jsx>{`
        @keyframes fade-in {
          from {
            opacity: 0;
            transform: translateY(10px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        .animate-fade-in {
          animation: fade-in 0.3s ease-out;
        }

        .animation-delay-2000 {
          animation-delay: 2s;
        }

        .animation-delay-4000 {
          animation-delay: 4s;
        }
      `}</style>
    </div>
  )
}