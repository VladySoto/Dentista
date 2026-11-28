import { useLiveQuery } from 'dexie-react-hooks'
import { History } from 'lucide-react'
import { useState } from 'react'
import { db, hoy, type Cara, type CarasDientes, type Denticion, type EstadoCara, type EstadoDiente, type Paciente } from '../lib/db'
import { edad, fechaCorta } from '../lib/format'
import { Modal } from './ui'

// ---------------------------------------------------------------- numeración FDI (vista del profesional)

const SUP = [18, 17, 16, 15, 14, 13, 12, 11, 21, 22, 23, 24, 25, 26, 27, 28]
const INF = [48, 47, 46, 45, 44, 43, 42, 41, 31, 32, 33, 34, 35, 36, 37, 38]
const SUP_T = [55, 54, 53, 52, 51, 61, 62, 63, 64, 65]
const INF_T = [85, 84, 83, 82, 81, 71, 72, 73, 74, 75]

const FILAS: Record<Denticion, { nums: number[]; arriba: boolean }[]> = {
  adulto: [{ nums: SUP, arriba: true }, { nums: INF, arriba: false }],
  nino: [{ nums: SUP_T, arriba: true }, { nums: INF_T, arriba: false }],
  mixta: [{ nums: SUP, arriba: true }, { nums: SUP_T, arriba: true }, { nums: INF_T, arriba: false }, { nums: INF, arriba: false }],
}

const NOMBRES_PERM = ['', 'incisivo central', 'incisivo lateral', 'canino', 'primer premolar', 'segundo premolar', 'primer molar', 'segundo molar', 'tercer molar']
const NOMBRES_TEMP = ['', 'incisivo central', 'incisivo lateral', 'canino', 'primer molar', 'segundo molar']
const LADOS = ['', 'superior derecho', 'superior izquierdo', 'inferior izquierdo', 'inferior derecho']

function nombreDiente(n: number) {
  const c = Math.floor(n / 10), p = n % 10
  const temporal = c >= 5
  const lado = LADOS[temporal ? c - 4 : c]
  return `${(temporal ? NOMBRES_TEMP : NOMBRES_PERM)[p]} ${lado}${temporal ? ' (de leche)' : ''}`
}

/** Qué cara del diente queda arriba, abajo, a la izquierda y a la derecha en el dibujo. */
function carasPorPosicion(n: number) {
  const c = Math.floor(n / 10)
  const cuad = c >= 5 ? c - 4 : c
  const superior = cuad <= 2
  const mesialIzq = cuad === 2 || cuad === 3
  return { arriba: superior ? 'V' : 'L', abajo: superior ? 'L' : 'V', izq: mesialIzq ? 'M' : 'D', der: mesialIzq ? 'D' : 'M', centro: 'O' } as const
}

const NOMBRE_CARA: Record<Cara, string> = { V: 'Vestibular', L: 'Lingual / palatino', M: 'Mesial', D: 'Distal', O: 'Oclusal / incisal' }

// ---------------------------------------------------------------- estados

export const ESTADOS: Record<EstadoDiente, { label: string; color: string }> = {
  sano: { label: 'Sano', color: 'bg-white border-slate-300 text-slate-500' },
  caries: { label: 'Caries', color: 'bg-rose-500 border-rose-600 text-white' },
  obturado: { label: 'Obturado', color: 'bg-sky-500 border-sky-600 text-white' },
  endodoncia: { label: 'Endodoncia', color: 'bg-violet-500 border-violet-600 text-white' },
  corona: { label: 'Corona', color: 'bg-amber-400 border-amber-500 text-amber-950' },
  implante: { label: 'Implante', color: 'bg-emerald-500 border-emerald-600 text-white' },
  extraido: { label: 'Extraído', color: 'bg-slate-200 border-slate-400 text-slate-600' },
  ausente: { label: 'Ausente', color: 'bg-slate-100 border-dashed border-slate-300 text-slate-500' },
}
const COLOR_CARA: Record<EstadoCara, string> = { caries: '#f43f5e', obturado: '#0ea5e9' }
const ESTADOS_DIENTE: EstadoDiente[] = ['endodoncia', 'corona', 'implante', 'extraido', 'ausente']

