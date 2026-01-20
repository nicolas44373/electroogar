'use client'
import { useState, useEffect } from 'react'
import { supabase } from '@/app/lib/supabase'
import Link from 'next/link'
import { 
  Zap, 
  Users, 
  ShoppingCart, 
  DollarSign, 
  TrendingUp, 
  Package, 
  CreditCard,
  AlertCircle,
  ArrowRight,
  Sparkles,
  Activity
} from 'lucide-react'

export default function HomePage() {
  const [estadisticas, setEstadisticas] = useState({
    totalClientes: 0,
    totalProductos: 0,
    ventasActivas: 0,
    montosPendientes: 0
  })
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    cargarEstadisticas()
  }, [])

  const cargarEstadisticas = async () => {
    try {
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
    } catch (error) {
      console.error('Error cargando estadísticas:', error)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-slate-800 relative overflow-hidden">
      {/* Animated background pattern */}
      <div className="absolute inset-0 overflow-hidden opacity-10">
        <div className="absolute inset-0" style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23ffffff' fill-opacity='0.4'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`,
        }}></div>
      </div>

      {/* Floating shapes */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-20 left-10 w-64 h-64 bg-emerald-500/10 rounded-full blur-3xl animate-pulse"></div>
        <div className="absolute bottom-20 right-10 w-80 h-80 bg-blue-500/10 rounded-full blur-3xl animate-pulse animation-delay-2000"></div>
        <div className="absolute top-1/2 right-1/3 w-96 h-96 bg-slate-500/10 rounded-full blur-3xl animate-pulse animation-delay-4000"></div>
      </div>

      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12">
        {/* Header Section */}
        <div className="text-center mb-12 sm:mb-16 animate-fade-in">
          <div className="inline-flex items-center justify-center mb-6">
            <div className="relative">
              <div className="absolute inset-0 bg-gradient-to-r from-emerald-500 to-blue-500 rounded-xl blur-xl opacity-50 animate-pulse"></div>
              <div className="relative bg-gradient-to-br from-slate-700 to-slate-800 w-16 h-16 sm:w-20 sm:h-20 rounded-xl flex items-center justify-center shadow-xl border-2 border-emerald-500/30">
                <Zap className="w-8 h-8 sm:w-10 sm:h-10 text-emerald-400" strokeWidth={2.5} />
              </div>
            </div>
          </div>
          
          <h1 className="text-3xl sm:text-4xl md:text-5xl font-bold text-white mb-4 tracking-tight">
            Electro Hogar
          </h1>
          <div className="flex items-center justify-center gap-2 text-slate-300 mb-2">
            <ShoppingCart className="w-5 h-5 text-emerald-400" />
            <p className="text-base sm:text-lg">Sistema de Gestión Profesional</p>
          </div>
          <p className="text-sm sm:text-base text-slate-400">Electrodomésticos • Préstamos • Cobranzas</p>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6 mb-12 sm:mb-16">
          {/* Total Clientes */}
          <div className="group relative">
            <div className="absolute inset-0 bg-gradient-to-r from-blue-600 to-blue-500 rounded-xl blur opacity-25 group-hover:opacity-40 transition-opacity"></div>
            <div className="relative backdrop-blur-xl bg-slate-800/40 rounded-xl shadow-xl border border-slate-700/50 p-6 hover:transform hover:scale-105 transition-all duration-300">
              <div className="flex items-center justify-between mb-4">
                <div className="p-3 bg-blue-500/20 rounded-lg">
                  <Users className="w-6 h-6 text-blue-400" />
                </div>
                <div className="flex items-center text-blue-400 text-sm">
                  <Activity className="w-4 h-4 mr-1" />
                  <span>Activo</span>
                </div>
              </div>
              <h3 className="text-slate-400 text-sm font-medium mb-2">Total Clientes</h3>
              {loading ? (
                <div className="h-10 w-20 bg-slate-700/50 animate-pulse rounded"></div>
              ) : (
                <p className="text-4xl font-bold text-white">{estadisticas.totalClientes}</p>
              )}
            </div>
          </div>

          {/* Total Productos */}
          <div className="group relative">
            <div className="absolute inset-0 bg-gradient-to-r from-emerald-600 to-emerald-500 rounded-xl blur opacity-25 group-hover:opacity-40 transition-opacity"></div>
            <div className="relative backdrop-blur-xl bg-slate-800/40 rounded-xl shadow-xl border border-slate-700/50 p-6 hover:transform hover:scale-105 transition-all duration-300">
              <div className="flex items-center justify-between mb-4">
                <div className="p-3 bg-emerald-500/20 rounded-lg">
                  <Package className="w-6 h-6 text-emerald-400" />
                </div>
                <div className="flex items-center text-emerald-400 text-sm">
                  <Sparkles className="w-4 h-4 mr-1" />
                  <span>Stock</span>
                </div>
              </div>
              <h3 className="text-slate-400 text-sm font-medium mb-2">Total Productos</h3>
              {loading ? (
                <div className="h-10 w-20 bg-slate-700/50 animate-pulse rounded"></div>
              ) : (
                <p className="text-4xl font-bold text-white">{estadisticas.totalProductos}</p>
              )}
            </div>
          </div>

          {/* Ventas Activas */}
          <div className="group relative">
            <div className="absolute inset-0 bg-gradient-to-r from-purple-600 to-purple-500 rounded-xl blur opacity-25 group-hover:opacity-40 transition-opacity"></div>
            <div className="relative backdrop-blur-xl bg-slate-800/40 rounded-xl shadow-xl border border-slate-700/50 p-6 hover:transform hover:scale-105 transition-all duration-300">
              <div className="flex items-center justify-between mb-4">
                <div className="p-3 bg-purple-500/20 rounded-lg">
                  <TrendingUp className="w-6 h-6 text-purple-400" />
                </div>
                <div className="flex items-center text-purple-400 text-sm">
                  <ArrowRight className="w-4 h-4 mr-1" />
                  <span>En curso</span>
                </div>
              </div>
              <h3 className="text-slate-400 text-sm font-medium mb-2">Ventas Activas</h3>
              {loading ? (
                <div className="h-10 w-20 bg-slate-700/50 animate-pulse rounded"></div>
              ) : (
                <p className="text-4xl font-bold text-white">{estadisticas.ventasActivas}</p>
              )}
            </div>
          </div>

          {/* Pagos Pendientes */}
          <div className="group relative">
            <div className="absolute inset-0 bg-gradient-to-r from-orange-600 to-red-500 rounded-xl blur opacity-25 group-hover:opacity-40 transition-opacity"></div>
            <div className="relative backdrop-blur-xl bg-slate-800/40 rounded-xl shadow-xl border border-slate-700/50 p-6 hover:transform hover:scale-105 transition-all duration-300">
              <div className="flex items-center justify-between mb-4">
                <div className="p-3 bg-red-500/20 rounded-lg">
                  <AlertCircle className="w-6 h-6 text-red-400" />
                </div>
                <div className="flex items-center text-red-400 text-sm">
                  <Activity className="w-4 h-4 mr-1 animate-pulse" />
                  <span>Urgente</span>
                </div>
              </div>
              <h3 className="text-slate-400 text-sm font-medium mb-2">Pagos Pendientes</h3>
              {loading ? (
                <div className="h-10 w-20 bg-slate-700/50 animate-pulse rounded"></div>
              ) : (
                <p className="text-4xl font-bold text-white">{estadisticas.montosPendientes}</p>
              )}
            </div>
          </div>
        </div>

        {/* Quick Access Section */}
        <div className="mb-8">
          <h2 className="text-2xl sm:text-3xl font-bold text-white mb-6 sm:mb-8 text-center">
            Accesos Rápidos
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 sm:gap-6">
            {/* Productos */}
            <Link href="/productos" className="group relative">
              <div className="absolute inset-0 bg-gradient-to-r from-emerald-600 to-blue-600 rounded-xl blur-lg opacity-0 group-hover:opacity-50 transition-opacity duration-300"></div>
              <div className="relative backdrop-blur-xl bg-slate-800/40 rounded-xl shadow-xl border border-slate-700/50 p-6 sm:p-8 hover:transform hover:scale-105 transition-all duration-300 overflow-hidden">
                {/* Gradient overlay */}
                <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
                
                <div className="relative">
                  <div className="flex items-center justify-between mb-4">
                    <div className="p-3 bg-emerald-500/20 rounded-lg group-hover:bg-emerald-500/30 transition-colors">
                      <Package className="w-8 h-8 text-emerald-400" />
                    </div>
                    <ArrowRight className="w-5 h-5 text-slate-400 group-hover:text-emerald-400 transform group-hover:translate-x-1 transition-all" />
                  </div>
                  <h3 className="text-xl sm:text-2xl font-bold text-white mb-2 group-hover:text-emerald-400 transition-colors">
                    Productos
                  </h3>
                  <p className="text-slate-400 text-sm sm:text-base">
                    Gestionar catálogo de productos y electrodomésticos
                  </p>
                </div>
              </div>
            </Link>

            {/* Clientes */}
            <Link href="/clientes" className="group relative">
              <div className="absolute inset-0 bg-gradient-to-r from-blue-600 to-purple-600 rounded-xl blur-lg opacity-0 group-hover:opacity-50 transition-opacity duration-300"></div>
              <div className="relative backdrop-blur-xl bg-slate-800/40 rounded-xl shadow-xl border border-slate-700/50 p-6 sm:p-8 hover:transform hover:scale-105 transition-all duration-300 overflow-hidden">
                {/* Gradient overlay */}
                <div className="absolute inset-0 bg-gradient-to-br from-blue-500/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
                
                <div className="relative">
                  <div className="flex items-center justify-between mb-4">
                    <div className="p-3 bg-blue-500/20 rounded-lg group-hover:bg-blue-500/30 transition-colors">
                      <Users className="w-8 h-8 text-blue-400" />
                    </div>
                    <ArrowRight className="w-5 h-5 text-slate-400 group-hover:text-blue-400 transform group-hover:translate-x-1 transition-all" />
                  </div>
                  <h3 className="text-xl sm:text-2xl font-bold text-white mb-2 group-hover:text-blue-400 transition-colors">
                    Clientes
                  </h3>
                  <p className="text-slate-400 text-sm sm:text-base">
                    Administrar información y historial de clientes
                  </p>
                </div>
              </div>
            </Link>

            {/* Cobranzas */}
            <Link href="/cobranzas" className="group relative">
              <div className="absolute inset-0 bg-gradient-to-r from-purple-600 to-pink-600 rounded-xl blur-lg opacity-0 group-hover:opacity-50 transition-opacity duration-300"></div>
              <div className="relative backdrop-blur-xl bg-slate-800/40 rounded-xl shadow-xl border border-slate-700/50 p-6 sm:p-8 hover:transform hover:scale-105 transition-all duration-300 overflow-hidden">
                {/* Gradient overlay */}
                <div className="absolute inset-0 bg-gradient-to-br from-purple-500/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
                
                <div className="relative">
                  <div className="flex items-center justify-between mb-4">
                    <div className="p-3 bg-purple-500/20 rounded-lg group-hover:bg-purple-500/30 transition-colors">
                      <CreditCard className="w-8 h-8 text-purple-400" />
                    </div>
                    <ArrowRight className="w-5 h-5 text-slate-400 group-hover:text-purple-400 transform group-hover:translate-x-1 transition-all" />
                  </div>
                  <h3 className="text-xl sm:text-2xl font-bold text-white mb-2 group-hover:text-purple-400 transition-colors">
                    Cobranzas
                  </h3>
                  <p className="text-slate-400 text-sm sm:text-base">
                    Control de pagos, cuotas y seguimiento de deudas
                  </p>
                </div>
              </div>
            </Link>
          </div>
        </div>

        {/* Features Section */}
        <div className="mt-12 sm:mt-16">
          <div className="backdrop-blur-xl bg-slate-800/40 rounded-2xl shadow-xl border border-slate-700/50 p-6 sm:p-8">
            <h2 className="text-xl sm:text-2xl font-bold text-white mb-6 text-center">
              Sistema Completo de Gestión
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
              <div className="flex items-start space-x-3 p-4 bg-slate-900/30 rounded-lg border border-slate-700/30 hover:border-emerald-500/30 transition-colors">
                <div className="flex-shrink-0 p-2 bg-emerald-500/20 rounded-lg">
                  <ShoppingCart className="w-5 h-5 text-emerald-400" />
                </div>
                <div>
                  <h3 className="text-white font-semibold mb-1 text-sm sm:text-base">Ventas a Crédito</h3>
                  <p className="text-slate-400 text-xs sm:text-sm">Gestión completa de ventas en cuotas</p>
                </div>
              </div>

              <div className="flex items-start space-x-3 p-4 bg-slate-900/30 rounded-lg border border-slate-700/30 hover:border-blue-500/30 transition-colors">
                <div className="flex-shrink-0 p-2 bg-blue-500/20 rounded-lg">
                  <DollarSign className="w-5 h-5 text-blue-400" />
                </div>
                <div>
                  <h3 className="text-white font-semibold mb-1 text-sm sm:text-base">Préstamos</h3>
                  <p className="text-slate-400 text-xs sm:text-sm">Control de préstamos de dinero</p>
                </div>
              </div>

              <div className="flex items-start space-x-3 p-4 bg-slate-900/30 rounded-lg border border-slate-700/30 hover:border-purple-500/30 transition-colors">
                <div className="flex-shrink-0 p-2 bg-purple-500/20 rounded-lg">
                  <Activity className="w-5 h-5 text-purple-400" />
                </div>
                <div>
                  <h3 className="text-white font-semibold mb-1 text-sm sm:text-base">Seguimiento</h3>
                  <p className="text-slate-400 text-xs sm:text-sm">Monitoreo en tiempo real de pagos</p>
                </div>
              </div>

              <div className="flex items-start space-x-3 p-4 bg-slate-900/30 rounded-lg border border-slate-700/30 hover:border-orange-500/30 transition-colors">
                <div className="flex-shrink-0 p-2 bg-orange-500/20 rounded-lg">
                  <AlertCircle className="w-5 h-5 text-orange-400" />
                </div>
                <div>
                  <h3 className="text-white font-semibold mb-1 text-sm sm:text-base">Notificaciones</h3>
                  <p className="text-slate-400 text-xs sm:text-sm">Alertas de vencimientos y mora</p>
                </div>
              </div>

              <div className="flex items-start space-x-3 p-4 bg-slate-900/30 rounded-lg border border-slate-700/30 hover:border-emerald-500/30 transition-colors">
                <div className="flex-shrink-0 p-2 bg-emerald-500/20 rounded-lg">
                  <CreditCard className="w-5 h-5 text-emerald-400" />
                </div>
                <div>
                  <h3 className="text-white font-semibold mb-1 text-sm sm:text-base">Recibos</h3>
                  <p className="text-slate-400 text-xs sm:text-sm">Generación automática de comprobantes</p>
                </div>
              </div>

              <div className="flex items-start space-x-3 p-4 bg-slate-900/30 rounded-lg border border-slate-700/30 hover:border-blue-500/30 transition-colors">
                <div className="flex-shrink-0 p-2 bg-blue-500/20 rounded-lg">
                  <TrendingUp className="w-5 h-5 text-blue-400" />
                </div>
                <div>
                  <h3 className="text-white font-semibold mb-1 text-sm sm:text-base">Estadísticas</h3>
                  <p className="text-slate-400 text-xs sm:text-sm">Reportes y análisis de datos</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="mt-12 text-center">
          <div className="inline-flex items-center gap-2 text-slate-400 text-sm backdrop-blur-sm bg-slate-800/30 rounded-full px-6 py-2 border border-slate-700/30">
            <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></div>
            <span>Sistema operando correctamente</span>
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

        .animate-fade-in {
          animation: fade-in 1s ease-out;
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