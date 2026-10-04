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
      <nav className="fixed top-0 left-0 right-0 z-40 bg-[#0F4C81] dark:bg-surface dark:border-b dark:border-line text-white shadow-e2" aria-label="Navegación principal">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            {/* Logo/Brand */}
            <div className="flex items-center gap-3">
              <div className="icon-tile w-9 h-9 bg-white/15 text-white">
                <Zap className="w-5 h-5" />
              </div>
              <div className="leading-tight">
                <p className="font-semibold text-base">Electro Hogar</p>
                <p className="hidden sm:block text-xs text-white/70">Ventas, préstamos y cobranzas</p>
              </div>
            </div>

            {/* Desktop Navigation */}
            <div className="hidden md:flex items-center gap-1">
              {navItems.map((item) => {
                const Icon = item.icon
                const active = isActive(item.href)

                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    aria-current={active ? 'page' : undefined}
                    className={`flex items-center gap-2 min-h-[44px] px-4 rounded-lg text-sm font-medium transition-colors ${
                      active
                        ? 'bg-white text-[#0F4C81] dark:bg-primary/15 dark:text-primary shadow-e1'
                        : 'text-white/80 hover:text-white hover:bg-white/10'
                    }`}
                  >
                    <Icon className="w-4 h-4" />
                    <span>{item.label}</span>
                  </Link>
                )
              })}

              {/* Desktop Logout */}
              <button
                onClick={logout}
                className="flex items-center gap-2 min-h-[44px] px-4 ml-2 rounded-lg text-sm font-medium text-white/80 hover:text-white hover:bg-white/10 border border-white/20 transition-colors"
              >
                <LogOut className="w-4 h-4" />
                <span>Cerrar sesión</span>
              </button>
            </div>

            {/* Mobile Menu Button */}
            <button
              onClick={toggleMobileMenu}
              className="md:hidden inline-flex items-center justify-center w-11 h-11 rounded-lg text-white hover:bg-white/10 transition-colors"
              aria-label={isMobileMenuOpen ? 'Cerrar menú' : 'Abrir menú'}
              aria-expanded={isMobileMenuOpen}
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
          className="fixed inset-0 bg-slate-950/50 z-30 md:hidden"
          onClick={closeMobileMenu}
        />
      )}

      {/* Mobile Menu Panel */}
      <div className={`fixed top-16 right-0 bottom-0 w-72 max-w-[85vw] bg-surface border-l border-line shadow-e3 transform transition-transform duration-300 ease-out z-[35] md:hidden ${
        isMobileMenuOpen ? 'translate-x-0' : 'translate-x-full'
      }`}>
        <div className="p-4 space-y-1">
          <p className="px-3 pt-2 pb-3 text-xs font-semibold uppercase tracking-wide text-muted">Menú</p>

          {/* Mobile Nav Items */}
          {navItems.map((item) => {
            const Icon = item.icon
            const active = isActive(item.href)

            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={closeMobileMenu}
                aria-current={active ? 'page' : undefined}
                className={`flex items-center gap-3 min-h-[48px] px-3 rounded-lg text-sm font-medium transition-colors ${
                  active
                    ? 'bg-primary/10 text-primary'
                    : 'text-fg hover:bg-surface-2'
                }`}
              >
                <Icon className="w-5 h-5" />
                <span>{item.label}</span>
              </Link>
            )
          })}

          {/* Separator */}
          <div className="divider !my-4"></div>

          {/* Mobile Logout Button */}
          <button
            onClick={() => {
              closeMobileMenu()
              logout()
            }}
            className="w-full flex items-center gap-3 min-h-[48px] px-3 rounded-lg text-sm font-medium text-danger-text hover:bg-danger-soft transition-colors"
          >
            <LogOut className="w-5 h-5" />
            <span>Cerrar sesión</span>
          </button>
        </div>
      </div>

      {/* Spacer for fixed navbar */}
      <div className="h-16"></div>
    </>
  )
}