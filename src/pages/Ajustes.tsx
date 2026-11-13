import { useLiveQuery } from 'dexie-react-hooks'
import { Building2, Check, Download, MessageCircle, Plus, ShieldCheck, Smartphone, Stethoscope, Trash2, Upload } from 'lucide-react'
import { useEffect, useRef, useState, type ReactNode } from 'react'
import { Campo, Encabezado } from '../components/ui'
import { CONFIG_INICIAL, db, exportarRespaldo, hoy, importarRespaldo, rellenar, varsPlantilla, type Config } from '../lib/db'
import { useConfig } from '../lib/useConfig'

export default function Ajustes() {
  return (
    <>
      <Encabezado titulo="Ajustes" />
      <div className="space-y-4">
        <DatosConsultorio />
        <Tratamientos />
        <Plantillas />
        <Respaldo />
        <Seccion icono={<Smartphone size={20} />} titulo="Instalar como app">
          <ul className="list-disc space-y-1 pl-5 text-sm text-slate-500">
            <li><b>Android (Chrome):</b> menú ⋮ → “Instalar aplicación”.</li>
            <li><b>iPhone (Safari):</b> botón Compartir → “Agregar a inicio”.</li>
            <li><b>PC (Chrome/Edge):</b> ícono de instalar en la barra de direcciones.</li>
          </ul>
        </Seccion>
      </div>
    </>
  )
}

function Seccion({ icono, titulo, sub, children }: { icono: ReactNode; titulo: string; sub?: string; children: ReactNode }) {
  return (
    <section className="card p-5">
      <div className="flex items-center gap-2 font-semibold"><span className="text-teal-600">{icono}</span>{titulo}</div>
      {sub && <p className="mt-1 text-sm text-slate-500">{sub}</p>}
      <div className="mt-4">{children}</div>
    </section>
  )
}

/** Formulario sobre la configuración con botón Guardar y aviso de guardado. */
function useFormConfig() {
  const config = useConfig()
  const [form, setForm] = useState<Config>(config)
  const [ok, setOk] = useState(false)
  useEffect(() => setForm(config), [config])
  const cambiado = JSON.stringify(form) !== JSON.stringify(config)
  async function guardar() {
    await db.config.put(form)
    setOk(true); setTimeout(() => setOk(false), 2000)
  }
  const boton = (
    <button className="btn-primary mt-4" onClick={guardar} disabled={!cambiado && !ok}>
      {ok ? <><Check size={18} /> Guardado</> : 'Guardar cambios'}
    </button>
  )
  return { form, setForm, boton }
}

function DatosConsultorio() {
  const { form, setForm, boton } = useFormConfig()
  const set = (k: 'consultorio' | 'dentista' | 'telefono' | 'direccion' | 'horario') =>
    (e: { target: { value: string } }) => setForm({ ...form, [k]: e.target.value })
  return (
    <Seccion icono={<Building2 size={20} />} titulo="Datos del consultorio" sub="Se usan en el encabezado y en los mensajes de WhatsApp.">
      <div className="space-y-3">
        <div className="grid gap-3 sm:grid-cols-2">
          <Campo label="Nombre del consultorio"><input className="input" value={form.consultorio} onChange={set('consultorio')} /></Campo>
          <Campo label="Dentista"><input className="input" placeholder="Dr./Dra. …" value={form.dentista} onChange={set('dentista')} /></Campo>
          <Campo label="Teléfono"><input className="input" type="tel" value={form.telefono} onChange={set('telefono')} /></Campo>
          <Campo label="Dirección"><input className="input" value={form.direccion} onChange={set('direccion')} /></Campo>
        </div>
        <Campo label="Horario de atención"><input className="input" value={form.horario} onChange={set('horario')} /></Campo>
        <Campo label="Recordar control cada (meses)">
          <input className="input w-28" type="number" min="1" max="24" value={form.mesesControl}
            onChange={(e) => setForm({ ...form, mesesControl: Math.max(1, Number(e.target.value) || 6) })} />
        </Campo>
      </div>
      {boton}
    </Seccion>
  )
}

