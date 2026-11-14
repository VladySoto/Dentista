import { X } from 'lucide-react'
import { useEffect, type ReactNode } from 'react'
import { iniciales } from '../lib/format'

export function Modal({ abierto, onCerrar, titulo, children }: {
  abierto: boolean; onCerrar: () => void; titulo: string; children: ReactNode
}) {
  useEffect(() => {
    if (!abierto) return
    const fn = (e: KeyboardEvent) => e.key === 'Escape' && onCerrar()
    document.addEventListener('keydown', fn)
    document.body.style.overflow = 'hidden'
    return () => { document.removeEventListener('keydown', fn); document.body.style.overflow = '' }
  }, [abierto, onCerrar])
  if (!abierto) return null
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center sm:p-4">
      <div className="modal-fondo absolute inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={onCerrar} />
      <div className="modal-panel relative flex max-h-[92vh] w-full flex-col rounded-t-3xl bg-white shadow-2xl sm:max-w-lg sm:rounded-3xl">
        <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
          <h2 className="text-lg font-semibold">{titulo}</h2>
          <button className="btn-ghost -mr-2 p-2" onClick={onCerrar} aria-label="Cerrar"><X size={20} /></button>
        </div>
        <div className="overflow-y-auto px-5 py-4 pb-[max(1rem,env(safe-area-inset-bottom))]">{children}</div>
      </div>
    </div>
  )
}

export function Campo({ label, children }: { label: string; children: ReactNode }) {
  return <label className="block"><span className="label">{label}</span>{children}</label>
}

export function Avatar({ nombre, size = 'md' }: { nombre: string; size?: 'sm' | 'md' | 'lg' }) {
  const s = { sm: 'h-9 w-9 text-xs', md: 'h-11 w-11 text-sm', lg: 'h-16 w-16 text-xl' }[size]
  return (
    <div className={`${s} flex shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-teal-400 to-cyan-600 font-bold text-white`}>
      {iniciales(nombre) || '?'}
    </div>
  )
}

export function Vacio({ icono, titulo, texto, accion }: { icono: ReactNode; titulo: string; texto?: string; accion?: ReactNode }) {
  return (
    <div className="card flex flex-col items-center px-6 py-12 text-center">
      <div className="mb-3 rounded-2xl bg-teal-50 p-4 text-teal-600">{icono}</div>
      <p className="font-semibold">{titulo}</p>
      {texto && <p className="mt-1 max-w-sm text-sm text-slate-500">{texto}</p>}
      {accion && <div className="mt-5">{accion}</div>}
    </div>
  )
}

export function Encabezado({ titulo, sub, accion }: { titulo: string; sub?: string; accion?: ReactNode }) {
  return (
    <div className="mb-5 flex items-end justify-between gap-3">
      <div className="min-w-0">
        <h1 className="text-2xl font-bold tracking-tight">{titulo}</h1>
        {sub && <p className="mt-0.5 text-sm text-slate-500 first-letter:uppercase">{sub}</p>}
      </div>
      {accion}
    </div>
  )
}
