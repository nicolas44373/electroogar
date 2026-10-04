// /app/reportes/morosos/page.tsx
'use client'
import { useState, useEffect } from 'react'
import { supabase } from '@/app/lib/supabase'
import { fechaLocalISO } from '@/app/lib/fechas'
import PageHero from '@/app/components/ui/PageHero'
import { AlertTriangle } from 'lucide-react'

export default function ReporteMorosos() {
  const [morosos, setMorosos] = useState<any[]>([])
  const [diasAtraso, setDiasAtraso] = useState(7)

  useEffect(() => {
    cargarMorosos()
  }, [diasAtraso])

  const cargarMorosos = async () => {
    const fechaLimite = new Date()
    fechaLimite.setDate(fechaLimite.getDate() - diasAtraso)
    
    const { data } = await supabase
      .from('pagos')
      .select(`
        *,
        transaccion:transacciones(
          *,
          cliente:clientes(nombre, apellido, telefono, documento)
        )
      `)
      .eq('estado', 'pendiente')
      .lt('fecha_vencimiento', fechaLocalISO(fechaLimite))
      .order('fecha_vencimiento')
    
    if (data) {
      setMorosos(data)
    }
  }

  return (
    <div className="page">
      <div className="page-container max-w-6xl">
        <PageHero emoji="⏳" titulo="Cuotas atrasadas" subtitulo="Cuotas pendientes con más días de atraso que el filtro elegido." />

        <div className="card card-body mb-6 max-w-xs">
          <label htmlFor="morosos-dias" className="label">Días de atraso</label>
          <select
            id="morosos-dias"
            value={diasAtraso}
            onChange={(e) => setDiasAtraso(parseInt(e.target.value))}
            className="input"
          >
            <option value={7}>Más de 7 días</option>
            <option value={15}>Más de 15 días</option>
            <option value={30}>Más de 30 días</option>
          </select>
        </div>

        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="data-table min-w-[720px]">
              <thead>
                <tr>
                  <th>Cliente</th>
                  <th>Documento</th>
                  <th>Teléfono</th>
                  <th>Cuota</th>
                  <th className="!text-right">Importe</th>
                  <th>Vencimiento</th>
                  <th className="!text-right">Atraso</th>
                </tr>
              </thead>
              <tbody>
                {morosos.map((pago) => {
                  const diasAtraso = Math.floor(
                    (new Date().getTime() - new Date(pago.fecha_vencimiento).getTime()) / (1000 * 60 * 60 * 24)
                  )
                  return (
                    <tr key={pago.id}>
                      <td className="font-medium text-fg">
                        {pago.transaccion?.cliente?.nombre} {pago.transaccion?.cliente?.apellido}
                      </td>
                      <td className="text-muted num">{pago.transaccion?.cliente?.documento}</td>
                      <td className="text-muted num">{pago.transaccion?.cliente?.telefono}</td>
                      <td className="num">{pago.numero_cuota}</td>
                      <td className="text-right font-semibold text-fg num whitespace-nowrap">
                        {new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', minimumFractionDigits: 2 }).format(pago.transaccion?.monto_cuota || 0)}
                      </td>
                      <td className="text-muted num">{new Date(pago.fecha_vencimiento).toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' })}</td>
                      <td className="text-right">
                        <span className={diasAtraso > 30 ? 'badge-danger' : 'badge-warning'}>
                          <AlertTriangle className="w-3.5 h-3.5" aria-hidden="true" />
                          <span className="num">{diasAtraso} días</span>
                        </span>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
          {morosos.length === 0 && (
            <div className="empty-state">
              <span className="empty-emoji" aria-hidden="true">🎉</span>
              <p className="text-sm font-medium text-fg">No hay cuotas con ese atraso</p>
              <p className="text-xs mt-1">Probá con un filtro de menos días.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