function denticionInicial(p: Paciente): Denticion {
  if (p.denticion) return p.denticion
  const e = edad(p.fechaNacimiento)
  return e === null || e >= 13 ? 'adulto' : e < 6 ? 'nino' : 'mixta'
}

// ---------------------------------------------------------------- dibujo de un diente

const REGIONES = {
  arriba: '0,0 30,0 22,8 8,8',
  der: '30,0 30,30 22,22 22,8',
  abajo: '0,30 30,30 22,22 8,22',
  izq: '0,0 8,8 8,22 0,30',
}

function Diente({ n, estado, caras, grande, onCara }: {
  n: number; estado?: EstadoDiente; caras?: Partial<Record<Cara, EstadoCara>>; grande?: boolean; onCara?: (c: Cara) => void
}) {
  const pos = carasPorPosicion(n)
  const todo = estado === 'caries' || estado === 'obturado' ? COLOR_CARA[estado] : estado === 'implante' ? '#a7f3d0' : undefined
  const relleno = (c: Cara) => (caras?.[c] ? COLOR_CARA[caras[c]!] : todo ?? '#fff')
  const trazo = grande ? 0.6 : 1.2
  const region = (clave: 'arriba' | 'der' | 'abajo' | 'izq') => {
    const c = pos[clave]
    return (
      <polygon key={clave} points={REGIONES[clave]} fill={relleno(c)} stroke="#94a3b8" strokeWidth={trazo}
        className={onCara ? 'cursor-pointer hover:opacity-80' : undefined} onClick={onCara && (() => onCara(c))}>
        {onCara && <title>{NOMBRE_CARA[c]}</title>}
      </polygon>
    )
  }
  return (
    <svg viewBox="-3 -3 36 36" className={`w-full ${estado === 'ausente' ? 'opacity-30' : ''}`} role={onCara ? undefined : 'img'} aria-hidden={!onCara}>
      {(['arriba', 'der', 'abajo', 'izq'] as const).map(region)}
      <rect x="8" y="8" width="14" height="14" fill={relleno('O')} stroke="#94a3b8" strokeWidth={trazo}
        className={onCara ? 'cursor-pointer hover:opacity-80' : undefined} onClick={onCara && (() => onCara('O'))}>
        {onCara && <title>{NOMBRE_CARA.O}</title>}
      </rect>
      {estado === 'endodoncia' && <rect x="-1.5" y="-1.5" width="33" height="33" fill="none" stroke="#8b5cf6" strokeWidth="3" rx="2" pointerEvents="none" />}
      {estado === 'corona' && <circle cx="15" cy="15" r="16.5" fill="none" stroke="#f59e0b" strokeWidth="3" pointerEvents="none" />}
      {estado === 'implante' && <text x="15" y="19.5" textAnchor="middle" fontSize="12" fontWeight="700" fill="#047857" pointerEvents="none">I</text>}
      {estado === 'extraido' && <g stroke="#e11d48" strokeWidth="3" strokeLinecap="round" pointerEvents="none"><line x1="1" y1="1" x2="29" y2="29" /><line x1="29" y1="1" x2="1" y2="29" /></g>}
      {estado === 'ausente' && <rect x="-1.5" y="-1.5" width="33" height="33" fill="none" stroke="#64748b" strokeWidth="1.5" strokeDasharray="3 2" pointerEvents="none" />}
    </svg>
  )
}

// ---------------------------------------------------------------- odontograma completo

