'use client'
import { createContext, useContext, useState, useEffect, ReactNode } from 'react'
import { Zap, Lock, User, Eye, EyeOff, LogIn, ShieldCheck, XCircle } from 'lucide-react'

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
      <div className="min-h-screen flex items-center justify-center bg-canvas">
        <div className="flex flex-col items-center gap-4" role="status" aria-live="polite">
          <div className="icon-tile w-12 h-12 bg-primary text-on-primary shadow-e2">
            <Zap className="w-6 h-6" />
          </div>
          <div className="w-40 h-1.5 rounded-full bg-line overflow-hidden">
            <div className="h-full w-1/2 bg-primary rounded-full animate-pulse" />
          </div>
          <p className="text-sm text-muted">Cargando…</p>
        </div>
      </div>
    )
  }

  // Si NO está autenticado, mostrar login profesional
  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-canvas flex flex-col">
        <div className="flex-1 flex items-center justify-center p-4">
          <div className="w-full max-w-sm">
            {/* Marca */}
            <div className="text-center mb-8">
              <div className="icon-tile w-14 h-14 rounded-xl bg-primary text-on-primary shadow-e2 mb-4">
                <Zap className="w-7 h-7" />
              </div>
              <h1 className="text-2xl font-semibold text-fg">Electro Hogar</h1>
              <p className="text-sm text-muted mt-1">Gestión de ventas, préstamos y cobranzas</p>
            </div>

            <div className="card p-6 sm:p-8">
              <h2 className="text-lg font-semibold text-fg mb-1">Iniciar sesión</h2>
              <p className="text-sm text-muted mb-6">Ingresá con tu usuario y contraseña.</p>

              {/* Login form */}
              <form onSubmit={handleLoginSubmit} className="space-y-4">
                {/* Username input */}
                <div>
                  <label htmlFor="username" className="label">
                    Usuario
                  </label>
                  <div className="relative">
                    <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted pointer-events-none" />
                    <input
                      id="username"
                      type="text"
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                      className="input input-icon"
                      placeholder="Tu usuario"
                      required
                      autoFocus
                      disabled={isAnimating}
                    />
                  </div>
                </div>

                {/* Password input */}
                <div>
                  <label htmlFor="password" className="label">
                    Contraseña
                  </label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted pointer-events-none" />
                    <input
                      id="password"
                      type={showPassword ? 'text' : 'password'}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="input input-icon pr-12"
                      placeholder="Tu contraseña"
                      required
                      disabled={isAnimating}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-0 top-0 btn-icon"
                      tabIndex={-1}
                      aria-label={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                    >
                      {showPassword ? (
                        <EyeOff className="w-5 h-5" />
                      ) : (
                        <Eye className="w-5 h-5" />
                      )}
                    </button>
                  </div>
                </div>

                {/* Error message */}
                {error && (
                  <div className="alert-danger" role="alert">
                    <XCircle className="w-5 h-5 flex-shrink-0" />
                    <span>{error}. Revisá los datos e intentá de nuevo.</span>
                  </div>
                )}

                {/* Submit button */}
                <button
                  type="submit"
                  disabled={isAnimating}
                  className="btn-primary w-full"
                >
                  {isAnimating ? (
                    <>
                      <span className="spinner" />
                      <span>Verificando…</span>
                    </>
                  ) : (
                    <>
                      <LogIn className="w-4 h-4" />
                      <span>Ingresar</span>
                    </>
                  )}
                </button>
              </form>
            </div>

            <p className="mt-6 flex items-center justify-center gap-2 text-xs text-muted">
              <ShieldCheck className="w-4 h-4" />
              Acceso exclusivo para el personal autorizado
            </p>
          </div>
        </div>
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