import { BellRing, CheckCircle2, Loader2, PartyPopper, XCircle } from 'lucide-react'
import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react'
import { useParams } from 'react-router-dom'
import { hoy } from '../lib/db'
import { supabase } from '../lib/supabase'

type Info = { consultorio: string; horario?: string; direccion?: string }
type Guardado = { turno: string; numero: number; fecha: string }
type Estado = { numero: number; estado: 'espera' | 'atencion' | 'atendido' | 'cancelado'; antes: number; atendiendo: number | null }

const MOTIVOS = ['Dolor', 'Control', 'Limpieza', 'Extracción', 'Curación', 'Urgencia', 'Otro']

const leer = (codigo: string): Guardado | null => {
  try {
    const g = JSON.parse(localStorage.getItem(`turno:${codigo}`) ?? 'null') as Guardado | null
    return g && g.fecha === hoy() ? g : null
  } catch { return null }
}
const guardar = (codigo: string, g: Guardado | null) => {
  try { g ? localStorage.setItem(`turno:${codigo}`, JSON.stringify(g)) : localStorage.removeItem(`turno:${codigo}`) } catch { /* sin almacenamiento */ }
}

/** Página pública: el paciente toma turno desde su celular (sin cuenta). */
export default function TomarTurno() {
  const codigo = useParams().codigo ?? ''
  const [info, setInfo] = useState<Info | null | undefined>(undefined)
  const [mio, setMio] = useState<Guardado | null>(() => leer(codigo))

  useEffect(() => {
    supabase.rpc('info_consultorio', { p_codigo: codigo }).then(({ data, error }) => setInfo(error ? null : (data as Info | null)))
  }, [codigo])

  return (
    <div className="min-h-screen bg-gradient-to-b from-teal-50 to-slate-50 px-4 pb-10 pt-6 text-lg">
      <div className="mx-auto max-w-md">
        <header className="mb-6 flex items-center gap-3">
          <img src="/icon.svg" alt="" className="h-12 w-12" />
          <div className="min-w-0">
            <p className="truncate text-xl font-bold leading-tight">{info?.consultorio ?? 'Consultorio Dental'}</p>
            {info?.horario && <p className="text-sm text-slate-500">{info.horario}</p>}
          </div>
        </header>
        {info === undefined ? <Cargando /> : info === null ? (
          <Aviso icono={<XCircle size={48} className="text-rose-500" />} titulo="No se pudo abrir"
            texto="El código QR no es válido o no hay internet. Pida una ficha numerada en la puerta." />
        ) : mio ? (
          <MiTurno codigo={codigo} mio={mio} onOtro={() => { guardar(codigo, null); setMio(null) }} />
        ) : (
          <Formulario codigo={codigo} onListo={(g) => { guardar(codigo, g); setMio(g) }} />
        )}
      </div>
    </div>
  )
}

