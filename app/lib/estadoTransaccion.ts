import { supabase } from '@/app/lib/supabase'

// Marca la venta/préstamo como 'completado' cuando todas sus cuotas están pagadas,
// y la vuelve a 'activo' si estaba completada y una cuota dejó de estar pagada
// (por ejemplo, al anular un pago). Llamar después de registrar o anular pagos.
export async function sincronizarEstadoTransaccion(transaccionId: string) {
  const [{ data: pagos }, { data: transaccion }] = await Promise.all([
    supabase.from('pagos').select('estado').eq('transaccion_id', transaccionId),
    supabase.from('transacciones').select('estado').eq('id', transaccionId).single(),
  ])
  if (!pagos || pagos.length === 0 || !transaccion) return

  const todasPagadas = pagos.every((p) => p.estado === 'pagado')

  if (todasPagadas && transaccion.estado !== 'completado') {
    await supabase.from('transacciones').update({ estado: 'completado' }).eq('id', transaccionId)
  } else if (!todasPagadas && transaccion.estado === 'completado') {
    await supabase.from('transacciones').update({ estado: 'activo' }).eq('id', transaccionId)
  }
}
