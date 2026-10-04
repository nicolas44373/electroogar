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
  TrendingUp
} from 'lucide-react'

interface Producto {
  id: string
  nombre: string
  descripcion: string
  precio: number
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
    precio: '',
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
      precio: '',
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
    if (!formData.precio || parseFloat(formData.precio) <= 0) {
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
        precio: parseFloat(formData.precio),
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
      precio: producto.precio.toString(),
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
      minimumFractionDigits: 2
    }).format(monto)
  }

  const getTipoColor = (tipo: string) => {
    switch (tipo) {
      case 'electrodomestico':
        return 'badge-primary'
      case 'prestamo':
        return 'badge-reprog'
      default:
        return 'badge-neutral'
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

  const totalValorInventario = productosFiltrados.reduce((sum, p) => sum + (p.precio * (p.stock || 0)), 0)
  const totalProductos = productosFiltrados.reduce((sum, p) => sum + (p.stock || 0), 0)

  return (
    <div className="page">
      <div className="page-container">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4 mb-6">
          <div>
            <h1 className="page-title">Productos</h1>
            <p className="page-subtitle num">
              {productosFiltrados.length} producto{productosFiltrados.length !== 1 ? 's' : ''} · {totalProductos} unidades en stock
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
            Nuevo producto
          </button>
        </div>

        {/* Stats Cards */}
        <dl className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
          <div className="card p-5">
            <div className="flex items-center gap-3">
              <div className="icon-tile bg-primary/10 text-primary">
                <Package className="w-5 h-5" />
              </div>
              <div>
                <dt className="text-sm text-muted">Productos</dt>
                <dd className="text-2xl font-bold text-fg num">{productosFiltrados.length}</dd>
              </div>
            </div>
          </div>

          <div className="card p-5">
            <div className="flex items-center gap-3">
              <div className="icon-tile bg-success-soft text-success-text">
                <Box className="w-5 h-5" />
              </div>
              <div>
                <dt className="text-sm text-muted">Unidades en stock</dt>
                <dd className="text-2xl font-bold text-fg num">{totalProductos}</dd>
              </div>
            </div>
          </div>

          <div className="card p-5 border-l-4 border-l-primary">
            <div className="flex items-center gap-3 min-w-0">
              <div className="icon-tile bg-reprog-soft text-reprog-text">
                <TrendingUp className="w-5 h-5" />
              </div>
              <div className="min-w-0">
                <dt className="text-sm text-muted">Valor del inventario</dt>
                <dd className="text-2xl font-bold text-fg num truncate">{formatearMoneda(totalValorInventario)}</dd>
              </div>
            </div>
          </div>
        </dl>

        {/* Barra de búsqueda */}
        <div className="relative mb-6">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted w-5 h-5 pointer-events-none" />
          <input
            type="text"
            placeholder="Buscar por nombre, descripción o tipo"
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            className="input input-icon bg-surface shadow-e1"
            aria-label="Buscar productos"
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
                <Package className="w-5 h-5 text-primary" />
                {modoEdicion ? 'Editar producto' : 'Nuevo producto'}
              </h2>
              <button
                onClick={limpiarFormulario}
                className="btn-icon"
                aria-label="Cerrar formulario"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={guardarProducto} className="card-body grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label htmlFor="prod-nombre" className="label">
                  Nombre <span className="text-danger" aria-hidden="true">*</span>
                </label>
                <div className="relative">
                  <Tag className="absolute left-3 top-1/2 -translate-y-1/2 text-muted w-4 h-4 pointer-events-none" />
                  <input
                    id="prod-nombre"
                    type="text"
                    name="nombre"
                    placeholder="Ej: Heladera Samsung 350 L"
                    value={formData.nombre}
                    onChange={handleInputChange}
                    className="input input-icon"
                    required
                  />
                </div>
              </div>

              <div>
                <label htmlFor="prod-precio" className="label">
                  Precio unitario <span className="text-danger" aria-hidden="true">*</span>
                </label>
                <div className="relative">
                  <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 text-muted w-4 h-4 pointer-events-none" />
                  <input
                    id="prod-precio"
                    type="number"
                    name="precio"
                    placeholder="0,00"
                    value={formData.precio}
                    onChange={handleInputChange}
                    className="input input-icon num"
                    step="0.01"
                    min="0"
                    required
                  />
                </div>
              </div>

              <div>
                <label htmlFor="prod-tipo" className="label">
                  Tipo <span className="text-danger" aria-hidden="true">*</span>
                </label>
                <select
                  id="prod-tipo"
                  name="tipo"
                  value={formData.tipo}
                  onChange={handleInputChange}
                  className="input"
                >
                  <option value="electrodomestico">Electrodoméstico</option>
                  <option value="prestamo">Préstamo</option>
                </select>
              </div>

              <div>
                <label htmlFor="prod-stock" className="label">
                  Stock disponible
                </label>
                <div className="relative">
                  <Box className="absolute left-3 top-1/2 -translate-y-1/2 text-muted w-4 h-4 pointer-events-none" />
                  <input
                    id="prod-stock"
                    type="number"
                    name="stock"
                    placeholder="0"
                    value={formData.stock}
                    onChange={handleInputChange}
                    className="input input-icon num"
                    min="0"
                  />
                </div>
                <p className="help">Cantidad de unidades que tenés para vender.</p>
              </div>

              <div className="md:col-span-2">
                <label htmlFor="prod-descripcion" className="label">
                  Descripción <span className="font-normal text-muted">(opcional)</span>
                </label>
                <div className="relative">
                  <FileText className="absolute left-3 top-3 text-muted w-4 h-4 pointer-events-none" />
                  <textarea
                    id="prod-descripcion"
                    name="descripcion"
                    placeholder="Marca, modelo, medidas, garantía…"
                    value={formData.descripcion}
                    onChange={handleInputChange}
                    className="input input-icon resize-none"
                    rows={3}
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
                        {modoEdicion ? 'Guardar cambios' : 'Crear producto'}
                      </>
                    )}
                  </button>
                </div>
              </div>
            </form>
          </div>
        )}

        {/* Tabla de productos */}
        <div className="card overflow-hidden">
          <div className="card-header">
            <h2 className="section-title">
              <Package className="w-5 h-5 text-primary" />
              Catálogo
            </h2>
          </div>

          {loading && productosFiltrados.length === 0 ? (
            <div className="p-4 space-y-3" role="status" aria-live="polite">
              <span className="sr-only">Cargando productos…</span>
              {[0, 1, 2, 3, 4].map((i) => (
                <div key={i} className="flex items-center gap-4 py-2">
                  <div className="flex-1 space-y-2">
                    <div className="skeleton h-4 w-1/3" />
                    <div className="skeleton h-3 w-1/2" />
                  </div>
                  <div className="skeleton h-4 w-24" />
                  <div className="skeleton h-6 w-28 rounded-full" />
                </div>
              ))}
            </div>
          ) : productosFiltrados.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="data-table min-w-[560px]">
                <thead>
                  <tr>
                    <th>Producto</th>
                    <th className="hidden md:table-cell">Descripción</th>
                    <th className="!text-right">Precio</th>
                    <th className="!text-center">Tipo</th>
                    <th className="!text-right">Stock</th>
                    <th className="!text-right">Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {productosFiltrados.map((producto) => (
                    <tr key={producto.id}>
                      <td>
                        <div className="font-medium text-fg">{producto.nombre}</div>
                        <div className="text-xs text-muted md:hidden mt-0.5 line-clamp-2">
                          {producto.descripcion}
                        </div>
                      </td>
                      <td className="hidden md:table-cell">
                        {producto.descripcion ? (
                          <div className="text-muted max-w-xs truncate" title={producto.descripcion}>
                            {producto.descripcion}
                          </div>
                        ) : (
                          <span className="text-muted">—</span>
                        )}
                      </td>
                      <td className="text-right">
                        <div className="font-semibold text-fg num whitespace-nowrap">
                          {formatearMoneda(producto.precio)}
                        </div>
                      </td>
                      <td className="text-center">
                        <span className={getTipoColor(producto.tipo)}>
                          {getTipoLabel(producto.tipo)}
                        </span>
                      </td>
                      <td className="text-right">
                        <span className={`inline-flex items-center gap-1 font-semibold num ${
                          (producto.stock || 0) > 0 ? 'text-fg' : 'text-danger-text'
                        }`}>
                          {(producto.stock || 0) > 0 ? null : <AlertTriangle className="w-3.5 h-3.5" aria-label="Sin stock" />}
                          {producto.stock || 0}
                        </span>
                      </td>
                      <td>
                        <div className="flex items-center justify-end gap-0.5">
                          <button
                            onClick={() => iniciarEdicion(producto)}
                            className="btn-icon"
                            title="Editar"
                            aria-label={`Editar ${producto.nombre}`}
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => confirmarEliminar(producto)}
                            className="btn-icon hover:!text-danger hover:!bg-danger-soft"
                            title="Eliminar"
                            aria-label={`Eliminar ${producto.nombre}`}
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
            <div className="empty-state">
              <Package className="w-10 h-10 text-muted/60 mb-3" />
              <h3 className="text-base font-semibold text-fg mb-1">
                {busqueda ? 'No encontramos productos' : 'Todavía no hay productos'}
              </h3>
              <p className="text-sm">
                {busqueda
                  ? 'Probá con otro nombre o tipo.'
                  : 'Tocá “Nuevo producto” para cargar el primero.'
                }
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Modal de confirmación de eliminación */}
      {mostrarModalEliminar && productoAEliminar && (
        <div className="modal-backdrop">
          <div className="modal" role="alertdialog" aria-modal="true" aria-labelledby="titulo-eliminar-producto">
            <div className="modal-body">
              <div className="flex items-start gap-4">
                <div className="icon-tile w-11 h-11 bg-danger-soft text-danger-text">
                  <AlertTriangle className="w-5 h-5" />
                </div>
                <div className="flex-1">
                  <h3 id="titulo-eliminar-producto" className="text-base font-semibold text-fg">
                    ¿Eliminar {productoAEliminar.nombre}?
                  </h3>
                  <p className="text-sm text-muted mt-1">
                    Se borra el producto del catálogo. Esta acción no se puede deshacer.
                  </p>
                </div>
              </div>
              <dl className="rounded-lg bg-surface-2 p-3 space-y-1 text-sm">
                <div className="flex gap-2"><dt className="text-muted">Precio:</dt><dd className="text-fg num">{formatearMoneda(productoAEliminar.precio)}</dd></div>
                <div className="flex gap-2"><dt className="text-muted">Tipo:</dt><dd className="text-fg">{getTipoLabel(productoAEliminar.tipo)}</dd></div>
                <div className="flex gap-2"><dt className="text-muted">Stock:</dt><dd className="text-fg num">{productoAEliminar.stock || 0} unidades</dd></div>
              </dl>
            </div>

            <div className="modal-footer">
              <button
                onClick={() => {
                  setMostrarModalEliminar(false)
                  setProductoAEliminar(null)
                }}
                className="btn-secondary"
                disabled={loading}
              >
                Cancelar
              </button>
              <button
                onClick={eliminarProducto}
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
                    Eliminar producto
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
