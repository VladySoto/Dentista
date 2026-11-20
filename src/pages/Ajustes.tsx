import { useLiveQuery } from 'dexie-react-hooks'
import { Building2, Check, Cloud, Download, Landmark, Lock, Pill, QrCode, MessageCircle, Plus, ShieldCheck, Smartphone, Stethoscope, Trash2, Upload } from 'lucide-react'
import { useEffect, useRef, useState, type ReactNode } from 'react'
import AjustesBloqueo from '../components/AjustesBloqueo'
import AjustesQRPago from '../components/AjustesQRPago'
import CuentaNube from '../components/CuentaNube'
import TurnosQR from '../components/TurnosQR'
import { Campo, Encabezado } from '../components/ui'
import { CONFIG_INICIAL, db, importarRespaldo, MEDICAMENTOS_EJEMPLO, rellenar, varsPlantilla, type Config } from '../lib/db'
import { useSync } from '../lib/sync'
import { fechaCorta, hora } from '../lib/format'
import { guardarRespaldo, useRespaldo } from '../lib/respaldo'
import { useConfig } from '../lib/useConfig'

export default function Ajustes() {
  return (
    <>
      <Encabezado titulo="Ajustes" />
      <div className="space-y-4">
        <Seccion icono={<Cloud size={20} />} titulo="Cuenta y nube"
          sub="Con una cuenta, los datos se guardan en la nube y se ven en todos tus dispositivos (celular, PC, tablet). Sin internet sigue funcionando y sube los cambios después.">
          <CuentaNube />
        </Seccion>
        <Seccion icono={<Lock size={20} />} titulo="Bloqueo con PIN o huella"
          sub="Protege los datos de los pacientes si el celular se pierde o lo usa otra persona. Cada dispositivo tiene su propio PIN.">
          <AjustesBloqueo />
        </Seccion>
        <Seccion icono={<QrCode size={20} />} titulo="Turnos por QR">
          <TurnosQR />
        </Seccion>
        <DatosConsultorio />
        <Seccion icono={<Landmark size={20} />} titulo="Cobro con QR"
          sub="Muestra el QR de tu banco en pantalla para que el paciente pague desde su celular.">
          <AjustesQRPago />
        </Seccion>
        <Tratamientos />
        <Medicamentos />
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
  const set = (k: 'consultorio' | 'dentista' | 'matricula' | 'telefono' | 'direccion' | 'horario') =>
    (e: { target: { value: string } }) => setForm({ ...form, [k]: e.target.value })
  return (
    <Seccion icono={<Building2 size={20} />} titulo="Datos del consultorio" sub="Se usan en el encabezado y en los mensajes de WhatsApp.">
      <div className="space-y-3">
        <div className="grid gap-3 sm:grid-cols-2">
          <Campo label="Nombre del consultorio"><input className="input" value={form.consultorio} onChange={set('consultorio')} /></Campo>
          <Campo label="Dentista"><input className="input" placeholder="Dr./Dra. …" value={form.dentista} onChange={set('dentista')} /></Campo>
          <Campo label="Matrícula profesional (para recetas)"><input className="input" value={form.matricula ?? ''} onChange={set('matricula')} /></Campo>
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

function Medicamentos() {
  const lista = useLiveQuery(() => db.medicamentos.orderBy('nombre').toArray(), [])
  const [nombre, setNombre] = useState('')
  const [indicacion, setIndicacion] = useState('')
  const usaEjemplo = lista !== undefined && lista.length === 0

  // La lista de ejemplo se guarda recién al editarla (así no se duplica entre dispositivos)
  async function asegurarLista() {
    if ((await db.medicamentos.count()) === 0) await db.medicamentos.bulkAdd(MEDICAMENTOS_EJEMPLO.map((m) => ({ ...m })))
  }
  async function agregar() {
    if (!nombre.trim()) return
    await asegurarLista()
    await db.medicamentos.add({ nombre: nombre.trim(), indicacion: indicacion.trim() })
    setNombre(''); setIndicacion('')
  }

  return (
    <Seccion icono={<Pill size={20} />} titulo="Medicamentos frecuentes"
      sub="Aparecen como botones al hacer una receta. Revisa las dosis: la lista inicial es solo un ejemplo.">
      {usaEjemplo ? (
        <div className="space-y-3">
          <ul className="space-y-1 text-sm text-slate-600">
            {MEDICAMENTOS_EJEMPLO.map((m) => <li key={m.nombre}><b>{m.nombre}</b> · {m.indicacion}</li>)}
          </ul>
          <button className="btn-soft" onClick={asegurarLista}>Editar esta lista</button>
        </div>
      ) : (
        <>
          <div className="divide-y divide-slate-100 rounded-xl border border-slate-200">
            {lista?.map((m) => (
              <div key={m.id} className="flex items-start gap-2 p-2">
                <div className="min-w-0 flex-1 space-y-1">
                  <input className="input border-transparent px-2 py-1 font-semibold hover:border-slate-200" defaultValue={m.nombre} aria-label="Medicamento"
                    onBlur={(e) => e.target.value.trim() && e.target.value !== m.nombre && db.medicamentos.update(m.id!, { nombre: e.target.value.trim() })} />
                  <input className="input border-transparent px-2 py-1 text-sm text-slate-600 hover:border-slate-200" defaultValue={m.indicacion} aria-label="Indicación"
                    onBlur={(e) => e.target.value !== m.indicacion && db.medicamentos.update(m.id!, { indicacion: e.target.value.trim() })} />
                </div>
                <button className="btn-ghost p-2 text-slate-400 hover:text-rose-600" aria-label={`Eliminar ${m.nombre}`}
                  onClick={() => confirm(`¿Eliminar “${m.nombre}”?`) && db.medicamentos.delete(m.id!)}><Trash2 size={16} /></button>
              </div>
            ))}
          </div>
          <div className="mt-3 space-y-2">
            <input className="input" placeholder="Nuevo medicamento (ej: Dexametasona 4 mg)" value={nombre} onChange={(e) => setNombre(e.target.value)} />
            <div className="flex gap-2">
              <input className="input flex-1" placeholder="Indicación (dosis, frecuencia, días)" value={indicacion} onChange={(e) => setIndicacion(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && agregar()} />
              <button className="btn-soft px-3" onClick={agregar} aria-label="Agregar medicamento"><Plus size={18} /></button>
            </div>
          </div>
        </>
      )}
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
  const { sesion } = useSync()
  const { ultimo } = useRespaldo()

  async function guardar() {
    const r = await guardarRespaldo()
    if (r !== 'cancelado') setMsg(r === 'compartido' ? 'Copia guardada.' : 'Copia descargada. Súbela a Google Drive o envíatela por correo.')
  }

  async function restaurar(file?: File) {
    if (!file) return
    if (!confirm(`Esto reemplazará TODOS los datos actuales con los del respaldo${sesion ? ', también en la nube y en tus otros dispositivos' : ''}. ¿Continuar?`)) return
    try {
      await importarRespaldo(JSON.parse(await file.text()))
      setMsg('Datos restaurados correctamente.')
    } catch (e) {
      setMsg(`Error: ${(e as Error).message}`)
    }
  }

  return (
    <Seccion icono={<ShieldCheck size={20} />} titulo="Respaldo de datos"
      sub={sesion
        ? 'Tus datos ya están en la nube. Además, una copia semanal en Google Drive te protege por si algo falla. La sala de espera te lo recuerda cada 7 días.'
        : 'Sin cuenta, los datos se guardan solo en este dispositivo. Guarda una copia cada semana en Google Drive: la sala de espera te lo recuerda.'}>
      <p className="mb-3 text-sm text-slate-600">Última copia en este dispositivo: <b>{ultimo ? `${fechaCorta(ultimo)} ${hora(ultimo)}` : 'nunca'}</b></p>
      <div className="flex flex-wrap gap-2">
        <button className="btn-primary" onClick={guardar}><Download size={18} /> Guardar copia en Drive</button>
        <button className="btn-soft" onClick={() => input.current?.click()}><Upload size={18} /> Restaurar</button>
        <input ref={input} type="file" accept="application/json,text/plain,.json,.txt" hidden onChange={(e) => { restaurar(e.target.files?.[0]); e.target.value = '' }} />
      </div>
      {msg && <p className="mt-3 text-sm font-medium text-teal-700">{msg}</p>}
      <p className="mt-3 text-xs text-slate-500">En el celular se abre el menú de compartir: elige <b>Drive</b> y la carpeta. La copia incluye pacientes, historial, citas, caja e inventario. Las fotos completas quedan en la nube (en la copia van sus miniaturas).</p>
    </Seccion>
  )
}