export default function Odontograma({ paciente }: { paciente: Paciente }) {
  const id = paciente.id!
  const [denticion, setDenticion] = useState<Denticion>(() => denticionInicial(paciente))
  const [abierto, setAbierto] = useState<number | null>(null)
  const [verFecha, setVerFecha] = useState<string | null>(null)
  const historial = useLiveQuery(() => db.odontogramas.where('pacienteId').equals(id).reverse().sortBy('fecha'), [id])

  const pasado = verFecha ? historial?.find((h) => h.fecha === verFecha) : undefined
  const dientes = pasado?.dientes ?? paciente.dientes ?? {}
  const caras = pasado?.caras ?? paciente.caras ?? {}
  const anteriores = (historial ?? []).filter((h) => h.fecha !== hoy())

  /** Guarda el estado actual y una copia del día para el historial. */
  async function guardar(d: Record<number, EstadoDiente>, c: CarasDientes) {
    await db.transaction('rw', db.pacientes, db.odontogramas, async () => {
      await db.pacientes.update(id, { dientes: d, caras: c })
      const hoyGuardado = await db.odontogramas.where('[pacienteId+fecha]').equals([id, hoy()]).first()
      await db.odontogramas.put({ ...(hoyGuardado?.id ? { id: hoyGuardado.id } : {}), pacienteId: id, fecha: hoy(), dientes: d, caras: c })
    })
  }

  function cambiarDenticion(d: Denticion) {
    setDenticion(d)
    db.pacientes.update(id, { denticion: d })
  }

  // Resumen
  const conteo: Partial<Record<EstadoDiente, number>> = {}
  const todos = new Set([...Object.keys(dientes), ...Object.keys(caras)].map(Number))
  for (const n of todos) {
    const e = dientes[n]
    if (e) conteo[e] = (conteo[e] ?? 0) + 1
    for (const ec of new Set(Object.values(caras[n] ?? {}))) if (e !== ec) conteo[ec] = (conteo[ec] ?? 0) + 1
  }

  const fila = (nums: number[], arriba: boolean) => {
    const relleno = (16 - nums.length) / 2
    const mitad = nums.length / 2
    return (
      <div className="grid grid-cols-[repeat(8,minmax(0,1fr))_6px_repeat(8,minmax(0,1fr))] gap-0.5 sm:gap-1">
        {Array.from({ length: relleno }, (_, i) => <span key={`a${i}`} />)}
        {nums.map((n, i) => [
          i === mitad && <span key="sep" className="border-l border-dashed border-slate-300" />,
          <button key={n} type="button" disabled={!!pasado} onClick={() => setAbierto(n)} aria-label={`Diente ${n}`}
            className="flex flex-col items-center gap-0.5 rounded-md transition enabled:active:scale-90 enabled:hover:bg-teal-50">
            {arriba && <span className="text-[9px] text-slate-500 sm:text-[10px]">{n}</span>}
            <Diente n={n} estado={dientes[n]} caras={caras[n]} />
            {!arriba && <span className="text-[9px] text-slate-500 sm:text-[10px]">{n}</span>}
          </button>,
        ])}
        {Array.from({ length: relleno }, (_, i) => <span key={`b${i}`} />)}
      </div>
    )
  }

  const filas = FILAS[denticion]

  return (
    <div>
      <div className="mb-3 grid grid-cols-3 rounded-xl bg-slate-100 p-1">
        {([['adulto', 'Adulto'], ['mixta', 'Mixta'], ['nino', 'Niño (leche)']] as const).map(([k, l]) => (
          <button key={k} type="button" onClick={() => cambiarDenticion(k)}
            className={`rounded-lg py-1.5 text-xs font-semibold sm:text-sm ${denticion === k ? 'bg-white text-teal-700 shadow-sm' : 'text-slate-600'}`}>{l}</button>
        ))}
      </div>

      {anteriores.length > 0 && (
        <div className="mb-3 flex items-center gap-1.5 overflow-x-auto pb-1">
          <History size={16} className="shrink-0 text-slate-500" />
          <button type="button" onClick={() => setVerFecha(null)}
            className={`chip shrink-0 border px-3 py-1 ${!verFecha ? 'border-teal-700 bg-teal-700 text-white' : 'border-slate-200 bg-white text-slate-600'}`}>Actual</button>
          {anteriores.map((h) => (
            <button key={h.fecha} type="button" onClick={() => setVerFecha(h.fecha)}
              className={`chip shrink-0 border px-3 py-1 ${verFecha === h.fecha ? 'border-teal-700 bg-teal-700 text-white' : 'border-slate-200 bg-white text-slate-600'}`}>{fechaCorta(h.fecha)}</button>
          ))}
        </div>
      )}
      {pasado && <p className="mb-3 rounded-xl bg-sky-50 p-2.5 text-sm text-sky-800">Así estaba el <b>{fechaCorta(pasado.fecha)}</b> (solo lectura).</p>}

      {!pasado && <p className="mb-2 text-xs text-slate-500">Toca un diente para marcar sus caras o su estado.</p>}
      <div className="space-y-2 overflow-x-auto rounded-2xl bg-slate-50 p-2 sm:p-4">
        {filas.map((f, i) => (
          <div key={i}>
            {fila(f.nums, f.arriba)}
            {i === filas.length / 2 - 1 && <div className="mt-2 border-t border-dashed border-slate-300" />}
          </div>
        ))}
      </div>

      <div className="mt-3 flex flex-wrap gap-1.5">
        {(Object.keys(ESTADOS) as EstadoDiente[]).filter((k) => k !== 'sano').map((k) => (
          <span key={k} className={`chip border ${ESTADOS[k].color} ${conteo[k] ? '' : 'opacity-50'}`}>{ESTADOS[k].label}{conteo[k] ? ` · ${conteo[k]}` : ''}</span>
        ))}
      </div>

      <Modal abierto={abierto !== null} onCerrar={() => setAbierto(null)} titulo={abierto ? `Diente ${abierto}` : ''}>
        {abierto !== null && <EditorDiente n={abierto} estado={dientes[abierto]} caras={caras[abierto] ?? {}}
          onCambiar={(e, c) => {
            const d = { ...dientes }, cs = { ...caras }
            if (e) d[abierto] = e; else delete d[abierto]
            if (Object.keys(c).length) cs[abierto] = c; else delete cs[abierto]
            guardar(d, cs)
          }} />}
      </Modal>
    </div>
  )
}

