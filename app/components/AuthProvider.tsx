'use client'
import { createContext, useContext, useState, useEffect, ReactNode } from 'react'
import { Zap, Lock, User, Eye, EyeOff, ShoppingCart, DollarSign, CreditCard, TrendingUp } from 'lucide-react'

interface AuthContextType {
  isAuthenticated: boolean
  login: (username: string, password: string) => boolean
  logout: () => void
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [isAnimating, setIsAnimating] = useState(false)

  useEffect(() => {
    // Verificar si ya está autenticado
    const authStatus = sessionStorage.getItem('isAuthenticated')
    if (authStatus === 'true') {
      setIsAuthenticated(true)
    }
    setIsLoading(false)
  }, [])

  const login = (user: string, pass: string): boolean => {
    setError('')
    setIsAnimating(true)
    
    setTimeout(() => {
      if (user === 'electro' && pass === '270306') {
        setIsAuthenticated(true)
        sessionStorage.setItem('isAuthenticated', 'true')
        setIsAnimating(false)
        return true
      } else {
        setError('Usuario o contraseña incorrectos')
        setIsAnimating(false)
        return false
      }
    }, 800)
    
    return false
  }

  const logout = () => {
    setIsAuthenticated(false)
    sessionStorage.removeItem('isAuthenticated')
  }

