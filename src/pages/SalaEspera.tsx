import { useLiveQuery } from 'dexie-react-hooks'
import { AlertTriangle, Banknote, CalendarCheck, CheckCircle2, ChevronRight, Megaphone, Play, Plus, Users, X } from 'lucide-react'
import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import PacienteSelector from '../components/PacienteSelector'
import { Avatar, Encabezado, Modal, Vacio } from '../components/ui'
import { db, hoy, llamarSiguiente, registrarLlegada, type Paciente, type Turno } from '../lib/db'
import { dinero, duracion, fechaLarga, hora, minutosDesde } from '../lib/format'
import { useAhora } from '../lib/useAhora'

export default function SalaEspera() {
  const ahora = useAhora()
  const navigate = useNavigate()
  const fecha = hoy()
  const [modal, setModal] = useState(false)
  const [elegido, setElegido] = useState<number | null>(null)
  const [motivo, setMotivo] = useState('')
  const [ticket, setTicket] = useState<number | null>(null)

  const datos = useLiveQuery(async () => {
    const turnos = await db.turnos.where('fecha').equals(fecha).sortBy('numero')
    const citas = await db.citas.where('fecha').equals(fecha).sortBy('hora')
    const ids = [...new Set([...turnos.map((t) => t.pacienteId), ...citas.map((c) => c.pacienteId)])]
    const pacientes = new Map((await db.pacientes.bulkGet(ids)).filter(Boolean).map((p) => [p!.id!, p!]))
    const inicio = new Date(fecha + 'T00:00').getTime()
    const fin = inicio + 86400000
    const [consultas, pagos] = await Promise.all([
      db.consultas.where('fecha').between(inicio, fin).toArray(),
      db.pagos.where('fecha').between(inicio, fin).toArray(),
    ])
    const cobrado = consultas.reduce((s, c) => s + (c.pagado ?? 0), 0) + pagos.reduce((s, p) => s + p.monto, 0)
    return { turnos, citas, pacientes, cobrado }
  }, [fecha])

  if (!datos) return null
  const { turnos, citas, pacientes, cobrado } = datos
  const espera = turnos.filter((t) => t.estado === 'espera')
  const atencion = turnos.filter((t) => t.estado === 'atencion')
  const atendidos = turnos.filter((t) => t.estado === 'atendido')
  const citasPendientes = citas.filter((c) => c.estado === 'pendiente' || c.estado === 'confirmada')

  function cerrar() { setModal(false); setElegido(null); setMotivo(''); setTicket(null) }

  async function confirmarLlegada() {
    if (!elegido) return
    setTicket(await registrarLlegada(elegido, motivo.trim() || undefined))
  }

  async function llegoCita(citaId: number, pacienteId: number, m?: string) {
    await registrarLlegada(pacienteId, m)
    await db.citas.update(citaId, { estado: 'llego' })
  }

  async function atender(t: Turno) {
    await db.turnos.update(t.id!, { estado: 'atencion', inicio: Date.now() })
    navigate(`/pacientes/${t.pacienteId}`)
  }
  async function siguiente() {
    const t = await llamarSiguiente()
    if (t) navigate(`/pacientes/${t.pacienteId}`)
  }
  const cancelar = (t: Turno) => confirm('¿Quitar de la sala de espera?') && db.turnos.update(t.id!, { estado: 'cancelado' })
  const proximo = espera[0]

  return (
    <>
      <Encabezado titulo="Sala de espera" sub={fechaLarga(Date.now())}
        accion={<button className="btn-primary hidden sm:inline-flex" onClick={() => setModal(true)}><Plus size={18} /> Registrar llegada</button>} />

      <div className="mb-6 grid grid-cols-3 gap-3">
        <Stat icono={<Users size={18} />} valor={espera.length} label="En espera" />
        <Stat icono={<CheckCircle2 size={18} />} valor={atendidos.length} label="Atendidos" />
        <Stat icono={<Banknote size={18} />} valor={`Bs ${dinero(cobrado)}`} label="Cobrado hoy" />
      </div>

      {proximo && atencion.length === 0 && (
        <button onClick={siguiente}
          className="mb-6 flex w-full items-center gap-4 rounded-2xl bg-gradient-to-br from-teal-600 to-cyan-700 p-4 text-left text-white shadow-lg shadow-teal-700/20 transition active:scale-[.99]">
          <div className="rounded-xl bg-white/20 p-3"><Megaphone size={24} /></div>
          <div className="min-w-0 flex-1">
            <p className="text-lg font-bold">Llamar siguiente</p>
            <p className="truncate text-sm text-teal-50">Turno {proximo.numero} · {pacientes.get(proximo.pacienteId)?.nombre}</p>
          </div>
          <ChevronRight size={24} />
        </button>
      )}

      {atencion.length > 0 && (
        <section className="mb-6">
          <Titulo>En atención</Titulo>
          <div className="space-y-2">
            {atencion.map((t) => (
              <TurnoCard key={t.id} t={t} p={pacientes.get(t.pacienteId)} ahora={ahora} activo>
                <Link className="btn-primary" to={`/pacientes/${t.pacienteId}`}>Abrir ficha</Link>
              </TurnoCard>
            ))}
          </div>
        </section>
      )}

      <section className="mb-6">
        <Titulo>Turnos en espera</Titulo>
        {espera.length === 0 ? (
          <Vacio icono={<Users size={28} />} titulo="Nadie en espera"
            texto="Cuando llegue un paciente, regístralo y se le asignará un número de turno automáticamente."
            accion={<button className="btn-primary" onClick={() => setModal(true)}><Plus size={18} /> Registrar llegada</button>} />
        ) : (
          <div className="space-y-2">
            {espera.map((t, i) => (
              <TurnoCard key={t.id} t={t} p={pacientes.get(t.pacienteId)} ahora={ahora} siguiente={i === 0}>
                <button className="btn-ghost p-2.5" onClick={() => cancelar(t)} aria-label="Quitar"><X size={18} /></button>
                <button className={i === 0 && atencion.length > 0 ? 'btn-primary' : 'btn-soft'} onClick={() => atender(t)}><Play size={16} /> Atender</button>
              </TurnoCard>
            ))}
          </div>
        )}
      </section>

      {citasPendientes.length > 0 && (
        <section className="mb-6">
          <Titulo>Citas programadas para hoy</Titulo>
          <div className="card divide-y divide-slate-100">
            {citasPendientes.map((c) => {
              const p = pacientes.get(c.pacienteId)
              return (
                <div key={c.id} className="flex items-center gap-3 p-3">
                  <span className="w-14 text-center font-semibold text-teal-700">{c.hora}</span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium">{p?.nombre}</p>
                    {c.motivo && <p className="truncate text-xs text-slate-500">{c.motivo}</p>}
                  </div>
                  <button className="btn-soft" onClick={() => llegoCita(c.id!, c.pacienteId, c.motivo)}><CalendarCheck size={16} /> Llegó</button>
                </div>
              )
            })}
          </div>
        </section>
      )}

      {atendidos.length > 0 && (
        <section>
          <Titulo>Atendidos hoy</Titulo>
          <div className="card divide-y divide-slate-100">
            {atendidos.map((t) => (
              <Link key={t.id} to={`/pacientes/${t.pacienteId}`} className="flex items-center gap-3 p-3 hover:bg-slate-50">
                <span className="w-10 text-center text-sm font-bold text-slate-400">#{t.numero}</span>
                <p className="min-w-0 flex-1 truncate">{pacientes.get(t.pacienteId)?.nombre}</p>
                <span className="text-xs text-slate-500">{t.fin ? hora(t.fin) : ''}</span>
              </Link>
            ))}
          </div>
        </section>
      )}

      <button onClick={() => setModal(true)} aria-label="Registrar llegada"
        className="fixed bottom-24 right-4 z-30 flex h-14 w-14 items-center justify-center rounded-2xl bg-teal-600 text-white shadow-lg shadow-teal-600/30 active:scale-95 sm:hidden">
        <Plus size={26} />
      </button>

      <Modal abierto={modal} onCerrar={cerrar} titulo={ticket ? 'Turno asignado' : elegido ? 'Motivo de la visita' : 'Registrar llegada'}>
        {ticket ? (
          <div className="py-4 text-center">
            <p className="text-sm text-slate-500">Número de turno</p>
            <p className="my-2 text-7xl font-bold text-teal-600">{ticket}</p>
            <p className="font-medium">{pacientes.get(elegido!)?.nombre ?? ''}</p>
            <p className="mt-1 text-sm text-slate-500">{espera.length > 1 ? `${espera.length - 1} persona(s) antes` : 'Es el siguiente'}</p>
            <button className="btn-primary mt-6 w-full" onClick={cerrar}>Listo</button>
          </div>
        ) : elegido ? (
          <div className="space-y-4">
            <div className="flex flex-wrap gap-2">
              {['Dolor', 'Control', 'Limpieza', 'Extracción', 'Curación', 'Ortodoncia', 'Urgencia'].map((m) => (
                <button key={m} type="button" onClick={() => setMotivo(m)}
                  className={`chip border px-3 py-1.5 text-sm ${motivo === m ? 'border-teal-600 bg-teal-600 text-white' : 'border-slate-200 bg-white text-slate-600'}`}>{m}</button>
              ))}
            </div>
            <input className="input" placeholder="U otro motivo…" value={motivo} onChange={(e) => setMotivo(e.target.value)} />
            <button className="btn-primary w-full" onClick={confirmarLlegada}>Asignar turno</button>
          </div>
        ) : (
          <PacienteSelector onElegir={setElegido} />
        )}
      </Modal>
    </>
  )
}

