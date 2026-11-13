import { Download, ShieldCheck, Smartphone, Upload } from 'lucide-react'
import { useRef, useState } from 'react'
import { Encabezado } from '../components/ui'
import { exportarRespaldo, hoy, importarRespaldo } from '../lib/db'

export default function Ajustes() {
  const input = useRef<HTMLInputElement>(null)
  const [msg, setMsg] = useState('')

  async function descargar() {
    const data = await exportarRespaldo()
    const url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }))
    const a = document.createElement('a')
    a.href = url; a.download = `respaldo-consultorio-${hoy()}.json`; a.click()
    URL.revokeObjectURL(url)
    setMsg('Respaldo descargado.')
  }

  async function restaurar(file?: File) {
    if (!file) return
    if (!confirm('Esto reemplazará TODOS los datos actuales con los del respaldo. ¿Continuar?')) return
    try {
      await importarRespaldo(JSON.parse(await file.text()))
      setMsg('Datos restaurados correctamente.')
    } catch (e) {
      setMsg(`Error: ${(e as Error).message}`)
    }
  }

  return (
    <>
      <Encabezado titulo="Ajustes" />
      <div className="space-y-4">
        <section className="card p-5">
          <div className="mb-3 flex items-center gap-2 font-semibold"><ShieldCheck size={20} className="text-teal-600" /> Respaldo de datos</div>
          <p className="mb-4 text-sm text-slate-500">
            Los datos se guardan en este dispositivo. Descarga un respaldo con frecuencia (por ejemplo, cada semana) y guárdalo en Drive o en tu correo.
          </p>
          <div className="flex flex-wrap gap-2">
            <button className="btn-primary" onClick={descargar}><Download size={18} /> Descargar respaldo</button>
            <button className="btn-soft" onClick={() => input.current?.click()}><Upload size={18} /> Restaurar</button>
            <input ref={input} type="file" accept="application/json" hidden onChange={(e) => { restaurar(e.target.files?.[0]); e.target.value = '' }} />
          </div>
          {msg && <p className="mt-3 text-sm font-medium text-teal-700">{msg}</p>}
        </section>
        <section className="card p-5">
          <div className="mb-3 flex items-center gap-2 font-semibold"><Smartphone size={20} className="text-teal-600" /> Instalar como app</div>
          <ul className="list-disc space-y-1 pl-5 text-sm text-slate-500">
            <li><b>Android (Chrome):</b> menú ⋮ → “Instalar aplicación”.</li>
            <li><b>iPhone (Safari):</b> botón Compartir → “Agregar a inicio”.</li>
            <li><b>PC (Chrome/Edge):</b> ícono de instalar en la barra de direcciones.</li>
          </ul>
        </section>
      </div>
    </>
  )
}
