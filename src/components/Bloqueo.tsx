import { Delete, Fingerprint, Loader2, Lock } from 'lucide-react'
import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
import { borrarDispositivo, estadoBloqueo, quitarBloqueo, verificarHuella, verificarPin } from '../lib/bloqueo'
import { supabase } from '../lib/supabase'
import { useSync } from '../lib/sync'
import { useConfig } from '../lib/useConfig'
import { Modal } from './ui'

type Estado = Awaited<ReturnType<typeof estadoBloqueo>>

// Compartido entre pantallas: si ya se desbloqueó, abrir el cartel no vuelve a pedir el PIN
let abierta = false

/** Muestra la pantalla de PIN al abrir la app y después de un rato sin usarla. */
export default function Bloqueo({ children }: { children: ReactNode }) {
  const [estado, setEstado] = useState<Estado | null>(null)
  const [bloqueado, setBloqueadoLocal] = useState(!abierta)
  const setBloqueado = useCallback((b: boolean) => { abierta = !b; setBloqueadoLocal(b) }, [])
  const oculto = useRef<number | null>(null)

  const cargar = useCallback(async (inicial = false) => {
    const e = await estadoBloqueo()
    setEstado(e)
    if (inicial) setBloqueado(e.tienePin && !abierta)
    else if (!e.tienePin) setBloqueado(false)
  }, [setBloqueado])

  useEffect(() => {
    cargar(true)
    const cambio = () => cargar()
    const vis = () => {
      if (document.visibilityState === 'hidden') oculto.current = Date.now()
      else if (oculto.current !== null) {
        const fuera = Date.now() - oculto.current
        oculto.current = null
        estadoBloqueo().then((e) => { if (e.tienePin && fuera >= e.minutos * 60_000) setBloqueado(true) })
      }
    }
    window.addEventListener('bloqueo-cambio', cambio)
    document.addEventListener('visibilitychange', vis)
    return () => { window.removeEventListener('bloqueo-cambio', cambio); document.removeEventListener('visibilitychange', vis) }
  }, [cargar, setBloqueado])

  if (!estado) return <div className="flex min-h-screen items-center justify-center text-teal-700"><Loader2 className="animate-spin" size={32} /></div>
  if (bloqueado && estado.tienePin) return <PantallaPin estado={estado} onAbrir={() => setBloqueado(false)} />
  return <>{children}</>
}

