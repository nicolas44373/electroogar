// Convierte un teléfono cargado como venga ("381 555-1234", "0381...", "+54 381...")
// al formato que necesita WhatsApp para Argentina: 549 + característica + número.
// Devuelve '' si no hay un número usable.
export function telefonoWhatsApp(telefono?: string | null): string {
  let d = (telefono || '').replace(/\D/g, '')
  if (!d) return ''
  if (d.startsWith('00')) d = d.slice(2) // 0054...
  if (d.startsWith('549')) return d
  if (d.startsWith('54')) return '549' + d.slice(2) // falta el 9 de celulares
  if (d.startsWith('0')) d = d.slice(1) // 0381...
  if (d.length === 10) return '549' + d // 381 + 7 dígitos
  return d // otro formato (ej. extranjero): se usa tal cual
}

export function enlaceWhatsApp(telefono?: string | null, mensaje?: string): string {
  const numero = telefonoWhatsApp(telefono)
  if (!numero) return ''
  return `https://wa.me/${numero}${mensaje ? `?text=${encodeURIComponent(mensaje)}` : ''}`
}
