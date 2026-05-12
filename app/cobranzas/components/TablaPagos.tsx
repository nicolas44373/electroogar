import { useState } from 'react'
import { supabase } from '@/app/lib/supabase'
import { Transaccion, Pago } from '@/app/lib/types/cobranzas'
import { CheckCircle, XCircle, AlertTriangle, Calendar, DollarSign, RotateCcw } from 'lucide-react'

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

interface ToastMsg {
  tipo: 'success' | 'error'
  texto: string
}

export default function TablaPagos({ transaccion, pagos, onPagoRegistrado }: TablaPagosProps) {
  const [procesando, setProcesando] = useState<string | null>(null)
  const [toast, setToast] = useState<ToastMsg | null>(null)
  const [reprogramacion, setReprogramacion] = useState<ReprogramacionState>({
    pagoId: null,
    nuevaFecha: '',
    interesesMora: 0,
    motivoReprogramacion: '',
  })

  const mostrarToast = (tipo: 'success' | 'error', texto: string) => {
    setToast({ tipo, texto })
    setTimeout(() => setToast(null), 4000)
  }

  const registrarPago = async (pagoId: string, montoPago: number) => {
    setProcesando(pagoId)
    try {
      const { error } = await supabase
        .from('pagos')
        .update({
          monto_pagado: montoPago,
          fecha_pago: new Date().toISOString().split('T')[0],
          estado: 'pagado',
        })
        .eq('id', pagoId)

      if (error) throw error

      const cuotasPagadas = pagos.filter((p) => p.estado === 'pagado').length + 1
      if (cuotasPagadas === transaccion.numero_cuotas) {
        await supabase.from('transacciones').update({ estado: 'completado' }).eq('id', transaccion.id)
      }

      mostrarToast('success', 'Pago registrado exitosamente')
      onPagoRegistrado()
    } catch (error: any) {
      mostrarToast('error', 'Error al registrar el pago: ' + error.message)
    } finally {
      setProcesando(null)
    }
  }

  const reprogramarPago = async () => {
    if (!reprogramacion.pagoId || !reprogramacion.nuevaFecha) {
      mostrarToast('error', 'Por favor complete todos los campos requeridos')
      return
    }

    setProcesando(reprogramacion.pagoId)
    try {
      const nuevoMonto = transaccion.monto_cuota + reprogramacion.interesesMora

      const { error } = await supabase
        .from('pagos')
        .update({
          fecha_vencimiento: reprogramacion.nuevaFecha,
          monto_cuota: nuevoMonto,
          intereses_mora: reprogramacion.interesesMora,
          fecha_reprogramacion: new Date().toISOString().split('T')[0],
          motivo_reprogramacion: reprogramacion.motivoReprogramacion || null,
          estado: 'reprogramado',
        })
        .eq('id', reprogramacion.pagoId)

      if (error) throw error

      mostrarToast('success', 'Pago reprogramado exitosamente')
      setReprogramacion({ pagoId: null, nuevaFecha: '', interesesMora: 0, motivoReprogramacion: '' })
      onPagoRegistrado()
    } catch (error: any) {
      mostrarToast('error', 'Error al reprogramar el pago: ' + error.message)
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
    return Math.floor((vencimiento.getTime() - hoy.getTime()) / (1000 * 60 * 60 * 24))
  }

  const formatearFecha = (fecha: string) => {
    const [year, month, day] = fecha.split('-').map(Number)
    return new Date(year, month - 1, day).toLocaleDateString('es-AR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    })
  }

  const formatearMoneda = (monto: number) =>
    new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', minimumFractionDigits: 0 }).format(monto)

  const calcularInteresesSugeridos = (diasAtraso: number, montoBase: number) => {
    const tasaMensual = 0.01
    const mesesAtraso = Math.ceil(Math.abs(diasAtraso) / 30)
    return montoBase * tasaMensual * mesesAtraso
  }

  const abrirReprogramacion = (pagoId: string) => {
    const pago = pagos.find((p) => p.id === pagoId)
    if (pago) {
      const diasAtraso = calcularDiasVencimiento(pago.fecha_vencimiento)
      const interesesSugeridos =
        diasAtraso < 0 ? calcularInteresesSugeridos(diasAtraso, transaccion.monto_cuota) : 0
      setReprogramacion({ pagoId, nuevaFecha: '', interesesMora: interesesSugeridos, motivoReprogramacion: '' })
    }
  }

  const cerrarReprogramacion = () =>
    setReprogramacion({ pagoId: null, nuevaFecha: '', interesesMora: 0, motivoReprogramacion: '' })

  return (
    <div className="border-t">
      {/* Toast notification */}
      {toast && (
        <div
          className={`mx-4 mt-3 flex items-center gap-2 px-4 py-3 rounded-lg text-sm font-medium transition-all ${
            toast.tipo === 'success'
              ? 'bg-green-50 border border-green-200 text-green-800'
              : 'bg-red-50 border border-red-200 text-red-800'
          }`}
        >
          {toast.tipo === 'success' ? (
            <CheckCircle className="w-4 h-4 flex-shrink-0 text-green-600" />
          ) : (
            <XCircle className="w-4 h-4 flex-shrink-0 text-red-600" />
          )}
          {toast.texto}
        </div>
      )}

      <div className="p-4">
        <h4 className="font-semibold mb-3 text-gray-800 flex items-center gap-2">
          <DollarSign className="w-4 h-4 text-gray-500" />
          Detalle de Cuotas
        </h4>
        <div className="overflow-x-auto rounded-lg border border-gray-200">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200">
                <th className="text-left px-4 py-3 font-semibold text-xs uppercase text-gray-500 tracking-wide">Cuota</th>
                <th className="text-left px-4 py-3 font-semibold text-xs uppercase text-gray-500 tracking-wide">Vencimiento</th>
                <th className="text-right px-4 py-3 font-semibold text-xs uppercase text-gray-500 tracking-wide">Monto</th>
                <th className="text-right px-4 py-3 font-semibold text-xs uppercase text-gray-500 tracking-wide">Pagado</th>
                <th className="text-center px-4 py-3 font-semibold text-xs uppercase text-gray-500 tracking-wide">Estado</th>
                <th className="text-center px-4 py-3 font-semibold text-xs uppercase text-gray-500 tracking-wide">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {pagos.map((pago) => {
                const diasVencimiento = calcularDiasVencimiento(pago.fecha_vencimiento)
                const estaVencido = diasVencimiento < 0 && pago.estado !== 'pagado'
                const proximoAVencer = diasVencimiento >= 0 && diasVencimiento <= 7 && pago.estado !== 'pagado'
                const montoTotal = (pago.monto_cuota || transaccion.monto_cuota) + (pago.intereses_mora || 0)

                return (
                  <tr
                    key={pago.id}
                    className={`hover:bg-gray-50 transition-colors ${
                      estaVencido ? 'bg-red-50/30' : proximoAVencer ? 'bg-amber-50/30' : ''
                    }`}
                  >
                    <td className="px-4 py-3">
                      <span className="font-semibold text-gray-800">#{pago.numero_cuota}</span>
                    </td>
                    <td className="px-4 py-3">
                      <div>
                        <p className="text-gray-800">{formatearFecha(pago.fecha_vencimiento)}</p>
                        {pago.fecha_reprogramacion && (
                          <p className="text-xs text-blue-600 mt-0.5">
                            Reprog: {formatearFecha(pago.fecha_reprogramacion)}
                          </p>
                        )}
                        {pago.estado !== 'pagado' && (
                          <p
                            className={`text-xs mt-0.5 font-medium ${
                              estaVencido
                                ? 'text-red-600'
                                : proximoAVencer
                                ? 'text-amber-600'
                                : 'text-gray-400'
                            }`}
                          >
                            {estaVencido
                              ? `Vencido hace ${Math.abs(diasVencimiento)}d`
                              : diasVencimiento === 0
                              ? 'Vence hoy'
                              : proximoAVencer
                              ? `Vence en ${diasVencimiento}d`
                              : `En ${diasVencimiento}d`}
                          </p>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <p className="font-semibold text-gray-800">{formatearMoneda(montoTotal)}</p>
                      {(pago.intereses_mora || 0) > 0 && (
                        <p className="text-xs text-red-500 mt-0.5">
                          +{formatearMoneda(pago.intereses_mora || 0)} mora
                        </p>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <p className="font-semibold text-green-600">
                        {formatearMoneda(pago.monto_pagado || 0)}
                      </p>
                      {pago.fecha_pago && (
                        <p className="text-xs text-gray-400 mt-0.5">{formatearFecha(pago.fecha_pago)}</p>
                      )}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <EstadoPago
                        estado={pago.estado}
                        vencido={estaVencido}
                        reprogramado={pago.estado === 'reprogramado'}
                      />
                    </td>
                    <td className="px-4 py-3 text-center">
                      {pago.estado !== 'pagado' && (
                        <div className="flex justify-center gap-2">
                          <button
                            onClick={() => registrarPago(pago.id, montoTotal)}
                            disabled={procesando === pago.id}
                            className="inline-flex items-center gap-1 bg-emerald-600 text-white px-3 py-1.5 rounded-lg text-xs font-medium hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                          >
                            {procesando === pago.id ? (
                              <span className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />
                            ) : (
                              <CheckCircle className="w-3 h-3" />
                            )}
                            Cobrar
                          </button>
                          <button
                            onClick={() => abrirReprogramacion(pago.id)}
                            disabled={procesando === pago.id}
                            className="inline-flex items-center gap-1 bg-blue-600 text-white px-3 py-1.5 rounded-lg text-xs font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                          >
                            <RotateCcw className="w-3 h-3" />
                            Reprog.
                          </button>
                        </div>
                      )}
                      {pago.estado === 'pagado' && (
                        <span className="inline-flex items-center gap-1 text-emerald-600 text-xs font-medium">
                          <CheckCircle className="w-3.5 h-3.5" />
                          Cobrado
                        </span>
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
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-md">
            <div className="p-5 border-b border-gray-100">
              <div className="flex items-center gap-2">
                <div className="p-2 bg-blue-100 rounded-lg">
                  <Calendar className="w-5 h-5 text-blue-600" />
                </div>
                <h3 className="text-lg font-semibold text-gray-900">Reprogramar Cuota</h3>
              </div>
            </div>

            {(() => {
              const pago = pagos.find((p) => p.id === reprogramacion.pagoId)
              const diasAtraso = pago ? calcularDiasVencimiento(pago.fecha_vencimiento) : 0
              return (
                <div className="p-5 space-y-4">
                  {transaccion.descripcion && (
                    <div className="bg-blue-50 border-l-4 border-blue-400 p-3 rounded-lg">
                      <p className="text-xs text-gray-600 font-medium mb-1">Transacción:</p>
                      <p className="text-sm text-gray-800">{transaccion.descripcion}</p>
                    </div>
                  )}

                  <div className="bg-gray-50 rounded-lg p-3">
                    <p className="text-sm font-medium text-gray-700 mb-1">
                      Cuota #{pago?.numero_cuota} — Vencimiento original:
                    </p>
                    <p className="text-sm text-gray-600">{pago ? formatearFecha(pago.fecha_vencimiento) : ''}</p>
                    {diasAtraso < 0 && (
                      <p className="text-sm text-red-600 font-medium mt-1">
                        Vencido hace {Math.abs(diasAtraso)} días
                      </p>
                    )}
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">
                      Nueva fecha de vencimiento *
                    </label>
                    <input
                      type="date"
                      value={reprogramacion.nuevaFecha}
                      onChange={(e) => setReprogramacion((prev) => ({ ...prev, nuevaFecha: e.target.value }))}
                      className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                      min={new Date().toISOString().split('T')[0]}
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">
                      Intereses por mora
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      value={reprogramacion.interesesMora}
                      onChange={(e) =>
                        setReprogramacion((prev) => ({ ...prev, interesesMora: parseFloat(e.target.value) || 0 }))
                      }
                      className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                      placeholder="0.00"
                    />
                    <div className="mt-2 p-3 bg-gray-50 rounded-lg text-sm space-y-1">
                      <div className="flex justify-between text-gray-600">
                        <span>Monto original:</span>
                        <span>{formatearMoneda(transaccion.monto_cuota)}</span>
                      </div>
                      <div className="flex justify-between text-red-600">
                        <span>Intereses mora:</span>
                        <span>+{formatearMoneda(reprogramacion.interesesMora)}</span>
                      </div>
                      <div className="flex justify-between font-bold text-gray-900 border-t pt-1">
                        <span>Total nuevo:</span>
                        <span>{formatearMoneda(transaccion.monto_cuota + reprogramacion.interesesMora)}</span>
                      </div>
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">
                      Motivo (opcional)
                    </label>
                    <textarea
                      value={reprogramacion.motivoReprogramacion}
                      onChange={(e) =>
                        setReprogramacion((prev) => ({ ...prev, motivoReprogramacion: e.target.value }))
                      }
                      className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm resize-none"
                      placeholder="Ej: Problemas económicos temporales..."
                      rows={2}
                    />
                  </div>

                  <div className="flex gap-3 pt-2">
                    <button
                      onClick={cerrarReprogramacion}
                      disabled={procesando !== null}
                      className="flex-1 px-4 py-2.5 bg-gray-100 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-200 transition-colors"
                    >
                      Cancelar
                    </button>
                    <button
                      onClick={reprogramarPago}
                      disabled={!reprogramacion.nuevaFecha || procesando !== null}
                      className="flex-1 px-4 py-2.5 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
                    >
                      {procesando ? (
                        <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      ) : (
                        <RotateCcw className="w-4 h-4" />
                      )}
                      Confirmar
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

function EstadoPago({
  estado,
  vencido,
  reprogramado,
}: {
  estado: string
  vencido?: boolean
  reprogramado?: boolean
}) {
  if (estado === 'pagado')
    return (
      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800">
        <CheckCircle className="w-3 h-3" />
        Pagado
      </span>
    )
  if (reprogramado)
    return (
      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-blue-100 text-blue-800">
        <RotateCcw className="w-3 h-3" />
        Reprog.
      </span>
    )
  if (vencido)
    return (
      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-red-100 text-red-800">
        <AlertTriangle className="w-3 h-3" />
        Vencido
      </span>
    )
  return (
    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-100 text-amber-800">
      <Calendar className="w-3 h-3" />
      Pendiente
    </span>
  )
}
