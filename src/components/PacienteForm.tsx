import { useState, type FormEvent } from 'react'
import { db, type Paciente } from '../lib/db'
import { Campo } from './ui'

export default function PacienteForm({ inicial, nombreInicial = '', datosIniciales, onGuardado }: {
  inicial?: Paciente; nombreInicial?: string; datosIniciales?: Partial<Paciente>; onGuardado: (id: number) => void
}) {
  const [p, setP] = useState<Paciente>(inicial ?? { nombre: nombreInicial, creado: Date.now(), sexo: '', ...datosIniciales })
  const [guardando, setGuardando] = useState(false)
  const set = (k: keyof Paciente) => (e: { target: { value: string } }) => setP({ ...p, [k]: e.target.value })

  async function guardar(e: FormEvent) {
    e.preventDefault()
    if (!p.nombre.trim()) return
    setGuardando(true)
    const datos = { ...p, nombre: p.nombre.trim() }
    const id = inicial?.id ? (await db.pacientes.put(datos), inicial.id) : await db.pacientes.add(datos)
    onGuardado(id as number)
  }

  return (
    <form onSubmit={guardar} className="space-y-4">
      <Campo label="Nombre completo *">
        <input className="input" value={p.nombre} onChange={set('nombre')} required autoFocus />
      </Campo>
      <div className="grid grid-cols-2 gap-3">
        <Campo label="Teléfono"><input className="input" type="tel" value={p.telefono ?? ''} onChange={set('telefono')} /></Campo>
        <Campo label="CI / Documento"><input className="input" value={p.documento ?? ''} onChange={set('documento')} /></Campo>
        <Campo label="Fecha de nacimiento"><input className="input" type="date" value={p.fechaNacimiento ?? ''} onChange={set('fechaNacimiento')} /></Campo>
        <Campo label="Sexo">
          <select className="input" value={p.sexo ?? ''} onChange={set('sexo')}>
            <option value="">—</option><option value="F">Femenino</option><option value="M">Masculino</option><option value="O">Otro</option>
          </select>
        </Campo>
      </div>
      <Campo label="Dirección"><input className="input" value={p.direccion ?? ''} onChange={set('direccion')} /></Campo>

      <div className="rounded-2xl bg-amber-50 p-4">
        <p className="mb-3 text-sm font-semibold text-amber-800">Antecedentes médicos</p>
        <div className="space-y-3">
          <Campo label="Alergias"><input className="input" placeholder="Ej: penicilina, látex, anestesia…" value={p.alergias ?? ''} onChange={set('alergias')} /></Campo>
          <Campo label="Enfermedades"><input className="input" placeholder="Ej: diabetes, hipertensión…" value={p.enfermedades ?? ''} onChange={set('enfermedades')} /></Campo>
          <Campo label="Medicamentos actuales"><input className="input" value={p.medicamentos ?? ''} onChange={set('medicamentos')} /></Campo>
        </div>
      </div>
      <div className="rounded-2xl bg-sky-50 p-4">
        <p className="text-sm font-semibold text-sky-900">Familiar o contacto <span className="font-normal text-sky-700">(opcional)</span></p>
        <p className="mb-3 text-xs text-sky-700">Útil si el paciente no tiene celular o no usa WhatsApp.</p>
        <div className="grid grid-cols-2 gap-3">
          <Campo label="Nombre"><input className="input" placeholder="Ej: Carla" value={p.contactoNombre ?? ''} onChange={set('contactoNombre')} /></Campo>
          <Campo label="Parentesco"><input className="input" placeholder="Ej: Hija" value={p.contactoParentesco ?? ''} onChange={set('contactoParentesco')} /></Campo>
        </div>
        <div className="mt-3"><Campo label="Teléfono del contacto"><input className="input" type="tel" value={p.contactoTelefono ?? ''} onChange={set('contactoTelefono')} /></Campo></div>
        {p.contactoTelefono && (
          <label className="mt-3 flex items-center gap-2.5 text-sm text-sky-900">
            <input type="checkbox" className="h-5 w-5 accent-teal-600" checked={!!p.avisarContacto || !p.telefono}
              disabled={!p.telefono} onChange={(e) => setP({ ...p, avisarContacto: e.target.checked })} />
            Enviar los avisos de WhatsApp a este contacto{!p.telefono && ' (el paciente no tiene teléfono)'}
          </label>
        )}
      </div>
      <Campo label="Notas"><textarea className="input" rows={2} value={p.notas ?? ''} onChange={set('notas')} /></Campo>
      <button className="btn-primary w-full" disabled={guardando}>{inicial ? 'Guardar cambios' : 'Registrar paciente'}</button>
    </form>
  )
}
