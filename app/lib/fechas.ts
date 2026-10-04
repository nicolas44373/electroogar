// Fechas en formato YYYY-MM-DD según la hora LOCAL (Argentina).
// No usar toISOString() para esto: devuelve la fecha en UTC y después de las 21 h
// ya marca el día siguiente.

export const fechaLocalISO = (fecha: Date): string => {
  const y = fecha.getFullYear()
  const m = String(fecha.getMonth() + 1).padStart(2, '0')
  const d = String(fecha.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

export const hoyISO = (): string => fechaLocalISO(new Date())