function PantallaPin({ estado, onAbrir }: { estado: Estado; onAbrir: () => void }) {
  const config = useConfig()
  const [pin, setPin] = useState('')
  const [error, setError] = useState('')
  const [fallos, setFallos] = useState(0)
  const [esperaHasta, setEsperaHasta] = useState(0)
  const [ahora, setAhora] = useState(Date.now())
  const [olvido, setOlvido] = useState(false)
  const [verificando, setVerificando] = useState(false)
  const intentoHuella = useRef(false)

  const usarHuella = useCallback(async () => {
    if (await verificarHuella()) onAbrir()
  }, [onAbrir])

  useEffect(() => {
    if (estado.tieneHuella && !intentoHuella.current) { intentoHuella.current = true; usarHuella() }
  }, [estado.tieneHuella, usarHuella])

  useEffect(() => {
    if (esperaHasta <= Date.now()) return
    const t = setInterval(() => setAhora(Date.now()), 500)
    return () => clearInterval(t)
  }, [esperaHasta])

  const esperando = esperaHasta > ahora
  const segundos = Math.ceil((esperaHasta - ahora) / 1000)

  async function probar(valor: string) {
    setVerificando(true)
    const ok = await verificarPin(valor)
    setVerificando(false)
    if (ok) return onAbrir()
    const n = fallos + 1
    setFallos(n); setPin('')
    if (n >= 5) { setEsperaHasta(Date.now() + 30_000 * Math.pow(2, Math.floor(n / 5) - 1)); setAhora(Date.now()); setError('Demasiados intentos.') }
    else setError(`PIN incorrecto. Quedan ${5 - (n % 5)} intento(s).`)
    navigator.vibrate?.(200)
  }

  function tecla(d: string) {
    if (esperando || verificando) return
    setError('')
    const nuevo = (pin + d).slice(0, estado.largo)
    setPin(nuevo)
    if (nuevo.length === estado.largo) probar(nuevo)
  }

  useEffect(() => {
    const fn = (e: KeyboardEvent) => {
      if (/^\d$/.test(e.key)) tecla(e.key)
      else if (e.key === 'Backspace') setPin((p) => p.slice(0, -1))
    }
    document.addEventListener('keydown', fn)
    return () => document.removeEventListener('keydown', fn)
  })

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-gradient-to-b from-teal-700 to-cyan-800 px-6 py-10 text-white">
      <div className="mb-2 rounded-2xl bg-white/15 p-4"><Lock size={32} /></div>
      <p className="text-lg font-bold">{config.consultorio}</p>
      <p className="mb-6 text-sm text-teal-100">{esperando ? `Espera ${segundos} s para intentar de nuevo` : verificando ? 'Verificando…' : 'Ingresa tu PIN'}</p>
      <div className="mb-3 flex gap-3" aria-label={`${pin.length} de ${estado.largo} dígitos`}>
        {Array.from({ length: estado.largo }, (_, i) => (
          <span key={i} className={`h-4 w-4 rounded-full border-2 border-white ${i < pin.length ? 'bg-white' : ''}`} />
        ))}
      </div>
      <p className="mb-4 h-5 text-sm font-medium text-amber-200">{error}</p>
      <div className="grid w-full max-w-xs grid-cols-3 gap-3">
        {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((d) => (
          <button key={d} onClick={() => tecla(d)} disabled={esperando}
            className="aspect-square rounded-full bg-white/10 text-3xl font-semibold transition hover:bg-white/20 active:scale-95 active:bg-white/30 disabled:opacity-40">{d}</button>
        ))}
        {estado.tieneHuella ? (
          <button onClick={usarHuella} aria-label="Usar huella" className="flex aspect-square items-center justify-center rounded-full transition hover:bg-white/10 active:scale-95"><Fingerprint size={34} /></button>
        ) : <span />}
        <button onClick={() => tecla('0')} disabled={esperando}
          className="aspect-square rounded-full bg-white/10 text-3xl font-semibold transition hover:bg-white/20 active:scale-95 active:bg-white/30 disabled:opacity-40">0</button>
        <button onClick={() => setPin((p) => p.slice(0, -1))} aria-label="Borrar" className="flex aspect-square items-center justify-center rounded-full transition hover:bg-white/10 active:scale-95"><Delete size={28} /></button>
      </div>
      <button className="mt-8 text-sm text-teal-100 underline-offset-2 hover:underline" onClick={() => setOlvido(true)}>¿Olvidaste tu PIN?</button>
      <Modal abierto={olvido} onCerrar={() => setOlvido(false)} titulo="Recuperar acceso">
        <Recuperar onListo={onAbrir} />
      </Modal>
    </div>
  )
}

function Recuperar({ onListo }: { onListo: () => void }) {
  const { sesion } = useSync()
  const [clave, setClave] = useState('')
  const [error, setError] = useState('')
  const [cargando, setCargando] = useState(false)

  if (!sesion?.user.email) return (
    <div className="space-y-4 text-sm text-slate-600">
      <p>Este dispositivo no tiene cuenta en la nube, así que no hay forma de comprobar quién eres.</p>
      <p>La única opción es <b>borrar todos los datos de este dispositivo</b> y empezar de nuevo (o restaurar un respaldo).</p>
      <button className="btn-danger w-full" onClick={() => confirm('¿Borrar TODOS los datos de este dispositivo? No se puede deshacer.') && borrarDispositivo()}>Borrar datos del dispositivo</button>
    </div>
  )

  return (
    <form className="space-y-4" onSubmit={async (e) => {
      e.preventDefault()
      setCargando(true); setError('')
      const { error } = await supabase.auth.signInWithPassword({ email: sesion.user.email!, password: clave })
      setCargando(false)
      if (error) return setError(/fetch/i.test(error.message) ? 'Necesitas internet para comprobar la contraseña.' : 'Contraseña incorrecta.')
      await quitarBloqueo()
      onListo()
    }}>
      <p className="text-sm text-slate-600">Escribe la contraseña de tu cuenta en la nube (<b>{sesion.user.email}</b>). Se quitará el PIN y podrás crear uno nuevo en Ajustes.</p>
      <input className="input" type="password" autoComplete="current-password" required value={clave} onChange={(e) => setClave(e.target.value)} autoFocus aria-label="Contraseña de la nube" />
      {error && <p className="rounded-xl bg-rose-50 p-3 text-sm text-rose-700">{error}</p>}
      <button className="btn-primary w-full" disabled={cargando}>{cargando ? 'Comprobando…' : 'Quitar PIN'}</button>
    </form>
  )
}
