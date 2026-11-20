import { Check, Fingerprint } from 'lucide-react'
import { useEffect, useState, type FormEvent } from 'react'
import { activarHuella, crearPin, estadoBloqueo, fijarMinutos, huellaDisponible, quitarBloqueo, quitarHuella, verificarPin } from '../lib/bloqueo'
import { Campo } from './ui'

type Estado = Awaited<ReturnType<typeof estadoBloqueo>>

export default function AjustesBloqueo() {
  const [estado, setEstado] = useState<Estado | null>(null)
  const [conHuella, setConHuella] = useState(false)
  const [modo, setModo] = useState<'nada' | 'crear' | 'quitar'>('nada')
  const [msg, setMsg] = useState('')

  const cargar = () => estadoBloqueo().then(setEstado)
  useEffect(() => { cargar(); huellaDisponible().then(setConHuella) }, [])
  if (!estado) return null

  if (modo === 'crear') return <CrearPin onListo={() => { setModo('nada'); cargar(); setMsg('PIN guardado. La app pedirá el PIN al abrirse.') }} onCancelar={() => setModo('nada')} />
  if (modo === 'quitar') return <QuitarPin onListo={() => { setModo('nada'); cargar(); setMsg('Bloqueo desactivado.') }} onCancelar={() => setModo('nada')} />

  return (
    <div className="space-y-4">
      {!estado.tienePin ? (
        <>
          <p className="rounded-xl bg-amber-50 p-3 text-sm text-amber-900">Ahora cualquiera que tome este dispositivo puede ver los datos de los pacientes.</p>
          <button className="btn-primary" onClick={() => { setMsg(''); setModo('crear') }}>Activar PIN</button>
        </>
      ) : (
        <>
          <p className="flex items-center gap-2 rounded-xl bg-emerald-50 p-3 text-sm font-medium text-emerald-800"><Check size={18} /> La app está protegida con un PIN de {estado.largo} dígitos.</p>
          <Campo label="Bloquear cuando la app quede sin usar">
            <select className="input" value={estado.minutos} onChange={async (e) => { await fijarMinutos(Number(e.target.value)); cargar() }}>
              <option value={0}>Apenas se cierre o cambie de app</option>
              <option value={1}>Después de 1 minuto</option>
              <option value={5}>Después de 5 minutos</option>
              <option value={15}>Después de 15 minutos</option>
              <option value={60}>Después de 1 hora</option>
            </select>
          </Campo>
          {conHuella && (
            estado.tieneHuella ? (
              <div className="flex flex-wrap items-center gap-2">
                <span className="flex items-center gap-1.5 text-sm text-emerald-700"><Fingerprint size={18} /> Huella activada</span>
                <button className="btn-ghost px-3 py-1.5 text-xs" onClick={async () => { await quitarHuella(); cargar() }}>Quitar huella</button>
              </div>
            ) : (
              <button className="btn-soft" onClick={async () => {
                setMsg('')
                try { await activarHuella(); cargar(); setMsg('Huella activada.') } catch { setMsg('No se pudo activar la huella. Puedes seguir usando el PIN.') }
              }}><Fingerprint size={18} /> Usar también huella o rostro</button>
            )
          )}
          <div className="flex flex-wrap gap-2 border-t border-slate-100 pt-3">
            <button className="btn-ghost px-3 py-1.5 text-xs" onClick={() => { setMsg(''); setModo('crear') }}>Cambiar PIN</button>
            <button className="btn-ghost px-3 py-1.5 text-xs text-rose-600" onClick={() => { setMsg(''); setModo('quitar') }}>Desactivar bloqueo</button>
          </div>
        </>
      )}
      {msg && <p className="text-sm font-medium text-teal-700">{msg}</p>}
    </div>
  )
}

function CrearPin({ onListo, onCancelar }: { onListo: () => void; onCancelar: () => void }) {
  const [a, setA] = useState('')
  const [b, setB] = useState('')
  const [error, setError] = useState('')
  async function guardar(e: FormEvent) {
    e.preventDefault()
    if (!/^\d{4,6}$/.test(a)) return setError('El PIN debe tener de 4 a 6 números.')
    if (/^(\d)\1+$/.test(a) || '0123456789'.includes(a) || '9876543210'.includes(a)) return setError('Elige un PIN menos fácil de adivinar (no 1111 ni 1234).')
    if (a !== b) return setError('Los dos PIN no coinciden.')
    await crearPin(a)
    onListo()
  }
  const prop = { className: 'input text-center text-2xl tracking-[0.5em]', type: 'password', inputMode: 'numeric' as const, autoComplete: 'off', maxLength: 6 }
  return (
    <form onSubmit={guardar} className="space-y-3">
      <Campo label="Nuevo PIN (4 a 6 números)"><input {...prop} value={a} onChange={(e) => setA(e.target.value.replace(/\D/g, ''))} autoFocus /></Campo>
      <Campo label="Repite el PIN"><input {...prop} value={b} onChange={(e) => setB(e.target.value.replace(/\D/g, ''))} /></Campo>
      {error && <p className="rounded-xl bg-rose-50 p-3 text-sm text-rose-700">{error}</p>}
      <p className="text-xs text-slate-500">Si lo olvidas, podrás quitarlo con la contraseña de tu cuenta en la nube.</p>
      <div className="flex gap-2"><button className="btn-primary">Guardar PIN</button><button type="button" className="btn-ghost" onClick={onCancelar}>Cancelar</button></div>
    </form>
  )
}

function QuitarPin({ onListo, onCancelar }: { onListo: () => void; onCancelar: () => void }) {
  const [pin, setPin] = useState('')
  const [error, setError] = useState('')
  return (
    <form className="space-y-3" onSubmit={async (e) => {
      e.preventDefault()
      if (!(await verificarPin(pin))) return setError('PIN incorrecto.')
      await quitarBloqueo(); onListo()
    }}>
      <Campo label="Escribe tu PIN actual">
        <input className="input text-center text-2xl tracking-[0.5em]" type="password" inputMode="numeric" maxLength={6} value={pin} onChange={(e) => setPin(e.target.value.replace(/\D/g, ''))} autoFocus />
      </Campo>
      {error && <p className="rounded-xl bg-rose-50 p-3 text-sm text-rose-700">{error}</p>}
      <div className="flex gap-2"><button className="btn-danger">Desactivar</button><button type="button" className="btn-ghost" onClick={onCancelar}>Cancelar</button></div>
    </form>
  )
}
