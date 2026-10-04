import { useState, useEffect, useRef } from 'react'
import { supabase } from '@/app/lib/supabase'
import { Cliente } from '@/app/lib/types/cobranzas'
import {
  Save,
  MapPin,
  Navigation,
  LocateFixed,
  CheckCircle,
  XCircle,
  Move,
  FileText,
  Phone,
  Mail,
  Plus,
  X,
} from 'lucide-react'
import dynamic from 'next/dynamic'

const MapaPin = dynamic(() => import('./MapaPin'), {
  ssr: false,
  loading: () => <div className="skeleton w-full h-72 rounded-lg" />,
})

interface PinEnEdicion {
  lat: number
  lng: number
  precision?: number
}

interface LecturaGPS {
  lat: number
  lng: number
  precision: number
}

interface MedicionGPS {
  precision: number | null
  lecturas: number
  segundos: number
}

// Metros de precisión a partir de los cuales la medición se da por buena
const PRECISION_OBJETIVO = 5
// Lecturas buenas necesarias para promediar antes de terminar sola
const LECTURAS_BUENAS_MINIMAS = 5
// Tiempo máximo midiendo; al cumplirse se usa lo mejor que se haya conseguido
const DURACION_MAXIMA_SEG = 45

// Promedia las lecturas más precisas, dando más peso a las de menor error
const calcularPosicion = (lecturas: LecturaGPS[]): PinEnEdicion => {
  const mejor = Math.min(...lecturas.map((l) => l.precision))
  const utiles = lecturas.filter((l) => l.precision <= Math.max(mejor * 1.5, mejor + 3))
  let sumaPesos = 0
  let lat = 0
  let lng = 0
  for (const l of utiles) {
    const peso = 1 / (l.precision * l.precision)
    sumaPesos += peso
    lat += l.lat * peso
    lng += l.lng * peso
  }
  return { lat: lat / sumaPesos, lng: lng / sumaPesos, precision: mejor }
}

interface InfoClienteProps {
  cliente: Cliente
  mostrarFormulario: boolean
  onToggleFormulario: () => void
  onClienteActualizado: () => void
}

interface ToastMsg {
  tipo: 'success' | 'error'
  texto: string
}

const urlComoLlegar = (lat: number, lng: number) =>
  `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}&travelmode=driving`

const urlMapaEmbebido = (lat: number, lng: number) =>
  `https://maps.google.com/maps?q=${lat},${lng}&z=17&output=embed`

