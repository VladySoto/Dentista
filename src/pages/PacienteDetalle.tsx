import { useLiveQuery } from 'dexie-react-hooks'
import { AlertTriangle, ArrowLeft, ClipboardList, MessageCircle, Pencil, Phone, Plus, Trash2, Wallet } from 'lucide-react'
import { useState } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import ConsultaForm from '../components/ConsultaForm'
import Odontograma from '../components/Odontograma'
import PacienteForm from '../components/PacienteForm'
import { Avatar, Modal, Vacio } from '../components/ui'
import { db, type Consulta } from '../lib/db'
import { dinero, edad, fechaCorta, hora } from '../lib/format'

type Tab = 'historial' | 'odontograma' | 'datos'

export default function PacienteDetalle() {
  const id = Number(useParams().id)
  const navigate = useNavigate()
  const [params, setParams] = useSearchParams()
  const [tab, setTab] = useState<Tab>('historial')
  const [editar, setEditar] = useState(false)
  const [consultaEdit, setConsultaEdit] = useState<Consulta | null>(null)
  const nuevaConsulta = params.get('consulta') === 'nueva'

  const p = useLiveQuery(() => db.pacientes.get(id), [id])
  const consultas = useLiveQuery(() => db.consultas.where('pacienteId').equals(id).reverse().sortBy('fecha'), [id])

  if (p === undefined) return null
  if (p === null) return <p>Paciente no encontrado.</p>

  const e = edad(p.fechaNacimiento)
  const saldo = (consultas ?? []).reduce((s, c) => s + (c.costo ?? 0) - (c.pagado ?? 0), 0)
  const tel = p.telefono?.replace(/\D/g, '')
  const cerrarConsulta = () => { setConsultaEdit(null); params.delete('consulta'); params.delete('motivo'); setParams(params, { replace: true }) }

  async function eliminar() {
    if (!confirm(`¿Eliminar a ${p!.nombre} y todo su historial? Esta acción no se puede deshacer.`)) return
    await db.transaction('rw', [db.pacientes, db.consultas, db.turnos, db.citas], async () => {
      await db.consultas.where('pacienteId').equals(id).delete()
      await db.turnos.where('pacienteId').equals(id).delete()
      await db.citas.where('pacienteId').equals(id).delete()
      await db.pacientes.delete(id)
    })
    navigate('/pacientes')
  }

  return (
    <>
      <Link to="/pacientes" className="btn-ghost -ml-3 mb-3 px-3 py-1.5"><ArrowLeft size={18} /> Pacientes</Link>

      <div className="card mb-4 p-4 sm:p-5">
        <div className="flex items-start gap-4">
          <Avatar nombre={p.nombre} size="lg" />
          <div className="min-w-0 flex-1">
            <h1 className="text-xl font-bold leading-tight sm:text-2xl">{p.nombre}</h1>
            <p className="mt-1 text-sm text-slate-500">
              {[e !== null && `${e} años`, p.documento && `CI ${p.documento}`, p.telefono].filter(Boolean).join(' · ') || 'Sin datos adicionales'}
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              {tel && <a href={`tel:${p.telefono}`} className="btn-soft px-3 py-2"><Phone size={16} /> Llamar</a>}
              {tel && <a href={`https://wa.me/${tel}`} target="_blank" rel="noreferrer" className="btn-soft px-3 py-2"><MessageCircle size={16} /> WhatsApp</a>}
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
          <div className="mt-3 flex items-center gap-2 rounded-xl bg-rose-50 px-3 py-2 text-sm font-medium text-rose-700">
            <Wallet size={17} /> Saldo pendiente: Bs {dinero(saldo)}
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
          <button className="btn-primary mb-4 w-full sm:w-auto" onClick={() => setParams({ consulta: 'nueva' })}><Plus size={18} /> Nueva consulta</button>
          {consultas?.length === 0 ? (
            <Vacio icono={<ClipboardList size={28} />} titulo="Sin consultas registradas" texto="Cada atención que registres aparecerá aquí, en orden cronológico." />
          ) : (
            <ol className="relative space-y-3 border-l-2 border-teal-100 pl-5">
              {consultas?.map((c) => (
                <li key={c.id} className="relative">
                  <span className="absolute -left-[27px] top-4 h-3 w-3 rounded-full border-2 border-white bg-teal-500 ring-2 ring-teal-100" />
                  <button onClick={() => setConsultaEdit(c)} className="card w-full p-4 text-left transition hover:border-teal-200">
                    <div className="flex items-start justify-between gap-2">
                      <p className="font-semibold">{c.motivo}</p>
                      <span className="shrink-0 text-xs text-slate-500">{fechaCorta(c.fecha)} · {hora(c.fecha)}</span>
                    </div>
                    {c.piezas && <span className="chip mt-1 bg-slate-100 text-slate-600">Pieza {c.piezas}</span>}
                    <dl className="mt-2 space-y-1 text-sm">
                      {c.diagnostico && <div><dt className="inline font-medium text-slate-500">Dx: </dt><dd className="inline">{c.diagnostico}</dd></div>}
                      {c.tratamiento && <div><dt className="inline font-medium text-slate-500">Tx: </dt><dd className="inline">{c.tratamiento}</dd></div>}
                      {c.notas && <div className="text-slate-500">{c.notas}</div>}
                    </dl>
                    {c.costo !== undefined && (
                      <p className="mt-2 text-xs text-slate-500">
                        Bs {dinero(c.costo)} · pagado Bs {dinero(c.pagado)}
                        {(c.costo ?? 0) > (c.pagado ?? 0) && <span className="ml-1 font-semibold text-rose-600">debe Bs {dinero((c.costo ?? 0) - (c.pagado ?? 0))}</span>}
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
      <Modal abierto={nuevaConsulta || !!consultaEdit} onCerrar={cerrarConsulta} titulo={consultaEdit ? 'Editar consulta' : 'Nueva consulta'}>
        <ConsultaForm key={consultaEdit?.id ?? 'nueva'} pacienteId={id} inicial={consultaEdit ?? undefined}
          motivoInicial={params.get('motivo') ?? ''} onGuardado={cerrarConsulta} />
        {consultaEdit && (
          <button className="btn-danger mt-3 w-full" onClick={async () => {
            if (confirm('¿Eliminar esta consulta?')) { await db.consultas.delete(consultaEdit.id!); cerrarConsulta() }
          }}><Trash2 size={16} /> Eliminar consulta</button>
        )}
      </Modal>
    </>
  )
}
