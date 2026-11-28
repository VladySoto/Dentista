import { Copy, ExternalLink, Printer, QrCode, RefreshCw } from 'lucide-react'
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { db } from '../lib/db'
import { nuevoCodigoQR, urlTurnos, useQR } from '../lib/qr'
import { useSync } from '../lib/sync'
import { useConfig } from '../lib/useConfig'
import { confirmar } from '../lib/dialogo'

export default function TurnosQR() {
  const config = useConfig()
  const { sesion } = useSync()
  const url = config.codigoQR ? urlTurnos(config.codigoQR) : undefined
  const qr = useQR(url, 320)
  const [copiado, setCopiado] = useState(false)

  const guardarCodigo = (codigoQR: string | undefined) => db.config.update('general', { codigoQR })

  if (!sesion) return (
    <p className="rounded-xl bg-slate-50 p-3 text-sm text-slate-600">
      Primero inicia sesión en <b>Cuenta y nube</b> (arriba): los turnos por QR llegan a través de la nube.
    </p>
  )

  if (!url) return (
    <button className="btn-primary" onClick={() => guardarCodigo(nuevoCodigoQR())}><QrCode size={18} /> Activar turnos por QR</button>
  )

  return (
    <div className="space-y-4">
      <div className="flex flex-col items-center gap-4 sm:flex-row sm:items-start">
        {qr && <img src={qr} alt="QR para tomar turno" className="w-44 rounded-xl border border-slate-200 p-1" />}
        <div className="min-w-0 flex-1 space-y-2">
          <p className="text-sm text-slate-600">Los pacientes toman su ficha de papel, escanean este código y escriben el número de su ficha: ven cuánto les falta y les avisa cuando los llaman. Aparecen con su nombre en la sala de espera.</p>
          <p className="break-all rounded-lg bg-slate-50 px-3 py-2 font-mono text-xs text-slate-500">{url}</p>
          <div className="flex flex-wrap gap-2">
            <Link to="/cartel" className="btn-primary px-3 py-2"><Printer size={16} /> Imprimir cartel</Link>
            <a href={url} target="_blank" rel="noreferrer" className="btn-soft px-3 py-2"><ExternalLink size={16} /> Probar</a>
            <button className="btn-ghost px-3 py-2" onClick={async () => {
              try { await navigator.clipboard.writeText(url); setCopiado(true); setTimeout(() => setCopiado(false), 2000) } catch { /* sin portapapeles */ }
            }}><Copy size={16} /> {copiado ? 'Copiado' : 'Copiar enlace'}</button>
          </div>
        </div>
      </div>
      <div className="flex flex-wrap gap-2 border-t border-slate-100 pt-3">
        <button className="btn-ghost px-3 py-1.5 text-xs" onClick={async () =>
          (await confirmar({ titulo: '¿Cambiar el código del QR?', texto: 'El cartel actual dejará de funcionar y tendrás que imprimir uno nuevo. Úsalo solo si alguien está abusando del QR.', si: 'Cambiar código', peligro: true })) && guardarCodigo(nuevoCodigoQR())}>
          <RefreshCw size={14} /> Cambiar código
        </button>
        <button className="btn-ghost px-3 py-1.5 text-xs text-rose-600" onClick={async () =>
          (await confirmar({ titulo: '¿Desactivar el QR de los pacientes?', texto: 'El cartel dejará de funcionar.', si: 'Desactivar', peligro: true })) && guardarCodigo(undefined)}>
          Desactivar
        </button>
      </div>
    </div>
  )
}
