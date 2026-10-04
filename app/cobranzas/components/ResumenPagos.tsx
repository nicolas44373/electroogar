'use client'
import { Transaccion, Pago } from '@/app/lib/types/cobranzas'
import { CheckCircle2, AlertTriangle, CalendarDays, BarChart3 } from 'lucide-react'

interface ResumenPagosProps {
  transaccion: Transaccion
  pagos: Pago[]
}

const fmt = (n: number) =>
  new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', minimumFractionDigits: 2 }).format(n)

export default function ResumenPagos({ transaccion, pagos }: ResumenPagosProps) {
  const totalPagado = pagos.reduce((sum, p) => sum + (p.monto_pagado || 0), 0)
  const totalPendiente = Math.max(0, transaccion.monto_total - totalPagado)
  const cuotasPagadas = pagos.filter(p => p.estado === 'pagado').length
  const porcentajePagado = (totalPagado / transaccion.monto_total) * 100
  
  // Calcular próximo vencimiento
  const proximoPago = pagos
    .filter(p => p.estado !== 'pagado')
    .sort((a, b) => new Date(a.fecha_vencimiento).getTime() - new Date(b.fecha_vencimiento).getTime())[0]
  
  // Calcular pagos vencidos (timezone-safe)
  const pagosVencidos = pagos.filter(p => {
    const hoy = new Date()
    hoy.setHours(0, 0, 0, 0)
    const [y, m, d] = p.fecha_vencimiento.split('-').map(Number)
    const vencimiento = new Date(y, m - 1, d)
    return p.estado !== 'pagado' && vencimiento < hoy
  })
  
  return (
    <div className="rounded-xl bg-surface-2 p-4 space-y-3">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {/* Montos */}
        <div className="rounded-lg bg-surface border border-line p-4">
          <div className="flex items-center justify-between">
            <p className="text-xs font-medium text-muted">Total pagado</p>
            {porcentajePagado === 100 && (
              <CheckCircle2 className="w-4 h-4 text-success" aria-label="Pagado por completo" />
            )}
          </div>
          <p className="text-xl font-bold text-success-text num mt-1">
            {fmt(totalPagado)}
          </p>
          <div className="mt-3 pt-3 border-t border-line flex justify-between items-center">
            <p className="text-xs text-muted">Saldo</p>
            <p className="font-semibold text-fg num">
              {fmt(totalPendiente)}
            </p>
          </div>
        </div>

        {/* Progreso */}
        <div className="rounded-lg bg-surface border border-line p-4">
          <p className="text-xs font-medium text-muted">Cuotas pagadas</p>
          <div className="flex items-baseline gap-1.5 mt-1">
            <p className="text-xl font-bold text-fg num">
              {cuotasPagadas}
            </p>
            <p className="text-sm text-muted num">
              de {transaccion.numero_cuotas}
            </p>
          </div>
          <div className="mt-3">
            <div className="w-full bg-line rounded-full h-2" role="progressbar" aria-valuenow={Math.round(porcentajePagado)} aria-valuemin={0} aria-valuemax={100}>
              <div
                className={`h-2 rounded-full transition-all duration-500 ${
                  porcentajePagado === 100 ? 'bg-success' :
                  porcentajePagado > 50 ? 'bg-primary' :
                  porcentajePagado > 0 ? 'bg-warning' : 'bg-neutral'
                }`}
                style={{ width: `${porcentajePagado}%` }}
              />
            </div>
            <p className="text-xs text-muted mt-1.5 num">
              {porcentajePagado.toFixed(0)}% del total cobrado
            </p>
          </div>
        </div>

        {/* Próximo vencimiento o Estado */}
        <div className={`rounded-lg border p-4 ${pagosVencidos.length > 0 ? 'bg-danger-soft border-danger/30' : 'bg-surface border-line'}`}>
          {pagosVencidos.length > 0 ? (
            <>
              <p className="text-xs font-medium text-danger-text flex items-center gap-1.5">
                <AlertTriangle className="w-4 h-4" /> Cuotas vencidas
              </p>
              <p className="text-xl font-bold text-danger-text num mt-1">
                {pagosVencidos.length} {pagosVencidos.length === 1 ? 'cuota' : 'cuotas'}
              </p>
              <div className="mt-3 pt-3 border-t border-danger/20 flex justify-between items-center">
                <p className="text-xs text-danger-text">Importe vencido</p>
                <p className="font-semibold text-danger-text num">
                  {new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', minimumFractionDigits: 2 }).format(
                    pagosVencidos.reduce((s, p) => s + (p.monto_cuota || transaccion.monto_cuota) + (p.intereses_mora || 0) - (p.monto_pagado || 0), 0)
                  )}
                </p>
              </div>
            </>
          ) : proximoPago ? (
            <>
              <p className="text-xs font-medium text-muted flex items-center gap-1.5">
                <CalendarDays className="w-4 h-4" /> Próxima cuota
              </p>
              <p className="text-xl font-bold text-fg num mt-1">
                Cuota {proximoPago.numero_cuota}
              </p>
              <dl className="mt-3 pt-3 border-t border-line space-y-1 text-sm">
                <div className="flex justify-between items-center">
                  <dt className="text-xs text-muted">Vence</dt>
                  <dd className="font-medium text-fg num">
                    {(() => {
                      const [y, m, d] = proximoPago.fecha_vencimiento.split('-').map(Number)
                      return new Date(y, m - 1, d).toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' })
                    })()}
                  </dd>
                </div>
                <div className="flex justify-between items-center">
                  <dt className="text-xs text-muted">Importe</dt>
                  <dd className="font-medium text-fg num">
                    {fmt(proximoPago.monto_cuota || transaccion.monto_cuota)}
                  </dd>
                </div>
              </dl>
            </>
          ) : (
            <div className="h-full flex flex-col items-center justify-center text-center py-2">
              <CheckCircle2 className="w-8 h-8 text-success mb-2" />
              <p className="text-success-text font-semibold">
                Todo pagado
              </p>
              <p className="text-xs text-muted mt-0.5">
                No quedan cuotas pendientes
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Alertas adicionales */}
      {transaccion.estado === 'completado' && (
        <div className="alert-success">
          <CheckCircle2 className="w-4 h-4 flex-shrink-0 mt-0.5" />
          <div>
            <p>Operación completada</p>
            <p className="text-xs font-normal mt-0.5 num">
              Finalizada el {pagos.find(p => p.numero_cuota === transaccion.numero_cuotas)?.fecha_pago
                ? new Date(pagos.find(p => p.numero_cuota === transaccion.numero_cuotas)!.fecha_pago!).toLocaleDateString('es-AR')
                : 'N/A'}
            </p>
          </div>
        </div>
      )}

      {pagosVencidos.length > 0 && transaccion.estado !== 'completado' && (
        <div className="alert-danger">
          <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
          <div>
            <p>{pagosVencidos.length} {pagosVencidos.length === 1 ? 'cuota vencida' : 'cuotas vencidas'} sin cobrar</p>
            <p className="text-xs font-normal mt-0.5 num">
              La más antigua venció hace {
                Math.floor((new Date().getTime() - new Date(pagosVencidos[0].fecha_vencimiento).getTime()) / (1000 * 60 * 60 * 24))
              } días
            </p>
          </div>
        </div>
      )}

      {/* Información del plan de pago */}
      <div className="flex flex-wrap justify-between items-center gap-2 text-sm px-1">
        <span className="flex items-center gap-1.5 text-muted">
          <BarChart3 className="w-4 h-4" />
          Plan <span className="capitalize">{transaccion.tipo_pago}</span>
        </span>
        <span className="text-fg font-medium num">
          {transaccion.numero_cuotas} cuotas de {fmt(transaccion.monto_cuota)}
        </span>
      </div>

      {/* Botón de acción rápida si hay pagos pendientes */}
      {totalPendiente > 0 && cuotasPagadas < transaccion.numero_cuotas && (
        <p className="text-xs text-muted px-1 num">
          Faltan {transaccion.numero_cuotas - cuotasPagadas} cuotas por cobrar
        </p>
      )}
    </div>
  )
}
