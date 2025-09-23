// /app/reportes/morosos/page.tsx
'use client'
import { useState, useEffect } from 'react'
import { supabase } from '@/app/lib/supabase'

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
      .lt('fecha_vencimiento', fechaLimite.toISOString())
      .order('fecha_vencimiento')
    
    if (data) {
      setMorosos(data)
    }
  }

  return (
    <div className="max-w-6xl mx-auto">
      <h1 className="text-3xl font-bold mb-6">Reporte de Pagos Atrasados</h1>
      
      <div className="bg-white p-4 rounded-lg shadow mb-6">
        <label className="block mb-2">Filtrar por días de atraso:</label>
        <select
          value={diasAtraso}
          onChange={(e) => setDiasAtraso(parseInt(e.target.value))}
          className="border p-2 rounded"
        >
          <option value={7}>Más de 7 días</option>
          <option value={15}>Más de 15 días</option>
          <option value={30}>Más de 30 días</option>
        </select>
      </div>

      <div className="bg-white p-6 rounded-lg shadow">
        <table className="w-full">
          <thead>
            <tr className="border-b">
              <th className="text-left p-2">Cliente</th>
              <th className="text-left p-2">Documento</th>
              <th className="text-left p-2">Teléfono</th>
              <th className="text-left p-2">Cuota</th>
              <th className="text-left p-2">Monto</th>
              <th className="text-left p-2">Vencimiento</th>
              <th className="text-left p-2">Días Atraso</th>
            </tr>
          </thead>
          <tbody>
            {morosos.map((pago) => {
              const diasAtraso = Math.floor(
                (new Date().getTime() - new Date(pago.fecha_vencimiento).getTime()) / (1000 * 60 * 60 * 24)
              )
              return (
                <tr key={pago.id} className="border-b hover:bg-gray-50">
                  <td className="p-2">
                    {pago.transaccion?.cliente?.nombre} {pago.transaccion?.cliente?.apellido}
                  </td>
                  <td className="p-2">{pago.transaccion?.cliente?.documento}</td>
                  <td className="p-2">{pago.transaccion?.cliente?.telefono}</td>
                  <td className="p-2">#{pago.numero_cuota}</td>
                  <td className="p-2">${pago.transaccion?.monto_cuota}</td>
                  <td className="p-2">{new Date(pago.fecha_vencimiento).toLocaleDateString()}</td>
                  <td className="p-2">
                    <span className={`font-bold ${diasAtraso > 30 ? 'text-red-600' : 'text-orange-600'}`}>
                      {diasAtraso} días
                    </span>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}