function Formulario({ codigo, onListo }: { codigo: string; onListo: (g: Guardado) => void }) {
  const [f, setF] = useState({ nombre: '', documento: '', telefono: '', motivo: '' })
  const [error, setError] = useState('')
  const [enviando, setEnviando] = useState(false)

  async function enviar(e: FormEvent) {
    e.preventDefault()
    setEnviando(true); setError('')
    const { data, error } = await supabase.rpc('tomar_turno', {
      p_codigo: codigo, p_fecha: hoy(), p_nombre: f.nombre, p_documento: f.documento, p_telefono: f.telefono, p_motivo: f.motivo,
    })
    setEnviando(false)
    if (error) return setError(/fetch|network/i.test(error.message) ? 'No hay internet. Intente de nuevo o tome una ficha en la puerta.' : error.message)
    const r = data as { turno: string; numero: number }
    onListo({ turno: r.turno, numero: r.numero, fecha: hoy() })
  }

  const input = 'w-full rounded-2xl border-2 border-slate-300 bg-white px-4 py-3.5 text-lg outline-none focus:border-teal-500'
  return (
    <form onSubmit={enviar} className="space-y-5">
      <h1 className="text-3xl font-bold">Tome su turno</h1>
      <label className="block">
        <span className="mb-1.5 block font-semibold">Su nombre y apellido *</span>
        <input className={input} required minLength={2} maxLength={80} autoComplete="name" value={f.nombre} onChange={(e) => setF({ ...f, nombre: e.target.value })} />
      </label>
      <label className="block">
        <span className="mb-1.5 block font-semibold">Número de carnet <span className="font-normal text-slate-500">(si ya vino antes)</span></span>
        <input className={input} inputMode="numeric" maxLength={20} value={f.documento} onChange={(e) => setF({ ...f, documento: e.target.value })} />
      </label>
      <label className="block">
        <span className="mb-1.5 block font-semibold">Celular <span className="font-normal text-slate-500">(opcional)</span></span>
        <input className={input} type="tel" inputMode="tel" maxLength={20} autoComplete="tel" value={f.telefono} onChange={(e) => setF({ ...f, telefono: e.target.value })} />
      </label>
      <fieldset>
        <legend className="mb-2 font-semibold">¿Por qué viene hoy?</legend>
        <div className="grid grid-cols-2 gap-2">
          {MOTIVOS.map((m) => (
            <button key={m} type="button" onClick={() => setF({ ...f, motivo: f.motivo === m ? '' : m })}
              className={`rounded-2xl border-2 py-3 font-semibold transition ${f.motivo === m ? 'border-teal-600 bg-teal-600 text-white' : 'border-slate-200 bg-white text-slate-700'}`}>{m}</button>
          ))}
        </div>
      </fieldset>
      {error && <p className="rounded-2xl bg-rose-50 p-4 text-base font-medium text-rose-700">{error}</p>}
      <button disabled={enviando} className="flex w-full items-center justify-center gap-2 rounded-2xl bg-teal-600 py-4 text-xl font-bold text-white shadow-lg shadow-teal-600/30 active:scale-[.98] disabled:opacity-60">
        {enviando ? <><Loader2 className="animate-spin" /> Un momento…</> : 'Tomar turno'}
      </button>
    </form>
  )
}

