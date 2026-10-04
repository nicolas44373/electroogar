'use client'
import { useEffect, useRef, useState } from 'react'
import { supabase } from '@/app/lib/supabase'
import { CheckCircle2, CloudOff, Eraser } from 'lucide-react'

type EstadoGuardado = 'cargando' | 'guardado' | 'escribiendo' | 'guardando' | 'solo-local' | 'error'

const CLAVE_LOCAL = 'notas-personales'
const ESPERA_MS = 800 // se guarda solo cuando dejás de escribir

const leerLocal = () => { try { return localStorage.getItem(CLAVE_LOCAL) ?? '' } catch { return '' } }
const guardarLocal = (t: string) => { try { localStorage.setItem(CLAVE_LOCAL, t) } catch {} }

// Bloc de notas personal: una sola nota, se guarda sola en Supabase (y una copia en el navegador)
export default function NotasPersonales() {
  const [texto, setTexto] = useState('')
  const [estado, setEstado] = useState<EstadoGuardado>('cargando')
  const [actualizado, setActualizado] = useState<string | null>(null)
  const temporizador = useRef<ReturnType<typeof setTimeout> | null>(null)
  const sinTabla = useRef(false)

  useEffect(() => {
    let cancelado = false
    ;(async () => {
      const { data, error } = await supabase.from('notas_personales').select('contenido, actualizado').eq('id', 1).maybeSingle()
      if (cancelado) return
      if (error) {
        // Tabla todavía no creada (o sin conexión): usar la copia del navegador
        sinTabla.current = true
        setTexto(leerLocal())
        setEstado('solo-local')
        return
      }
      const enBase = data?.contenido ?? ''
      const local = leerLocal()
      if (!enBase && local) {
        // Se escribió antes de crear la tabla: subir esa copia
        setTexto(local)
        await guardar(local)
        return
      }
      setTexto(enBase)
      guardarLocal(enBase)
      setActualizado(data?.actualizado ?? null)
      setEstado('guardado')
    })()
    return () => { cancelado = true }
  }, [])

  const guardar = async (contenido: string) => {
    guardarLocal(contenido)
    if (sinTabla.current) { setEstado('solo-local'); return }
    setEstado('guardando')
    const ahora = new Date().toISOString()
    const { error } = await supabase.from('notas_personales').upsert({ id: 1, contenido, actualizado: ahora })
    if (error) { setEstado('error'); return }
    setActualizado(ahora)
    setEstado('guardado')
  }

  const alEscribir = (nuevo: string) => {
    setTexto(nuevo)
    setEstado('escribiendo')
    if (temporizador.current) clearTimeout(temporizador.current)
    temporizador.current = setTimeout(() => guardar(nuevo), ESPERA_MS)
  }

  const limpiar = () => {
    if (!texto || !confirm('¿Borrar todo el contenido del bloc de notas?')) return
    alEscribir('')
  }

  // Guardar lo pendiente si se sale de la página
  useEffect(() => () => { if (temporizador.current) clearTimeout(temporizador.current) }, [])

  const indicador = {
    cargando: <span className="text-muted">Cargando…</span>,
    escribiendo: <span className="text-muted">Escribiendo…</span>,
    guardando: <span className="text-muted flex items-center gap-1.5"><span className="spinner w-3 h-3" /> Guardando…</span>,
    guardado: (
      <span className="text-success-text flex items-center gap-1">
        <CheckCircle2 className="w-3.5 h-3.5" />
        Guardado{actualizado ? ` · ${new Date(actualizado).toLocaleString('es-AR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}` : ''}
      </span>
    ),
    'solo-local': (
      <span className="text-warning-text flex items-center gap-1">
        <CloudOff className="w-3.5 h-3.5" />
        Guardado solo en este dispositivo
      </span>
    ),
    error: <span className="text-danger-text">No se pudo guardar. Revisá la conexión; se reintenta al seguir escribiendo.</span>,
  }[estado]

  return (
    <section className="card animate-aparecer mb-8 overflow-hidden">
      <div className="card-header tint-warning">
        <h2 className="section-title">
          <span className="emoji" aria-hidden="true">🗒️</span>
          Mis notas
        </h2>
        <button type="button" onClick={limpiar} disabled={!texto} className="btn-ghost btn-sm" title="Borrar todo">
          <Eraser className="w-4 h-4" />
          <span className="hidden sm:inline">Limpiar</span>
        </button>
      </div>
      <div className="card-body">
        <textarea
          value={texto}
          onChange={(e) => alEscribir(e.target.value)}
          onBlur={() => { if (estado === 'escribiendo') { if (temporizador.current) clearTimeout(temporizador.current); guardar(texto) } }}
          disabled={estado === 'cargando'}
          rows={6}
          placeholder="Anotá lo que quieras: pendientes, ideas, recordatorios… Se guarda solo."
          className="input resize-y leading-relaxed min-h-[150px] bg-warning-soft/30"
          aria-label="Mis notas personales"
        />
        <div className="flex items-center justify-between gap-3 mt-2 text-xs" aria-live="polite">
          {indicador}
          <span className="text-muted num">{texto.length} caracteres</span>
        </div>
        {estado === 'solo-local' && (
          <p className="help">
            Para verlas también desde otros dispositivos, falta crear la tabla en Supabase (archivo <code>sql/2026-10-04_notas_personales.sql</code>).
          </p>
        )}
      </div>
    </section>
  )
}
