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
  Check
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
  
  // Modal de confirmación
  const [mostrarModalEliminar, setMostrarModalEliminar] = useState(false)
  const [clienteAEliminar, setClienteAEliminar] = useState<Cliente | null>(null)
  
  // Modal de éxito/error
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
    // Filtrar clientes según búsqueda
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
    // Auto-ocultar mensajes después de 3 segundos
    if (mensaje) {
      const timer = setTimeout(() => setMensaje(null), 3000)
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
        // Actualizar cliente existente
        const { error } = await supabase
          .from('clientes')
          .update(formData)
          .eq('id', clienteEditando)
        
        if (error) throw error
        setMensaje({ tipo: 'exito', texto: 'Cliente actualizado correctamente' })
      } else {
        // Crear nuevo cliente
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
    // Scroll al formulario
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
      // Verificar si tiene transacciones
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
    <div className="max-w-7xl mx-auto p-4 sm:p-6">
      {/* Header */}
      <div className="bg-white rounded-lg shadow-sm border p-6 mb-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 flex items-center gap-2">
              <User className="w-8 h-8 text-blue-600" />
              Gestión de Clientes
            </h1>
            <p className="text-gray-600 mt-1">
              Total: {clientesFiltrados.length} cliente{clientesFiltrados.length !== 1 ? 's' : ''}
            </p>
          </div>
          
          <button
            onClick={() => {
              limpiarFormulario()
              setMostrarFormulario(!mostrarFormulario)
            }}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2"
          >
            <Plus className="w-5 h-5" />
            Nuevo Cliente
          </button>
        </div>

        {/* Barra de búsqueda */}
        <div className="mt-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
            <input
              type="text"
              placeholder="Buscar por nombre, documento, teléfono o email..."
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>
      </div>

      {/* Mensaje de éxito/error */}
      {mensaje && (
        <div className={`mb-4 p-4 rounded-lg flex items-center gap-2 animate-pulse ${
          mensaje.tipo === 'exito' 
            ? 'bg-green-50 border border-green-200 text-green-700'
            : 'bg-red-50 border border-red-200 text-red-700'
        }`}>
          {mensaje.tipo === 'exito' ? (
            <Check className="w-5 h-5" />
          ) : (
            <AlertTriangle className="w-5 h-5" />
          )}
          {mensaje.texto}
        </div>
      )}

      {/* Formulario */}
      {mostrarFormulario && (
        <div className="bg-white rounded-lg shadow-sm border p-6 mb-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-semibold text-gray-900">
              {modoEdicion ? 'Editar Cliente' : 'Nuevo Cliente'}
            </h2>
            <button
              onClick={limpiarFormulario}
              className="text-gray-400 hover:text-gray-600"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
          
          <form onSubmit={guardarCliente} className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Nombre *
              </label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                <input
                  type="text"
                  name="nombre"
                  placeholder="Ingrese el nombre"
                  value={formData.nombre}
                  onChange={handleInputChange}
                  className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  required
                />
              </div>
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Apellido *
              </label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                <input
                  type="text"
                  name="apellido"
                  placeholder="Ingrese el apellido"
                  value={formData.apellido}
                  onChange={handleInputChange}
                  className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  required
                />
              </div>
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Documento *
              </label>
              <div className="relative">
                <FileText className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                <input
                  type="text"
                  name="documento"
                  placeholder="DNI / CUIT / ID"
                  value={formData.documento}
                  onChange={handleInputChange}
                  className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  required
                  disabled={modoEdicion}
                />
              </div>
              {modoEdicion && (
                <p className="text-xs text-gray-500 mt-1">
                  El documento no se puede modificar
                </p>
              )}
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Teléfono
              </label>
              <div className="relative">
                <Phone className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                <input
                  type="tel"
                  name="telefono"
                  placeholder="Ej: 11-1234-5678"
                  value={formData.telefono}
                  onChange={handleInputChange}
                  className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Email
              </label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                <input
                  type="email"
                  name="email"
                  placeholder="correo@ejemplo.com"
                  value={formData.email}
                  onChange={handleInputChange}
                  className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Dirección
              </label>
              <div className="relative">
                <MapPin className="absolute left-3 top-3 text-gray-400 w-4 h-4" />
                <textarea
                  name="direccion"
                  placeholder="Calle, número, ciudad..."
                  value={formData.direccion}
                  onChange={handleInputChange}
                  className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                  rows={2}
                />
              </div>
            </div>
            
            <div className="md:col-span-2 flex justify-end gap-3">
              <button
                type="button"
                onClick={limpiarFormulario}
                className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={loading}
                className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:bg-gray-400 disabled:cursor-not-allowed flex items-center gap-2"
              >
                {loading ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
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
      <div className="bg-white rounded-lg shadow-sm border overflow-hidden">
        <div className="p-4 border-b bg-gray-50">
          <h2 className="text-lg font-semibold text-gray-900">Lista de Clientes</h2>
        </div>
        
        {loading && clientesFiltrados.length === 0 ? (
          <div className="p-8 text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
            <p className="mt-2 text-gray-600">Cargando clientes...</p>
          </div>
        ) : clientesFiltrados.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b">
                <tr>
                  <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">
                    Documento
                  </th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">
                    Nombre Completo
                  </th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase hidden sm:table-cell">
                    Teléfono
                  </th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase hidden md:table-cell">
                    Email
                  </th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase hidden lg:table-cell">
                    Dirección
                  </th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase hidden xl:table-cell">
                    Registrado
                  </th>
                  <th className="text-center px-4 py-3 text-xs font-medium text-gray-500 uppercase">
                    Acciones
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {clientesFiltrados.map((cliente) => (
                  <tr key={cliente.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3">
                      <span className="font-mono text-sm bg-gray-100 px-2 py-1 rounded">
                        {cliente.documento}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div>
                        <div className="font-medium text-gray-900">
                          {cliente.nombre} {cliente.apellido}
                        </div>
                        <div className="text-sm text-gray-500 sm:hidden">
                          {cliente.telefono}
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 hidden sm:table-cell">
                      {cliente.telefono ? (
                        <div className="flex items-center gap-1 text-sm">
                          <Phone className="w-3 h-3 text-gray-400" />
                          {cliente.telefono}
                        </div>
                      ) : (
                        <span className="text-gray-400 text-sm">-</span>
                      )}
                    </td>
                    <td className="px-4 py-3 hidden md:table-cell">
                      {cliente.email ? (
                        <div className="flex items-center gap-1 text-sm">
                          <Mail className="w-3 h-3 text-gray-400" />
                          {cliente.email}
                        </div>
                      ) : (
                        <span className="text-gray-400 text-sm">-</span>
                      )}
                    </td>
                    <td className="px-4 py-3 hidden lg:table-cell">
                      {cliente.direccion ? (
                        <div className="flex items-center gap-1 text-sm">
                          <MapPin className="w-3 h-3 text-gray-400" />
                          <span className="truncate max-w-xs" title={cliente.direccion}>
                            {cliente.direccion}
                          </span>
                        </div>
                      ) : (
                        <span className="text-gray-400 text-sm">-</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-500 hidden xl:table-cell">
                      {formatearFecha(cliente.created_at)}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-center gap-2">
                        <button
                          onClick={() => iniciarEdicion(cliente)}
                          className="p-1.5 text-blue-600 hover:bg-blue-100 rounded-lg transition-colors"
                          title="Editar"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => confirmarEliminar(cliente)}
                          className="p-1.5 text-red-600 hover:bg-red-100 rounded-lg transition-colors"
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
          <div className="p-8 text-center">
            <User className="w-12 h-12 text-gray-400 mx-auto mb-3" />
            <h3 className="text-lg font-medium text-gray-900 mb-1">
              {busqueda ? 'No se encontraron clientes' : 'No hay clientes registrados'}
            </h3>
            <p className="text-gray-600">
              {busqueda 
                ? 'Intenta con otros términos de búsqueda'
                : 'Comienza agregando tu primer cliente'
              }
            </p>
          </div>
        )}
      </div>

      {/* Modal de confirmación de eliminación */}
      {mostrarModalEliminar && clienteAEliminar && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg max-w-md w-full p-6">
            <div className="flex items-start gap-4">
              <div className="flex-shrink-0 w-12 h-12 bg-red-100 rounded-full flex items-center justify-center">
                <AlertTriangle className="w-6 h-6 text-red-600" />
              </div>
              <div className="flex-1">
                <h3 className="text-lg font-semibold text-gray-900 mb-2">
                  Confirmar eliminación
                </h3>
                <p className="text-gray-600 mb-4">
                  ¿Estás seguro de que deseas eliminar al cliente <strong>
                    {clienteAEliminar.nombre} {clienteAEliminar.apellido}
                  </strong>?
                </p>
                <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 mb-4">
                  <p className="text-sm text-amber-800">
                    <strong>⚠️ Advertencia:</strong> Esta acción no se puede deshacer. 
                    Se eliminará permanentemente el registro del cliente.
                  </p>
                </div>
                <div className="bg-gray-50 rounded-lg p-3 space-y-1 text-sm">
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
            
            <div className="flex justify-end gap-3 mt-6">
              <button
                onClick={() => {
                  setMostrarModalEliminar(false)
                  setClienteAEliminar(null)
                }}
                className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors"
                disabled={loading}
              >
                Cancelar
              </button>
              <button
                onClick={eliminarCliente}
                className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors disabled:bg-gray-400 disabled:cursor-not-allowed flex items-center gap-2"
                disabled={loading}
              >
                {loading ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
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
    </div>
  )
}