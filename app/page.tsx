'use client'
import { useState, useEffect } from 'react'
import EmojiImagen from '@/app/components/ui/EmojiImagen'
import { supabase } from '@/app/lib/supabase'
import Link from 'next/link'
import PageHero from '@/app/components/ui/PageHero'
import NotasPersonales from '@/app/components/NotasPersonales'
import { ArrowRight } from 'lucide-react'

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

  const formatearMoneda = (monto: number) =>
    new Intl.NumberFormat('es-AR', {
      style: 'currency',
      currency: 'ARS',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(monto)

  const cargarEstadisticas = async () => {
    try {
      const { count: clientesCount } = await supabase
        .from('clientes')
        .select('*', { count: 'exact', head: true })
      
      const { count: productosCount } = await supabase
        .from('productos')
        .select('*', { count: 'exact', head: true })
      
      const { count: ventasCount } = await supabase
        .from('transacciones')
        .select('*', { count: 'exact', head: true })
        .eq('estado', 'activo')
      
      // Paginar TODOS los pagos pendientes (LEFT JOIN para no excluir ninguno)
      let allPagos: any[] = []
      let pagFrom = 0
      while (true) {
        const { data: page } = await supabase
          .from('pagos')
          .select('monto_cuota, monto_pagado, intereses_mora, transaccion:transacciones(monto_cuota)')
          .in('estado', ['pendiente', 'parcial', 'reprogramado'])
          .range(pagFrom, pagFrom + 999)
        if (!page || page.length === 0) break
        allPagos = allPagos.concat(page)
        if (page.length < 1000) break
        pagFrom += 1000
      }

      const montosPendientes = allPagos.reduce((sum, pago: any) => {
        const transCuota = Array.isArray(pago.transaccion)
          ? pago.transaccion[0]?.monto_cuota
          : pago.transaccion?.monto_cuota
        const cuotaBase = (pago.monto_cuota && pago.monto_cuota > 0)
          ? pago.monto_cuota
          : (transCuota || 0)
        const cuota = cuotaBase + (pago.intereses_mora || 0)
        const pagado = pago.monto_pagado || 0
        return sum + Math.max(0, cuota - pagado)
      }, 0)

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
    <div className="page">
      <div className="page-container">
        {/* Header Section */}
        <PageHero
          emoji="👋"
          titulo="¡Hola de nuevo!"
          subtitulo={<>Así está Electro Hogar hoy, <span className="first-letter:uppercase inline-block">{new Date().toLocaleDateString('es-AR', { weekday: 'long', day: 'numeric', month: 'long' })}</span></>}
        />

        {/* Bloc de notas personal */}
        <NotasPersonales />

        {/* Stats Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-10">
          {/* Cartera pendiente: protagonista */}
          <div className="card card-hover animate-aparecer tint-primary p-5 sm:col-span-2 lg:col-span-1 lg:order-last border-l-4 border-l-primary">
            <div className="flex items-center gap-3 mb-3">
              <div className="icon-tile bg-primary/10 text-primary">
                <span className="emoji text-xl" aria-hidden="true">💰</span>
              </div>
              <h2 className="text-sm font-medium text-muted">Total a cobrar</h2>
            </div>
            {loading ? (
              <div className="skeleton h-8 w-40" />
            ) : (
              <p className="text-2xl font-bold text-fg num truncate">{formatearMoneda(estadisticas.montosPendientes)}</p>
            )}
            <p className="text-xs text-muted mt-1">Suma de cuotas pendientes</p>
          </div>

          {/* Total Clientes */}
          <div className="card card-hover animate-aparecer p-5">
            <div className="flex items-center gap-3 mb-3">
              <div className="icon-tile bg-info-soft text-info-text">
                <span className="emoji text-xl" aria-hidden="true">👥</span>
              </div>
              <h2 className="text-sm font-medium text-muted">Clientes</h2>
            </div>
            {loading ? (
              <div className="skeleton h-8 w-16" />
            ) : (
              <p className="text-2xl font-bold text-fg num">{estadisticas.totalClientes}</p>
            )}
            <p className="text-xs text-muted mt-1">Registrados</p>
          </div>

          {/* Total Productos */}
          <div className="card card-hover animate-aparecer p-5">
            <div className="flex items-center gap-3 mb-3">
              <div className="icon-tile bg-success-soft text-success-text">
                <span className="emoji text-xl" aria-hidden="true">📦</span>
              </div>
              <h2 className="text-sm font-medium text-muted">Productos</h2>
            </div>
            {loading ? (
              <div className="skeleton h-8 w-16" />
            ) : (
              <p className="text-2xl font-bold text-fg num">{estadisticas.totalProductos}</p>
            )}
            <p className="text-xs text-muted mt-1">En el catálogo</p>
          </div>

          {/* Ventas Activas */}
          <div className="card card-hover animate-aparecer p-5">
            <div className="flex items-center gap-3 mb-3">
              <div className="icon-tile bg-reprog-soft text-reprog-text">
                <span className="emoji text-xl" aria-hidden="true">📈</span>
              </div>
              <h2 className="text-sm font-medium text-muted">Ventas y préstamos activos</h2>
            </div>
            {loading ? (
              <div className="skeleton h-8 w-16" />
            ) : (
              <p className="text-2xl font-bold text-fg num">{estadisticas.ventasActivas}</p>
            )}
            <p className="text-xs text-muted mt-1">Con cuotas en curso</p>
          </div>
        </div>

        {/* Quick Access Section */}
        <section className="mb-10">
          <h2 className="section-title mb-4"><span className="emoji" aria-hidden="true">🚀</span> Accesos rápidos</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Cobranzas */}
            <Link href="/cobranzas" className="group card card-hover p-5 flex items-start gap-4 hover:border-primary/40 md:order-first">
              <div className="icon-tile w-12 h-12 bg-primary text-on-primary">
                <span className="emoji text-xl" aria-hidden="true">💳</span>
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="text-base font-semibold text-fg flex items-center gap-1">
                  Cobranzas
                  <ArrowRight className="w-4 h-4 text-muted group-hover:text-primary group-hover:translate-x-0.5 transition-all" />
                </h3>
                <p className="text-sm text-muted mt-1">Cuotas, pagos, recibos y vencimientos</p>
              </div>
            </Link>

            {/* Clientes */}
            <Link href="/clientes" className="group card card-hover p-5 flex items-start gap-4 hover:border-primary/40">
              <div className="icon-tile w-12 h-12 bg-info-soft text-info-text">
                <span className="emoji text-xl" aria-hidden="true">👥</span>
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="text-base font-semibold text-fg flex items-center gap-1">
                  Clientes
                  <ArrowRight className="w-4 h-4 text-muted group-hover:text-primary group-hover:translate-x-0.5 transition-all" />
                </h3>
                <p className="text-sm text-muted mt-1">Datos de contacto y ubicación</p>
              </div>
            </Link>

            {/* Productos */}
            <Link href="/productos" className="group card card-hover p-5 flex items-start gap-4 hover:border-primary/40">
              <div className="icon-tile w-12 h-12 bg-success-soft text-success-text">
                <span className="emoji text-xl" aria-hidden="true">📦</span>
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="text-base font-semibold text-fg flex items-center gap-1">
                  Productos
                  <ArrowRight className="w-4 h-4 text-muted group-hover:text-primary group-hover:translate-x-0.5 transition-all" />
                </h3>
                <p className="text-sm text-muted mt-1">Catálogo de electrodomésticos y stock</p>
              </div>
            </Link>
          </div>
        </section>

        {/* Features Section */}
        <section className="card card-body">
          <h2 className="section-title mb-4"><span className="emoji" aria-hidden="true">✨</span> Qué podés hacer</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {[
              { icono: '🛒', imagen: 'carrito' as const, titulo: 'Ventas en cuotas', texto: 'Registrá ventas y generá el plan de cuotas.' },
              { icono: '💵', imagen: 'billete' as const, titulo: 'Préstamos', texto: 'Préstamos de dinero con interés y cuotas.' },
              { icono: '👀', titulo: 'Seguimiento', texto: 'Estado de cada cuota y de cada cliente.' },
              { icono: '⏰', titulo: 'Vencimientos', texto: 'Avisos de cuotas por vencer y vencidas.' },
              { icono: '🧾', titulo: 'Recibos', texto: 'Comprobantes de pago listos para imprimir.' },
              { icono: '📊', titulo: 'Resumen', texto: 'Indicadores de cobranza del mes.' },
            ].map(({ icono, imagen, titulo, texto }: { icono: string; imagen?: 'carrito' | 'billete'; titulo: string; texto: string }) => (
              <div key={titulo} className="flex items-start gap-3 p-3 rounded-lg bg-surface-2">
                <div className="icon-tile w-9 h-9 bg-surface text-primary border border-line">
                  {imagen ? <EmojiImagen nombre={imagen} className="w-6 h-6" /> : <span className="emoji text-lg" aria-hidden="true">{icono}</span>}
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-fg">{titulo}</h3>
                  <p className="text-xs text-muted mt-0.5">{texto}</p>
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  )
}
