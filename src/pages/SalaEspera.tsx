import { useLiveQuery } from 'dexie-react-hooks'
import {
  AlertTriangle, Banknote, CalendarCheck, CheckCircle2, ChevronRight, Megaphone, Play, Ticket, Undo2, UserPlus, UserSearch, Users, X,
} from 'lucide-react'
import { useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import PacienteSelector from '../components/PacienteSelector'
import { Conteo, Encabezado, Modal, useListaAnimada, Vacio } from '../components/ui'
import { db, hoy, llamarSiguiente, registrarLlegada, type Paciente, type Turno } from '../lib/db'
import { dinero, duracion, fechaLarga, hora, minutosDesde } from '../lib/format'
import { useAhora } from '../lib/useAhora'

export default function SalaEspera() {
  const ahora = useAhora()
  const navigate = useNavigate()
  const [params, setParams] = useSearchParams()
  const fecha = hoy()
  const [modal, setModal] = useState(false)
  const [elegido, setElegido] = useState<number | null>(null)
  const [motivo, setMotivo] = useState('')
  const [ticket, setTicket] = useState<number | null>(null)
  const [aviso, setAviso] = useState<{ numero: number; id: number } | null>(null)
  const [identificar, setIdentificar] = useState<Turno | null>(null)
  const listaEspera = useListaAnimada<HTMLDivElement>()
  const listaCitas = useListaAnimada<HTMLDivElement>()

  const datos = useLiveQuery(async () => {
    const turnos = await db.turnos.where('fecha').equals(fecha).sortBy('numero')
    const citas = await db.citas.where('fecha').equals(fecha).sortBy('hora')
    const ids = [...new Set([...turnos.map((t) => t.pacienteId), ...citas.map((c) => c.pacienteId)])].filter((x): x is number => !!x)
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

  // Viene de "Guardar y llamar siguiente" cuando el siguiente llegó con ficha sin nombre
  const paramIdentificar = Number(params.get('identificar'))
  useEffect(() => {
    if (!paramIdentificar) return
    db.turnos.get(paramIdentificar).then((t) => t && setIdentificar(t))
    setParams({}, { replace: true })
  }, [paramIdentificar, setParams])

  useEffect(() => {
    if (!aviso) return
    const t = setTimeout(() => setAviso(null), 5000)
    return () => clearTimeout(t)
  }, [aviso])

  if (!datos) return null
  const { turnos, citas, pacientes, cobrado } = datos
  const espera = turnos.filter((t) => t.estado === 'espera')
  const atencion = turnos.filter((t) => t.estado === 'atencion')
  const atendidos = turnos.filter((t) => t.estado === 'atendido')
  const citasPendientes = citas.filter((c) => c.estado === 'pendiente' || c.estado === 'confirmada')
  const nombre = (t: Turno) => (t.pacienteId ? pacientes.get(t.pacienteId)?.nombre : undefined) ?? 'Sin identificar'

  function cerrar() { setModal(false); setElegido(null); setMotivo(''); setTicket(null) }

  async function confirmarLlegada() {
    if (!elegido) return
    setTicket(await registrarLlegada(elegido, motivo.trim() || undefined))
  }

  async function llegadaRapida() {
    const numero = await registrarLlegada()
    const t = await db.turnos.where('[fecha+numero]').equals([fecha, numero]).first()
    setAviso({ numero, id: t!.id! })
  }

  async function deshacer() {
    if (!aviso) return
    await db.turnos.delete(aviso.id)
    setAviso(null)
  }

  async function llegoCita(citaId: number, pacienteId: number, m?: string) {
    await registrarLlegada(pacienteId, m)
    await db.citas.update(citaId, { estado: 'llego' })
  }

  /** Abre la ficha; si el turno no tiene nombre, primero pide identificar al paciente. */
  function abrir(t: Turno) {
    if (t.pacienteId) navigate(`/pacientes/${t.pacienteId}`)
    else setIdentificar(t)
  }
  async function atender(t: Turno) {
    const actualizado = { ...t, estado: 'atencion' as const, inicio: Date.now() }
    await db.turnos.update(t.id!, { estado: 'atencion', inicio: actualizado.inicio })
    abrir(actualizado)
  }
  async function siguiente() {
    const t = await llamarSiguiente()
    if (t) abrir(t)
  }
  async function alIdentificar(pacienteId: number) {
    const t = identificar!
    await db.turnos.update(t.id!, { pacienteId })
    setIdentificar(null)
    if (t.estado === 'atencion') navigate(`/pacientes/${pacienteId}`)
  }
  const cancelar = (t: Turno) => confirm('¿Quitar de la sala de espera?') && db.turnos.update(t.id!, { estado: 'cancelado' })
  const proximo = espera[0]

  return (
    <>
      <Encabezado titulo="Sala de espera" sub={fechaLarga(Date.now())} />

      <div className="mb-4 grid grid-cols-3 gap-3">
        <Stat icono={<Users size={18} />} valor={espera.length} label="En espera" />
        <Stat icono={<CheckCircle2 size={18} />} valor={atendidos.length} label="Atendidos" />
        <Stat icono={<Banknote size={18} />} valor={<>Bs <Conteo valor={cobrado} /></>} label="Cobrado hoy" />
      </div>

      <div className="mb-6 grid grid-cols-2 gap-3">
        <button onClick={llegadaRapida} className="card flex items-center gap-3 p-3 text-left transition hover:border-teal-300 active:scale-[.98]">
          <div className="rounded-xl bg-amber-100 p-2.5 text-amber-700"><Ticket size={22} /></div>
          <div className="min-w-0"><p className="font-semibold">+1 llegada</p><p className="text-xs text-slate-500">Con ficha, sin nombre</p></div>
        </button>
        <button onClick={() => setModal(true)} className="card flex items-center gap-3 p-3 text-left transition hover:border-teal-300 active:scale-[.98]">
          <div className="rounded-xl bg-teal-100 p-2.5 text-teal-700"><UserPlus size={22} /></div>
          <div className="min-w-0"><p className="font-semibold">Registrar llegada</p><p className="text-xs text-slate-500">Con nombre</p></div>
        </button>
      </div>

      {proximo && atencion.length === 0 && (
        <button onClick={siguiente}
          className="mb-6 flex w-full items-center gap-4 rounded-2xl bg-gradient-to-br from-teal-600 to-cyan-700 p-4 text-left text-white shadow-lg shadow-teal-700/20 transition active:scale-[.99]">
          <div className="rounded-xl bg-white/20 p-3"><Megaphone size={24} className="meneo" /></div>
          <div className="min-w-0 flex-1">
            <p className="text-lg font-bold">Llamar siguiente</p>
            <p className="truncate text-sm text-teal-50">Turno {proximo.numero} · {nombre(proximo)}</p>
          </div>
          <ChevronRight size={24} />
        </button>
      )}

      {atencion.length > 0 && (
        <section className="mb-6">
          <Titulo>En atención</Titulo>
          <div className="escalonado space-y-2">
            {atencion.map((t) => (
              <TurnoCard key={t.id} t={t} p={t.pacienteId ? pacientes.get(t.pacienteId) : undefined} ahora={ahora} activo onAbrir={() => abrir(t)}>
                <button className="btn-primary" onClick={() => abrir(t)}>{t.pacienteId ? 'Abrir ficha' : 'Identificar'}</button>
              </TurnoCard>
            ))}
          </div>
        </section>
      )}

      <section className="mb-6">
        <Titulo>Turnos en espera</Titulo>
        {espera.length === 0 ? (
          <Vacio icono={<Users size={28} />} titulo="Nadie en espera"
            texto="Si el paciente tomó una ficha de papel, toca “+1 llegada”. Si quieres anotar su nombre, toca “Registrar llegada”." />
        ) : (
          <div ref={listaEspera} className="escalonado relative space-y-2">
            {espera.map((t, i) => (
              <TurnoCard key={t.id} t={t} p={t.pacienteId ? pacientes.get(t.pacienteId) : undefined} ahora={ahora} siguiente={i === 0} onAbrir={() => abrir(t)}>
                <button className="btn-ghost p-2.5" onClick={() => cancelar(t)} aria-label={`Quitar turno ${t.numero}`}><X size={18} /></button>
                <button className={i === 0 && atencion.length > 0 ? 'btn-primary' : 'btn-soft'} onClick={() => atender(t)}><Play size={16} /> Atender</button>
              </TurnoCard>
            ))}
          </div>
        )}
      </section>

      {citasPendientes.length > 0 && (
        <section className="mb-6">
          <Titulo>Citas programadas para hoy</Titulo>
          <div ref={listaCitas} className="escalonado card relative divide-y divide-slate-100 overflow-hidden">
            {citasPendientes.map((c) => (
              <div key={c.id} className="flex items-center gap-3 p-3">
                <span className="w-14 text-center font-semibold text-teal-700">{c.hora}</span>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium">{pacientes.get(c.pacienteId)?.nombre}</p>
                  {c.motivo && <p className="truncate text-xs text-slate-500">{c.motivo}</p>}
                </div>
                <button className="btn-soft" onClick={() => llegoCita(c.id!, c.pacienteId, c.motivo)}><CalendarCheck size={16} /> Llegó</button>
              </div>
            ))}
          </div>
        </section>
      )}

      {atendidos.length > 0 && (
        <section>
          <Titulo>Atendidos hoy</Titulo>
          <div className="escalonado card divide-y divide-slate-100">
            {atendidos.map((t) => (
              <button key={t.id} onClick={() => abrir(t)} className="flex w-full items-center gap-3 p-3 text-left hover:bg-slate-50">
                <span className="w-10 text-center text-sm font-bold text-slate-400">#{t.numero}</span>
                <p className="min-w-0 flex-1 truncate">{nombre(t)}</p>
                <span className="text-xs text-slate-500">{t.fin ? hora(t.fin) : ''}</span>
              </button>
            ))}
          </div>
        </section>
      )}

      {aviso && (
        <div key={aviso.id} className="aviso fixed inset-x-4 bottom-24 z-40 mx-auto flex max-w-md items-center gap-3 overflow-hidden rounded-2xl bg-slate-900 px-4 py-3 text-white shadow-xl md:bottom-6">
          <span aria-hidden className="aviso-barra absolute inset-x-0 bottom-0 h-0.5 bg-amber-300" />
          <Ticket size={20} className="text-amber-300" />
          <p className="flex-1 text-sm">Turno <b className="text-lg">{aviso.numero}</b> agregado</p>
          <button className="btn px-3 py-1.5 text-amber-300 hover:bg-white/10" onClick={deshacer}><Undo2 size={16} /> Deshacer</button>
        </div>
      )}

      <Modal abierto={modal} onCerrar={cerrar} titulo={ticket ? 'Turno asignado' : elegido ? 'Motivo de la visita' : 'Registrar llegada'}>
        {ticket ? (
          <div className="paso py-4 text-center">
            <p className="text-sm text-slate-500">Número de turno</p>
            <p className="pop my-2 text-7xl font-bold text-teal-600">{ticket}</p>
            <p className="font-medium">{pacientes.get(elegido!)?.nombre ?? ''}</p>
            <p className="mt-1 text-sm text-slate-500">{espera.length > 1 ? `${espera.length - 1} persona(s) antes` : 'Es el siguiente'}</p>
            <button className="btn-primary mt-6 w-full" onClick={cerrar}>Listo</button>
          </div>
        ) : elegido ? (
          <div className="paso space-y-4">
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

      <Modal abierto={!!identificar} onCerrar={() => setIdentificar(null)} titulo={`¿Quién tiene el turno ${identificar?.numero ?? ''}?`}>
        <p className="-mt-1 mb-3 flex items-center gap-2 text-sm text-slate-500"><UserSearch size={16} /> Búscalo por nombre o carnet, o regístralo si es nuevo.</p>
        {identificar && <PacienteSelector key={identificar.id} onElegir={alIdentificar} />}
      </Modal>
    </>
  )
}

function Stat({ icono, valor, label }: { icono: React.ReactNode; valor: React.ReactNode; label: string }) {
  return (
    <div className="card p-3 sm:p-4">
      <div className="mb-1 text-teal-600">{icono}</div>
      <p className="text-xl font-bold tabular-nums sm:text-2xl">{typeof valor === 'number' ? <span key={valor} className="salto">{valor}</span> : valor}</p>
      <p className="text-xs text-slate-500">{label}</p>
    </div>
  )
}

const Titulo = ({ children }: { children: React.ReactNode }) =>
  <h2 className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-500">{children}</h2>

function TurnoCard({ t, p, ahora, activo, siguiente, onAbrir, children }: {
  t: Turno; p?: Paciente; ahora: number; activo?: boolean; siguiente?: boolean; onAbrir: () => void; children: React.ReactNode
}) {
  const min = minutosDesde(activo ? t.inicio! : t.llegada, ahora)
  const tieneAlerta = !!(p?.alergias || p?.enfermedades)
  return (
    <div className={`card flex items-center gap-3 p-3 ${activo ? 'border-teal-300 bg-teal-50/60 ring-1 ring-teal-200' : siguiente ? 'border-teal-200' : ''}`}>
      <div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl text-lg font-bold ${activo ? 'latido' : ''} ${activo || siguiente ? 'bg-teal-600 text-white' : 'bg-slate-100 text-slate-600'}`}>
        {t.numero}
      </div>
      <button onClick={onAbrir} className="min-w-0 flex-1 text-left">
        <p className={`flex items-center gap-1.5 truncate font-semibold ${t.pacienteId ? '' : 'italic text-slate-400'}`}>
          {t.pacienteId ? p?.nombre ?? '…' : <><Ticket size={15} className="shrink-0 text-amber-500" /> Sin nombre</>}
          {tieneAlerta && <AlertTriangle size={15} className="shrink-0 text-amber-500" />}
        </p>
        <p className="truncate text-xs text-slate-500">
          {t.motivo && <>{t.motivo} · </>}
          {activo ? `En consultorio hace ${duracion(min)}` : `Llegó ${hora(t.llegada)} · espera ${duracion(min)}`}
        </p>
      </button>
      <div className="flex shrink-0 items-center gap-1">{children}</div>
    </div>
  )
}
