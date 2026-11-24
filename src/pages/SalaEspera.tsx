import { useLiveQuery } from 'dexie-react-hooks'
import {
  AlertTriangle, Banknote, CalendarCheck, CheckCircle2, ChevronRight, Megaphone, Play, RotateCcw, Smartphone, Ticket, Undo2,
  UserPlus, X,
} from 'lucide-react'
import { useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import PacienteSelector from '../components/PacienteSelector'
import { IdentificarTurno, TerminarSinNombre } from '../components/TurnoRapido'
import { Encabezado, Modal } from '../components/ui'
import {
  cobrosSinNombre, db, deshacerReinicio, estimarEsperas, etiquetaTurno, hoy, identificarTurno, llamarSiguiente, noVino, registrarLlegada,
  reiniciarSala, ultimoLlamado, type Paciente, type Turno,
} from '../lib/db'
import { dinero, duracion, fechaLarga, hora, minutosDesde } from '../lib/format'
import { useAhora } from '../lib/useAhora'
import { useConfig } from '../lib/useConfig'

/**
 * Sala de espera con UN SOLO NÚMERO: el de la ficha de papel que toma cada paciente al llegar.
 * El dentista llama "Ficha 4", "Ficha 5"… en orden. Quien tiene celular puede registrar su ficha
 * con el QR para ver cuánto le falta; el dentista también puede anotar fichas con nombre.
 */
export default function SalaEspera() {
  const ahora = useAhora()
  const navigate = useNavigate()
  const [params, setParams] = useSearchParams()
  const fecha = hoy()
  const config = useConfig()
  const [anotar, setAnotar] = useState(false)
  const [confirmarReinicio, setConfirmarReinicio] = useState(false)
  const [reinicio, setReinicio] = useState<Turno[] | null>(null)
  const [identificar, setIdentificar] = useState<Turno | null>(null)
  const [terminar, setTerminar] = useState<Turno | null>(null)
  const [aviso, setAviso] = useState('')

  const datos = useLiveQuery(async () => {
    const turnos = await db.turnos.where('fecha').equals(fecha).sortBy('numero')
    const citas = await db.citas.where('fecha').equals(fecha).sortBy('hora')
    const ids = [...new Set([...turnos.map((t) => t.pacienteId), ...citas.map((c) => c.pacienteId)])].filter((x): x is number => !!x)
    const pacientes = new Map((await db.pacientes.bulkGet(ids)).filter(Boolean).map((p) => [p!.id!, p!]))
    const inicio = new Date(fecha + 'T00:00').getTime()
    const fin = inicio + 86400000
    const [consultas, pagos, sinNombre] = await Promise.all([
      db.consultas.where('fecha').between(inicio, fin).toArray(),
      db.pagos.where('fecha').between(inicio, fin).toArray(),
      cobrosSinNombre(inicio, fin),
    ])
    const cobrado = consultas.reduce((s, c) => s + (c.pagado ?? 0), 0) + pagos.reduce((s, p) => s + p.monto, 0) + sinNombre.reduce((s, t) => s + t.cobro!.pagado, 0)
    return { turnos, citas, pacientes, cobrado }
  }, [fecha])

  // Viene de "Guardar y llamar siguiente" cuando la ficha siguiente no tiene nombre
  const paramIdentificar = Number(params.get('identificar'))
  useEffect(() => {
    if (!paramIdentificar) return
    db.turnos.get(paramIdentificar).then((t) => t && setIdentificar(t))
    setParams({}, { replace: true })
  }, [paramIdentificar, setParams])

  useEffect(() => {
    if (!reinicio) return
    const t = setTimeout(() => setReinicio(null), 10_000)
    return () => clearTimeout(t)
  }, [reinicio])

  useEffect(() => {
    if (!aviso) return
    const t = setTimeout(() => setAviso(''), 4000)
    return () => clearTimeout(t)
  }, [aviso])

  if (!datos) return null
  const { turnos, citas, pacientes, cobrado } = datos
  const ultimo = ultimoLlamado(turnos)
  const siguienteNumero = ultimo + 1
  const anotadaSiguiente = turnos.find((t) => t.numero === siguienteNumero && t.estado === 'espera')
  const atencion = turnos.filter((t) => t.estado === 'atencion')
  const atendidos = turnos.filter((t) => t.estado === 'atendido')
  const esperando = turnos.filter((t) => t.estado === 'espera' && t.numero > ultimo)
  const pasados = turnos.filter((t) => t.estado === 'espera' && t.numero > 0 && t.numero <= ultimo)
  const sinFicha = turnos.filter((t) => t.estado === 'espera' && t.numero === 0)
  const citasPendientes = citas.filter((c) => c.estado === 'pendiente' || c.estado === 'confirmada')
  const esperas = estimarEsperas(turnos, config, ahora)
  const nombre = (t: Turno) => (t.pacienteId ? pacientes.get(t.pacienteId)?.nombre : undefined) ?? t.nombreLlegada

  /** Abre la ficha del paciente; si no tiene nombre, ofrece identificarlo (opcional). */
  function abrir(t: Turno) {
    if (t.pacienteId) navigate(`/pacientes/${t.pacienteId}`)
    else setIdentificar(t)
  }
  async function siguiente() {
    setReinicio(null) // ya empezó la nueva numeración: no se ofrece deshacer el reinicio
    abrir(await llamarSiguiente(fecha))
  }
  async function atender(t: Turno) {
    const actualizado = { ...t, estado: 'atencion' as const, inicio: Date.now() }
    await db.turnos.update(t.id!, { estado: 'atencion', inicio: actualizado.inicio })
    abrir(actualizado)
  }
  async function alTerminar(siguienteTambien: boolean) {
    setTerminar(null)
    if (siguienteTambien) await siguiente()
  }
  async function alIdentificar(pacienteId: number) {
    const t = identificar!
    await identificarTurno(t.id!, pacienteId)
    setIdentificar(null)
    if (t.estado === 'atencion') navigate(`/pacientes/${pacienteId}`)
  }
  async function noVinoYSiguiente(t: Turno) {
    setIdentificar(null)
    await noVino(t.id!)
    await siguiente()
  }
  async function llegoCita(citaId: number, pacienteId: number, m?: string) {
    await registrarLlegada(pacienteId, m, 0)
    await db.citas.update(citaId, { estado: 'llego' })
  }
  const quitar = (t: Turno) => confirm(`¿Quitar la ${etiquetaTurno(t).toLowerCase()} de la lista?`) && db.turnos.delete(t.id!)

  return (
    <>
      <Encabezado titulo="Sala de espera" sub={fechaLarga(Date.now())}
        accion={turnos.some((t) => t.estado !== 'atendido' || t.numero > 0) && (
          <button className="btn-ghost px-3 py-2 text-xs text-slate-500" onClick={() => setConfirmarReinicio(true)}>
            <RotateCcw size={16} /> Reiniciar
          </button>
        )} />

      <div className="mb-4 grid grid-cols-3 gap-3">
        <Stat icono={<Ticket size={18} />} valor={ultimo ? `Ficha ${ultimo}` : '—'} label="Última llamada" />
        <Stat icono={<CheckCircle2 size={18} />} valor={atendidos.length} label="Atendidos" />
        <Stat icono={<Banknote size={18} />} valor={`Bs ${dinero(cobrado)}`} label="Cobrado hoy" />
      </div>

      {atencion.length > 0 && (
        <section className="mb-5">
          <Titulo>En atención</Titulo>
          <div className="space-y-2">
            {atencion.map((t) => (
              <TurnoCard key={t.id} t={t} nombre={nombre(t)} p={t.pacienteId ? pacientes.get(t.pacienteId) : undefined} ahora={ahora} activo onAbrir={() => abrir(t)}>
                {t.pacienteId ? <button className="btn-primary" onClick={() => abrir(t)}>Abrir ficha</button>
                  : <button className="btn-primary" onClick={() => setTerminar(t)}>Terminar</button>}
              </TurnoCard>
            ))}
          </div>
        </section>
      )}

      {atencion.length === 0 && (
        <button onClick={siguiente}
          className="mb-2 flex w-full items-center gap-4 rounded-2xl bg-gradient-to-br from-teal-600 to-cyan-700 p-4 text-left text-white shadow-lg shadow-teal-700/20 transition active:scale-[.99]">
          <div className="rounded-xl bg-white/20 p-3"><Megaphone size={24} /></div>
          <div className="min-w-0 flex-1">
            <p className="text-lg font-bold">Llamar ficha {siguienteNumero}</p>
            <p className="truncate text-sm text-teal-50">
              {anotadaSiguiente ? `${nombre(anotadaSiguiente) ?? 'Anotada sin nombre'}${anotadaSiguiente.motivo ? ` · ${anotadaSiguiente.motivo}` : ''}` : 'Quien tenga esta ficha pasa al consultorio'}
            </p>
          </div>
          <ChevronRight size={24} />
        </button>
      )}
      {atencion.length === 0 && (
        <p className="mb-5 px-1 text-xs text-slate-500">Cada paciente toma una ficha de papel al llegar. Si nadie tiene esta ficha, toca “No vino” al llamarla.</p>
      )}

      <button onClick={() => setAnotar(true)} className="card mb-6 flex w-full items-center gap-3 p-3 text-left transition hover:border-teal-300 active:scale-[.99]">
        <div className="rounded-xl bg-teal-100 p-2.5 text-teal-700"><UserPlus size={22} /></div>
        <div className="min-w-0">
          <p className="font-semibold">Anotar paciente</p>
          <p className="text-xs text-slate-500">Opcional: para dejar su nombre junto al número de su ficha</p>
        </div>
      </button>

      {esperando.length > 0 && (
        <section className="mb-6">
          <Titulo>Fichas anotadas que esperan</Titulo>
          <div className="space-y-2">
            {esperando.map((t) => (
              <TurnoCard key={t.id} t={t} nombre={nombre(t)} p={t.pacienteId ? pacientes.get(t.pacienteId) : undefined} ahora={ahora}
                siguiente={t.numero === siguienteNumero} estimado={esperas.get(t.id!)} onAbrir={() => abrir(t)}>
                <button className="btn-ghost p-2.5" onClick={() => quitar(t)} aria-label={`Quitar ${etiquetaTurno(t).toLowerCase()}`}><X size={18} /></button>
                <button className="btn-soft" onClick={() => atender(t)}><Play size={16} /> Atender</button>
              </TurnoCard>
            ))}
          </div>
          <p className="mt-2 px-1 text-xs text-slate-500">Las fichas que no se anotaron también esperan: se cuentan para calcular la hora.</p>
        </section>
      )}

      {pasados.length > 0 && (
        <section className="mb-6">
          <Titulo>Ya pasó su número</Titulo>
          <div className="space-y-2">
            {pasados.map((t) => (
              <TurnoCard key={t.id} t={t} nombre={nombre(t)} p={t.pacienteId ? pacientes.get(t.pacienteId) : undefined} ahora={ahora} onAbrir={() => abrir(t)}>
                <button className="btn-ghost p-2.5" onClick={() => quitar(t)} aria-label={`Quitar ${etiquetaTurno(t).toLowerCase()}`}><X size={18} /></button>
                <button className="btn-soft" onClick={() => atender(t)}><Play size={16} /> Atender</button>
              </TurnoCard>
            ))}
          </div>
        </section>
      )}

      {sinFicha.length > 0 && (
        <section className="mb-6">
          <Titulo>Sin ficha (con cita)</Titulo>
          <div className="space-y-2">
            {sinFicha.map((t) => (
              <TurnoCard key={t.id} t={t} nombre={nombre(t)} p={t.pacienteId ? pacientes.get(t.pacienteId) : undefined} ahora={ahora} onAbrir={() => abrir(t)}>
                <button className="btn-ghost p-2.5" onClick={() => quitar(t)} aria-label="Quitar de la lista"><X size={18} /></button>
                <button className="btn-soft" onClick={() => atender(t)}><Play size={16} /> Atender</button>
              </TurnoCard>
            ))}
          </div>
        </section>
      )}

      {citasPendientes.length > 0 && (
        <section className="mb-6">
          <Titulo>Citas programadas para hoy</Titulo>
          <div className="card divide-y divide-slate-100">
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
          <div className="card divide-y divide-slate-100">
            {atendidos.map((t) => (
              <button key={t.id} onClick={() => abrir(t)} className="flex w-full items-center gap-3 p-3 text-left hover:bg-slate-50">
                <span className="w-10 text-center text-sm font-bold text-slate-400">{t.numero ? `F${t.numero}` : '—'}</span>
                <p className="min-w-0 flex-1 truncate">
                  {nombre(t) ?? 'Sin nombre'}
                  {!t.pacienteId && <span className="ml-1 text-xs text-teal-700">· ponerle nombre</span>}
                </p>
                {t.cobro && t.cobro.pagado > 0 && <span className="text-xs font-semibold text-emerald-700">Bs {dinero(t.cobro.pagado)}</span>}
                <span className="text-xs text-slate-500">{t.fin ? hora(t.fin) : ''}</span>
              </button>
            ))}
          </div>
        </section>
      )}

      {(reinicio || aviso) && (
        <div className="fixed inset-x-4 bottom-24 z-40 mx-auto flex max-w-md items-center gap-3 rounded-2xl bg-slate-900 px-4 py-3 text-white shadow-xl md:bottom-6">
          {reinicio ? (
            <>
              <RotateCcw size={20} className="text-amber-300" />
              <p className="flex-1 text-sm">Sala reiniciada. Se llamará desde la ficha <b className="text-lg">1</b></p>
              <button className="btn px-3 py-1.5 text-amber-300 hover:bg-white/10" onClick={async () => { const r = reinicio; setReinicio(null); await deshacerReinicio(fecha, r) }}>
                <Undo2 size={16} /> Deshacer
              </button>
            </>
          ) : (
            <><Ticket size={20} className="text-amber-300" /><p className="flex-1 text-sm">{aviso}</p></>
          )}
        </div>
      )}

      <Modal abierto={confirmarReinicio} onCerrar={() => setConfirmarReinicio(false)} titulo="¿Reiniciar la sala de espera?">
        <div className="space-y-4">
          <ul className="space-y-2 text-sm text-slate-700">
            <li className="flex gap-2"><RotateCcw size={18} className="shrink-0 text-teal-600" /><span>Se vuelve a llamar desde la <b>ficha 1</b>. Junta las fichas de papel para empezar de nuevo.</span></li>
            {esperando.length + pasados.length + sinFicha.length + atencion.length > 0 && (
              <li className="flex gap-2"><X size={18} className="shrink-0 text-rose-500" />
                <span>Se quitan <b>{esperando.length + pasados.length + sinFicha.length + atencion.length} anotado(s)</b>{atencion.length > 0 && <> (incluido el que está en atención)</>}.</span></li>
            )}
            {atendidos.length > 0 && (
              <li className="flex gap-2"><CheckCircle2 size={18} className="shrink-0 text-emerald-600" />
                <span>Los <b>{atendidos.length} atendido(s)</b> de hoy se conservan con sus cobros.</span></li>
            )}
            {turnos.some((t) => t.origen === 'qr' && t.estado === 'espera') && (
              <li className="flex gap-2"><Smartphone size={18} className="shrink-0 text-sky-600" /><span>Quienes se registraron con QR verán en su celular que deben registrarse de nuevo.</span></li>
            )}
          </ul>
          <button className="btn-danger w-full" onClick={async () => { setConfirmarReinicio(false); setReinicio(await reiniciarSala(fecha)) }}>
            <RotateCcw size={18} /> Reiniciar desde la ficha 1
          </button>
          <button className="btn-ghost w-full" onClick={() => setConfirmarReinicio(false)}>Cancelar</button>
        </div>
      </Modal>

      <Modal abierto={anotar} onCerrar={() => setAnotar(false)} titulo="Anotar paciente">
        {anotar && <AnotarPaciente siguiente={siguienteNumero} motivos={(config.motivos ?? []).map((m) => m.nombre)}
          onListo={(texto) => { setAnotar(false); setAviso(texto) }} />}
      </Modal>

      <Modal abierto={!!terminar} onCerrar={() => setTerminar(null)} titulo={terminar ? `Terminar ${etiquetaTurno(terminar).toLowerCase()}` : ''}>
        {terminar && (
          <>
            <TerminarSinNombre key={terminar.id} turno={terminar} siguienteFicha={Math.max(ultimo, terminar.numero) + 1} onListo={alTerminar} />
            <button className="mt-3 w-full text-center text-sm text-teal-700 underline-offset-2 hover:underline" onClick={() => { setIdentificar(terminar); setTerminar(null) }}>
              Ponerle nombre y abrir su ficha
            </button>
          </>
        )}
      </Modal>

      <Modal abierto={!!identificar} onCerrar={() => setIdentificar(null)}
        titulo={identificar ? (identificar.numero ? `¿Quién tiene la ficha ${identificar.numero}?` : '¿Quién es?') : ''}>
        {identificar && (
          <IdentificarTurno key={identificar.id} turno={identificar} onElegir={alIdentificar}
            onSinNombre={identificar.estado === 'atencion' ? () => setIdentificar(null) : undefined}
            onNoVino={identificar.estado === 'atencion' && identificar.numero > 0 ? () => noVinoYSiguiente(identificar) : undefined} />
        )}
      </Modal>
    </>
  )
}

/** El dentista anota a un paciente con su número de ficha (o sin ficha, si viene con cita). */
function AnotarPaciente({ siguiente, motivos, onListo }: { siguiente: number; motivos: string[]; onListo: (aviso: string) => void }) {
  const [pacienteId, setPacienteId] = useState<number | null>(null)
  const [ficha, setFicha] = useState('')
  const [motivo, setMotivo] = useState('')
  const [error, setError] = useState('')
  if (!pacienteId) return <PacienteSelector onElegir={setPacienteId} />
  return (
    <form className="space-y-4" onSubmit={async (e) => {
      e.preventDefault()
      const n = Number(ficha) || 0
      try {
        await registrarLlegada(pacienteId, motivo.trim() || undefined, n)
        onListo(n ? `Ficha ${n} anotada` : 'Paciente anotado sin ficha')
      } catch (err) {
        setError((err as Error).message)
      }
    }}>
      <label className="block">
        <span className="label">Número de su ficha de papel</span>
        <input className="input text-center text-3xl font-bold" type="number" min="1" inputMode="numeric" placeholder={`Ej: ${siguiente}`}
          value={ficha} onChange={(e) => setFicha(e.target.value)} autoFocus />
        <span className="mt-1 block text-xs text-slate-500">Déjalo vacío si viene con cita o sin ficha.</span>
      </label>
      <div className="flex flex-wrap gap-2">
        {motivos.map((m) => (
          <button key={m} type="button" onClick={() => setMotivo(motivo === m ? '' : m)}
            className={`chip border px-3 py-1.5 text-sm ${motivo === m ? 'border-teal-600 bg-teal-600 text-white' : 'border-slate-200 bg-white text-slate-600'}`}>{m}</button>
        ))}
      </div>
      {error && <p className="rounded-xl bg-rose-50 p-3 text-sm text-rose-700">{error}</p>}
      <button className="btn-primary w-full">Anotar</button>
    </form>
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

function TurnoCard({ t, nombre, p, ahora, activo, siguiente, estimado, onAbrir, children }: {
  t: Turno; nombre?: string; p?: Paciente; ahora: number; activo?: boolean; siguiente?: boolean
  /** Minutos aproximados hasta que le toque. */
  estimado?: number
  onAbrir: () => void
  children: React.ReactNode
}) {
  const min = minutosDesde(activo ? t.inicio! : t.llegada, ahora)
  const tieneAlerta = !!(p?.alergias || p?.enfermedades)
  return (
    <div className={`card flex items-center gap-3 p-3 ${activo ? 'border-teal-300 bg-teal-50/60 ring-1 ring-teal-200' : siguiente ? 'border-teal-200' : ''}`}>
      <div aria-label={etiquetaTurno(t)}
        className={`flex h-12 w-12 shrink-0 flex-col items-center justify-center rounded-xl font-bold leading-none ${activo || siguiente ? 'bg-teal-600 text-white' : 'bg-slate-100 text-slate-600'}`}>
        {t.numero ? <><span className="text-[9px] font-semibold uppercase opacity-75">ficha</span><span className="text-lg">{t.numero}</span></>
          : <span className="text-[10px] font-semibold uppercase">cita</span>}
      </div>
      <button onClick={onAbrir} className="min-w-0 flex-1 text-left">
        <p className={`flex items-center gap-1.5 truncate font-semibold ${nombre ? '' : 'italic text-slate-400'}`}>
          {nombre ?? <><Ticket size={15} className="shrink-0 text-amber-500" /> Sin nombre</>}
          {t.origen === 'qr' && <Smartphone size={14} className="shrink-0 text-sky-500" aria-label="Se registró con QR" />}
          {tieneAlerta && <AlertTriangle size={15} className="shrink-0 text-amber-500" />}
        </p>
        <p className="truncate text-xs text-slate-500">
          {!t.pacienteId && t.nombreLlegada && <b className="font-semibold text-sky-700">Nuevo · </b>}
          {t.motivo && <>{t.motivo} · </>}
          {activo ? `En consultorio hace ${duracion(min)}` : `Anotado ${hora(t.llegada)}`}
        </p>
        {!activo && estimado !== undefined && (
          <p className="truncate text-xs font-semibold text-teal-700">
            {estimado < 3 ? 'Le toca ahora' : `Le toca ≈ ${hora(ahora + estimado * 60000)}`}
          </p>
        )}
      </button>
      <div className="flex shrink-0 items-center gap-1">{children}</div>
    </div>
  )
}

