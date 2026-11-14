import { useLiveQuery } from 'dexie-react-hooks'
import { AlertTriangle, ChevronRight, Search, UserPlus, Users } from 'lucide-react'
import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import PacienteForm from '../components/PacienteForm'
import { Avatar, Encabezado, Modal, Vacio } from '../components/ui'
import { db } from '../lib/db'
import { edad, normalizar } from '../lib/format'

export default function Pacientes() {
  const [q, setQ] = useState('')
  const [nuevo, setNuevo] = useState(false)
  const navigate = useNavigate()
  const total = useLiveQuery(() => db.pacientes.count())
  const lista = useLiveQuery(async () => {
    const t = normalizar(q.trim())
    const todos = await db.pacientes.orderBy('nombre').toArray()
    return t ? todos.filter((p) => normalizar(p.nombre).includes(t) || p.documento?.includes(t) || p.telefono?.includes(t)) : todos
  }, [q])

  return (
    <>
      <Encabezado titulo="Pacientes" sub={total !== undefined ? `${total} registrados` : ''}
        accion={<button className="btn-primary" onClick={() => setNuevo(true)} aria-label="Nuevo paciente"><UserPlus size={18} /><span className="hidden sm:inline">Nuevo paciente</span></button>} />

      <div className="relative mb-4">
        <Search size={18} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
        <input className="input pl-10" placeholder="Buscar por nombre, CI o teléfono…" value={q} onChange={(e) => setQ(e.target.value)} />
      </div>

      {lista && lista.length === 0 ? (
        <Vacio icono={<Users size={28} />} titulo={q ? 'Sin resultados' : 'Aún no hay pacientes'}
          texto={q ? undefined : 'Registra tu primer paciente para empezar su historial clínico.'}
          accion={!q && <button className="btn-primary" onClick={() => setNuevo(true)}><UserPlus size={18} /> Nuevo paciente</button>} />
      ) : (
        <div className="escalonado card divide-y divide-slate-100 overflow-hidden">
          {lista?.map((p) => {
            const e = edad(p.fechaNacimiento)
            return (
              <Link key={p.id} to={`/pacientes/${p.id}`} className="flex items-center gap-3 p-3 hover:bg-slate-50">
                <Avatar nombre={p.nombre} />
                <div className="min-w-0 flex-1">
                  <p className="flex items-center gap-1.5 truncate font-semibold">
                    {p.nombre}{(p.alergias || p.enfermedades) && <AlertTriangle size={14} className="shrink-0 text-amber-500" />}
                  </p>
                  <p className="truncate text-sm text-slate-500">
                    {[e !== null && `${e} años`, p.documento && `CI ${p.documento}`, p.telefono].filter(Boolean).join(' · ') || '—'}
                  </p>
                </div>
                <ChevronRight size={18} className="text-slate-300" />
              </Link>
            )
          })}
        </div>
      )}

      <Modal abierto={nuevo} onCerrar={() => setNuevo(false)} titulo="Nuevo paciente">
        <PacienteForm onGuardado={(id) => navigate(`/pacientes/${id}`)} />
      </Modal>
    </>
  )
}