function Stat({ icono, valor, label }: { icono: React.ReactNode; valor: React.ReactNode; label: string }) {
  return (
    <div className="card p-3 sm:p-4">
      <div className="mb-1 text-teal-600">{icono}</div>
      <p className="text-xl font-bold sm:text-2xl">{valor}</p>
      <p className="text-xs text-slate-500">{label}</p>
    </div>
  )
}

const Titulo = ({ children }: { children: React.ReactNode }) =>
  <h2 className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-500">{children}</h2>

function TurnoCard({ t, p, ahora, activo, siguiente, children }: {
  t: Turno; p?: Paciente; ahora: number; activo?: boolean; siguiente?: boolean; children: React.ReactNode
}) {
  const min = minutosDesde(activo ? t.inicio! : t.llegada, ahora)
  const tieneAlerta = !!(p?.alergias || p?.enfermedades)
  return (
    <div className={`card flex items-center gap-3 p-3 ${activo ? 'border-teal-300 bg-teal-50/60 ring-1 ring-teal-200' : siguiente ? 'border-teal-200' : ''}`}>
      <div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl text-lg font-bold ${activo || siguiente ? 'bg-teal-600 text-white' : 'bg-slate-100 text-slate-600'}`}>
        {t.numero}
      </div>
      <Link to={`/pacientes/${t.pacienteId}`} className="min-w-0 flex-1">
        <p className="flex items-center gap-1.5 truncate font-semibold">
          {p?.nombre ?? '…'}
          {tieneAlerta && <AlertTriangle size={15} className="shrink-0 text-amber-500" />}
        </p>
        <p className="truncate text-xs text-slate-500">
          {t.motivo && <>{t.motivo} · </>}
          {activo ? `En consultorio hace ${duracion(min)}` : `Llegó ${hora(t.llegada)} · espera ${duracion(min)}`}
        </p>
      </Link>
      <div className="flex shrink-0 items-center gap-1">{children}</div>
    </div>
  )
}
