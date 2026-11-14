import QRCode from 'qrcode'
import { useEffect, useState } from 'react'

export function urlTurnos(codigo: string) {
  return `${location.origin}/t/${codigo}`
}

export function nuevoCodigoQR() {
  const bytes = crypto.getRandomValues(new Uint8Array(12))
  return btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

/** Imagen (data URL) del QR para un texto. */
export function useQR(texto: string | undefined, ancho = 640) {
  const [src, setSrc] = useState<string>()
  useEffect(() => {
    if (!texto) return setSrc(undefined)
    QRCode.toDataURL(texto, { width: ancho, margin: 1, errorCorrectionLevel: 'M', color: { dark: '#0f172a', light: '#ffffff' } })
      .then(setSrc).catch(() => setSrc(undefined))
  }, [texto, ancho])
  return src
}
