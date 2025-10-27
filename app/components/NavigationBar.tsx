'use client'
import { useState } from 'react'
import Link from 'next/link'
import { useAuth } from './AuthProvider'

export default function NavigationBar() {
  const { isAuthenticated, logout } = useAuth()
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)

  // Si NO está autenticado, no mostrar nada
  if (!isAuthenticated) {
    return null
  }

  const toggleMobileMenu = () => {
    setIsMobileMenuOpen(!isMobileMenuOpen)
  }

  const closeMobileMenu = () => {
    setIsMobileMenuOpen(false)
  }

  // Si está autenticado, mostrar la navegación completa
  return (
    <nav className="bg-gray-800 text-white shadow-lg">
      <div className="container mx-auto px-4">
        {/* Desktop y Mobile Header */}
        <div className="flex justify-between items-center h-16">
          {/* Logo/Brand - Visible en móvil y desktop */}
          <div className="flex items-center">
            <span className="text-xl font-bold md:hidden">💼 Sistema</span>
            
            {/* Desktop Menu - Oculto en móvil */}
            <div className="hidden md:flex gap-6">
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
          </div>

          {/* Desktop Logout Button - Oculto en móvil */}
          <div className="hidden md:block">
            <button
              onClick={logout}
              className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg transition-colors font-medium text-sm"
            >
              🚪 Cerrar Sesión
            </button>
          </div>

          {/* Mobile Menu Button - Visible solo en móvil */}
          <div className="md:hidden">
            <button
              onClick={toggleMobileMenu}
              className="text-white hover:text-gray-300 focus:outline-none focus:text-gray-300 p-2"
              aria-label="Toggle menu"
            >
              {isMobileMenuOpen ? (
                // X icon cuando está abierto
                <svg className="h-6 w-6" fill="none" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" viewBox="0 0 24 24" stroke="currentColor">
                  <path d="M6 18L18 6M6 6l12 12"></path>
                </svg>
              ) : (
                // Hamburger icon cuando está cerrado
                <svg className="h-6 w-6" fill="none" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" viewBox="0 0 24 24" stroke="currentColor">
                  <path d="M4 6h16M4 12h16M4 18h16"></path>
                </svg>
              )}
            </button>
          </div>
        </div>

        {/* Mobile Menu - Se muestra/oculta según el estado */}
        <div className={`md:hidden ${isMobileMenuOpen ? 'block' : 'hidden'}`}>
          <div className="px-2 pt-2 pb-3 space-y-1 border-t border-gray-700">
            <Link 
              href="/" 
              onClick={closeMobileMenu}
              className="block px-3 py-2 rounded-md text-base font-medium hover:bg-gray-700 hover:text-white transition-colors"
            >
              🏠 Inicio
            </Link>
            <Link 
              href="/productos" 
              onClick={closeMobileMenu}
              className="block px-3 py-2 rounded-md text-base font-medium hover:bg-gray-700 hover:text-white transition-colors"
            >
              📦 Productos
            </Link>
            <Link 
              href="/clientes" 
              onClick={closeMobileMenu}
              className="block px-3 py-2 rounded-md text-base font-medium hover:bg-gray-700 hover:text-white transition-colors"
            >
              👥 Clientes
            </Link>
            <Link 
              href="/cobranzas" 
              onClick={closeMobileMenu}
              className="block px-3 py-2 rounded-md text-base font-medium hover:bg-gray-700 hover:text-white transition-colors"
            >
              💰 Cobranzas
            </Link>
            
            {/* Separador */}
            <div className="border-t border-gray-700 my-2"></div>
            
            {/* Mobile Logout Button */}
            <button
              onClick={() => {
                closeMobileMenu()
                logout()
              }}
              className="block w-full text-left px-3 py-2 rounded-md text-base font-medium bg-red-600 hover:bg-red-700 transition-colors"
            >
              🚪 Cerrar Sesión
            </button>
          </div>
        </div>
      </div>
    </nav>
  )
}