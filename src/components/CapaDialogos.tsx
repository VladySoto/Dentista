import { AlertTriangle, X } from 'lucide-react'
import { useEffect, useRef } from 'react'
import { cerrarAviso, useDialogos } from '../lib/dialogo'

/** Muestra la pregunta abierta y los avisos. Va una sola vez, en la raíz de la app. */
export default function CapaDialogos() {
  const { pregunta, avisos } = useDialogos()
  const si = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    if (!pregunta) return
    si.current?.focus()
    const esc = (e: KeyboardEvent) => e.key === 'Escape' && pregunta.responder(false)
    document.addEventListener('keydown', esc)
    return () => document.removeEventListener('keydown', esc)
  }, [pregunta])

  return (
    <>
      {pregunta && (
        <div className="fixed inset-0 z-[60] flex items-end justify-center p-4 sm:items-center" role="alertdialog" aria-modal="true" aria-labelledby="dlg-titulo">
          <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={() => pregunta.responder(false)} />
          <div className="relative w-full max-w-sm rounded-3xl bg-white p-5 shadow-2xl">
            <div className="flex gap-3">
              {pregunta.peligro && <div className="h-fit rounded-full bg-rose-100 p-2 text-rose-600"><AlertTriangle size={20} /></div>}
              <div className="min-w-0">
                <h2 id="dlg-titulo" className="text-lg font-semibold">{pregunta.titulo}</h2>
                {pregunta.texto && <p className="mt-1 whitespace-pre-line text-sm text-slate-600">{pregunta.texto}</p>}
              </div>
            </div>
            <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <button className="btn-ghost" onClick={() => pregunta.responder(false)}>{pregunta.no ?? 'Cancelar'}</button>
              <button ref={si} className={pregunta.peligro ? 'btn bg-rose-600 text-white hover:bg-rose-700' : 'btn-primary'} onClick={() => pregunta.responder(true)}>
                {pregunta.si ?? 'Aceptar'}
              </button>
            </div>
          </div>
        </div>
      )}
      <div className="pointer-events-none fixed inset-x-4 bottom-24 z-[55] mx-auto flex max-w-md flex-col gap-2 md:bottom-6" aria-live="polite">
        {avisos.map((a) => (
          <div key={a.id} className="pointer-events-auto flex items-center gap-3 rounded-2xl bg-slate-900 px-4 py-3 text-sm text-white shadow-xl">
            <p className="flex-1">{a.texto}</p>
            {a.accion && (
              <button className="rounded-lg px-2.5 py-1.5 font-semibold text-amber-300 hover:bg-white/10"
                onClick={async () => { cerrarAviso(a.id); await a.accion!.hacer() }}>{a.accion.texto}</button>
            )}
            <button className="rounded-lg p-1 text-slate-300 hover:bg-white/10" aria-label="Cerrar aviso" onClick={() => cerrarAviso(a.id)}><X size={16} /></button>
          </div>
        ))}
      </div>
    </>
  )
}
