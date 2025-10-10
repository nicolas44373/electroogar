'use client'
import Link from 'next/link'
import { useAuth } from './AuthProvider'

export default function NavigationBar() {
  const { isAuthenticated, logout } = useAuth()

  // Si NO está autenticado, no mostrar nada
  if (!isAuthenticated) {
    return null
  }

  // Si está autenticado, mostrar la navegación completa
  return (
    <nav className="bg-gray-800 text-white p-4 shadow-lg">
      <div className="container mx-auto flex justify-between items-center">
        <div className="flex gap-6">
          <Link href="/" className="hover:text-gray-300 transition-colors font-medium">
            🏠 Inicio
          </Link>
          <Link href="/productos" className="hover:text-gray-300 transition-colors font-medium">
            📦 Productos
          </Link>
          <Link href="/clientes" className="hover:text-gray-300 transition-colors font-medium">
            👥 Clientes
          </Link>
          <Link href="/cobranzas" className="hover:text-gray-300 transition-colors font-medium">
            💰 Cobranzas
          </Link>
        </div>
        
        <button
          onClick={logout}
          className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg transition-colors font-medium text-sm"
        >
          🚪 Cerrar Sesión
        </button>
      </div>
    </nav>
  )
}