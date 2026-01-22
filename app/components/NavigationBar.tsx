'use client'
import { useState, useEffect } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useAuth } from './AuthProvider'
import { Home, Package, Users, CreditCard, LogOut, Menu, X, Zap } from 'lucide-react'

export default function NavigationBar() {
  const { isAuthenticated, logout } = useAuth()
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)
  const pathname = usePathname()

  // Cerrar menú móvil cuando cambia la ruta (FIX del bug)
  useEffect(() => {
    setIsMobileMenuOpen(false)
  }, [pathname])

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

  const navItems = [
    { href: '/', label: 'Inicio', icon: Home },
    { href: '/productos', label: 'Productos', icon: Package },
    { href: '/clientes', label: 'Clientes', icon: Users },
    { href: '/cobranzas', label: 'Cobranzas', icon: CreditCard },
  ]

  const isActive = (href: string) => {
    if (href === '/') {
      return pathname === '/'
    }
    return pathname?.startsWith(href)
  }

  return (
    <>
      {/* Navigation Bar */}
      <nav className="fixed top-0 left-0 right-0 z-[100] backdrop-blur-xl bg-slate-900/95 border-b border-slate-700/50 shadow-2xl">
        {/* Animated background pattern */}
        <div className="absolute inset-0 overflow-hidden opacity-5">
          <div className="absolute inset-0" style={{
            backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23ffffff' fill-opacity='0.4'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`,
          }}></div>
        </div>

        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            {/* Logo/Brand */}
            <div className="flex items-center gap-3">
              <div className="relative">
                <div className="absolute inset-0 bg-gradient-to-r from-emerald-500 to-blue-500 rounded-lg blur opacity-50"></div>
                <div className="relative bg-gradient-to-br from-slate-700 to-slate-800 w-10 h-10 rounded-lg flex items-center justify-center border border-emerald-500/30">
                  <Zap className="w-5 h-5 text-emerald-400" strokeWidth={2.5} />
                </div>
              </div>
              
              <div className="hidden sm:block">
                <h1 className="text-white font-bold text-lg">Electro Hogar</h1>
                <p className="text-xs text-slate-400">Sistema de Gestión</p>
              </div>
              
              <h1 className="sm:hidden text-white font-bold text-lg">Electro Hogar</h1>
            </div>

            {/* Desktop Navigation */}
            <div className="hidden md:flex items-center gap-2">
              {navItems.map((item) => {
                const Icon = item.icon
                const active = isActive(item.href)
                
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`group relative flex items-center gap-2 px-4 py-2 rounded-lg font-medium text-sm transition-all ${
                      active
                        ? 'bg-gradient-to-r from-emerald-600 to-blue-600 text-white shadow-lg'
                        : 'text-slate-300 hover:text-white hover:bg-slate-800/50'
                    }`}
                  >
                    {active && (
                      <div className="absolute inset-0 bg-gradient-to-r from-white/20 to-transparent rounded-lg"></div>
                    )}
                    <Icon className={`w-4 h-4 relative z-10 ${active ? 'animate-pulse' : ''}`} />
                    <span className="relative z-10">{item.label}</span>
                  </Link>
                )
              })}

              {/* Desktop Logout */}
              <button
                onClick={logout}
                className="group relative flex items-center gap-2 px-4 py-2 rounded-lg font-medium text-sm text-slate-300 hover:text-white hover:bg-red-500/20 border border-transparent hover:border-red-500/50 transition-all ml-2"
              >
                <LogOut className="w-4 h-4" />
                <span>Salir</span>
              </button>
            </div>

            {/* Mobile Menu Button */}
            <button
              onClick={toggleMobileMenu}
              className="md:hidden p-2 rounded-lg text-slate-300 hover:text-white hover:bg-slate-800/50 transition-all"
              aria-label="Toggle menu"
            >
              {isMobileMenuOpen ? (
                <X className="w-6 h-6" />
              ) : (
                <Menu className="w-6 h-6" />
              )}
            </button>
          </div>
        </div>
      </nav>

      {/* Mobile Menu Overlay */}
      {isMobileMenuOpen && (
        <div 
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[90] md:hidden"
          onClick={closeMobileMenu}
        />
      )}

      {/* Mobile Menu Panel */}
      <div className={`fixed top-16 right-0 bottom-0 w-72 bg-slate-900/98 backdrop-blur-xl border-l border-slate-700/50 shadow-2xl transform transition-transform duration-300 ease-out z-[95] md:hidden ${
        isMobileMenuOpen ? 'translate-x-0' : 'translate-x-full'
      }`}>
        {/* Gradient decoration */}
        <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-emerald-500 via-blue-500 to-purple-500"></div>
        
        <div className="p-6 space-y-3">
          <div className="mb-6">
            <h2 className="text-white font-bold text-lg mb-1">Navegación</h2>
            <p className="text-slate-400 text-sm">Selecciona una opción</p>
          </div>

          {/* Mobile Nav Items */}
          {navItems.map((item) => {
            const Icon = item.icon
            const active = isActive(item.href)
            
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={closeMobileMenu}
                className={`group relative flex items-center gap-3 px-4 py-3 rounded-lg font-medium text-sm transition-all overflow-hidden ${
                  active
                    ? 'bg-gradient-to-r from-emerald-600 to-blue-600 text-white shadow-lg'
                    : 'text-slate-300 hover:text-white bg-slate-800/30 hover:bg-slate-800/60'
                }`}
              >
                {active && (
                  <>
                    <div className="absolute inset-0 bg-gradient-to-r from-white/10 to-transparent"></div>
                    <div className="absolute left-0 top-0 bottom-0 w-1 bg-white rounded-r"></div>
                  </>
                )}
                <Icon className={`w-5 h-5 relative z-10 ${active ? 'animate-pulse' : 'group-hover:scale-110 transition-transform'}`} />
                <span className="relative z-10">{item.label}</span>
              </Link>
            )
          })}

          {/* Separator */}
          <div className="my-6 border-t border-slate-700/50"></div>

          {/* Mobile Logout Button */}
          <button
            onClick={() => {
              closeMobileMenu()
              logout()
            }}
            className="group w-full flex items-center gap-3 px-4 py-3 rounded-lg font-medium text-sm bg-red-500/20 text-red-400 hover:bg-red-500/30 hover:text-red-300 border border-red-500/30 hover:border-red-500/50 transition-all"
          >
            <LogOut className="w-5 h-5 group-hover:scale-110 transition-transform" />
            <span>Cerrar Sesión</span>
          </button>

          {/* Status indicator */}
          <div className="mt-8 pt-6 border-t border-slate-700/50">
            <div className="flex items-center gap-2 text-sm">
              <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></div>
              <span className="text-slate-400">Sistema activo</span>
            </div>
          </div>
        </div>
      </div>

      {/* Spacer for fixed navbar */}
      <div className="h-16"></div>
    </>
  )
}