function Tratamientos() {
  const lista = useLiveQuery(() => db.tratamientos.orderBy('nombre').toArray(), [])
  const [nombre, setNombre] = useState('')
  const [precio, setPrecio] = useState('')
  async function agregar() {
    if (!nombre.trim()) return
    await db.tratamientos.add({ nombre: nombre.trim(), precio: Number(precio) || 0 })
    setNombre(''); setPrecio('')
  }
  return (
    <Seccion icono={<Stethoscope size={20} />} titulo="Tratamientos y precios"
      sub="Aparecen como botones al registrar una consulta; el precio se suma solo. Los precios iniciales son de ejemplo.">
      <div className="divide-y divide-slate-100 rounded-xl border border-slate-200">
        {lista?.map((t) => (
          <div key={t.id} className="flex items-center gap-2 p-2">
            <input className="input flex-1 border-transparent px-2 py-1.5 hover:border-slate-200" defaultValue={t.nombre}
              onBlur={(e) => e.target.value.trim() && e.target.value !== t.nombre && db.tratamientos.update(t.id!, { nombre: e.target.value.trim() })} aria-label="Nombre" />
            <span className="text-sm text-slate-400">Bs</span>
            <input className="input w-24 border-transparent px-2 py-1.5 text-right hover:border-slate-200" type="number" inputMode="decimal" min="0" defaultValue={t.precio}
              onBlur={(e) => Number(e.target.value) !== t.precio && db.tratamientos.update(t.id!, { precio: Number(e.target.value) || 0 })} aria-label="Precio" />
            <button className="btn-ghost p-2 text-slate-400 hover:text-rose-600" aria-label={`Eliminar ${t.nombre}`}
              onClick={() => confirm(`¿Eliminar “${t.nombre}”?`) && db.tratamientos.delete(t.id!)}><Trash2 size={16} /></button>
          </div>
        ))}
      </div>
      <div className="mt-3 flex gap-2">
        <input className="input flex-1" placeholder="Nuevo tratamiento" value={nombre} onChange={(e) => setNombre(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && agregar()} />
        <input className="input w-24" placeholder="Bs" type="number" inputMode="decimal" min="0" value={precio} onChange={(e) => setPrecio(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && agregar()} />
        <button className="btn-soft px-3" onClick={agregar} aria-label="Agregar tratamiento"><Plus size={18} /></button>
      </div>
    </Seccion>
  )
}

const PLANTILLAS: { k: keyof Config['plantillas']; titulo: string; extra: Record<string, string> }[] = [
  { k: 'cita', titulo: 'Recordatorio de cita', extra: { fecha: 'lunes, 16 de noviembre', hora: '10:00' } },
  { k: 'control', titulo: 'Aviso de control', extra: {} },
  { k: 'saldo', titulo: 'Saldo pendiente', extra: { saldo: '150' } },
]

function Plantillas() {
  const { form, setForm, boton } = useFormConfig()
  const ejemplo = { nombre: 'María' }
  return (
    <Seccion icono={<MessageCircle size={20} />} titulo="Mensajes de WhatsApp"
      sub="Se abren listos en WhatsApp Business; solo tocas Enviar. Puedes usar: {nombre} {consultorio} {dentista} {horario} {direccion} {telefono} {fecha} {hora} {saldo}">
      <div className="space-y-4">
        {PLANTILLAS.map(({ k, titulo, extra }) => (
          <div key={k}>
            <div className="mb-1.5 flex items-center justify-between">
              <span className="label mb-0">{titulo}</span>
              <button className="text-xs text-slate-400 hover:text-teal-700"
                onClick={() => setForm({ ...form, plantillas: { ...form.plantillas, [k]: CONFIG_INICIAL.plantillas[k] } })}>Restablecer</button>
            </div>
            <textarea className="input" rows={3} value={form.plantillas[k]}
              onChange={(e) => setForm({ ...form, plantillas: { ...form.plantillas, [k]: e.target.value } })} />
            <p className="mt-1.5 rounded-xl rounded-tl-sm bg-emerald-50 px-3 py-2 text-xs text-emerald-900">
              {rellenar(form.plantillas[k], { ...varsPlantilla(form), ...ejemplo, ...extra })}
            </p>
          </div>
        ))}
      </div>
      {boton}
    </Seccion>
  )
}

function Respaldo() {
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
    <Seccion icono={<ShieldCheck size={20} />} titulo="Respaldo de datos"
      sub="Por ahora los datos se guardan en este dispositivo. Descarga un respaldo cada semana y guárdalo en Drive o en tu correo.">
      <div className="flex flex-wrap gap-2">
        <button className="btn-primary" onClick={descargar}><Download size={18} /> Descargar respaldo</button>
        <button className="btn-soft" onClick={() => input.current?.click()}><Upload size={18} /> Restaurar</button>
        <input ref={input} type="file" accept="application/json" hidden onChange={(e) => { restaurar(e.target.files?.[0]); e.target.value = '' }} />
      </div>
      {msg && <p className="mt-3 text-sm font-medium text-teal-700">{msg}</p>}
    </Seccion>
  )
}
