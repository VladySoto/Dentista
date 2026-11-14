import { useState } from 'react'
import type { EstadoDiente } from '../lib/db'

export const ESTADOS: Record<EstadoDiente, { label: string; color: string; marca?: string }> = {
  sano: { label: 'Sano', color: 'bg-white border-slate-300 text-slate-500' },
  caries: { label: 'Caries', color: 'bg-rose-500 border-rose-600 text-white' },
  obturado: { label: 'Obturado', color: 'bg-sky-500 border-sky-600 text-white' },
  endodoncia: { label: 'Endodoncia', color: 'bg-violet-500 border-violet-600 text-white' },
  corona: { label: 'Corona', color: 'bg-amber-400 border-amber-500 text-amber-950' },
  implante: { label: 'Implante', color: 'bg-emerald-500 border-emerald-600 text-white' },
  extraido: { label: 'Extraído', color: 'bg-slate-200 border-slate-400 text-slate-500', marca: '✕' },
  ausente: { label: 'Ausente', color: 'bg-slate-100 border-dashed border-slate-300 text-slate-300' },
}

// Numeración FDI (adulto), vista del profesional
const SUP = [18, 17, 16, 15, 14, 13, 12, 11, 21, 22, 23, 24, 25, 26, 27, 28]
const INF = [48, 47, 46, 45, 44, 43, 42, 41, 31, 32, 33, 34, 35, 36, 37, 38]

export default function Odontograma({ dientes, onCambiar }: {
  dientes: Record<number, EstadoDiente>; onCambiar: (d: Record<number, EstadoDiente>) => void
}) {
  const [herramienta, setHerramienta] = useState<EstadoDiente>('caries')
  const [ultimo, setUltimo] = useState({ n: 0, c: 0 })

  const marcar = (n: number) => {
    const actual = dientes[n] ?? 'sano'
    const nuevo = { ...dientes }
    if (actual === herramienta) delete nuevo[n]
    else nuevo[n] = herramienta
    onCambiar(nuevo)
    setUltimo((u) => ({ n, c: u.c + 1 }))
  }

  const fila = (nums: number[], arriba: boolean) => (
    <div className="grid grid-cols-[repeat(8,minmax(0,1fr))_4px_repeat(8,minmax(0,1fr))] gap-0.5 sm:grid-cols-[repeat(8,minmax(0,1fr))_8px_repeat(8,minmax(0,1fr))] sm:gap-1">
      {nums.map((n, i) => {
        const e = ESTADOS[dientes[n] ?? 'sano']
        return [
          i === 8 && <span key="sep" className="border-l border-dashed border-slate-300" />,
          <button key={n} type="button" onClick={() => marcar(n)} aria-label={`Diente ${n}`}
            className="flex flex-col items-center gap-0.5">
            {arriba && <span className="text-[9px] text-slate-400 sm:text-[10px]">{n}</span>}
            <span key={ultimo.n === n ? ultimo.c : 0}
              className={`flex aspect-[3/4] w-full items-center justify-center border-2 text-[10px] font-bold transition duration-200 hover:-translate-y-0.5 active:scale-90 ${ultimo.n === n ? 'diente-pop' : ''} ${arriba ? 'rounded-b-[45%] rounded-t-md' : 'rounded-t-[45%] rounded-b-md'} ${e.color}`}>
              {e.marca}
            </span>
            {!arriba && <span className="text-[9px] text-slate-400 sm:text-[10px]">{n}</span>}
          </button>,
        ]
      })}
    </div>
  )

  const conteo = Object.values(dientes).reduce<Record<string, number>>((a, e) => ({ ...a, [e]: (a[e] ?? 0) + 1 }), {})

  return (
    <div>
      <p className="mb-2 text-xs text-slate-500">Elige un estado y toca los dientes. Tocar de nuevo lo deja como sano.</p>
      <div className="mb-4 flex flex-wrap gap-1.5">
        {(Object.keys(ESTADOS) as EstadoDiente[]).filter((k) => k !== 'sano').map((k) => (
          <button key={k} type="button" onClick={() => setHerramienta(k)}
            className={`chip border py-1 transition ${herramienta === k ? 'ring-2 ring-teal-500 ring-offset-1' : ''} ${ESTADOS[k].color}`}>
            {ESTADOS[k].label}{conteo[k] ? <> · <span key={conteo[k]} className="salto">{conteo[k]}</span></> : ''}
          </button>
        ))}
      </div>
      <div className="space-y-3 overflow-x-auto rounded-2xl bg-slate-50 p-2 sm:p-4">
        {fila(SUP, true)}
        <div className="border-t border-dashed border-slate-300" />
        {fila(INF, false)}
      </div>
    </div>
  )
}
