import { useState } from 'react'
import EmojiImagen from '@/app/components/ui/EmojiImagen'
import { supabase } from '@/app/lib/supabase'
import { sincronizarEstadoTransaccion } from '@/app/lib/estadoTransaccion'
import { hoyISO } from '@/app/lib/fechas'
import { Transaccion, Pago } from '@/app/lib/types/cobranzas'
import EstadoBadge from '@/app/components/ui/EstadoBadge'
import {
  CheckCircle,
  XCircle,
  AlertTriangle,
  RotateCcw,
  CalendarClock,
  ArrowRight,
} from 'lucide-react'

const DIAS_SEMANA = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado']

const parseFecha = (fecha: string) => {
  const [y, m, d] = fecha.split('-').map(Number)
  return new Date(y, m - 1, d)
}

const aFechaISO = (fecha: Date) => {
  const y = fecha.getFullYear()
  const m = String(fecha.getMonth() + 1).padStart(2, '0')
  const d = String(fecha.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

// Genera `cantidad` fechas consecutivas a partir de `inicio` según la frecuencia de pago
// mantenerDiaSemana: en quincenal usa 14 días (en vez de 15) para que todas las cuotas caigan el mismo día
const generarFechas = (inicio: string, cantidad: number, tipoPago: string, mantenerDiaSemana = false): string[] => {
  const base = parseFecha(inicio)
  const fechas: string[] = []
  for (let i = 0; i < cantidad; i++) {
    let fecha: Date
    if (tipoPago === 'mensual') {
      // Mantener el mismo día del mes; si el mes es más corto, usar el último día
      const ultimoDia = new Date(base.getFullYear(), base.getMonth() + i + 1, 0).getDate()
      fecha = new Date(base.getFullYear(), base.getMonth() + i, Math.min(base.getDate(), ultimoDia))
    } else {
      const dias = tipoPago === 'quincenal' ? (mantenerDiaSemana ? 14 : 15) : 7
      fecha = new Date(base.getFullYear(), base.getMonth(), base.getDate() + dias * i)
    }
    fechas.push(aFechaISO(fecha))
  }
  return fechas
}

// Próxima fecha (desde hoy inclusive) que cae en el día de la semana indicado
const proximoDiaSemana = (diaSemana: number) => {
  const hoy = new Date()
  hoy.setHours(0, 0, 0, 0)
  hoy.setDate(hoy.getDate() + ((diaSemana - hoy.getDay() + 7) % 7))
  return aFechaISO(hoy)
}

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

  const [cambioDia, setCambioDia] = useState<{ abierto: boolean; nuevaFecha: string; porDiaSemana?: boolean }>({
    abierto: false,
    nuevaFecha: '',
  })

  // Cuotas que todavía se deben cobrar, en orden
  const cuotasPendientes = pagos
    .filter((p) => p.estado !== 'pagado')
    .sort((a, b) => (a.numero_cuota || 0) - (b.numero_cuota || 0))

  const nuevasFechas = cambioDia.nuevaFecha
    ? generarFechas(cambioDia.nuevaFecha, cuotasPendientes.length, transaccion.tipo_pago, cambioDia.porDiaSemana)
    : []

  const cambiarDiaDePago = async () => {
    if (!cambioDia.nuevaFecha || cuotasPendientes.length === 0) return

    setProcesando('cambio-dia')
    try {
      const resultados = await Promise.all(
        cuotasPendientes.map((pago, i) =>
          supabase.from('pagos').update({ fecha_vencimiento: nuevasFechas[i] }).eq('id', pago.id)
        )
      )
      const fallo = resultados.find((r) => r.error)
      if (fallo?.error) throw fallo.error

      mostrarToast(
        'success',
        `Día de pago cambiado: ${cuotasPendientes.length} cuota${cuotasPendientes.length !== 1 ? 's' : ''} actualizada${cuotasPendientes.length !== 1 ? 's' : ''}`
      )
      setCambioDia({ abierto: false, nuevaFecha: '' })
      onPagoRegistrado()
    } catch (error: any) {
      mostrarToast('error', 'Error al cambiar el día de pago: ' + error.message)
    } finally {
      setProcesando(null)
    }
  }

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
          fecha_pago: hoyISO(),
          estado: 'pagado',
        })
        .eq('id', pagoId)

      if (error) throw error

      await sincronizarEstadoTransaccion(transaccion.id)

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
      // El importe de la cuota no cambia: el interés va solo en intereses_mora
      // (todas las pantallas muestran monto_cuota + intereses_mora). Si ya tenía
      // interés de una reprogramación anterior, se acumula.
      const pagoActual = pagos.find((p) => p.id === reprogramacion.pagoId)
      const moraAnterior = pagoActual?.intereses_mora || 0

      const { error } = await supabase
        .from('pagos')
        .update({
          fecha_vencimiento: reprogramacion.nuevaFecha,
          intereses_mora: moraAnterior + reprogramacion.interesesMora,
          fecha_reprogramacion: hoyISO(),
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
    new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', minimumFractionDigits: 2 }).format(monto)

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
    <div>
      {/* Toast notification */}
      {toast && (
        <div className="px-4 sm:px-5 pt-4">
          <div className={toast.tipo === 'success' ? 'alert-success' : 'alert-danger'} role="status">
            {toast.tipo === 'success' ? (
              <CheckCircle className="w-4 h-4 flex-shrink-0" />
            ) : (
              <XCircle className="w-4 h-4 flex-shrink-0" />
            )}
            {toast.texto}
          </div>
        </div>
      )}

      <div className="p-4 sm:p-5">
        <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
          <h4 className="text-sm font-semibold text-fg flex items-center gap-2">
            <EmojiImagen nombre="billete" className="w-5 h-5" />
            Cuotas
          </h4>
          {cuotasPendientes.length > 0 && (
            <button
              onClick={() => setCambioDia({ abierto: true, nuevaFecha: '' })}
              className="btn-secondary btn-sm"
            >
              <CalendarClock className="w-4 h-4" />
              Cambiar día de pago
            </button>
          )}
        </div>

        <div className="table-wrap">
          <table className="data-table min-w-[640px]">
            <thead>
              <tr>
                <th>Cuota</th>
                <th>Vencimiento</th>
                <th className="!text-right">Importe</th>
                <th className="!text-right">Pagado</th>
                <th className="!text-center">Estado</th>
                <th className="!text-right">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {pagos.map((pago) => {
                const diasVencimiento = calcularDiasVencimiento(pago.fecha_vencimiento)
                const estaVencido = diasVencimiento < 0 && pago.estado !== 'pagado'
                const proximoAVencer = diasVencimiento >= 0 && diasVencimiento <= 7 && pago.estado !== 'pagado'
                const montoTotal = (pago.monto_cuota || transaccion.monto_cuota) + (pago.intereses_mora || 0)

                return (
                  <tr
                    key={pago.id}
                    className={estaVencido ? '!bg-danger-soft/30' : proximoAVencer ? '!bg-warning-soft/30' : ''}
                  >
                    <td>
                      <span className="font-semibold text-fg num">{pago.numero_cuota}</span>
                    </td>
                    <td>
                      <p className="text-fg num whitespace-nowrap">{formatearFecha(pago.fecha_vencimiento)}</p>
                      {pago.fecha_reprogramacion && (
                        <p className="text-xs text-reprog-text mt-0.5 num">
                          Reprogramada el {formatearFecha(pago.fecha_reprogramacion)}
                        </p>
                      )}
                      {pago.estado !== 'pagado' && (
                        <p
                          className={`text-xs mt-0.5 font-medium ${
                            estaVencido
                              ? 'text-danger-text'
                              : proximoAVencer
                              ? 'text-warning-text'
                              : 'text-muted'
                          }`}
                        >
                          {estaVencido
                            ? `Vencida hace ${Math.abs(diasVencimiento)} d`
                            : diasVencimiento === 0
                            ? 'Vence hoy'
                            : proximoAVencer
                            ? `Vence en ${diasVencimiento} d`
                            : `En ${diasVencimiento} d`}
                        </p>
                      )}
                    </td>
                    <td className="text-right">
                      <p className="font-semibold text-fg num whitespace-nowrap">{formatearMoneda(montoTotal)}</p>
                      {(pago.intereses_mora || 0) > 0 && (
                        <p className="text-xs text-danger-text mt-0.5 num whitespace-nowrap">
                          +{formatearMoneda(pago.intereses_mora || 0)} mora
                        </p>
                      )}
                    </td>
                    <td className="text-right">
                      <p className="font-medium text-success-text num whitespace-nowrap">
                        {formatearMoneda(pago.monto_pagado || 0)}
                      </p>
                      {pago.fecha_pago && (
                        <p className="text-xs text-muted mt-0.5 num">{formatearFecha(pago.fecha_pago)}</p>
                      )}
                    </td>
                    <td className="text-center">
                      <EstadoPago
                        estado={pago.estado}
                        vencido={estaVencido}
                        reprogramado={pago.estado === 'reprogramado'}
                        porVencer={proximoAVencer}
                      />
                    </td>
                    <td>
                      {pago.estado !== 'pagado' && (
                        <div className="flex justify-end gap-1.5">
                          <button
                            onClick={() => abrirReprogramacion(pago.id)}
                            disabled={procesando === pago.id}
                            className="btn-secondary btn-sm"
                            title="Reprogramar cuota"
                          >
                            <RotateCcw className="w-3.5 h-3.5" />
                            Reprogramar
                          </button>
                          <button
                            onClick={() => registrarPago(pago.id, montoTotal)}
                            disabled={procesando === pago.id}
                            className="btn-accent btn-sm"
                          >
                            {procesando === pago.id ? (
                              <span className="spinner w-3.5 h-3.5" />
                            ) : (
                              <CheckCircle className="w-3.5 h-3.5" />
                            )}
                            Cobrar
                          </button>
                        </div>
                      )}
                      {pago.estado === 'pagado' && (
                        <span className="flex justify-end items-center gap-1 text-success-text text-xs font-medium">
                          <CheckCircle className="w-3.5 h-3.5" />
                          Cobrada
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

      {/* Modal de Cambio de Día de Pago */}
      {cambioDia.abierto && cuotasPendientes.length > 0 && (
        <div className="modal-backdrop">
          <div className="modal flex flex-col" role="dialog" aria-modal="true" aria-labelledby="titulo-cambio-dia">
            <div className="modal-header">
              <div className="icon-tile bg-primary/10 text-primary">
                <span className="emoji text-xl" aria-hidden="true">🗓️</span>
              </div>
              <div>
                <h3 id="titulo-cambio-dia" className="text-base font-semibold text-fg">Cambiar día de pago</h3>
                <p className="text-xs text-muted">
                  Las cuotas pendientes se reacomodan solas ({transaccion.tipo_pago})
                </p>
              </div>
            </div>

            <div className="modal-body overflow-y-auto">
              <div className="rounded-lg bg-surface-2 p-3 text-sm space-y-0.5">
                <p className="text-muted">
                  Próxima cuota a cobrar: <strong className="text-fg num">{cuotasPendientes[0].numero_cuota}</strong>
                </p>
                <p className="text-muted">
                  Vence actualmente el{' '}
                  <strong className="text-fg num">
                    {DIAS_SEMANA[parseFecha(cuotasPendientes[0].fecha_vencimiento).getDay()]}{' '}
                    {formatearFecha(cuotasPendientes[0].fecha_vencimiento)}
                  </strong>
                </p>
              </div>

              {transaccion.tipo_pago !== 'mensual' && (
                <fieldset>
                  <legend className="label">
                    Nuevo día de la semana
                  </legend>
                  <div className="grid grid-cols-4 sm:grid-cols-7 gap-1.5">
                    {[1, 2, 3, 4, 5, 6, 0].map((dia) => {
                      const fecha = proximoDiaSemana(dia)
                      const activo = cambioDia.nuevaFecha === fecha
                      return (
                        <button
                          key={dia}
                          type="button"
                          onClick={() => setCambioDia((prev) => ({ ...prev, nuevaFecha: fecha, porDiaSemana: true }))}
                          aria-pressed={activo}
                          className={`min-h-[44px] px-2 rounded-lg text-xs font-semibold border transition-colors ${
                            activo
                              ? 'bg-primary text-on-primary border-primary'
                              : 'bg-surface text-fg border-line hover:border-primary/50'
                          }`}
                        >
                          {DIAS_SEMANA[dia].slice(0, 3)}
                        </button>
                      )
                    })}
                  </div>
                </fieldset>
              )}

              <div>
                <label htmlFor="cambio-dia-fecha" className="label">
                  {transaccion.tipo_pago === 'mensual'
                    ? 'Nueva fecha de la próxima cuota *'
                    : 'O elegí la fecha exacta de la próxima cuota'}
                </label>
                <input
                  id="cambio-dia-fecha"
                  type="date"
                  value={cambioDia.nuevaFecha}
                  onChange={(e) => setCambioDia((prev) => ({ ...prev, nuevaFecha: e.target.value, porDiaSemana: false }))}
                  className="input"
                />
              </div>

              {nuevasFechas.length > 0 && (
                <div>
                  <p className="label">Así quedan las cuotas</p>
                  <div className="border border-line rounded-lg divide-y divide-line max-h-56 overflow-y-auto text-sm">
                    {cuotasPendientes.map((pago, i) => (
                      <div key={pago.id} className="flex items-center justify-between px-3 py-2">
                        <span className="font-semibold text-fg num">Cuota {pago.numero_cuota}</span>
                        <span className="flex items-center gap-2 num">
                          <span className="text-muted line-through">{formatearFecha(pago.fecha_vencimiento)}</span>
                          <ArrowRight className="w-3 h-3 text-muted" />
                          <span className="text-primary font-medium">
                            {DIAS_SEMANA[parseFecha(nuevasFechas[i]).getDay()].slice(0, 3)} {formatearFecha(nuevasFechas[i])}
                          </span>
                        </span>
                      </div>
                    ))}
                  </div>
                  <p className="help">
                    Las cuotas ya pagadas no se modifican.
                    {transaccion.tipo_pago === 'quincenal' && (cambioDia.porDiaSemana
                      ? ' Cada 14 días, para que siempre caigan el mismo día de la semana.'
                      : ' Cada 15 días a partir de la fecha elegida.')}
                  </p>
                </div>
              )}
            </div>

            <div className="modal-footer">
              <button
                onClick={() => setCambioDia({ abierto: false, nuevaFecha: '' })}
                disabled={procesando !== null}
                className="btn-secondary flex-1 sm:flex-none"
              >
                Cancelar
              </button>
              <button
                onClick={cambiarDiaDePago}
                disabled={!cambioDia.nuevaFecha || procesando !== null}
                className="btn-primary flex-1 sm:flex-none"
              >
                {procesando === 'cambio-dia' ? (
                  <span className="spinner" />
                ) : (
                  <CalendarClock className="w-4 h-4" />
                )}
                Confirmar cambio
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Reprogramación */}
      {reprogramacion.pagoId && (
        <div className="modal-backdrop">
          <div className="modal" role="dialog" aria-modal="true" aria-labelledby="titulo-reprogramar">
            <div className="modal-header">
              <div className="icon-tile bg-reprog-soft text-reprog-text">
                <span className="emoji text-xl" aria-hidden="true">📅</span>
              </div>
              <h3 id="titulo-reprogramar" className="text-base font-semibold text-fg">Reprogramar cuota</h3>
            </div>

            {(() => {
              const pago = pagos.find((p) => p.id === reprogramacion.pagoId)
              const diasAtraso = pago ? calcularDiasVencimiento(pago.fecha_vencimiento) : 0
              return (
                <>
                <div className="modal-body">
                  {transaccion.descripcion && (
                    <p className="text-sm text-muted border-l-2 border-primary/40 pl-3">
                      {transaccion.descripcion}
                    </p>
                  )}

                  <div className="rounded-lg bg-surface-2 p-3 text-sm">
                    <p className="font-medium text-fg">
                      Cuota {pago?.numero_cuota}
                    </p>
                    <p className="text-muted num">Vencimiento actual: {pago ? formatearFecha(pago.fecha_vencimiento) : ''}</p>
                    {diasAtraso < 0 && (
                      <span className="badge-danger mt-2">
                        <AlertTriangle className="w-3.5 h-3.5" />
                        Vencida hace {Math.abs(diasAtraso)} días
                      </span>
                    )}
                  </div>

                  <div>
                    <label htmlFor="reprog-fecha" className="label">
                      Nueva fecha de vencimiento <span className="text-danger" aria-hidden="true">*</span>
                    </label>
                    <input
                      id="reprog-fecha"
                      type="date"
                      value={reprogramacion.nuevaFecha}
                      onChange={(e) => setReprogramacion((prev) => ({ ...prev, nuevaFecha: e.target.value }))}
                      className="input"
                      min={hoyISO()}
                    />
                  </div>

                  <div>
                    <label htmlFor="reprog-interes" className="label">
                      Interés por atraso
                    </label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted font-medium pointer-events-none">$</span>
                      <input
                        id="reprog-interes"
                        type="number"
                        step="0.01"
                        value={reprogramacion.interesesMora}
                        onChange={(e) =>
                          setReprogramacion((prev) => ({ ...prev, interesesMora: parseFloat(e.target.value) || 0 }))
                        }
                        className="input pl-8 num"
                        placeholder="0,00"
                      />
                    </div>
                    <p className="help">Se sugiere un 1% por cada mes de atraso. Podés modificarlo.</p>
                    <dl className="mt-3 p-3 rounded-lg bg-surface-2 text-sm space-y-1 num">
                      <div className="flex justify-between text-muted">
                        <dt>Cuota original</dt>
                        <dd>{formatearMoneda(pago?.monto_cuota || transaccion.monto_cuota)}</dd>
                      </div>
                      {(pago?.intereses_mora || 0) > 0 && (
                        <div className="flex justify-between text-danger-text">
                          <dt>Interés de reprogramaciones anteriores</dt>
                          <dd>+{formatearMoneda(pago?.intereses_mora || 0)}</dd>
                        </div>
                      )}
                      <div className="flex justify-between text-danger-text">
                        <dt>Interés por atraso</dt>
                        <dd>+{formatearMoneda(reprogramacion.interesesMora)}</dd>
                      </div>
                      <div className="flex justify-between font-bold text-fg border-t border-line pt-1">
                        <dt>Nuevo total</dt>
                        <dd>{formatearMoneda((pago?.monto_cuota || transaccion.monto_cuota) + (pago?.intereses_mora || 0) + reprogramacion.interesesMora)}</dd>
                      </div>
                    </dl>
                  </div>

                  <div>
                    <label htmlFor="reprog-motivo" className="label">
                      Motivo <span className="font-normal text-muted">(opcional)</span>
                    </label>
                    <textarea
                      id="reprog-motivo"
                      value={reprogramacion.motivoReprogramacion}
                      onChange={(e) =>
                        setReprogramacion((prev) => ({ ...prev, motivoReprogramacion: e.target.value }))
                      }
                      className="input resize-none"
                      placeholder="Ej: Pidió pagar a fin de mes"
                      rows={2}
                    />
                  </div>
                </div>

                <div className="modal-footer">
                  <button
                    onClick={cerrarReprogramacion}
                    disabled={procesando !== null}
                    className="btn-secondary flex-1 sm:flex-none"
                  >
                    Cancelar
                  </button>
                  <button
                    onClick={reprogramarPago}
                    disabled={!reprogramacion.nuevaFecha || procesando !== null}
                    className="btn-primary flex-1 sm:flex-none"
                  >
                    {procesando ? (
                      <span className="spinner" />
                    ) : (
                      <RotateCcw className="w-4 h-4" />
                    )}
                    Reprogramar
                  </button>
                </div>
                </>
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
  porVencer,
}: {
  estado: string
  vencido?: boolean
  reprogramado?: boolean
  porVencer?: boolean
}) {
  if (estado === 'pagado') return <EstadoBadge estado="pagado" />
  if (reprogramado) return <EstadoBadge estado="reprogramado" />
  if (vencido) return <EstadoBadge estado="vencido" />
  if (estado === 'parcial') return <EstadoBadge estado="parcial" />
  if (porVencer) return <EstadoBadge estado="por_vencer" />
  return <EstadoBadge estado="pendiente" />
}
