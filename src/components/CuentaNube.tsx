import { Cloud, CloudOff, LogOut, RefreshCw } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { cerrarSesion, crearCuenta, iniciarSesion, sincronizar, useSync } from '../lib/sync'
import { Campo, Segmentado } from './ui'

export default function CuentaNube() {
  const s = useSync()
  const [modo, setModo] = useState<'entrar' | 'crear'>('entrar')
  const [email, setEmail] = useState('')
  const [clave, setClave] = useState('')
  const [msg, setMsg] = useState<{ ok: boolean; texto: string } | null>(null)
  const [cargando, setCargando] = useState(false)

  async function enviar(e: FormEvent) {
    e.preventDefault()
    setCargando(true); setMsg(null)
    try {
      if (modo === 'entrar') await iniciarSesion(email.trim(), clave)
      else {
        const { requiereConfirmar } = await crearCuenta(email.trim(), clave)
        if (requiereConfirmar) setMsg({ ok: true, texto: 'Cuenta creada. Te enviamos un correo: ábrelo y toca el enlace para confirmar. Luego vuelve aquí e inicia sesión.' })
      }
    } catch (err) {
      setMsg({ ok: false, texto: (err as Error).message })
    } finally {
      setCargando(false)
    }
  }

  if (s.sesion) {
    const textoEstado = {
      apagado: 'Desconectado',
      sincronizando: 'Sincronizando…',
      ok: `Todo guardado en la nube${s.ultimo ? ` · ${new Date(s.ultimo).toLocaleTimeString('es', { hour: '2-digit', minute: '2-digit' })}` : ''}`,
      'sin-conexion': 'Sin internet: los cambios se guardan aquí y se subirán solos',
      error: `No se pudo sincronizar${s.error ? `: ${s.error}` : ''}`,
    }[s.estado]
    return (
      <div className="space-y-3">
        <div className={`flex items-start gap-3 rounded-xl p-3 text-sm ${s.estado === 'error' ? 'bg-rose-50 text-rose-800' : s.estado === 'sin-conexion' ? 'bg-amber-50 text-amber-900' : 'bg-emerald-50 text-emerald-900'}`}>
          {s.estado === 'sin-conexion' || s.estado === 'error' ? <CloudOff size={20} className="shrink-0" /> : <Cloud size={20} className="shrink-0" />}
          <div className="min-w-0">
            <p className="font-semibold">{textoEstado}</p>
            <p className="truncate text-xs opacity-80">{s.sesion.user.email}{s.pendientes > 0 && ` · ${s.pendientes} cambio(s) por subir`}</p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <button className="btn-soft" onClick={() => sincronizar()} disabled={s.estado === 'sincronizando'}>
            <RefreshCw size={17} className={s.estado === 'sincronizando' ? 'animate-spin' : ''} /> Sincronizar ahora
          </button>
          <button className="btn-ghost" onClick={() => confirm('¿Cerrar sesión en este dispositivo? Los datos se quedan guardados aquí.') && cerrarSesion()}>
            <LogOut size={17} /> Cerrar sesión
          </button>
        </div>
      </div>
    )
  }

  return (
    <form onSubmit={enviar} className="space-y-3">
      <Segmentado className="bg-slate-100" opciones={[['entrar', 'Iniciar sesión'], ['crear', 'Crear cuenta']] as const} valor={modo} onCambiar={(k) => { setModo(k); setMsg(null) }} />
      <Campo label="Correo"><input className="input" type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} /></Campo>
      <Campo label="Contraseña">
        <input className="input" type="password" autoComplete={modo === 'crear' ? 'new-password' : 'current-password'} required minLength={6} value={clave} onChange={(e) => setClave(e.target.value)} />
      </Campo>
      {msg && <p className={`rounded-xl p-3 text-sm ${msg.ok ? 'bg-emerald-50 text-emerald-800' : 'bg-rose-50 text-rose-700'}`}>{msg.texto}</p>}
      <button className="btn-primary w-full" disabled={cargando}>{cargando ? 'Un momento…' : modo === 'entrar' ? 'Iniciar sesión' : 'Crear cuenta'}</button>
    </form>
  )
}

/** Pequeño indicador de estado para la barra de navegación. */
export function IndicadorNube() {
  const s = useSync()
  if (!s.sesion) return <span title="Sin cuenta: datos solo en este dispositivo" className="h-2 w-2 rounded-full bg-slate-300" />
  const color = { apagado: 'bg-slate-300', sincronizando: 'bg-sky-400 animate-pulse', ok: 'bg-emerald-500', 'sin-conexion': 'bg-amber-400', error: 'bg-rose-500' }[s.estado]
  return <span title={s.estado} className={`h-2 w-2 rounded-full ${color}`} />
}