export default function InfoCliente({
  cliente,
  mostrarFormulario,
  onToggleFormulario,
  onClienteActualizado,
}: InfoClienteProps) {
  const [medicion, setMedicion] = useState<MedicionGPS | null>(null)
  const [guardandoUbicacion, setGuardandoUbicacion] = useState(false)
  const [pinEnEdicion, setPinEnEdicion] = useState<PinEnEdicion | null>(null)
  const [toast, setToast] = useState<ToastMsg | null>(null)
  const watchIdRef = useRef<number | null>(null)
  const relojRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const lecturasRef = useRef<LecturaGPS[]>([])
  const inicioRef = useRef(0)
  const obteniendoUbicacion = medicion !== null

  // Al cambiar de cliente (o salir), cortar cualquier medición en curso
  useEffect(() => {
    setPinEnEdicion(null)
    return () => {
      if (watchIdRef.current != null) navigator.geolocation.clearWatch(watchIdRef.current)
      if (relojRef.current != null) clearInterval(relojRef.current)
      watchIdRef.current = null
      relojRef.current = null
      setMedicion(null)
    }
  }, [cliente.id])

  const mostrarToast = (tipo: 'success' | 'error', texto: string) => {
    setToast({ tipo, texto })
    setTimeout(() => setToast(null), 4000)
  }

  const tieneUbicacion = cliente.latitud != null && cliente.longitud != null

  const guardarUbicacion = async () => {
    if (!pinEnEdicion) return

    setGuardandoUbicacion(true)
    try {
      const { error } = await supabase
        .from('clientes')
        .update({
          latitud: pinEnEdicion.lat,
          longitud: pinEnEdicion.lng,
          ubicacion_actualizada: new Date().toISOString(),
        })
        .eq('id', cliente.id)
      if (error) {
        if (error.message.includes('latitud') || error.message.includes('longitud')) {
          throw new Error('falta crear las columnas de ubicación en Supabase (ver sql/2026-10-03_ubicacion_clientes.sql)')
        }
        throw error
      }
      mostrarToast('success', 'Ubicación guardada')
      setPinEnEdicion(null)
      onClienteActualizado()
    } catch (error: any) {
      mostrarToast('error', 'Error al guardar la ubicación: ' + error.message)
    } finally {
      setGuardandoUbicacion(false)
    }
  }

  const detenerMedicion = () => {
    if (watchIdRef.current != null) navigator.geolocation.clearWatch(watchIdRef.current)
    if (relojRef.current != null) clearInterval(relojRef.current)
    watchIdRef.current = null
    relojRef.current = null
    setMedicion(null)
  }

  // Termina la medición y abre el mapa con la mejor posición obtenida
  const finalizarMedicion = () => {
    if (watchIdRef.current == null && relojRef.current == null) return
    const lecturas = lecturasRef.current
    detenerMedicion()
    if (lecturas.length === 0) {
      mostrarToast('error', 'No se recibió señal de GPS. Salí al aire libre y probá de nuevo.')
      return
    }
    setPinEnEdicion(calcularPosicion(lecturas))
  }

  // Mide el GPS durante varios segundos y se queda con las lecturas más precisas
  const tomarUbicacionActual = () => {
    if (!window.isSecureContext || !navigator.geolocation) {
      mostrarToast('error', 'El GPS solo funciona si la app se abre con https (o en localhost)')
      return
    }

    lecturasRef.current = []
    inicioRef.current = Date.now()
    setMedicion({ precision: null, lecturas: 0, segundos: 0 })

    watchIdRef.current = navigator.geolocation.watchPosition(
      (pos) => {
        const lecturas = lecturasRef.current
        lecturas.push({ lat: pos.coords.latitude, lng: pos.coords.longitude, precision: pos.coords.accuracy })
        const mejor = Math.min(...lecturas.map((l) => l.precision))
        setMedicion((prev) => prev && { ...prev, precision: mejor, lecturas: lecturas.length })

        const buenas = lecturas.filter((l) => l.precision <= PRECISION_OBJETIVO * 1.5)
        if (mejor <= PRECISION_OBJETIVO && buenas.length >= LECTURAS_BUENAS_MINIMAS) {
          finalizarMedicion()
        }
      },
      (err) => {
        // Si ya hay lecturas, un error suelto no corta la medición
        if (err.code !== 1 && lecturasRef.current.length > 0) return
        detenerMedicion()
        const mensajes: Record<number, string> = {
          1: 'Permiso de ubicación denegado. Habilitalo en el navegador.',
          2: 'No se pudo obtener la ubicación. Activá el GPS del celular.',
          3: 'Se tardó demasiado en obtener la ubicación. Probá de nuevo.',
        }
        mostrarToast('error', mensajes[err.code] || err.message)
      },
      { enableHighAccuracy: true, timeout: DURACION_MAXIMA_SEG * 1000, maximumAge: 0 }
    )

    relojRef.current = setInterval(() => {
      const segundos = Math.floor((Date.now() - inicioRef.current) / 1000)
      if (segundos >= DURACION_MAXIMA_SEG) {
        finalizarMedicion()
      } else {
        setMedicion((prev) => prev && { ...prev, segundos })
      }
    }, 1000)
  }

  return (
    <div className="card">
      <div className="card-body flex flex-col sm:flex-row sm:justify-between sm:items-start gap-4">
        <div className="flex items-start gap-4 min-w-0">
          <div className="icon-tile w-12 h-12 rounded-full bg-primary text-on-primary text-base font-semibold uppercase">
            {cliente.nombre?.[0]}{cliente.apellido?.[0]}
          </div>
          <div className="min-w-0">
            <h2 className="text-lg font-semibold text-fg">
              {cliente.nombre} {cliente.apellido}
            </h2>
            <dl className="mt-1 grid grid-cols-1 gap-x-6 gap-y-1 text-sm sm:grid-cols-2">
              <div className="flex items-center gap-2 text-muted">
                <dt className="sr-only">Documento</dt>
                <FileText className="w-4 h-4 flex-shrink-0" />
                <dd className="num">DNI {cliente.documento}</dd>
              </div>
              {cliente.telefono && (
                <div className="flex items-center gap-2 text-muted">
                  <dt className="sr-only">Teléfono</dt>
                  <Phone className="w-4 h-4 flex-shrink-0" />
                  <dd className="num">{cliente.telefono}</dd>
                </div>
              )}
              {cliente.email && (
                <div className="flex items-center gap-2 text-muted min-w-0">
                  <dt className="sr-only">Email</dt>
                  <Mail className="w-4 h-4 flex-shrink-0" />
                  <dd className="truncate">{cliente.email}</dd>
                </div>
              )}
              {cliente.direccion && (
                <div className="flex items-center gap-2 text-muted min-w-0">
                  <dt className="sr-only">Dirección</dt>
                  <MapPin className="w-4 h-4 flex-shrink-0" />
                  <dd className="truncate">{cliente.direccion}</dd>
                </div>
              )}
            </dl>
          </div>
        </div>
        <button
          onClick={onToggleFormulario}
          className={mostrarFormulario ? 'btn-secondary' : 'btn-primary'}
        >
          {mostrarFormulario ? <X className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
          {mostrarFormulario ? 'Cancelar' : 'Nueva venta o préstamo'}
        </button>
      </div>

      {toast && (
        <div className="px-4 sm:px-5 pb-4">
          <div
            className={toast.tipo === 'success' ? 'alert-success' : 'alert-danger'}
            role="status"
          >
            {toast.tipo === 'success' ? (
              <CheckCircle className="w-4 h-4 flex-shrink-0" />
            ) : (
              <XCircle className="w-4 h-4 flex-shrink-0" />
            )}
            {toast.texto}
          </div>
        </div>
      )}

      <div className="border-t border-line">
        {/* Ubicación */}
        <section className="p-4 sm:p-5">
          <h3 className="text-sm font-semibold text-fg flex items-center gap-2 mb-3">
            <span className="emoji" aria-hidden="true">📍</span>
            Ubicación
          </h3>

          {medicion ? (
            <div role="status" aria-live="polite">
              <div className="flex items-center gap-3 mb-3">
                <span className="spinner w-5 h-5 text-primary flex-shrink-0" />
                <div>
                  <p className="text-sm font-semibold text-fg num">
                    {medicion.precision == null
                      ? 'Buscando señal de GPS…'
                      : `Precisión actual: ±${Math.round(medicion.precision)} m`}
                  </p>
                  <p className="text-xs text-muted num">
                    {medicion.lecturas} lectura{medicion.lecturas !== 1 ? 's' : ''} · {medicion.segundos} de {DURACION_MAXIMA_SEG} s
                  </p>
                </div>
              </div>

              <div className="h-2 bg-line rounded-full overflow-hidden mb-3">
                <div
                  className={`h-full transition-all duration-500 ${
                    medicion.precision == null
                      ? 'bg-neutral'
                      : medicion.precision <= 10
                      ? 'bg-success'
                      : medicion.precision <= 25
                      ? 'bg-warning'
                      : 'bg-danger'
                  }`}
                  style={{
                    width: `${medicion.precision == null ? 5 : Math.max(5, Math.min(100, (PRECISION_OBJETIVO / medicion.precision) * 100))}%`,
                  }}
                />
              </div>

              <p className="help mb-3">
                Quedate quieto en la puerta del cliente, al aire libre y sin tapar el celular. La medición
                termina sola al llegar a ±{PRECISION_OBJETIVO} m.
              </p>

              <div className="flex gap-2">
                <button
                  onClick={detenerMedicion}
                  className="btn-secondary flex-1"
                >
                  Cancelar
                </button>
                <button
                  onClick={finalizarMedicion}
                  disabled={medicion.lecturas === 0}
                  className="btn-primary flex-1"
                >
                  <LocateFixed className="w-4 h-4" />
                  Usar ahora
                </button>
              </div>
            </div>
          ) : pinEnEdicion ? (
            <>
              <p className="help !mt-0 mb-3 flex items-start gap-1.5">
                <Move className="w-4 h-4 flex-shrink-0 text-primary" />
                <span>
                  Arrastrá el pin o tocá el mapa hasta la puerta exacta del cliente.
                  {pinEnEdicion.precision != null && ` Precisión del GPS: ±${Math.round(pinEnEdicion.precision)} m.`}
                </span>
              </p>
              <div className="rounded-lg overflow-hidden border border-line mb-3">
                <MapaPin
                  lat={pinEnEdicion.lat}
                  lng={pinEnEdicion.lng}
                  precision={pinEnEdicion.precision}
                  onMover={(lat, lng) => setPinEnEdicion((prev) => prev && { ...prev, lat, lng })}
                />
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => setPinEnEdicion(null)}
                  disabled={guardandoUbicacion}
                  className="btn-secondary flex-1"
                >
                  Cancelar
                </button>
                <button
                  onClick={guardarUbicacion}
                  disabled={guardandoUbicacion}
                  className="btn-primary flex-1"
                >
                  {guardandoUbicacion ? (
                    <span className="spinner" />
                  ) : (
                    <Save className="w-4 h-4" />
                  )}
                  Guardar ubicación
                </button>
              </div>
            </>
          ) : tieneUbicacion ? (
            <>
              <div className="rounded-lg overflow-hidden border border-line mb-2">
                <iframe
                  title={`Ubicación de ${cliente.nombre}`}
                  src={urlMapaEmbebido(cliente.latitud!, cliente.longitud!)}
                  className="w-full h-48"
                  loading="lazy"
                />
              </div>
              {cliente.ubicacion_actualizada && (
                <p className="text-xs text-muted mb-3 num">
                  Guardada el {new Date(cliente.ubicacion_actualizada).toLocaleString('es-AR', { dateStyle: 'short', timeStyle: 'short' })}
                </p>
              )}
              <div className="flex flex-wrap gap-2">
                <a
                  href={urlComoLlegar(cliente.latitud!, cliente.longitud!)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn-primary flex-1"
                >
                  <Navigation className="w-4 h-4" />
                  Cómo llegar
                </a>
                <button
                  onClick={() => setPinEnEdicion({ lat: cliente.latitud!, lng: cliente.longitud! })}
                  className="btn-secondary"
                >
                  <Move className="w-4 h-4" />
                  Ajustar pin
                </button>
                <button
                  onClick={tomarUbicacionActual}
                  disabled={obteniendoUbicacion}
                  className="btn-secondary"
                  title="Reemplazar por el lugar donde estás ahora"
                >
                  {obteniendoUbicacion ? (
                    <span className="spinner" />
                  ) : (
                    <LocateFixed className="w-4 h-4" />
                  )}
                  Usar mi GPS
                </button>
              </div>
            </>
          ) : (
            <div className="empty-state py-6 rounded-lg border border-dashed border-line">
              <span className="empty-emoji" aria-hidden="true">🗺️</span>
              <p className="text-sm text-fg font-medium">Todavía no hay ubicación guardada</p>
              <p className="text-xs mt-1 mb-4 max-w-xs">
                Cuando estés en la casa del cliente, marcá dónde estás parado. Después podés ajustar el pin antes de guardar.
              </p>
              <button
                onClick={tomarUbicacionActual}
                disabled={obteniendoUbicacion}
                className="btn-primary"
              >
                {obteniendoUbicacion ? (
                  <span className="spinner" />
                ) : (
                  <LocateFixed className="w-4 h-4" />
                )}
                {obteniendoUbicacion ? 'Obteniendo GPS…' : 'Tomar mi ubicación actual'}
              </button>
            </div>
          )}
        </section>
      </div>
    </div>
  )
}