function MiTurno({ codigo, mio, onOtro }: { codigo: string; mio: Guardado; onOtro: () => void }) {
  const [e, setE] = useState<Estado | null>(null)
  const [avisos, setAvisos] = useState(() => typeof Notification !== 'undefined' && Notification.permission === 'granted')
  const avisado = useRef<{ cerca?: boolean; turno?: boolean }>({})

  const consultar = useCallback(async () => {
    const { data } = await supabase.rpc('mi_turno', { p_codigo: codigo, p_turno: mio.turno })
    if (data) setE(data as Estado)
  }, [codigo, mio.turno])

  useEffect(() => {
    consultar()
    const t = setInterval(() => document.visibilityState === 'visible' && consultar(), 10_000)
    const v = () => document.visibilityState === 'visible' && consultar()
    document.addEventListener('visibilitychange', v)
    return () => { clearInterval(t); document.removeEventListener('visibilitychange', v) }
  }, [consultar])

  // Avisos: cuando faltan 2 o menos, y cuando le toca
  useEffect(() => {
    if (!e) return
    if (e.estado === 'atencion' && !avisado.current.turno) {
      avisado.current.turno = true
      avisar(`¡Es su turno! Turno ${e.numero}`, 'Pase al consultorio.')
    } else if (e.estado === 'espera' && e.antes <= 2 && !avisado.current.cerca) {
      avisado.current.cerca = true
      if (e.antes > 0) avisar(`Ya casi es su turno (${e.numero})`, e.antes === 1 ? 'Falta 1 persona.' : `Faltan ${e.antes} personas.`)
    }
  }, [e])

  async function activarAvisos() {
    prepararSonido() // el navegador solo permite sonar si se preparó con un toque
    setAvisos(true)
    if (typeof Notification !== 'undefined' && Notification.permission === 'default') await Notification.requestPermission()
  }

  const numero = e?.numero ?? mio.numero
  const estado = e?.estado ?? 'espera'

  if (estado === 'atencion') return (
    <div className="animate-pulse rounded-3xl bg-teal-600 p-8 text-center text-white shadow-xl">
      <PartyPopper size={56} className="mx-auto mb-3" />
      <p className="text-2xl font-bold">¡Es su turno!</p>
      <p className="my-2 text-8xl font-black">{numero}</p>
      <p className="text-xl">Pase al consultorio</p>
    </div>
  )
  if (estado === 'atendido') return <Aviso icono={<CheckCircle2 size={56} className="text-teal-600" />} titulo="¡Gracias por su visita!" texto="Su atención ya terminó." accion={<button className="mt-6 text-base text-teal-700 underline" onClick={onOtro}>Tomar un turno nuevo</button>} />
  if (estado === 'cancelado') return <Aviso icono={<XCircle size={56} className="text-slate-400" />} titulo="Turno cancelado" texto="Si todavía necesita atención, tome un turno nuevo." accion={<button className="mt-6 w-full rounded-2xl bg-teal-600 py-4 text-xl font-bold text-white" onClick={onOtro}>Tomar turno</button>} />

  return (
    <div className="space-y-5 text-center">
      <div className="rounded-3xl bg-white p-8 shadow-xl shadow-teal-900/5">
        <p className="text-lg text-slate-500">Su número de turno</p>
        <p className="my-1 text-9xl font-black tracking-tight text-teal-600">{numero}</p>
        <p className="text-2xl font-bold">
          {!e ? 'Consultando…' : e.antes === 0 ? 'Usted es el siguiente' : e.antes === 1 ? 'Falta 1 persona' : `Faltan ${e.antes} personas`}
        </p>
        {e?.atendiendo != null && <p className="mt-2 text-base text-slate-500">Ahora atendiendo: turno {e.atendiendo}</p>}
      </div>
      {!avisos ? (
        <button onClick={activarAvisos} className="flex w-full items-center justify-center gap-2 rounded-2xl border-2 border-teal-600 bg-white py-4 text-lg font-bold text-teal-700">
          <BellRing /> Avisarme cuando me toque
        </button>
      ) : (
        <p className="flex items-center justify-center gap-2 rounded-2xl bg-teal-50 p-3 text-base text-teal-800"><BellRing size={20} /> Le avisaremos con sonido y vibración</p>
      )}
      <p className="text-base text-slate-500">Deje esta página abierta. Se actualiza sola.</p>
      <button className="text-sm text-slate-400 underline" onClick={() => confirm('¿Tomar un turno nuevo? Este número ya no se mostrará aquí.') && onOtro()}>Tomar otro turno</button>
    </div>
  )
}

let audio: AudioContext | null = null
function prepararSonido() {
  try { audio ??= new AudioContext(); audio.resume() } catch { /* sin sonido */ }
}

function avisar(titulo: string, cuerpo: string) {
  try { navigator.vibrate?.([400, 200, 400, 200, 600]) } catch { /* sin vibración */ }
  try {
    const ctx = audio ?? new AudioContext()
    ;[0, 0.35].forEach((t) => {
      const o = ctx.createOscillator(); const g = ctx.createGain()
      o.frequency.value = 880; o.connect(g); g.connect(ctx.destination)
      g.gain.setValueAtTime(0.3, ctx.currentTime + t); g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + t + 0.3)
      o.start(ctx.currentTime + t); o.stop(ctx.currentTime + t + 0.3)
    })
  } catch { /* sin sonido */ }
  if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
    navigator.serviceWorker?.ready
      .then((r) => r.showNotification(titulo, { body: cuerpo, icon: '/icon.svg', tag: 'turno' }))
      .catch(() => new Notification(titulo, { body: cuerpo, icon: '/icon.svg' }))
  }
}

const Cargando = () => <div className="flex justify-center py-20 text-teal-600"><Loader2 size={40} className="animate-spin" /></div>

function Aviso({ icono, titulo, texto, accion }: { icono: React.ReactNode; titulo: string; texto: string; accion?: React.ReactNode }) {
  return (
    <div className="rounded-3xl bg-white p-8 text-center shadow-xl shadow-teal-900/5">
      <div className="mb-3 flex justify-center">{icono}</div>
      <p className="text-2xl font-bold">{titulo}</p>
      <p className="mt-2 text-slate-600">{texto}</p>
      {accion}
    </div>
  )
}
