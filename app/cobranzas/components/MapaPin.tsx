'use client'
import { useEffect, useRef } from 'react'
import 'leaflet/dist/leaflet.css'

interface MapaPinProps {
  lat: number
  lng: number
  precision?: number
  onMover: (lat: number, lng: number) => void
}

const PIN_HTML = `
  <svg width="36" height="48" viewBox="0 0 36 48" xmlns="http://www.w3.org/2000/svg">
    <path d="M18 0C8.1 0 0 8.1 0 18c0 13.5 18 30 18 30s18-16.5 18-30C36 8.1 27.9 0 18 0z" fill="#dc2626" stroke="#fff" stroke-width="2"/>
    <circle cx="18" cy="18" r="6.5" fill="#fff"/>
  </svg>`

// Mapa con un pin arrastrable. También se puede tocar el mapa para mover el pin ahí.
export default function MapaPin({ lat, lng, precision, onMover }: MapaPinProps) {
  const contenedorRef = useRef<HTMLDivElement>(null)
  const onMoverRef = useRef(onMover)
  onMoverRef.current = onMover

  useEffect(() => {
    let mapa: import('leaflet').Map | null = null
    let cancelado = false

    // Leaflet usa `window`, por eso se carga solo en el navegador
    import('leaflet').then((L) => {
      if (cancelado || !contenedorRef.current) return

      const calles = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
        attribution: '&copy; OpenStreetMap',
      })
      const satelite = L.tileLayer(
        'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
        { maxZoom: 19, attribution: '&copy; Esri' }
      )

      mapa = L.map(contenedorRef.current, { layers: [calles] }).setView([lat, lng], 18)
      L.control.layers({ Calles: calles, Satélite: satelite }, undefined, { position: 'topright' }).addTo(mapa)

      if (precision) {
        L.circle([lat, lng], {
          radius: precision,
          color: '#2563eb',
          weight: 1,
          fillOpacity: 0.1,
          interactive: false,
        }).addTo(mapa)
      }

      const pin = L.marker([lat, lng], {
        draggable: true,
        autoPan: true,
        icon: L.divIcon({ html: PIN_HTML, className: '', iconSize: [36, 48], iconAnchor: [18, 48] }),
      }).addTo(mapa)

      pin.on('dragend', () => {
        const pos = pin.getLatLng()
        onMoverRef.current(pos.lat, pos.lng)
      })

      mapa.on('click', (e: import('leaflet').LeafletMouseEvent) => {
        pin.setLatLng(e.latlng)
        onMoverRef.current(e.latlng.lat, e.latlng.lng)
      })
    })

    return () => {
      cancelado = true
      mapa?.remove()
    }
    // Solo se inicializa con la posición de partida; después el pin se mueve solo
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return <div ref={contenedorRef} className="relative isolate z-0 w-full h-72 rounded-lg" />
}
