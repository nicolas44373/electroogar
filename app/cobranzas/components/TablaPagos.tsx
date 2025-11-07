import { useState } from 'react'
import { supabase } from '@/app/lib/supabase'
import { Transaccion, Pago } from '@/app/lib/types/cobranzas'

interface TablaPagosProps {
  transaccion: Transaccion
  pagos: Pago[]
  onPagoRegistrado: () => void
}

interface ReprogramacionState {
  pagoId: string | null
  nuevaFecha: string
  interesesMora: number
  motivoReprogramacion: string
}

export default function TablaPagos({ 
  transaccion, 
  pagos, 
  onPagoRegistrado 
}: TablaPagosProps) {
  const [procesando, setProcesando] = useState<string | null>(null)
  const [reprogramacion, setReprogramacion] = useState<ReprogramacionState>({
    pagoId: null,
    nuevaFecha: '',
    interesesMora: 0,
    motivoReprogramacion: ''
  })

  const registrarPago = async (pagoId: string, montoPago: number) => {
    setProcesando(pagoId)
    try {
      const { error } = await supabase
        .from('pagos')
        .update({
          monto_pagado: montoPago,
          fecha_pago: new Date().toISOString().split('T')[0],
          estado: 'pagado'
        })
        .eq('id', pagoId)
      
      if (error) throw error
      
      // Verificar si todas las cuotas están pagadas
      const cuotasPagadas = pagos.filter(p => p.estado === 'pagado').length + 1
      if (cuotasPagadas === transaccion.numero_cuotas) {
        await supabase
          .from('transacciones')
          .update({ estado: 'completado' })
          .eq('id', transaccion.id)
      }
      
      alert('✅ Pago registrado exitosamente')
      onPagoRegistrado()
    } catch (error: any) {
      alert('Error al registrar el pago: ' + error.message)
    } finally {
      setProcesando(null)
    }
  }

  const reprogramarPago = async () => {
    if (!reprogramacion.pagoId || !reprogramacion.nuevaFecha) {
      alert('Por favor complete todos los campos requeridos')
      return
    }

    setProcesando(reprogramacion.pagoId)
    try {
      const pagoActual = pagos.find(p => p.id === reprogramacion.pagoId)
      if (!pagoActual) throw new Error('Pago no encontrado')

      const nuevoMonto = transaccion.monto_cuota + reprogramacion.interesesMora

      const { error } = await supabase
        .from('pagos')
        .update({
          fecha_vencimiento: reprogramacion.nuevaFecha,
          monto_cuota: nuevoMonto,
          intereses_mora: reprogramacion.interesesMora,
          fecha_reprogramacion: new Date().toISOString().split('T')[0],
          motivo_reprogramacion: reprogramacion.motivoReprogramacion || null,
          estado: 'reprogramado'
        })
        .eq('id', reprogramacion.pagoId)
      
      if (error) throw error
      
      alert('✅ Pago reprogramado exitosamente')
      setReprogramacion({
        pagoId: null,
        nuevaFecha: '',
        interesesMora: 0,
        motivoReprogramacion: ''
      })
      onPagoRegistrado()
    } catch (error: any) {
      alert('Error al reprogramar el pago: ' + error.message)
    } finally {
      setProcesando(null)
    }
  }

  const calcularDiasVencimiento = (fechaVencimiento: string) => {
    const hoy = new Date()
    hoy.setHours(0, 0, 0, 0)
    
    const [year, month, day] = fechaVencimiento.split('-').map(Number)
    const vencimiento = new Date(year, month - 1, day)
    vencimiento.setHours(0, 0, 0, 0)
    
    const diferencia = Math.floor((vencimiento.getTime() - hoy.getTime()) / (1000 * 60 * 60 * 24))
    return diferencia
  }

  const formatearFecha = (fecha: string) => {
    const [year, month, day] = fecha.split('-').map(Number)
    const fechaObj = new Date(year, month - 1, day)
    return fechaObj.toLocaleDateString('es-AR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    })
  }

  const calcularInteresesSugeridos = (diasAtraso: number, montoBase: number) => {
    // Ejemplo: 1% por cada 30 días de atraso
    const tasaMensual = 0.01
    const mesesAtraso = Math.ceil(Math.abs(diasAtraso) / 30)
    return montoBase * tasaMensual * mesesAtraso
  }

  const abrirReprogramacion = (pagoId: string) => {
    const pago = pagos.find(p => p.id === pagoId)
    if (pago) {
      const diasAtraso = calcularDiasVencimiento(pago.fecha_vencimiento)
      const interesesSugeridos = diasAtraso < 0 ? 
        calcularInteresesSugeridos(diasAtraso, transaccion.monto_cuota) : 0
      
      setReprogramacion({
        pagoId,
        nuevaFecha: '',
        interesesMora: interesesSugeridos,
        motivoReprogramacion: ''
      })
    }
  }

  const cerrarReprogramacion = () => {
    setReprogramacion({
      pagoId: null,
      nuevaFecha: '',
      interesesMora: 0,
      motivoReprogramacion: ''
    })
  }

  return (
    <div className="border-t">
      <div className="p-4">
        <h4 className="font-semibold mb-3">📊 Detalle de Pagos</h4>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-gray-50">
                <th className="text-left p-3">Cuota</th>
                <th className="text-left p-3">Vencimiento</th>
                <th className="text-left p-3">Monto</th>
                <th className="text-left p-3">Pagado</th>
                <th className="text-left p-3">Estado</th>
                <th className="text-left p-3">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {pagos.map((pago) => {
                const diasVencimiento = calcularDiasVencimiento(pago.fecha_vencimiento)
                const estaVencido = diasVencimiento < 0 && pago.estado !== 'pagado'
                const proximoAVencer = diasVencimiento >= 0 && diasVencimiento <= 7 && pago.estado !== 'pagado'
                const montoTotal = (pago.monto_cuota || transaccion.monto_cuota) + (pago.intereses_mora || 0)
                
                return (
                  <tr key={pago.id} className="border-b hover:bg-gray-50">
                    <td className="p-3">
                      <span className="font-medium">#{pago.numero_cuota}</span>
                    </td>
                    <td className="p-3">
                      <div>
                        <p>{formatearFecha(pago.fecha_vencimiento)}</p>
                        {pago.fecha_reprogramacion && (
                          <p className="text-xs text-blue-600">
                            Reprog: {formatearFecha(pago.fecha_reprogramacion)}
                          </p>
                        )}
                        {pago.estado !== 'pagado' && (
                          <p className={`text-xs ${
                            estaVencido ? 'text-red-600' : 
                            proximoAVencer ? 'text-yellow-600' : 'text-gray-500'
                          }`}>
                            {estaVencido ? `Vencido hace ${Math.abs(diasVencimiento)} días` :
                             diasVencimiento === 0 ? 'Vence hoy' :
                             proximoAVencer ? `Vence en ${diasVencimiento} días` :
                             `En ${diasVencimiento} días`}
                          </p>
                        )}
                      </div>
                    </td>
                    <td className="p-3 font-medium">
                      <div>
                        <p>${montoTotal.toFixed(2)}</p>
                        {(pago.intereses_mora || 0) > 0 && (
                          <p className="text-xs text-red-600">
                            (+ ${(pago.intereses_mora || 0).toFixed(2)} mora)
                          </p>
                        )}
                      </div>
                    </td>
                    <td className="p-3">
                      <div>
                        <p className="font-medium">${pago.monto_pagado.toFixed(2)}</p>
                        {pago.fecha_pago && (
                          <p className="text-xs text-gray-500">
                            {formatearFecha(pago.fecha_pago)}
                          </p>
                        )}
                      </div>
                    </td>
                    <td className="p-3">
                      <EstadoPago 
                        estado={pago.estado} 
                        vencido={estaVencido}
                        reprogramado={pago.estado === 'reprogramado'} 
                      />
                    </td>
                    <td className="p-3">
                      {pago.estado !== 'pagado' && (
                        <div className="flex gap-2">
                          <button
                            onClick={() => registrarPago(pago.id, montoTotal)}
                            disabled={procesando === pago.id}
                            className="bg-green-500 text-white px-3 py-1 rounded text-xs hover:bg-green-600 disabled:opacity-50"
                          >
                            {procesando === pago.id ? '...' : 'Registrar Pago'}
                          </button>
                          <button
                            onClick={() => abrirReprogramacion(pago.id)}
                            disabled={procesando === pago.id}
                            className="bg-blue-500 text-white px-3 py-1 rounded text-xs hover:bg-blue-600 disabled:opacity-50"
                          >
                            Reprogramar
                          </button>
                        </div>
                      )}
                      {pago.estado === 'pagado' && (
                        <span className="text-green-600 text-xs">✓ Pagado</span>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal de Reprogramación */}
      {reprogramacion.pagoId && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white p-6 rounded-lg w-96 max-w-full m-4">
            <h3 className="text-lg font-semibold mb-4">🔄 Reprogramar Pago</h3>
            
            {(() => {
              const pago = pagos.find(p => p.id === reprogramacion.pagoId)
              const diasAtraso = pago ? calcularDiasVencimiento(pago.fecha_vencimiento) : 0
              return (
                <div className="space-y-4">
                  {/* Información de la transacción */}
                  {transaccion.descripcion && (
                    <div className="bg-blue-50 border-l-4 border-blue-400 p-3 rounded">
                      <p className="text-xs text-gray-600 font-medium mb-1">Transacción:</p>
                      <p className="text-sm text-gray-800">{transaccion.descripcion}</p>
                    </div>
                  )}
                  
                  <div>
                    <label className="block text-sm font-medium mb-1">
                      Cuota #{pago?.numero_cuota}
                    </label>
                    <p className="text-sm text-gray-600">
                      Vencimiento original: {pago ? formatearFecha(pago.fecha_vencimiento) : ''}
                    </p>
                    {diasAtraso < 0 && (
                      <p className="text-sm text-red-600">
                        Vencido hace {Math.abs(diasAtraso)} días
                      </p>
                    )}
                  </div>

                  <div>
                    <label className="block text-sm font-medium mb-1">
                      Nueva fecha de vencimiento *
                    </label>
                    <input
                      type="date"
                      value={reprogramacion.nuevaFecha}
                      onChange={(e) => setReprogramacion(prev => ({
                        ...prev,
                        nuevaFecha: e.target.value
                      }))}
                      className="w-full p-2 border rounded focus:ring-2 focus:ring-blue-500"
                      min={new Date().toISOString().split('T')[0]}
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium mb-1">
                      Intereses por mora ($)
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      value={reprogramacion.interesesMora}
                      onChange={(e) => setReprogramacion(prev => ({
                        ...prev,
                        interesesMora: parseFloat(e.target.value) || 0
                      }))}
                      className="w-full p-2 border rounded focus:ring-2 focus:ring-blue-500"
                      placeholder="0.00"
                    />
                    <div className="mt-2 p-2 bg-gray-50 rounded text-sm">
                      <p>Monto original: ${transaccion.monto_cuota.toFixed(2)}</p>
                      <p>Intereses mora: ${reprogramacion.interesesMora.toFixed(2)}</p>
                      <p className="font-semibold border-t pt-1">
                        Total nuevo: ${(transaccion.monto_cuota + reprogramacion.interesesMora).toFixed(2)}
                      </p>
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium mb-1">
                      Motivo de la reprogramación
                    </label>
                    <textarea
                      value={reprogramacion.motivoReprogramacion}
                      onChange={(e) => setReprogramacion(prev => ({
                        ...prev,
                        motivoReprogramacion: e.target.value
                      }))}
                      className="w-full p-2 border rounded focus:ring-2 focus:ring-blue-500"
                      placeholder="Ej: Problemas económicos temporales, enfermedad, etc."
                      rows={3}
                    />
                  </div>

                  <div className="flex gap-3 pt-4">
                    <button
                      onClick={reprogramarPago}
                      disabled={!reprogramacion.nuevaFecha || procesando !== null}
                      className="flex-1 bg-blue-500 text-white py-2 px-4 rounded hover:bg-blue-600 disabled:opacity-50"
                    >
                      {procesando ? 'Procesando...' : 'Confirmar Reprogramación'}
                    </button>
                    <button
                      onClick={cerrarReprogramacion}
                      disabled={procesando !== null}
                      className="flex-1 bg-gray-300 text-gray-700 py-2 px-4 rounded hover:bg-gray-400"
                    >
                      Cancelar
                    </button>
                  </div>
                </div>
              )
            })()}
          </div>
        </div>
      )}
    </div>
  )
}

// Componente auxiliar para el estado del pago
function EstadoPago({ 
  estado, 
  vencido, 
  reprogramado 
}: { 
  estado: string; 
  vencido?: boolean;
  reprogramado?: boolean;
}) {
  const getEstilo = () => {
    if (estado === 'pagado') return 'bg-green-100 text-green-800'
    if (reprogramado) return 'bg-blue-100 text-blue-800'
    if (vencido) return 'bg-red-100 text-red-800'
    return 'bg-yellow-100 text-yellow-800'
  }
  
  const getTexto = () => {
    if (estado === 'pagado') return 'Pagado'
    if (reprogramado) return 'Reprogramado'
    if (vencido) return 'Vencido'
    return 'Pendiente'
  }
  
  return (
    <span className={`px-2 py-1 rounded text-xs font-medium ${getEstilo()}`}>
      {getTexto()}
    </span>
  )
}