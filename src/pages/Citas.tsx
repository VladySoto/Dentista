import { useLiveQuery } from 'dexie-react-hooks'
import { CalendarDays, ChevronLeft, ChevronRight, MessageCircle, Plus, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { Link } from 'react-router-dom'
import PacienteSelector from '../components/PacienteSelector'
import { Campo, Encabezado, Modal, Vacio } from '../components/ui'
import { avisoWhatsApp, db, hoy, varsPlantilla, type Cita, type EstadoCita } from '../lib/db'
import { fechaLarga } from '../lib/format'
import { useConfig } from '../lib/useConfig'

const ESTADO: Record<EstadoCita, { label: string; cls: string }> = {
  pendiente: { label: 'Pendiente', cls: 'bg-slate-100 text-slate-600' },
  confirmada: { label: 'Confirmada', cls: 'bg-sky-100 text-sky-700' },
  llego: { label: 'Llegó', cls: 'bg-emerald-100 text-emerald-700' },
  cancelada: { label: 'Cancelada', cls: 'bg-rose-100 text-rose-700' },
}

function moverDia(fecha: string, dias: number) {
  const d = new Date(fecha + 'T00:00'); d.setDate(d.getDate() + dias); return hoy(d)
}

export default function Citas() {
  const config = useConfig()
  const [fecha, setFecha] = useState(hoy())
  const [modal, setModal] = useState(false)
  const [pacienteId, setPacienteId] = useState<number | null>(null)
  const [form, setForm] = useState({ fecha: hoy(), hora: '09:00', motivo: '' })

  const datos = useLiveQuery(async () => {
    const citas = await db.citas.where('fecha').equals(fecha).sortBy('hora')
    const pacientes = new Map((await db.pacientes.bulkGet(citas.map((c) => c.pacienteId))).filter(Boolean).map((p) => [p!.id!, p!]))
    return { citas, pacientes }
  }, [fecha])
  const proximos = useLiveQuery(async () => {
    const lista = await db.citas.where('fecha').between(hoy(), moverDia(hoy(), 7), true, true).toArray()
    return lista.filter((c) => c.estado !== 'cancelada').reduce<Record<string, number>>((a, c) => ({ ...a, [c.fecha]: (a[c.fecha] ?? 0) + 1 }), {})
  })

  function abrir() { setForm({ fecha, hora: '09:00', motivo: '' }); setPacienteId(null); setModal(true) }
  async function guardar() {
    if (!pacienteId) return
    await db.citas.add({ pacienteId, ...form, motivo: form.motivo.trim() || undefined, estado: 'pendiente' })
    setFecha(form.fecha); setModal(false)
  }
  const cambiarEstado = (c: Cita, estado: EstadoCita) => db.citas.update(c.id!, { estado })

  function recordatorio(c: Cita) {
    const p = datos?.pacientes.get(c.pacienteId)
    return avisoWhatsApp(p, config.plantillas.cita, { ...varsPlantilla(config, p), fecha: fechaLarga(c.fecha), hora: c.hora })
  }

  const dias = Array.from({ length: 7 }, (_, i) => moverDia(hoy(), i))

  return (
    <>
      <Encabezado titulo="Citas" sub="Para pacientes que reservan con anticipación"
        accion={<button className="btn-primary" onClick={abrir} aria-label="Nueva cita"><Plus size={18} /><span className="hidden sm:inline">Nueva cita</span></button>} />

      <div className="-mx-4 mb-4 flex gap-2 overflow-x-auto px-4 pb-1 md:mx-0 md:px-0">
        {dias.map((d) => {
          const dt = new Date(d + 'T00:00')
          return (
            <button key={d} onClick={() => setFecha(d)}
              className={`flex min-w-[3.6rem] flex-col items-center rounded-2xl border px-2 py-2 transition ${fecha === d ? 'border-teal-600 bg-teal-600 text-white' : 'border-slate-200 bg-white'}`}>
              <span className="text-[11px] uppercase opacity-75">{dt.toLocaleDateString('es', { weekday: 'short' })}</span>
              <span className="text-lg font-bold">{dt.getDate()}</span>
              <span className={`h-1.5 w-1.5 rounded-full ${proximos?.[d] ? (fecha === d ? 'bg-white' : 'bg-teal-500') : 'bg-transparent'}`} />
            </button>
          )
        })}
      </div>

      <div className="mb-4 flex items-center justify-between">
        <button className="btn-ghost p-2" onClick={() => setFecha(moverDia(fecha, -1))} aria-label="Día anterior"><ChevronLeft /></button>
        <label className="relative cursor-pointer text-center font-semibold first-letter:uppercase">
          {fechaLarga(fecha)}
          <input type="date" className="absolute inset-0 opacity-0" value={fecha} onChange={(e) => e.target.value && setFecha(e.target.value)} />
        </label>
        <button className="btn-ghost p-2" onClick={() => setFecha(moverDia(fecha, 1))} aria-label="Día siguiente"><ChevronRight /></button>
      </div>

      {datos?.citas.length === 0 ? (
        <Vacio icono={<CalendarDays size={28} />} titulo="Sin citas este día" accion={<button className="btn-soft" onClick={abrir}><Plus size={18} /> Agendar cita</button>} />
      ) : (
        <div className="escalonado space-y-2">
          {datos?.citas.map((c) => {
            const p = datos.pacientes.get(c.pacienteId)
            const wa = recordatorio(c)
            return (
              <div key={c.id} className={`card p-3 ${c.estado === 'cancelada' ? 'opacity-60' : ''}`}>
                <div className="flex items-center gap-3">
                  <span className="w-14 text-center text-lg font-bold text-teal-700">{c.hora}</span>
                  <Link to={`/pacientes/${c.pacienteId}`} className="min-w-0 flex-1">
                    <p className="truncate font-semibold">{p?.nombre}</p>
                    {c.motivo && <p className="truncate text-xs text-slate-500">{c.motivo}</p>}
                  </Link>
                  <span className={`chip ${ESTADO[c.estado].cls}`}>{ESTADO[c.estado].label}</span>
                </div>
                <div className="mt-2 flex flex-wrap items-center gap-1 border-t border-slate-100 pt-2">
                  <select className="rounded-lg border-0 bg-slate-50 py-1.5 pl-2 pr-7 text-xs font-medium" value={c.estado} onChange={(e) => cambiarEstado(c, e.target.value as EstadoCita)}>
                    {Object.entries(ESTADO).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                  </select>
                  {wa && <a href={wa} target="_blank" rel="noreferrer" className="btn-ghost px-2.5 py-1.5 text-xs"><MessageCircle size={15} /> Recordar</a>}
                  <button className="btn-ghost ml-auto px-2.5 py-1.5 text-xs text-rose-600" onClick={() => confirm('¿Eliminar cita?') && db.citas.delete(c.id!)}><Trash2 size={15} /></button>
                </div>
              </div>
            )
          })}
        </div>
      )}

      <Modal abierto={modal} onCerrar={() => setModal(false)} titulo="Nueva cita">
        {!pacienteId ? <PacienteSelector onElegir={setPacienteId} /> : (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <Campo label="Fecha"><input className="input" type="date" value={form.fecha} onChange={(e) => setForm({ ...form, fecha: e.target.value })} /></Campo>
              <Campo label="Hora"><input className="input" type="time" value={form.hora} onChange={(e) => setForm({ ...form, hora: e.target.value })} /></Campo>
            </div>
            <Campo label="Motivo"><input className="input" value={form.motivo} onChange={(e) => setForm({ ...form, motivo: e.target.value })} /></Campo>
            <button className="btn-primary w-full" onClick={guardar}>Agendar</button>
          </div>
        )}
      </Modal>
    </>
  )
}
