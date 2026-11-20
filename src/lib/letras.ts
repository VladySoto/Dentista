const UNIDADES = ['', 'uno', 'dos', 'tres', 'cuatro', 'cinco', 'seis', 'siete', 'ocho', 'nueve', 'diez', 'once', 'doce', 'trece', 'catorce', 'quince',
  'dieciséis', 'diecisiete', 'dieciocho', 'diecinueve', 'veinte', 'veintiuno', 'veintidós', 'veintitrés', 'veinticuatro', 'veinticinco',
  'veintiséis', 'veintisiete', 'veintiocho', 'veintinueve']
const DECENAS = ['', '', '', 'treinta', 'cuarenta', 'cincuenta', 'sesenta', 'setenta', 'ochenta', 'noventa']
const CENTENAS = ['', 'ciento', 'doscientos', 'trescientos', 'cuatrocientos', 'quinientos', 'seiscientos', 'setecientos', 'ochocientos', 'novecientos']

function hasta999(n: number): string {
  if (n === 0) return ''
  if (n === 100) return 'cien'
  const c = Math.floor(n / 100), r = n % 100
  let t = CENTENAS[c]
  if (r) t += (t ? ' ' : '') + (r < 30 ? UNIDADES[r] : DECENAS[Math.floor(r / 10)] + (r % 10 ? ` y ${UNIDADES[r % 10]}` : ''))
  return t
}

/** 1250 → "mil doscientos cincuenta" (para recibos). */
export function numeroALetras(n: number): string {
  n = Math.floor(Math.abs(n))
  if (n === 0) return 'cero'
  const millones = Math.floor(n / 1_000_000), miles = Math.floor((n % 1_000_000) / 1000), resto = n % 1000
  const partes: string[] = []
  // Antes de "mil" o "millones", "uno" se apocopa: veintiún mil, treinta y un mil
  const apocopar = (t: string) => t.replace(/veintiuno$/, 'veintiún').replace(/uno$/, 'un')
  if (millones) partes.push(millones === 1 ? 'un millón' : `${apocopar(hasta999(millones))} millones`)
  if (miles) partes.push(miles === 1 ? 'mil' : `${apocopar(hasta999(miles))} mil`)
  if (resto) partes.push(hasta999(resto))
  return partes.join(' ')
}

/** 250.5 → "doscientos cincuenta 50/100 bolivianos". */
export function montoEnLetras(monto: number) {
  const entero = Math.floor(monto + 1e-9)
  const cent = Math.round((monto - entero) * 100)
  return `${numeroALetras(entero)} ${String(cent).padStart(2, '0')}/100 bolivianos`
}
