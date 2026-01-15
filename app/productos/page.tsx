'use client'
import { useState, useEffect } from 'react'
import { supabase } from '@/app/lib/supabase'

interface Producto {
  id: string
  nombre: string
  descripcion: string
  precio: number
  tipo: string
  stock: number
}

export default function ProductosPage() {
  const [productos, setProductos] = useState<Producto[]>([])
  const [nombre, setNombre] = useState('')
  const [descripcion, setDescripcion] = useState('')
  const [precio, setPrecio] = useState('')
  const [tipo, setTipo] = useState('electrodomestico')
  const [stock, setStock] = useState('')

  useEffect(() => {
    cargarProductos()
  }, [])

  const cargarProductos = async () => {
    const { data, error } = await supabase
      .from('productos')
      .select('*')
      .order('created_at', { ascending: false })
    
    if (data) setProductos(data)
  }

  const guardarProducto = async (e: React.FormEvent) => {
    e.preventDefault()
    
    const { error } = await supabase
      .from('productos')
      .insert({
        nombre,
        descripcion,
        precio: parseFloat(precio),
        tipo,
        stock: parseInt(stock) || 0
      })
    
    if (!error) {
      setNombre('')
      setDescripcion('')
      setPrecio('')
      setStock('')
      cargarProductos()
    }
  }

  const eliminarProducto = async (id: string) => {
    const { error } = await supabase
      .from('productos')
      .delete()
      .eq('id', id)
    
    if (!error) cargarProductos()
  }

  return (
    <div className="max-w-6xl mx-auto">
      <h1 className="text-3xl font-bold mb-6">Gestión de Productos</h1>
      
      <div className="bg-white p-6 rounded-lg shadow mb-6">
        <h2 className="text-xl font-semibold mb-4">Agregar Producto</h2>
        <form onSubmit={guardarProducto} className="grid grid-cols-2 gap-4">
          <input
            type="text"
            placeholder="Nombre del producto"
            value={nombre}
            onChange={(e) => setNombre(e.target.value)}
            className="border p-2 rounded"
            required
          />
          <input
            type="number"
            placeholder="Precio"
            value={precio}
            onChange={(e) => setPrecio(e.target.value)}
            className="border p-2 rounded"
            step="0.01"
            required
          />
          <select
            value={tipo}
            onChange={(e) => setTipo(e.target.value)}
            className="border p-2 rounded"
          >
            <option value="electrodomestico">Electrodoméstico</option>
            <option value="prestamo">Préstamo</option>
          </select>
          <input
            type="number"
            placeholder="Stock (opcional)"
            value={stock}
            onChange={(e) => setStock(e.target.value)}
            className="border p-2 rounded"
          />
          <textarea
            placeholder="Descripción"
            value={descripcion}
            onChange={(e) => setDescripcion(e.target.value)}
            className="border p-2 rounded col-span-2"
            rows={3}
          />
          <button
            type="submit"
            className="bg-blue-500 text-white p-2 rounded hover:bg-blue-600 col-span-2"
          >
            Guardar Producto
          </button>
        </form>
      </div>

      <div className="bg-white p-6 rounded-lg shadow">
        <h2 className="text-xl font-semibold mb-4">Lista de Productos</h2>
        <div className="overflow-x-auto">
          <table className="w-full border-collapse">
            <thead>
              <tr className="border-b">
                <th className="text-left p-2">Nombre</th>
                <th className="text-left p-2">Descripción</th>
                <th className="text-left p-2">Precio</th>
                <th className="text-left p-2">Tipo</th>
                <th className="text-left p-2">Stock</th>
                <th className="text-left p-2">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {productos.map((producto) => (
                <tr key={producto.id} className="border-b hover:bg-gray-50">
                  <td className="p-2">{producto.nombre}</td>
                  <td className="p-2">{producto.descripcion}</td>
                  <td className="p-2">${producto.precio}</td>
                  <td className="p-2">{producto.tipo}</td>
                  <td className="p-2">{producto.stock}</td>
                  <td className="p-2">
                    <button
                      onClick={() => eliminarProducto(producto.id)}
                      className="text-red-500 hover:text-red-700"
                    >
                      Eliminar
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}