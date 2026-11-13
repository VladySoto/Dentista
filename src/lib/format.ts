export function edad(fechaNacimiento?: string) {
  if (!fechaNacimiento) return null
  const n = new Date(fechaNacimiento + 'T00:00')
  const h = new Date()
  let e = h.getFullYear() - n.getFullYear()
  if (h.getMonth() < n.getMonth() || (h.getMonth() === n.getMonth() && h.getDate() < n.getDate())) e--
  return e >= 0 ? e : null
}

export function minutosDesde(ts: number, ahora = Date.now()) {
  return Math.max(0, Math.floor((ahora - ts) / 60000))
}

export function duracion(min: number) {
  if (min < 60) return `${min} min`
  return `${Math.floor(min / 60)} h ${min % 60} min`
}

export const hora = (ts: number) =>
  new Date(ts).toLocaleTimeString('es', { hour: '2-digit', minute: '2-digit' })

export const fechaLarga = (ts: number | string) =>
  new Date(typeof ts === 'string' ? ts + 'T00:00' : ts).toLocaleDateString('es', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
  })

export const fechaCorta = (ts: number | string) =>
  new Date(typeof ts === 'string' ? ts + 'T00:00' : ts).toLocaleDateString('es', {
    day: 'numeric', month: 'short', year: 'numeric',
  })

export const dinero = (n?: number) =>
  (n ?? 0).toLocaleString('es', { minimumFractionDigits: 0, maximumFractionDigits: 2 })

export function iniciales(nombre: string) {
  return nombre.split(/\s+/).filter(Boolean).slice(0, 2).map((p) => p[0]!.toUpperCase()).join('')
}

export function normalizar(s: string) {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
}
