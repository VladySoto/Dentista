import { useLiveQuery } from 'dexie-react-hooks'
import { Check, ChevronRight, Search, SkipForward, UserPlus, UserX } from 'lucide-react'
import { useState } from 'react'
import { db, type MetodoPago, type Turno } from '../lib/db'
import { dinero, normalizar } from '../lib/format'
import { MetodoSelector } from './Cobro'
import { Avatar } from './ui'

/**
 * Identificar al paciente de un turno en un toque: buscar, crear solo con el nombre,
 * o seguir sin nombre. Nada es obligatorio.
 */
export function IdentificarTurno({ turno, onElegir, onSinNombre, onNoVino }: {
  turno: Turno
  onElegir: (pacienteId: number) => void
  /** Si se pasa, aparece "Atender sin nombre". */
  onSinNombre?: () => void
  /** Si se pasa, aparece "No vino" (la ficha llamada no se presentó). */
  onNoVino?: () => void
}) {
  const [q, setQ] = useState('')
  const texto = q.trim()
  const resultados = useLiveQuery(async () => {
    const t = normalizar(texto)
    if (t.length < 2) return []
    const todos = await db.pacientes.toArray()
    return todos.filter((p) => normalizar(p.nombre).includes(t) || p.documento?.includes(t) || p.telefono?.includes(t)).slice(0, 6)
  }, [texto])

  async function crear(nombre: string, extra?: { documento?: string; telefono?: string }) {
    const id = (await db.pacientes.add({ nombre: nombre.trim(), creado: Date.now(), ...extra })) as number
    onElegir(id)
  }

  const verbo = onSinNombre ? ' y atender' : ''
  const sugerido = turno.nombreLlegada
  const puedeCrear = /[a-záéíóúñ]{2}/i.test(texto) && !resultados?.some((p) => normalizar(p.nombre) === normalizar(texto))

  return (
    <div className="space-y-3">
      {sugerido && (
        <button onClick={() => crear(sugerido, { documento: turno.documentoLlegada, telefono: turno.telefonoLlegada })}
          className="flex w-full items-center gap-3 rounded-2xl bg-teal-700 p-4 text-left text-white shadow-sm active:scale-[.99]">
          <UserPlus size={22} className="shrink-0" />
          <span className="min-w-0 flex-1">
            <span className="block font-semibold">Crear «{sugerido}»{verbo}</span>
            <span className="block truncate text-xs text-teal-50">{[turno.documentoLlegada && `CI ${turno.documentoLlegada}`, turno.telefonoLlegada].filter(Boolean).join(' · ') || 'Con los datos que escribió al tomar turno'}</span>
          </span>
          <ChevronRight size={20} />
        </button>
      )}

      <div className="relative">
        <Search size={18} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" />
        <input className="input pl-10 text-base" placeholder={sugerido ? 'O busca por nombre o carnet…' : 'Nombre o carnet…'} value={q}
          onChange={(e) => setQ(e.target.value)} autoFocus={!sugerido}
          onKeyDown={(e) => { if (e.key === 'Enter' && puedeCrear && !resultados?.length) crear(texto) }} />
      </div>

      {resultados && resultados.length > 0 && (
        <div className="divide-y divide-slate-100 rounded-xl border border-slate-200">
          {resultados.map((p) => (
            <button key={p.id} onClick={() => onElegir(p.id!)} className="flex w-full items-center gap-3 px-3 py-2.5 text-left hover:bg-slate-50">
              <Avatar nombre={p.nombre} size="sm" />
              <span className="min-w-0 flex-1">
                <span className="block truncate font-medium">{p.nombre}</span>
                <span className="block truncate text-xs text-slate-500">{[p.documento && `CI ${p.documento}`, p.telefono].filter(Boolean).join(' · ')}</span>
              </span>
            </button>
          ))}
        </div>
      )}

      {puedeCrear && (
        <button onClick={() => crear(texto)} className="btn-soft w-full justify-start">
          <UserPlus size={18} /> Crear «{texto}»{verbo}
        </button>
      )}

      {onSinNombre && (
        <button onClick={onSinNombre} className="btn-ghost w-full border border-dashed border-slate-300">
          <UserX size={18} /> Atender sin nombre
        </button>
      )}
      {onNoVino && (
        <button onClick={onNoVino} className="btn-ghost w-full text-slate-500">
          <SkipForward size={18} /> No vino: llamar la ficha {turno.numero + 1}
        </button>
      )}
      <p className="text-center text-xs text-slate-500">Los datos completos se pueden agregar después en la ficha.</p>
    </div>
  )
}