  const handleLoginSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    login(username, password)
  }

  // Mostrar pantalla de carga inicial
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 via-blue-900 to-slate-800">
        <div className="text-center">
          <div className="relative">
            <div className="animate-spin rounded-full h-20 w-20 border-t-4 border-b-4 border-emerald-400 mx-auto"></div>
            <Zap className="w-8 h-8 text-emerald-400 absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 animate-pulse" />
          </div>
          <p className="mt-6 text-white text-xl font-semibold animate-pulse">Cargando sistema...</p>
        </div>
      </div>
    )
  }

  // Si NO está autenticado, mostrar login profesional
  if (!isAuthenticated) {
    return (
      <div className="min-h-screen relative overflow-hidden bg-gradient-to-br from-slate-900 via-blue-900 to-slate-800">
        {/* Animated background pattern */}
        <div className="absolute inset-0 overflow-hidden opacity-10">
          <div className="absolute inset-0" style={{
            backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23ffffff' fill-opacity='0.4'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`,
          }}></div>
        </div>

        {/* Floating shapes */}
        <div className="absolute inset-0">
          <div className="absolute top-20 left-10 w-64 h-64 bg-emerald-500/10 rounded-full blur-3xl animate-pulse"></div>
          <div className="absolute bottom-20 right-10 w-80 h-80 bg-blue-500/10 rounded-full blur-3xl animate-pulse animation-delay-2000"></div>
          <div className="absolute top-1/2 right-1/3 w-96 h-96 bg-slate-500/10 rounded-full blur-3xl animate-pulse animation-delay-4000"></div>
        </div>

        {/* Main content */}
        <div className="relative min-h-screen flex items-center justify-center p-4">
          <div className="w-full max-w-md">
            {/* Glass card */}
            <div className="backdrop-blur-xl bg-slate-800/40 rounded-2xl shadow-2xl border border-slate-700/50 overflow-hidden transform transition-all duration-500 hover:shadow-emerald-500/20">
              {/* Top accent bar */}
              <div className="h-1.5 bg-gradient-to-r from-emerald-500 via-blue-500 to-emerald-500"></div>
              
              <div className="relative p-8 sm:p-10">
                {/* Logo and title */}
                <div className="text-center mb-8 animate-fade-in">
                  <div className="inline-flex items-center justify-center mb-6">
                    <div className="relative">
                      <div className="absolute inset-0 bg-gradient-to-r from-emerald-500 to-blue-500 rounded-xl blur-xl opacity-50 animate-pulse"></div>
                      <div className="relative bg-gradient-to-br from-slate-700 to-slate-800 w-20 h-20 rounded-xl flex items-center justify-center shadow-xl border-2 border-emerald-500/30">
                        <Zap className="w-10 h-10 text-emerald-400" strokeWidth={2.5} />
                      </div>
                    </div>
                  </div>
                  
                  <h1 className="text-3xl sm:text-4xl font-bold text-white mb-2 tracking-tight">
                    Electro Hogar
                  </h1>
                  <div className="flex items-center justify-center gap-2 text-slate-300 text-sm">
                    <ShoppingCart className="w-4 h-4 text-emerald-400" />
                    <p>Electrodomésticos</p>
                    <span className="text-slate-500">•</span>
                    <DollarSign className="w-4 h-4 text-emerald-400" />
                    <p>Préstamos</p>
                  </div>
                </div>

                {/* Login form */}
                <form onSubmit={handleLoginSubmit} className="space-y-5">
                  {/* Username input */}
                  <div className="group">
                    <label htmlFor="username" className="block text-sm font-semibold text-slate-200 mb-2 flex items-center gap-2">
                      <User className="w-4 h-4 text-emerald-400" />
                      Usuario
                    </label>
                    <div className="relative">
                      <input
                        id="username"
                        type="text"
                        value={username}
                        onChange={(e) => setUsername(e.target.value)}
                        className="w-full px-4 py-3.5 bg-slate-900/50 backdrop-blur-sm border-2 border-slate-700/50 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:border-emerald-500/50 focus:bg-slate-900/70 transition-all duration-300 text-base"
                        placeholder="Ingrese su usuario"
                        required
                        autoFocus
                        disabled={isAnimating}
                      />
                      <div className="absolute inset-0 rounded-lg bg-gradient-to-r from-emerald-500/0 to-blue-500/0 group-hover:from-emerald-500/5 group-hover:to-blue-500/5 pointer-events-none transition-all duration-500"></div>
                    </div>
                  </div>

                  {/* Password input */}
                  <div className="group">
                    <label htmlFor="password" className="block text-sm font-semibold text-slate-200 mb-2 flex items-center gap-2">
                      <Lock className="w-4 h-4 text-emerald-400" />
                      Contraseña
                    </label>
                    <div className="relative">
                      <input
                        id="password"
                        type={showPassword ? 'text' : 'password'}
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        className="w-full px-4 py-3.5 bg-slate-900/50 backdrop-blur-sm border-2 border-slate-700/50 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:border-emerald-500/50 focus:bg-slate-900/70 transition-all duration-300 text-base pr-12"
                        placeholder="Ingrese su contraseña"
                        required
                        disabled={isAnimating}
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-4 top-1/2 transform -translate-y-1/2 text-slate-400 hover:text-emerald-400 transition-colors"
                        tabIndex={-1}
                      >
                        {showPassword ? (
                          <EyeOff className="w-5 h-5" />
                        ) : (
                          <Eye className="w-5 h-5" />
                        )}
                      </button>
                      <div className="absolute inset-0 rounded-lg bg-gradient-to-r from-emerald-500/0 to-blue-500/0 group-hover:from-emerald-500/5 group-hover:to-blue-500/5 pointer-events-none transition-all duration-500"></div>
                    </div>
                  </div>

                  {/* Error message */}
                  {error && (
                    <div className="animate-shake bg-red-900/30 backdrop-blur-sm border-2 border-red-500/50 text-red-200 px-4 py-3 rounded-lg text-sm flex items-center gap-3 shadow-lg">
                      <div className="flex-shrink-0 w-5 h-5 rounded-full bg-red-500 flex items-center justify-center">
                        <span className="text-white text-xs font-bold">✕</span>
                      </div>
                      <span className="font-medium">{error}</span>
                    </div>
                  )}

                  {/* Submit button */}
                  <button
                    type="submit"
                    disabled={isAnimating}
                    className="relative w-full group overflow-hidden rounded-lg"
                  >
                    <div className="absolute inset-0 bg-gradient-to-r from-emerald-600 to-emerald-500"></div>
                    <div className="absolute inset-0 bg-gradient-to-r from-emerald-500 to-blue-500 opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
                    <div className="relative px-6 py-4 flex items-center justify-center gap-3 text-white font-bold text-base">
                      {isAnimating ? (
                        <>
                          <div className="animate-spin rounded-full h-5 w-5 border-t-2 border-b-2 border-white"></div>
                          <span>Verificando credenciales...</span>
                        </>
                      ) : (
                        <>
                          <Lock className="w-5 h-5" />
                          <span>Iniciar Sesión</span>
                        </>
                      )}
                    </div>
                  </button>
                </form>

                {/* Features */}
                <div className="mt-8 grid grid-cols-2 gap-3">
                  <div className="bg-slate-900/40 backdrop-blur-sm rounded-lg p-3 border border-slate-700/30">
                    <div className="flex items-center gap-2 text-emerald-400 mb-1">
                      <ShoppingCart className="w-4 h-4" />
                      <span className="text-xs font-semibold">Ventas</span>
                    </div>
                    <p className="text-[10px] text-slate-400">Electrodomésticos</p>
                  </div>
                  <div className="bg-slate-900/40 backdrop-blur-sm rounded-lg p-3 border border-slate-700/30">
                    <div className="flex items-center gap-2 text-blue-400 mb-1">
                      <TrendingUp className="w-4 h-4" />
                      <span className="text-xs font-semibold">Préstamos</span>
                    </div>
                    <p className="text-[10px] text-slate-400">Dinero rápido</p>
                  </div>
                </div>

                {/* Footer */}
                <div className="mt-6 text-center">
                  <div className="flex items-center justify-center gap-2 text-slate-400 text-xs">
                    <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></div>
                    <p className="font-medium">Sistema seguro y confiable</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Bottom info */}
            <div className="mt-6 text-center">
              <div className="inline-flex items-center gap-2 text-slate-300 text-sm backdrop-blur-sm bg-slate-800/30 rounded-full px-6 py-2 border border-slate-700/30">
                <CreditCard className="w-4 h-4 text-emerald-400" />
                <span>Gestión de cobranzas profesional</span>
              </div>
            </div>
          </div>
        </div>

        {/* Custom animations */}
        <style jsx>{`
          @keyframes fade-in {
            from {
              opacity: 0;
              transform: translateY(-10px);
            }
            to {
              opacity: 1;
              transform: translateY(0);
            }
          }

          @keyframes shake {
            0%, 100% { transform: translateX(0); }
            25% { transform: translateX(-10px); }
            75% { transform: translateX(10px); }
          }

          .animate-fade-in {
            animation: fade-in 1s ease-out;
          }

          .animate-shake {
            animation: shake 0.5s ease-in-out;
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

  // Si está autenticado, renderizar el contenido completo
  return (
    <AuthContext.Provider value={{ isAuthenticated, login, logout }}>
      {children}
    </AuthContext.Provider>
  )
}

// Hook personalizado para usar el contexto de autenticación
export function useAuth() {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error('useAuth debe ser usado dentro de un AuthProvider')
  }
  return context
}