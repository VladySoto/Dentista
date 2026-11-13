import { useLiveQuery } from 'dexie-react-hooks'
import {
  AlertTriangle, ArrowLeft, Banknote, CalendarClock, ClipboardList, MessageCircle, Pencil, Phone, Plus, Stethoscope, Trash2, Wallet,
} from 'lucide-react'
import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import ConsultaForm from '../components/ConsultaForm'
import Odontograma from '../components/Odontograma'
import PacienteForm from '../components/PacienteForm'
import { Avatar, Campo, Modal, Vacio } from '../components/ui'
import {
  calcularSaldo, db, enlaceWhatsApp, hoy, llamarSiguiente, rellenar, varsPlantilla, type Consulta, type Pago,
} from '../lib/db'
import { dinero, duracion, edad, fechaCorta, hora, minutosDesde } from '../lib/format'
import { useAhora } from '../lib/useAhora'
import { useConfig } from '../lib/useConfig'

type Tab = 'historial' | 'odontograma' | 'datos'
type ModalConsulta = { modo: 'turno' } | { modo: 'nueva' } | { modo: 'editar'; consulta: Consulta } | null

export default function PacienteDetalle() {
  const id = Number(useParams().id)
  const navigate = useNavigate()
  const config = useConfig()
  const ahora = useAhora()
  const [tab, setTab] = useState<Tab>('historial')
  const [editar, setEditar] = useState(false)
  const [modalConsulta, setModalConsulta] = useState<ModalConsulta>(null)
  const [modalPago, setModalPago] = useState(false)

  const p = useLiveQuery(() => db.pacientes.get(id), [id])
  const consultas = useLiveQuery(() => db.consultas.where('pacienteId').equals(id).toArray(), [id])
  const pagos = useLiveQuery(() => db.pagos.where('pacienteId').equals(id).toArray(), [id])
  const fila = useLiveQuery(async () => {
    const turnos = await db.turnos.where('fecha').equals(hoy()).toArray()
    return {
      activo: turnos.find((t) => t.pacienteId === id && t.estado === 'atencion'),
      enEspera: turnos.filter((t) => t.estado === 'espera').length,
    }
  }, [id])

  if (p === undefined || !consultas || !pagos) return null
  if (p === null) return <p>Paciente no encontrado.</p>

  const e = edad(p.fechaNacimiento)
  const saldo = calcularSaldo(consultas, pagos)
  const vars = { ...varsPlantilla(config, p), saldo: dinero(saldo) }
  const waChat = enlaceWhatsApp(p.telefono)
  const waSaldo = enlaceWhatsApp(p.telefono, rellenar(config.plantillas.saldo, vars))
  const turno = fila?.activo

  const historial = [
    ...consultas.map((c) => ({ tipo: 'consulta' as const, fecha: c.fecha, c })),
    ...pagos.map((pg) => ({ tipo: 'pago' as const, fecha: pg.fecha, pg })),
  ].sort((a, b) => b.fecha - a.fecha)

  async function alGuardarConsulta(_: Consulta, siguiente: boolean) {
    const modo = modalConsulta?.modo
    setModalConsulta(null)
    if (modo !== 'turno' || !turno) return
    await db.turnos.update(turno.id!, { estado: 'atendido', fin: Date.now() })
    const sig = siguiente ? await llamarSiguiente() : null
    navigate(sig ? `/pacientes/${sig.pacienteId}` : '/')
  }

  async function terminarSinRegistrar() {
    if (!turno || !confirm('¿Terminar la atención sin registrar una consulta?')) return
    await db.turnos.update(turno.id!, { estado: 'atendido', fin: Date.now() })
    navigate('/')
  }

  async function eliminar() {
    if (!confirm(`¿Eliminar a ${p!.nombre} y todo su historial? Esta acción no se puede deshacer.`)) return
    await db.transaction('rw', [db.pacientes, db.consultas, db.turnos, db.citas, db.pagos], async () => {
      for (const t of [db.consultas, db.turnos, db.citas, db.pagos]) await t.where('pacienteId').equals(id).delete()
      await db.pacientes.delete(id)
    })
    navigate('/pacientes')
  }

  return (
    <>
      <Link to={turno ? '/' : '/pacientes'} className="btn-ghost -ml-3 mb-3 px-3 py-1.5"><ArrowLeft size={18} /> {turno ? 'Sala de espera' : 'Pacientes'}</Link>

      {turno && (
        <div className="mb-4 rounded-2xl bg-gradient-to-br from-teal-600 to-cyan-700 p-4 text-white shadow-lg shadow-teal-700/20">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-white/20 text-xl font-bold">{turno.numero}</div>
            <div className="min-w-0 flex-1">
              <p className="font-semibold">En atención</p>
              <p className="truncate text-sm text-teal-50">{turno.motivo ? `${turno.motivo} · ` : ''}hace {duracion(minutosDesde(turno.inicio!, ahora))}</p>
            </div>
          </div>
          <button className="btn mt-3 w-full bg-white py-3 text-teal-700 hover:bg-teal-50" onClick={() => setModalConsulta({ modo: 'turno' })}>
            <Stethoscope size={18} /> Terminar consulta
          </button>
          <button className="mt-2 w-full text-center text-xs text-teal-100 underline-offset-2 hover:underline" onClick={terminarSinRegistrar}>Terminar sin registrar</button>
        </div>
      )}

      <div className="card mb-4 p-4 sm:p-5">
        <div className="flex items-start gap-4">
          <Avatar nombre={p.nombre} size="lg" />
          <div className="min-w-0 flex-1">
            <h1 className="text-xl font-bold leading-tight sm:text-2xl">{p.nombre}</h1>
            <p className="mt-1 text-sm text-slate-500">
              {[e !== null && `${e} años`, p.documento && `CI ${p.documento}`, p.telefono].filter(Boolean).join(' · ') || 'Sin datos adicionales'}
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              {p.telefono && <a href={`tel:${p.telefono}`} className="btn-soft px-3 py-2"><Phone size={16} /> Llamar</a>}
              {waChat && <a href={waChat} target="_blank" rel="noreferrer" className="btn-soft px-3 py-2"><MessageCircle size={16} /> WhatsApp</a>}
              <button className="btn-ghost px-3 py-2" onClick={() => setEditar(true)}><Pencil size={16} /> Editar</button>
            </div>
          </div>
        </div>
        {(p.alergias || p.enfermedades || p.medicamentos) && (
          <div className="mt-4 flex gap-3 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
            <AlertTriangle size={20} className="shrink-0 text-amber-500" />
            <div className="space-y-0.5">
              {p.alergias && <p><b>Alergias:</b> {p.alergias}</p>}
              {p.enfermedades && <p><b>Enfermedades:</b> {p.enfermedades}</p>}
              {p.medicamentos && <p><b>Medicamentos:</b> {p.medicamentos}</p>}
            </div>
          </div>
        )}
        {saldo > 0 && (
          <div className="mt-3 rounded-xl bg-rose-50 p-3">
            <p className="flex items-center gap-2 text-sm font-semibold text-rose-700"><Wallet size={17} /> Saldo pendiente: Bs {dinero(saldo)}</p>
            <div className="mt-2 flex flex-wrap gap-2">
              <button className="btn bg-white px-3 py-1.5 text-xs text-rose-700 hover:bg-rose-100" onClick={() => setModalPago(true)}><Banknote size={15} /> Registrar pago</button>
              {waSaldo && <a href={waSaldo} target="_blank" rel="noreferrer" className="btn bg-white px-3 py-1.5 text-xs text-rose-700 hover:bg-rose-100"><MessageCircle size={15} /> Recordar por WhatsApp</a>}
            </div>
          </div>
        )}
      </div>

      <div className="mb-4 grid grid-cols-3 rounded-xl bg-slate-200/60 p-1">
        {([['historial', 'Historial'], ['odontograma', 'Odontograma'], ['datos', 'Datos']] as const).map(([k, l]) => (
          <button key={k} onClick={() => setTab(k)}
            className={`rounded-lg py-2 text-sm font-semibold transition ${tab === k ? 'bg-white text-teal-700 shadow-sm' : 'text-slate-600'}`}>{l}</button>
        ))}
      </div>

      {tab === 'historial' && (
        <>
          {!turno && <button className="btn-primary mb-4 w-full sm:w-auto" onClick={() => setModalConsulta({ modo: 'nueva' })}><Plus size={18} /> Nueva consulta</button>}
          {historial.length === 0 ? (
            <Vacio icono={<ClipboardList size={28} />} titulo="Sin consultas registradas" texto="Cada atención que registres aparecerá aquí, en orden cronológico." />
          ) : (
            <ol className="relative space-y-3 border-l-2 border-teal-100 pl-5">
              {historial.map((h) => h.tipo === 'pago' ? (
                <PagoItem key={`p${h.pg.id}`} pg={h.pg} />
              ) : (
                <li key={`c${h.c.id}`} className="relative">
                  <span className="absolute -left-[27px] top-4 h-3 w-3 rounded-full border-2 border-white bg-teal-500 ring-2 ring-teal-100" />
                  <button onClick={() => setModalConsulta({ modo: 'editar', consulta: h.c })} className="card w-full p-4 text-left transition hover:border-teal-200">
                    <div className="flex items-start justify-between gap-2">
                      <p className="font-semibold">{h.c.motivo}</p>
                      <span className="shrink-0 text-xs text-slate-500">{fechaCorta(h.c.fecha)} · {hora(h.c.fecha)}</span>
                    </div>
                    <div className="mt-1 flex flex-wrap gap-1">
                      {h.c.piezas && <span className="chip bg-slate-100 text-slate-600">Pieza {h.c.piezas}</span>}
                      {h.c.proximoControl && <span className="chip bg-sky-50 text-sky-700"><CalendarClock size={12} /> Control {fechaCorta(h.c.proximoControl)}</span>}
                    </div>
                    <dl className="mt-2 space-y-1 text-sm">
                      {h.c.diagnostico && <div><dt className="inline font-medium text-slate-500">Dx: </dt><dd className="inline">{h.c.diagnostico}</dd></div>}
                      {h.c.tratamiento && <div><dt className="inline font-medium text-slate-500">Tx: </dt><dd className="inline">{h.c.tratamiento}</dd></div>}
                      {h.c.notas && <div className="text-slate-500">{h.c.notas}</div>}
                    </dl>
                    {h.c.costo !== undefined && (
                      <p className="mt-2 text-xs text-slate-500">
                        Bs {dinero(h.c.costo)} · pagó Bs {dinero(h.c.pagado)}
                        {(h.c.costo ?? 0) > (h.c.pagado ?? 0) && <span className="ml-1 font-semibold text-rose-600">quedó Bs {dinero((h.c.costo ?? 0) - (h.c.pagado ?? 0))}</span>}
                      </p>
                    )}
                  </button>
                </li>
              ))}
            </ol>
          )}
        </>
      )}

      {tab === 'odontograma' && (
        <div className="card p-3 sm:p-5">
          <Odontograma dientes={p.dientes ?? {}} onCambiar={(d) => db.pacientes.update(id, { dientes: d })} />
        </div>
      )}

      {tab === 'datos' && (
        <div className="card divide-y divide-slate-100 text-sm">
          {([
            ['Teléfono', p.telefono], ['CI / Documento', p.documento],
            ['Nacimiento', p.fechaNacimiento && fechaCorta(p.fechaNacimiento)],
            ['Sexo', { F: 'Femenino', M: 'Masculino', O: 'Otro' }[p.sexo as 'F'] ?? ''],
            ['Dirección', p.direccion], ['Notas', p.notas], ['Registrado', fechaCorta(p.creado)],
          ] as const).map(([k, v]) => (
            <div key={k} className="flex gap-4 px-4 py-3"><span className="w-32 shrink-0 text-slate-500">{k}</span><span>{v || '—'}</span></div>
          ))}
          <div className="p-4"><button className="btn-danger" onClick={eliminar}><Trash2 size={16} /> Eliminar paciente</button></div>
        </div>
      )}

      <Modal abierto={editar} onCerrar={() => setEditar(false)} titulo="Editar paciente">
        <PacienteForm inicial={p} onGuardado={() => setEditar(false)} />
      </Modal>

      <Modal abierto={!!modalConsulta} onCerrar={() => setModalConsulta(null)}
        titulo={modalConsulta?.modo === 'editar' ? 'Editar consulta' : modalConsulta?.modo === 'turno' ? 'Terminar consulta' : 'Nueva consulta'}>
        {modalConsulta && (
          <ConsultaForm
            key={modalConsulta.modo === 'editar' ? modalConsulta.consulta.id : modalConsulta.modo}
            pacienteId={id}
            inicial={modalConsulta.modo === 'editar' ? modalConsulta.consulta : undefined}
            motivoInicial={modalConsulta.modo === 'turno' ? turno?.motivo ?? '' : ''}
            enEspera={modalConsulta.modo === 'turno' ? fila?.enEspera ?? 0 : undefined}
            onGuardado={alGuardarConsulta} />
        )}
        {modalConsulta?.modo === 'editar' && (
          <button className="btn-danger mt-3 w-full" onClick={async () => {
            if (confirm('¿Eliminar esta consulta?')) { await db.consultas.delete(modalConsulta.consulta.id!); setModalConsulta(null) }
          }}><Trash2 size={16} /> Eliminar consulta</button>
        )}
      </Modal>

      <Modal abierto={modalPago} onCerrar={() => setModalPago(false)} titulo="Registrar pago">
        <FormPago pacienteId={id} saldo={saldo} onListo={() => setModalPago(false)} />
      </Modal>
    </>
  )
}

