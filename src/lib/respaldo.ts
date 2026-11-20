import { useLiveQuery } from 'dexie-react-hooks'
import { db, exportarRespaldo, hoy } from './db'

const SEMANA = 7 * 86400000
const DIA = 86400000

/**
 * Guarda una copia de todos los datos (sin las fotos completas, que están en la nube).
 * En el celular abre el menú de compartir para elegir Google Drive; si no se puede, la descarga.
 * Se comparte como .txt porque los navegadores no permiten compartir archivos .json.
 */
export async function guardarRespaldo(): Promise<'compartido' | 'descargado' | 'cancelado'> {
  const datos = JSON.stringify(await exportarRespaldo())
  const base = `respaldo-consultorio-${hoy()}`
  const archivo = new File([datos], `${base}.txt`, { type: 'text/plain' })
  let resultado: 'compartido' | 'descargado' | 'cancelado' = 'descargado'
  if (navigator.canShare?.({ files: [archivo] })) {
    try {
      await navigator.share({ files: [archivo], title: 'Copia de seguridad del consultorio' })
      resultado = 'compartido'
    } catch (e) {
      if ((e as Error).name === 'AbortError') return 'cancelado'
      resultado = 'descargado'
    }
  }
  if (resultado === 'descargado') {
    const url = URL.createObjectURL(new Blob([datos], { type: 'application/json' }))
    const a = document.createElement('a')
    a.href = url; a.download = `${base}.json`; a.click()
    setTimeout(() => URL.revokeObjectURL(url), 10_000)
  }
  await db.meta.put({ clave: 'ultimoRespaldo', valor: String(Date.now()) })
  await db.meta.delete('posponerRespaldo')
  return resultado
}

export const posponerRespaldo = () => db.meta.put({ clave: 'posponerRespaldo', valor: String(Date.now()) })

/** Fecha de la última copia y si toca recordarla (una vez por semana, si hay pacientes). */
export function useRespaldo() {
  return useLiveQuery(async () => {
    const [ultimo, pospuesto, pacientes] = await Promise.all([db.meta.get('ultimoRespaldo'), db.meta.get('posponerRespaldo'), db.pacientes.count()])
    const u = ultimo ? Number(ultimo.valor) : null
    const p = pospuesto ? Number(pospuesto.valor) : 0
    const ahora = Date.now()
    return { ultimo: u, recordar: pacientes > 0 && (u === null || ahora - u > SEMANA) && ahora - p > DIA }
  }, []) ?? { ultimo: null, recordar: false }
}
