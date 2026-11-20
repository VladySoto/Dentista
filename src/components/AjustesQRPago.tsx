import { ImagePlus, Trash2 } from 'lucide-react'
import { useRef, useState } from 'react'
import { db } from '../lib/db'
import { useConfig } from '../lib/useConfig'
import { Campo } from './ui'

/** Achica la captura del QR (máx. 700 px) manteniéndola nítida (PNG). */
async function prepararImagen(file: File) {
  const bmp = await createImageBitmap(file)
  const escala = Math.min(1, 700 / Math.max(bmp.width, bmp.height))
  const c = document.createElement('canvas')
  c.width = Math.round(bmp.width * escala); c.height = Math.round(bmp.height * escala)
  const ctx = c.getContext('2d')!
  ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, c.width, c.height)
  ctx.imageSmoothingEnabled = escala < 1
  ctx.drawImage(bmp, 0, 0, c.width, c.height)
  bmp.close()
  return c.toDataURL('image/png')
}

export default function AjustesQRPago() {
  const config = useConfig()
  const input = useRef<HTMLInputElement>(null)
  const [titular, setTitular] = useState<string | null>(null)
  const [error, setError] = useState('')

  async function subir(file?: File) {
    if (!file) return
    setError('')
    try {
      const qrPago = await prepararImagen(file)
      if (qrPago.length > 900_000) return setError('La imagen es muy pesada. Recorta la captura para que quede solo el QR.')
      await db.config.update('general', { qrPago })
    } catch {
      setError('No se pudo leer la imagen.')
    }
  }

  return (
    <div className="space-y-3">
      {config.qrPago ? (
        <div className="flex flex-col items-center gap-3 sm:flex-row sm:items-start">
          <img src={config.qrPago} alt="QR de cobro" className="w-44 rounded-xl border border-slate-200 bg-white p-1" />
          <div className="w-full flex-1 space-y-2">
            <Campo label="A nombre de (aparece debajo del QR)">
              <input className="input" placeholder="Ej: Banco Unión · Vladimir Soto" value={titular ?? config.qrPagoTitular ?? ''}
                onChange={(e) => setTitular(e.target.value)} onBlur={() => titular !== null && db.config.update('general', { qrPagoTitular: titular.trim() || undefined })} />
            </Campo>
            <div className="flex flex-wrap gap-2">
              <button className="btn-soft px-3 py-2" onClick={() => input.current?.click()}><ImagePlus size={16} /> Cambiar imagen</button>
              <button className="btn-ghost px-3 py-2 text-rose-600" onClick={() => confirm('¿Quitar el QR de cobro?') && db.config.update('general', { qrPago: undefined })}><Trash2 size={16} /> Quitar</button>
            </div>
          </div>
        </div>
      ) : (
        <>
          <ol className="list-decimal space-y-1 pl-5 text-sm text-slate-600">
            <li>En la app de tu banco, busca la opción para <b>cobrar con QR</b> o "Mi QR".</li>
            <li>Toma una <b>captura de pantalla</b> del QR (sin monto, así sirve para cualquier cobro).</li>
            <li>Súbela aquí.</li>
          </ol>
          <button className="btn-primary" onClick={() => input.current?.click()}><ImagePlus size={18} /> Subir QR de cobro</button>
        </>
      )}
      <input ref={input} type="file" accept="image/*" hidden onChange={(e) => { subir(e.target.files?.[0]); e.target.value = '' }} />
      {error && <p className="rounded-xl bg-rose-50 p-3 text-sm text-rose-700">{error}</p>}
      <p className="text-xs text-slate-500">El QR se guarda con tus datos en la nube, así aparece en todos tus dispositivos.</p>
    </div>
  )
}
