'use client'
import { useState, useEffect } from 'react'
import { supabase } from '@/app/lib/supabase'
import { 
  Package, 
  Plus, 
  Edit2, 
  Trash2, 
  Save, 
  X, 
  DollarSign, 
  FileText,
  AlertTriangle,
  Check,
  Search,
  Tag,
  Box,
  TrendingUp,
  Zap
} from 'lucide-react'

interface Producto {
  id: string
  nombre: string
  descripcion: string
  precio_unitario: number
  tipo: string
  stock: number
  created_at?: string
}

export default function ProductosPage() {
  const [productos, setProductos] = useState<Producto[]>([])
  const [productosFiltrados, setProductosFiltrados] = useState<Producto[]>([])
  const [busqueda, setBusqueda] = useState('')
  const [modoEdicion, setModoEdicion] = useState(false)
  const [productoEditando, setProductoEditando] = useState<string | null>(null)
  const [mostrarFormulario, setMostrarFormulario] = useState(false)
  const [loading, setLoading] = useState(false)
  
  const [mostrarModalEliminar, setMostrarModalEliminar] = useState(false)
  const [productoAEliminar, setProductoAEliminar] = useState<Producto | null>(null)
  
  const [mensaje, setMensaje] = useState<{tipo: 'exito' | 'error', texto: string} | null>(null)
  
  const [formData, setFormData] = useState({
    nombre: '',
    descripcion: '',
    precio_unitario: '',
    tipo: 'electrodomestico',
    stock: ''
  })

  useEffect(() => {
    cargarProductos()
  }, [])

  useEffect(() => {
    if (busqueda) {
      const filtrados = productos.filter(producto => 
        producto.nombre.toLowerCase().includes(busqueda.toLowerCase()) ||
        producto.descripcion.toLowerCase().includes(busqueda.toLowerCase()) ||
        producto.tipo.toLowerCase().includes(busqueda.toLowerCase())
      )
      setProductosFiltrados(filtrados)
    } else {
      setProductosFiltrados(productos)
    }
  }, [busqueda, productos])

  useEffect(() => {
    if (mensaje) {
      const timer = setTimeout(() => setMensaje(null), 4000)
      return () => clearTimeout(timer)
    }
  }, [mensaje])

  const cargarProductos = async () => {
    setLoading(true)
    try {
      const { data, error } = await supabase
        .from('productos')
        .select('*')
        .order('created_at', { ascending: false })
      
      if (error) throw error
      if (data) {
        setProductos(data)
        setProductosFiltrados(data)
      }
    } catch (error: any) {
      setMensaje({ tipo: 'error', texto: 'Error al cargar productos: ' + error.message })
    } finally {
      setLoading(false)
    }
  }

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target
    setFormData(prev => ({
      ...prev,
      [name]: value
    }))
  }

  const limpiarFormulario = () => {
    setFormData({
      nombre: '',
      descripcion: '',
      precio_unitario: '',
      tipo: 'electrodomestico',
      stock: ''
    })
    setModoEdicion(false)
    setProductoEditando(null)
    setMostrarFormulario(false)
  }

  const validarFormulario = () => {
    if (!formData.nombre.trim()) {
      setMensaje({ tipo: 'error', texto: 'El nombre es obligatorio' })
      return false
    }
    if (!formData.precio_unitario || parseFloat(formData.precio_unitario) <= 0) {
      setMensaje({ tipo: 'error', texto: 'El precio debe ser mayor a 0' })
      return false
    }
    return true
  }

  const guardarProducto = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!validarFormulario()) return
    
    setLoading(true)
    try {
      const dataToSave = {
        nombre: formData.nombre,
        descripcion: formData.descripcion,
        precio_unitario: parseFloat(formData.precio_unitario),
        tipo: formData.tipo,
        stock: parseInt(formData.stock) || 0
      }

      if (modoEdicion && productoEditando) {
        const { error } = await supabase
          .from('productos')
          .update(dataToSave)
          .eq('id', productoEditando)
        
        if (error) throw error
        setMensaje({ tipo: 'exito', texto: 'Producto actualizado correctamente' })
      } else {
        const { error } = await supabase
          .from('productos')
          .insert(dataToSave)
        
        if (error) throw error
        setMensaje({ tipo: 'exito', texto: 'Producto creado correctamente' })
      }
      
      limpiarFormulario()
      cargarProductos()
    } catch (error: any) {
      setMensaje({ tipo: 'error', texto: 'Error al guardar: ' + error.message })
    } finally {
      setLoading(false)
    }
  }

  const iniciarEdicion = (producto: Producto) => {
    setFormData({
      nombre: producto.nombre,
      descripcion: producto.descripcion || '',
      precio_unitario: producto.precio_unitario.toString(),
      tipo: producto.tipo,
      stock: producto.stock?.toString() || '0'
    })
    setModoEdicion(true)
    setProductoEditando(producto.id)
    setMostrarFormulario(true)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const confirmarEliminar = (producto: Producto) => {
    setProductoAEliminar(producto)
    setMostrarModalEliminar(true)
  }

  const eliminarProducto = async () => {
    if (!productoAEliminar) return
    
    setLoading(true)
    try {
      const { error } = await supabase
        .from('productos')
        .delete()
        .eq('id', productoAEliminar.id)
      
      if (error) throw error
      
      setMensaje({ tipo: 'exito', texto: 'Producto eliminado correctamente' })
      cargarProductos()
    } catch (error: any) {
      setMensaje({ tipo: 'error', texto: 'Error al eliminar: ' + error.message })
    } finally {
      setLoading(false)
      setMostrarModalEliminar(false)
      setProductoAEliminar(null)
    }
  }

  const formatearMoneda = (monto: number) => {
    return new Intl.NumberFormat('es-AR', {
      style: 'currency',
      currency: 'ARS',
      minimumFractionDigits: 0
    }).format(monto)
  }

  const getTipoColor = (tipo: string) => {
    switch (tipo) {
      case 'electrodomestico':
        return 'bg-blue-500/20 text-blue-300 border-blue-500/30'
      case 'prestamo':
        return 'bg-purple-500/20 text-purple-300 border-purple-500/30'
      default:
        return 'bg-slate-500/20 text-slate-300 border-slate-500/30'
    }
  }

  const getTipoLabel = (tipo: string) => {
    switch (tipo) {
      case 'electrodomestico':
        return 'Electrodoméstico'
      case 'prestamo':
        return 'Préstamo'
      default:
        return tipo
    }
  }

  const totalValorInventario = productosFiltrados.reduce((sum, p) => sum + (p.precio_unitario * (p.stock || 0)), 0)
  const totalProductos = productosFiltrados.reduce((sum, p) => sum + (p.stock || 0), 0)

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
        <div className="absolute top-20 left-10 w-64 h-64 bg-emerald-500/10 rounded-full blur-3xl animate-pulse"></div>
        <div className="absolute bottom-20 right-10 w-80 h-80 bg-purple-500/10 rounded-full blur-3xl animate-pulse animation-delay-2000"></div>
        <div className="absolute top-1/2 right-1/3 w-96 h-96 bg-blue-500/10 rounded-full blur-3xl animate-pulse animation-delay-4000"></div>
      </div>

      <div className="relative max-w-7xl mx-auto p-4 sm:p-6 lg:p-8">
        {/* Header */}
        <div className="backdrop-blur-xl bg-slate-800/40 rounded-xl border border-slate-700/50 shadow-2xl p-6 mb-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
            <div className="flex items-center gap-4">
              <div className="relative">
                <div className="absolute inset-0 bg-gradient-to-r from-emerald-500 to-blue-500 rounded-xl blur opacity-50"></div>
                <div className="relative bg-gradient-to-br from-emerald-600 to-blue-600 p-4 rounded-xl">
                  <Package className="w-8 h-8 text-white" />
                </div>
              </div>
              <div>
                <h1 className="text-2xl sm:text-3xl font-bold text-white">Gestión de Productos</h1>
                <p className="text-slate-300 mt-1">
                  {productosFiltrados.length} producto{productosFiltrados.length !== 1 ? 's' : ''} • {totalProductos} unidades
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
                Nuevo Producto
              </div>
            </button>
          </div>

          {/* Stats Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="bg-slate-700/30 backdrop-blur-sm rounded-lg p-4 border border-slate-600/50">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-blue-500/20 rounded-lg">
                  <Package className="w-5 h-5 text-blue-400" />
                </div>
                <div>
                  <p className="text-xs text-slate-400">Total Productos</p>
                  <p className="text-xl font-bold text-white">{productosFiltrados.length}</p>
                </div>
              </div>
            </div>
            
            <div className="bg-slate-700/30 backdrop-blur-sm rounded-lg p-4 border border-slate-600/50">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-emerald-500/20 rounded-lg">
                  <Box className="w-5 h-5 text-emerald-400" />
                </div>
                <div>
                  <p className="text-xs text-slate-400">Stock Total</p>
                  <p className="text-xl font-bold text-white">{totalProductos}</p>
                </div>
              </div>
            </div>
            
            <div className="bg-slate-700/30 backdrop-blur-sm rounded-lg p-4 border border-slate-600/50">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-purple-500/20 rounded-lg">
                  <TrendingUp className="w-5 h-5 text-purple-400" />
                </div>
                <div>
                  <p className="text-xs text-slate-400">Valor Inventario</p>
                  <p className="text-xl font-bold text-white">{formatearMoneda(totalValorInventario)}</p>
                </div>
              </div>
            </div>
          </div>

          {/* Barra de búsqueda */}
          <div className="mt-6">
            <div className="relative">
              <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 text-slate-400 w-5 h-5" />
              <input
                type="text"
                placeholder="Buscar por nombre, descripción o tipo..."
                value={busqueda}
                onChange={(e) => setBusqueda(e.target.value)}
                className="w-full pl-12 pr-4 py-3 bg-slate-700/50 border border-slate-600 rounded-xl text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent backdrop-blur-sm"
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
                <Package className="w-6 h-6 text-emerald-400" />
                {modoEdicion ? 'Editar Producto' : 'Nuevo Producto'}
              </h2>
              <button
                onClick={limpiarFormulario}
                className="p-2 text-slate-400 hover:text-white hover:bg-slate-700/50 rounded-lg transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <form onSubmit={guardarProducto} className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  Nombre del Producto *
                </label>
                <div className="relative">
                  <Tag className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 w-4 h-4" />
                  <input
                    type="text"
                    name="nombre"
                    placeholder="Ej: Heladera Samsung 350L"
                    value={formData.nombre}
                    onChange={handleInputChange}
                    className="w-full pl-10 pr-4 py-3 bg-slate-700/50 border border-slate-600 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    required
                  />
                </div>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  Precio Unitario *
                </label>
                <div className="relative">
                  <DollarSign className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 w-4 h-4" />
                  <input
                    type="number"
                    name="precio_unitario"
                    placeholder="0.00"
                    value={formData.precio_unitario}
                    onChange={handleInputChange}
                    className="w-full pl-10 pr-4 py-3 bg-slate-700/50 border border-slate-600 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    step="0.01"
                    min="0"
                    required
                  />
                </div>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  Tipo de Producto *
                </label>
                <select
                  name="tipo"
                  value={formData.tipo}
                  onChange={handleInputChange}
                  className="w-full px-4 py-3 bg-slate-700/50 border border-slate-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                >
                  <option value="electrodomestico">Electrodoméstico</option>
                  <option value="prestamo">Préstamo</option>
                </select>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  Stock Disponible
                </label>
                <div className="relative">
                  <Box className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 w-4 h-4" />
                  <input
                    type="number"
                    name="stock"
                    placeholder="0"
                    value={formData.stock}
                    onChange={handleInputChange}
                    className="w-full pl-10 pr-4 py-3 bg-slate-700/50 border border-slate-600 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    min="0"
                  />
                </div>
              </div>
              
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  Descripción
                </label>
                <div className="relative">
                  <FileText className="absolute left-3 top-3 text-slate-400 w-4 h-4" />
                  <textarea
                    name="descripcion"
                    placeholder="Descripción detallada del producto..."
                    value={formData.descripcion}
                    onChange={handleInputChange}
                    className="w-full pl-10 pr-4 py-3 bg-slate-700/50 border border-slate-600 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 resize-none"
                    rows={3}
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

        {/* Tabla de productos */}
        <div className="backdrop-blur-xl bg-slate-800/40 rounded-xl border border-slate-700/50 shadow-2xl overflow-hidden">
          <div className="p-4 border-b border-slate-700/50 bg-slate-800/60">
            <h2 className="text-lg font-bold text-white flex items-center gap-2">
              <Package className="w-5 h-5 text-emerald-400" />
              Catálogo de Productos
            </h2>
          </div>
          
          {loading && productosFiltrados.length === 0 ? (
            <div className="p-12 text-center">
              <div className="inline-block animate-spin rounded-full h-12 w-12 border-4 border-slate-600 border-t-emerald-500 mb-4"></div>
              <p className="text-slate-300 font-medium">Cargando productos...</p>
            </div>
          ) : productosFiltrados.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-slate-800/60 border-b border-slate-700/50">
                  <tr>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-slate-300 uppercase tracking-wider">
                      Producto
                    </th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-slate-300 uppercase tracking-wider hidden md:table-cell">
                      Descripción
                    </th>
                    <th className="text-right px-4 py-3 text-xs font-semibold text-slate-300 uppercase tracking-wider">
                      Precio
                    </th>
                    <th className="text-center px-4 py-3 text-xs font-semibold text-slate-300 uppercase tracking-wider">
                      Tipo
                    </th>
                    <th className="text-center px-4 py-3 text-xs font-semibold text-slate-300 uppercase tracking-wider hidden sm:table-cell">
                      Stock
                    </th>
                    <th className="text-center px-4 py-3 text-xs font-semibold text-slate-300 uppercase tracking-wider">
                      Acciones
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-700/50">
                  {productosFiltrados.map((producto) => (
                    <tr key={producto.id} className="hover:bg-slate-700/30 transition-colors">
                      <td className="px-4 py-3">
                        <div className="font-semibold text-white">{producto.nombre}</div>
                        <div className="text-sm text-slate-400 md:hidden mt-1">
                          {producto.descripcion}
                        </div>
                      </td>
                      <td className="px-4 py-3 hidden md:table-cell">
                        {producto.descripcion ? (
                          <div className="text-sm text-slate-300 max-w-xs truncate" title={producto.descripcion}>
                            {producto.descripcion}
                          </div>
                        ) : (
                          <span className="text-slate-500 text-sm">-</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="font-bold text-emerald-400">
                          {formatearMoneda(producto.precio_unitario)}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex justify-center">
                          <span className={`px-3 py-1 rounded-full text-xs font-semibold border ${getTipoColor(producto.tipo)}`}>
                            {getTipoLabel(producto.tipo)}
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-center hidden sm:table-cell">
                        <span className={`font-semibold ${
                          (producto.stock || 0) > 0 ? 'text-emerald-400' : 'text-red-400'
                        }`}>
                          {producto.stock || 0}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-center gap-2">
                          <button
                            onClick={() => iniciarEdicion(producto)}
                            className="p-2 text-blue-400 hover:bg-blue-500/20 rounded-lg transition-colors"
                            title="Editar"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => confirmarEliminar(producto)}
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
              <Package className="w-16 h-16 text-slate-600 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-white mb-2">
                {busqueda ? 'No se encontraron productos' : 'No hay productos registrados'}
              </h3>
              <p className="text-slate-400">
                {busqueda 
                  ? 'Intenta con otros términos de búsqueda'
                  : 'Comienza agregando tu primer producto'
                }
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Modal de confirmación de eliminación */}
      {mostrarModalEliminar && productoAEliminar && (
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
                  ¿Estás seguro de que deseas eliminar el producto <strong className="text-white">
                    {productoAEliminar.nombre}
                  </strong>?
                </p>
                <div className="bg-amber-500/10 border border-amber-500/30 rounded-lg p-3 mb-4">
                  <p className="text-sm text-amber-200">
                    <strong>⚠️ Advertencia:</strong> Esta acción no se puede deshacer.
                  </p>
                </div>
                <div className="bg-slate-700/50 rounded-lg p-3 space-y-1 text-sm text-slate-300">
                  <p><strong>Precio:</strong> {formatearMoneda(productoAEliminar.precio_unitario)}</p>
                  <p><strong>Tipo:</strong> {getTipoLabel(productoAEliminar.tipo)}</p>
                  <p><strong>Stock:</strong> {productoAEliminar.stock || 0} unidades</p>
                </div>
              </div>
            </div>
            
            <div className="flex justify-end gap-3">
              <button
                onClick={() => {
                  setMostrarModalEliminar(false)
                  setProductoAEliminar(null)
                }}
                className="px-4 py-2 border border-slate-600 rounded-lg text-slate-300 hover:bg-slate-700/50 transition-colors"
                disabled={loading}
              >
                Cancelar
              </button>
              <button
                onClick={eliminarProducto}
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
                    Eliminar Producto
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