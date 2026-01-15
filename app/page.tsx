'use client'
import { useState, useEffect } from 'react'
import { supabase } from '@/app/lib/supabase'
import Link from 'next/link'

export default function HomePage() {
  const [estadisticas, setEstadisticas] = useState({
    totalClientes: 0,
    totalProductos: 0,
    ventasActivas: 0,
    montosPendientes: 0
  })

  useEffect(() => {
    cargarEstadisticas()
  }, [])

  const cargarEstadisticas = async () => {
    // Contar clientes
    const { count: clientesCount } = await supabase
      .from('clientes')
      .select('*', { count: 'exact', head: true })
    
    // Contar productos
    const { count: productosCount } = await supabase
      .from('productos')
      .select('*', { count: 'exact', head: true })
    
    // Contar transacciones activas
    const { count: ventasCount } = await supabase
      .from('transacciones')
      .select('*', { count: 'exact', head: true })
      .eq('estado', 'activo')
    
    // Calcular montos pendientes
    const { data: pagosData } = await supabase
      .from('pagos')
      .select('*')
      .eq('estado', 'pendiente')
    
    const montosPendientes = pagosData?.length || 0

    setEstadisticas({
      totalClientes: clientesCount || 0,
      totalProductos: productosCount || 0,
      ventasActivas: ventasCount || 0,
      montosPendientes: montosPendientes
    })
  }

  return (
    <div className="max-w-6xl mx-auto">
      <h1 className="text-4xl font-bold mb-8">Sistema de Gestión de Ventas y Préstamos</h1>
      
      {/* Tarjetas de Estadísticas */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <div className="bg-white p-6 rounded-lg shadow">
          <h3 className="text-gray-500 text-sm mb-2">Total Clientes</h3>
          <p className="text-3xl font-bold text-blue-600">{estadisticas.totalClientes}</p>
        </div>
        <div className="bg-white p-6 rounded-lg shadow">
          <h3 className="text-gray-500 text-sm mb-2">Total Productos</h3>
          <p className="text-3xl font-bold text-green-600">{estadisticas.totalProductos}</p>
        </div>
        <div className="bg-white p-6 rounded-lg shadow">
          <h3 className="text-gray-500 text-sm mb-2">Ventas Activas</h3>
          <p className="text-3xl font-bold text-purple-600">{estadisticas.ventasActivas}</p>
        </div>
        <div className="bg-white p-6 rounded-lg shadow">
          <h3 className="text-gray-500 text-sm mb-2">Pagos Pendientes</h3>
          <p className="text-3xl font-bold text-red-600">{estadisticas.montosPendientes}</p>
        </div>
      </div>

      {/* Accesos Rápidos */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Link href="/productos" className="bg-white p-6 rounded-lg shadow hover:shadow-lg transition-shadow">
          <h2 className="text-xl font-semibold mb-2">📦 Productos</h2>
          <p className="text-gray-600">Gestionar catálogo de productos y préstamos</p>
        </Link>
        
        <Link href="/clientes" className="bg-white p-6 rounded-lg shadow hover:shadow-lg transition-shadow">
          <h2 className="text-xl font-semibold mb-2">👥 Clientes</h2>
          <p className="text-gray-600">Administrar información de clientes</p>
        </Link>
        
        <Link href="/cobranzas" className="bg-white p-6 rounded-lg shadow hover:shadow-lg transition-shadow">
          <h2 className="text-xl font-semibold mb-2">💰 Cobranzas</h2>
          <p className="text-gray-600">Control de pagos y seguimiento de cuotas</p>
        </Link>
      </div>
    </div>
  )
}