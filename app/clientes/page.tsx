'use client'
import { useState, useEffect } from 'react'
import { supabase } from '@/app/lib/supabase'

interface Cliente {
  id: string
  nombre: string
  apellido: string
  documento: string
  telefono: string
  direccion: string
  email: string
}

export default function ClientesPage() {
  const [clientes, setClientes] = useState<Cliente[]>([])
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

  const cargarClientes = async () => {
    const { data, error } = await supabase
      .from('clientes')
      .select('*')
      .order('created_at', { ascending: false })
    
    if (data) setClientes(data)
  }

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    })
  }

  const guardarCliente = async (e: React.FormEvent) => {
    e.preventDefault()
    
    const { error } = await supabase
      .from('clientes')
      .insert(formData)
    
    if (!error) {
      setFormData({
        nombre: '',
        apellido: '',
        documento: '',
        telefono: '',
        direccion: '',
        email: ''
      })
      cargarClientes()
    } else {
      alert('Error: ' + error.message)
    }
  }

  const eliminarCliente = async (id: string) => {
    if (confirm('¿Está seguro de eliminar este cliente?')) {
      const { error } = await supabase
        .from('clientes')
        .delete()
        .eq('id', id)
      
      if (!error) cargarClientes()
    }
  }

  return (
    <div className="max-w-6xl mx-auto">
      <h1 className="text-3xl font-bold mb-6">Gestión de Clientes</h1>
      
      <div className="bg-white p-6 rounded-lg shadow mb-6">
        <h2 className="text-xl font-semibold mb-4">Agregar Cliente</h2>
        <form onSubmit={guardarCliente} className="grid grid-cols-2 gap-4">
          <input
            type="text"
            name="nombre"
            placeholder="Nombre"
            value={formData.nombre}
            onChange={handleInputChange}
            className="border p-2 rounded"
            required
          />
          <input
            type="text"
            name="apellido"
            placeholder="Apellido"
            value={formData.apellido}
            onChange={handleInputChange}
            className="border p-2 rounded"
            required
          />
          <input
            type="text"
            name="documento"
            placeholder="Documento (ID único)"
            value={formData.documento}
            onChange={handleInputChange}
            className="border p-2 rounded"
            required
          />
          <input
            type="tel"
            name="telefono"
            placeholder="Teléfono"
            value={formData.telefono}
            onChange={handleInputChange}
            className="border p-2 rounded"
          />
          <input
            type="email"
            name="email"
            placeholder="Email"
            value={formData.email}
            onChange={handleInputChange}
            className="border p-2 rounded"
          />
          <textarea
            name="direccion"
            placeholder="Dirección"
            value={formData.direccion}
            onChange={handleInputChange}
            className="border p-2 rounded"
            rows={2}
          />
          <button
            type="submit"
            className="bg-green-500 text-white p-2 rounded hover:bg-green-600 col-span-2"
          >
            Guardar Cliente
          </button>
        </form>
      </div>

      <div className="bg-white p-6 rounded-lg shadow">
        <h2 className="text-xl font-semibold mb-4">Lista de Clientes</h2>
        <div className="overflow-x-auto">
          <table className="w-full border-collapse">
            <thead>
              <tr className="border-b">
                <th className="text-left p-2">ID/Documento</th>
                <th className="text-left p-2">Nombre Completo</th>
                <th className="text-left p-2">Teléfono</th>
                <th className="text-left p-2">Email</th>
                <th className="text-left p-2">Dirección</th>
                <th className="text-left p-2">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {clientes.map((cliente) => (
                <tr key={cliente.id} className="border-b hover:bg-gray-50">
                  <td className="p-2 font-mono text-sm">{cliente.documento}</td>
                  <td className="p-2">{cliente.nombre} {cliente.apellido}</td>
                  <td className="p-2">{cliente.telefono}</td>
                  <td className="p-2">{cliente.email}</td>
                  <td className="p-2">{cliente.direccion}</td>
                  <td className="p-2">
                    <button
                      onClick={() => eliminarCliente(cliente.id)}
                      className="text-red-500 hover:text-red-700 mr-2"
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