function PagoItem({ pg }: { pg: Pago }) {
  return (
    <li className="relative">
      <span className="absolute -left-[27px] top-3.5 h-3 w-3 rounded-full border-2 border-white bg-emerald-500 ring-2 ring-emerald-100" />
      <div className="flex items-center justify-between gap-2 rounded-2xl border border-emerald-100 bg-emerald-50/60 px-4 py-2.5 text-sm">
        <span className="font-medium text-emerald-800"><Banknote size={15} className="mr-1.5 inline" />Pagó Bs {dinero(pg.monto)}{pg.nota ? ` · ${pg.nota}` : ''}</span>
        <span className="flex items-center gap-2 text-xs text-slate-500">
          {fechaCorta(pg.fecha)}
          <button aria-label="Eliminar pago" className="text-slate-400 hover:text-rose-600" onClick={() => confirm('¿Eliminar este pago?') && db.pagos.delete(pg.id!)}><Trash2 size={14} /></button>
        </span>
      </div>
    </li>
  )
}

function FormPago({ pacienteId, saldo, onListo }: { pacienteId: number; saldo: number; onListo: () => void }) {
  const [monto, setMonto] = useState(String(saldo))
  const [nota, setNota] = useState('')
  return (
    <form className="space-y-4" onSubmit={async (e) => {
      e.preventDefault()
      const m = Number(monto)
      if (!(m > 0)) return
      await db.pagos.add({ pacienteId, fecha: Date.now(), monto: m, nota: nota.trim() || undefined })
      onListo()
    }}>
      <p className="text-sm text-slate-500">Saldo actual: <b className="text-rose-600">Bs {dinero(saldo)}</b></p>
      <Campo label="Monto (Bs)"><input className="input" type="number" inputMode="decimal" min="0" step="any" value={monto} onChange={(e) => setMonto(e.target.value)} autoFocus /></Campo>
      <Campo label="Nota (opcional)"><input className="input" placeholder="Ej: QR, efectivo…" value={nota} onChange={(e) => setNota(e.target.value)} /></Campo>
      <button className="btn-primary w-full">Guardar pago</button>
    </form>
  )
}