/** Terminar una atención sin nombre: qué se hizo y cuánto pagó, en segundos. */
export function TerminarSinNombre({ turno, siguienteFicha, onListo }: {
  turno: Turno
  /** Número de la ficha que se llamaría después (0 = no ofrecer). */
  siguienteFicha: number
  onListo: (siguiente: boolean) => void
}) {
  const tratamientos = useLiveQuery(() => db.tratamientos.orderBy('nombre').toArray(), [])
  const [elegidos, setElegidos] = useState<string[]>([])
  const [costo, setCosto] = useState('')
  const [pagado, setPagado] = useState<string | null>(null)
  const [metodo, setMetodo] = useState<MetodoPago>('efectivo')

  function alternar(nombre: string, precio: number) {
    const quitar = elegidos.includes(nombre)
    setElegidos(quitar ? elegidos.filter((n) => n !== nombre) : [...elegidos, nombre])
    setCosto(String(Math.max(0, (Number(costo) || 0) + (quitar ? -precio : precio))))
  }

  const c = Number(costo) || 0
  const p = pagado === null ? c : Number(pagado) || 0

  async function terminar(siguiente: boolean) {
    await db.turnos.update(turno.id!, {
      estado: 'atendido', fin: Date.now(),
      cobro: c > 0 || p > 0 ? { costo: c, pagado: p, concepto: elegidos.join(', ') || turno.motivo, metodo: p > 0 ? metodo : undefined } : undefined,
    })
    onListo(siguiente)
  }

  return (
    <div className="space-y-4">
      {tratamientos && tratamientos.length > 0 && (
        <div>
          <span className="label">¿Qué se hizo? (opcional)</span>
          <div className="flex flex-wrap gap-1.5">
            {tratamientos.map((t) => {
              const on = elegidos.includes(t.nombre)
              return (
                <button key={t.id} type="button" onClick={() => alternar(t.nombre, t.precio)}
                  className={`chip border px-3 py-1.5 text-sm ${on ? 'border-teal-700 bg-teal-700 text-white' : 'border-slate-200 bg-white text-slate-700'}`}>
                  {on && <Check size={14} />}{t.nombre} <span className={on ? 'text-teal-100' : 'text-slate-500'}>{dinero(t.precio)}</span>
                </button>
              )
            })}
          </div>
        </div>
      )}
      <div className="grid grid-cols-2 gap-3">
        <label className="block"><span className="label">Costo (Bs)</span>
          <input className="input" type="number" min="0" inputMode="decimal" value={costo} onChange={(e) => setCosto(e.target.value)} /></label>
        <label className="block"><span className="label">Pagó (Bs)</span>
          <input className="input" type="number" min="0" inputMode="decimal" value={pagado ?? costo} onChange={(e) => setPagado(e.target.value)} /></label>
      </div>
      {p > 0 && <MetodoSelector valor={metodo} onChange={setMetodo} />}
      {c > p && <p className="text-sm font-semibold text-rose-600">Queda debiendo Bs {dinero(c - p)}: ponle nombre para guardarlo en su ficha.</p>}
      <div className="space-y-2 pt-1">
        {siguienteFicha > 0 && (
          <button className="btn-primary w-full py-3.5" onClick={() => terminar(true)}>
            Terminar y llamar ficha {siguienteFicha} <ChevronRight size={18} />
          </button>
        )}
        <button className={`${siguienteFicha > 0 ? 'btn-soft' : 'btn-primary'} w-full`} onClick={() => terminar(false)}>Terminar</button>
      </div>
    </div>
  )
}
