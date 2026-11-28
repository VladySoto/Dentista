import { useLiveQuery } from 'dexie-react-hooks'
import { Camera, CloudUpload, ExternalLink, ImagePlus, Loader2, ScanLine, Trash2, X } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { borrarImagen, guardarImagen, obtenerImagen } from '../lib/archivos'
import { db, type Archivo, type TipoArchivo } from '../lib/db'
import { fechaCorta, hora } from '../lib/format'
import { Vacio } from './ui'
import { confirmar } from '../lib/dialogo'

const TIPOS: Record<TipoArchivo, string> = { foto: 'Foto', radiografia: 'Radiografía' }

export default function Galeria({ pacienteId }: { pacienteId: number }) {
  const archivos = useLiveQuery(() => db.archivos.where('pacienteId').equals(pacienteId).reverse().sortBy('fecha'), [pacienteId])
  const pendientes = useLiveQuery(async () => new Set((await db.archivosLocal.where('subido').equals(0).primaryKeys()) as number[]), [])
  const [tipo, setTipo] = useState<TipoArchivo>('foto')
  const [nota, setNota] = useState('')
  const [guardando, setGuardando] = useState(0)
  const [error, setError] = useState('')
  const [abierto, setAbierto] = useState<Archivo | null>(null)
  const camara = useRef<HTMLInputElement>(null)
  const galeria = useRef<HTMLInputElement>(null)

  async function agregar(files: FileList | null) {
    if (!files?.length) return
    setError('')
    setGuardando(files.length)
    for (const f of Array.from(files)) {
      try { await guardarImagen(pacienteId, f, tipo, nota) } catch (e) { setError((e as Error).message) }
      setGuardando((n) => n - 1)
    }
    setNota('')
  }

  // Agrupa por día
  const grupos = new Map<string, Archivo[]>()
  for (const a of archivos ?? []) {
    const k = fechaCorta(a.fecha)
    grupos.set(k, [...(grupos.get(k) ?? []), a])
  }

  return (
    <div>
      <div className="card mb-4 space-y-3 p-4">
        <div className="grid grid-cols-2 rounded-xl bg-slate-100 p-1">
          {(Object.keys(TIPOS) as TipoArchivo[]).map((k) => (
            <button key={k} onClick={() => setTipo(k)}
              className={`flex items-center justify-center gap-1.5 rounded-lg py-2 text-sm font-semibold ${tipo === k ? 'bg-white text-teal-700 shadow-sm' : 'text-slate-600'}`}>
              {k === 'foto' ? <Camera size={16} /> : <ScanLine size={16} />} {TIPOS[k]}
            </button>
          ))}
        </div>
        <input className="input" placeholder="Nota (opcional): ej. pieza 36 antes del tratamiento" value={nota} onChange={(e) => setNota(e.target.value)} />
        <div className="grid grid-cols-2 gap-2">
          <button className="btn-primary" onClick={() => camara.current?.click()} disabled={guardando > 0}><Camera size={18} /> Tomar foto</button>
          <button className="btn-soft" onClick={() => galeria.current?.click()} disabled={guardando > 0}><ImagePlus size={18} /> Subir imagen</button>
        </div>
        <input ref={camara} type="file" accept="image/*" capture="environment" hidden onChange={(e) => { agregar(e.target.files); e.target.value = '' }} />
        <input ref={galeria} type="file" accept="image/*" multiple hidden onChange={(e) => { agregar(e.target.files); e.target.value = '' }} />
        {guardando > 0 && <p className="flex items-center gap-2 text-sm text-teal-700"><Loader2 size={16} className="animate-spin" /> Guardando {guardando} imagen(es)…</p>}
        {error && <p className="rounded-xl bg-rose-50 p-3 text-sm text-rose-700">{error}</p>}
      </div>

      {archivos?.length === 0 ? (
        <Vacio icono={<Camera size={28} />} titulo="Sin fotos ni radiografías"
          texto="Toma fotos del antes y después, o sube radiografías escaneadas o fotografiadas." />
      ) : (
        <div className="space-y-5">
          {[...grupos].map(([dia, lista]) => (
            <section key={dia}>
              <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-500">{dia}</h3>
              <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
                {lista.map((a) => (
                  <button key={a.id} onClick={() => setAbierto(a)} className="group relative aspect-square overflow-hidden rounded-xl bg-slate-200">
                    <img src={a.miniatura} alt={a.nota || TIPOS[a.tipo]} className="h-full w-full object-cover transition group-hover:scale-105" />
                    <span className={`absolute left-1.5 top-1.5 chip ${a.tipo === 'radiografia' ? 'bg-slate-900/70 text-white' : 'bg-white/85 text-slate-700'}`}>{TIPOS[a.tipo]}</span>
                    {pendientes?.has(a.id!) && <span className="absolute bottom-1.5 right-1.5 rounded-full bg-amber-400 p-1 text-amber-950" title="Pendiente de subir a la nube"><CloudUpload size={12} /></span>}
                  </button>
                ))}
              </div>
            </section>
          ))}
        </div>
      )}

      {abierto && <Visor archivo={abierto} onCerrar={() => setAbierto(null)} />}
    </div>
  )
}

function Visor({ archivo, onCerrar }: { archivo: Archivo; onCerrar: () => void }) {
  const [url, setUrl] = useState<string>()
  const [error, setError] = useState('')

  useEffect(() => {
    let u: string | undefined
    obtenerImagen(archivo).then((b) => { u = URL.createObjectURL(b); setUrl(u) }).catch((e) => setError(e.message))
    const esc = (e: KeyboardEvent) => e.key === 'Escape' && onCerrar()
    document.addEventListener('keydown', esc)
    return () => { if (u) URL.revokeObjectURL(u); document.removeEventListener('keydown', esc) }
  }, [archivo, onCerrar])

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-black/95 text-white">
      <div className="flex items-center gap-2 p-3">
        <div className="min-w-0 flex-1">
          <p className="font-semibold">{TIPOS[archivo.tipo]} · {fechaCorta(archivo.fecha)} {hora(archivo.fecha)}</p>
          {archivo.nota && <p className="truncate text-sm text-slate-300">{archivo.nota}</p>}
        </div>
        {url && <a href={url} target="_blank" rel="noreferrer" className="btn px-3 py-2 text-white hover:bg-white/10" aria-label="Abrir en tamaño completo"><ExternalLink size={20} /></a>}
        <button className="btn px-3 py-2 text-rose-300 hover:bg-white/10" aria-label="Eliminar"
          onClick={async () => { if (await confirmar({ titulo: '¿Eliminar esta imagen?', texto: 'También se borrará de la nube.', si: 'Eliminar', peligro: true })) { await borrarImagen(archivo.id!); onCerrar() } }}>
          <Trash2 size={20} />
        </button>
        <button className="btn px-3 py-2 text-white hover:bg-white/10" onClick={onCerrar} aria-label="Cerrar"><X size={24} /></button>
      </div>
      <div className="flex min-h-0 flex-1 items-center justify-center overflow-auto p-2">
        {url ? <img src={url} alt={archivo.nota || TIPOS[archivo.tipo]} className="max-h-full max-w-full object-contain" />
          : error ? <div className="max-w-sm text-center"><img src={archivo.miniatura} alt="" className="mx-auto mb-4 w-48 rounded-xl opacity-60" /><p className="text-sm text-slate-300">{error}</p></div>
          : <Loader2 size={36} className="animate-spin text-slate-500" />}
      </div>
    </div>
  )
}
