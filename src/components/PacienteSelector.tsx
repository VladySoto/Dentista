import { useLiveQuery } from 'dexie-react-hooks'
import { Search, Smartphone, UserPlus } from 'lucide-react'
import { useState } from 'react'
import { db, type Paciente } from '../lib/db'
import { normalizar } from '../lib/format'
import PacienteForm from './PacienteForm'
import { Avatar } from './ui'

/** Busca un paciente existente o crea uno nuevo al vuelo. */
export default function PacienteSelector({ onElegir, sugerido }: {
  onElegir: (id: number) => void
  /** Datos que el paciente escribió al tomar turno por QR: permite registrarlo con un toque. */
  sugerido?: Partial<Paciente>
}) {
  const [q, setQ] = useState('')
  const [nuevo, setNuevo] = useState<Partial<Paciente> | null>(null)
  const resultados = useLiveQuery(async () => {
    const t = normalizar(q.trim())
    const todos = await db.pacientes.orderBy('nombre').toArray()
    if (!t) return todos.slice(0, 8)
    return todos.filter((p) =>
      normalizar(p.nombre).includes(t) || p.documento?.includes(t) || p.telefono?.includes(t)).slice(0, 8)
  }, [q])

  if (nuevo) return (
    <div>
      <button className="btn-ghost -ml-2 mb-2 px-2 py-1 text-xs" onClick={() => setNuevo(null)}>← Volver a buscar</button>
      <PacienteForm nombreInicial={q} datosIniciales={nuevo} onGuardado={onElegir} />
    </div>
  )

  return (
    <div>
      {sugerido?.nombre && (
        <button onClick={() => setNuevo(sugerido)}
          className="mb-4 flex w-full items-center gap-3 rounded-2xl border border-teal-200 bg-teal-50 p-3 text-left hover:bg-teal-100">
          <Smartphone size={20} className="shrink-0 text-teal-700" />
          <span className="min-w-0 flex-1">
            <span className="block text-sm font-semibold text-teal-900">Registrar a “{sugerido.nombre}”</span>
            <span className="block truncate text-xs text-teal-700">
              {[sugerido.documento && `CI ${sugerido.documento}`, sugerido.telefono].filter(Boolean).join(' · ') || 'Datos que escribió al tomar turno'}
            </span>
          </span>
          <UserPlus size={18} className="text-teal-700" />
        </button>
      )}
      <div className="relative">
        <Search size={18} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" />
        <input className="input pl-10" placeholder="Nombre, CI o teléfono…" value={q} onChange={(e) => setQ(e.target.value)} autoFocus />
      </div>
      <div className="mt-3 divide-y divide-slate-100">
        {resultados?.map((p) => (
          <button key={p.id} onClick={() => onElegir(p.id!)} className="flex w-full items-center gap-3 rounded-xl px-2 py-2.5 text-left hover:bg-slate-50">
            <Avatar nombre={p.nombre} size="sm" />
            <div className="min-w-0">
              <p className="truncate font-medium">{p.nombre}</p>
              <p className="truncate text-xs text-slate-500">{[p.documento && `CI ${p.documento}`, p.telefono].filter(Boolean).join(' · ') || 'Sin datos de contacto'}</p>
            </div>
          </button>
        ))}
        {resultados?.length === 0 && <p className="py-4 text-center text-sm text-slate-500">No se encontró “{q}”.</p>}
      </div>
      <button className="btn-soft mt-3 w-full" onClick={() => setNuevo({})}><UserPlus size={18} /> Paciente nuevo</button>
    </div>
  )
}