function EditorDiente({ n, estado, caras, onCambiar }: {
  n: number; estado?: EstadoDiente; caras: Partial<Record<Cara, EstadoCara>>
  onCambiar: (estado: EstadoDiente | undefined, caras: Partial<Record<Cara, EstadoCara>>) => void
}) {
  const [pincel, setPincel] = useState<EstadoCara | 'sano'>('caries')

  function tocarCara(c: Cara) {
    const nuevas = { ...caras }
    // Un diente marcado entero con caries/obturado pasa a marcarse por caras
    const e = estado === 'caries' || estado === 'obturado' ? undefined : estado
    if (pincel === 'sano' || nuevas[c] === pincel) delete nuevas[c]
    else nuevas[c] = pincel
    onCambiar(e, nuevas)
  }

  return (
    <div className="space-y-4">
      <p className="-mt-2 text-sm text-slate-500 first-letter:uppercase">{nombreDiente(n)}</p>
      <div>
        <span className="label">1. Elige y toca las caras del dibujo</span>
        <div className="grid grid-cols-3 gap-2">
          {([['caries', 'Caries', 'bg-rose-500'], ['obturado', 'Obturado', 'bg-sky-500'], ['sano', 'Sana', 'bg-white border border-slate-300']] as const).map(([k, l, c]) => (
            <button key={k} type="button" onClick={() => setPincel(k)}
              className={`flex items-center justify-center gap-2 rounded-xl border-2 py-2 text-sm font-semibold ${pincel === k ? 'border-teal-600 bg-teal-50 text-teal-800' : 'border-slate-200 text-slate-600'}`}>
              <span className={`h-3.5 w-3.5 rounded ${c}`} />{l}
            </button>
          ))}
        </div>
      </div>
      <div className="mx-auto w-52 select-none">
        <Diente n={n} estado={estado} caras={caras} grande onCara={tocarCara} />
        <div className="mt-1 grid grid-cols-3 text-center text-[10px] text-slate-500">
          <span>{carasPorPosicion(n).izq === 'M' ? '← Mesial' : '← Distal'}</span>
          <span>Centro: oclusal</span>
          <span>{carasPorPosicion(n).der === 'M' ? 'Mesial →' : 'Distal →'}</span>
        </div>
      </div>
      <div>
        <span className="label">2. O marca el diente completo</span>
        <div className="flex flex-wrap gap-1.5">
          {ESTADOS_DIENTE.map((k) => (
            <button key={k} type="button" onClick={() => onCambiar(estado === k ? undefined : k, k === 'extraido' || k === 'ausente' ? {} : caras)}
              className={`chip border px-3 py-1.5 text-sm transition ${ESTADOS[k].color} ${estado === k ? 'ring-2 ring-teal-500 ring-offset-1' : 'opacity-70'}`}>
              {ESTADOS[k].label}
            </button>
          ))}
        </div>
      </div>
      <button type="button" className="btn-ghost w-full" onClick={() => onCambiar(undefined, {})}>Dejar todo el diente sano</button>
    </div>
  )
}
