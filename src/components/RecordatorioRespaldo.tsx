import { HardDriveUpload, X } from 'lucide-react'
import { useState } from 'react'
import { guardarRespaldo, posponerRespaldo, useRespaldo } from '../lib/respaldo'

/** Aviso semanal para guardar una copia de seguridad en Google Drive. */
export default function RecordatorioRespaldo() {
  const { ultimo, recordar } = useRespaldo()
  const [ocupado, setOcupado] = useState(false)
  if (!recordar) return null
  const dias = ultimo ? Math.floor((Date.now() - ultimo) / 86400000) : null
  return (
    <div className="mb-5 flex items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
      <HardDriveUpload size={22} className="mt-0.5 shrink-0 text-amber-600" />
      <div className="min-w-0 flex-1">
        <p className="font-semibold">{dias === null ? 'Guarda tu primera copia de seguridad' : `Hace ${dias} días que no guardas una copia`}</p>
        <p className="text-xs text-amber-800">Un toque y la guardas en Google Drive. Así no pierdes nada aunque se pierda el celular.</p>
        <button className="btn mt-2 bg-amber-500 px-3 py-1.5 text-xs text-white hover:bg-amber-600" disabled={ocupado}
          onClick={async () => { setOcupado(true); try { await guardarRespaldo() } finally { setOcupado(false) } }}>
          <HardDriveUpload size={15} /> Guardar copia en Drive
        </button>
      </div>
      <button className="btn-ghost -mr-1 -mt-1 p-1.5 text-amber-700" aria-label="Recordar mañana" onClick={posponerRespaldo}><X size={18} /></button>
    </div>
  )
}
