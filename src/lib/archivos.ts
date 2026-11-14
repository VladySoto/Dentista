import { db, type Archivo, type TipoArchivo } from './db'
import { supabase } from './supabase'
import { BUCKET, rutaImagen, sincronizar, usuarioActual } from './sync'

const MAX_LADO = 1600
const MAX_MINI = 240

async function cargarImagen(file: Blob): Promise<ImageBitmap | HTMLImageElement> {
  try {
    return await createImageBitmap(file, { imageOrientation: 'from-image' })
  } catch {
    const url = URL.createObjectURL(file)
    try {
      const img = new Image()
      img.src = url
      await img.decode()
      return img
    } finally {
      URL.revokeObjectURL(url)
    }
  }
}

function dibujar(img: ImageBitmap | HTMLImageElement, maxLado: number) {
  const w0 = 'naturalWidth' in img ? img.naturalWidth : img.width
  const h0 = 'naturalHeight' in img ? img.naturalHeight : img.height
  const escala = Math.min(1, maxLado / Math.max(w0, h0))
  const canvas = document.createElement('canvas')
  canvas.width = Math.round(w0 * escala)
  canvas.height = Math.round(h0 * escala)
  const ctx = canvas.getContext('2d')!
  ctx.fillStyle = '#fff'
  ctx.fillRect(0, 0, canvas.width, canvas.height)
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
  return canvas
}

const aBlob = (c: HTMLCanvasElement, calidad: number) =>
  new Promise<Blob>((ok, mal) => c.toBlob((b) => (b ? ok(b) : mal(new Error('No se pudo procesar la imagen'))), 'image/jpeg', calidad))

/** Comprime la foto, la guarda en el dispositivo y la deja lista para subir a la nube. */
export async function guardarImagen(pacienteId: number, file: File, tipo: TipoArchivo, nota?: string) {
  if (!file.type.startsWith('image/')) throw new Error('Solo se pueden guardar imágenes (fotos o radiografías escaneadas).')
  const img = await cargarImagen(file)
  const grande = dibujar(img, MAX_LADO)
  const blob = await aBlob(grande, 0.82)
  const miniatura = dibujar(img, MAX_MINI).toDataURL('image/jpeg', 0.7)
  if ('close' in img) img.close()
  const fecha = file.lastModified && Math.abs(Date.now() - file.lastModified) < 3 * 86400000 ? file.lastModified : Date.now()
  const id = await db.transaction('rw', db.archivos, db.archivosLocal, async () => {
    const id = (await db.archivos.add({
      pacienteId, fecha, tipo, nota: nota?.trim() || undefined, ancho: grande.width, alto: grande.height, bytes: blob.size, miniatura,
    })) as number
    await db.archivosLocal.put({ id, blob, subido: 0 })
    return id
  })
  sincronizar()
  return id
}

/** Imagen completa: la de este dispositivo o, si no está, la descarga de la nube y la guarda. */
export async function obtenerImagen(a: Archivo): Promise<Blob> {
  const local = await db.archivosLocal.get(a.id!)
  if (local) return local.blob
  const uid = usuarioActual()
  if (!uid) throw new Error('Inicia sesión en la nube para ver esta imagen.')
  const { data, error } = await supabase.storage.from(BUCKET).download(rutaImagen(uid, a.id!))
  if (error || !data) throw new Error('La imagen aún no está disponible. Si se tomó en otro dispositivo, puede que todavía se esté subiendo.')
  await db.archivosLocal.put({ id: a.id!, blob: data, subido: 1 })
  return data
}

/** Borra la foto aquí, en la nube y en los demás dispositivos. */
export async function borrarImagen(id: number) {
  await db.transaction('rw', db.archivos, db.archivosLocal, async () => {
    await db.archivos.delete(id)
    await db.archivosLocal.delete(id)
  })
  const uid = usuarioActual()
  if (uid) await supabase.storage.from(BUCKET).remove([rutaImagen(uid, id)]).catch(() => {})
}
