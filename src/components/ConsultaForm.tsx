import { useState, type FormEvent } from 'react'
import { db, type Consulta } from '../lib/db'
import { Campo } from './ui'

export default function ConsultaForm({ pacienteId, inicial, motivoInicial = '', onGuardado }: {
  pacienteId: number; inicial?: Consulta; motivoInicial?: string; onGuardado: () => void
}) {
  const [c, setC] = useState<Consulta>(inicial ?? { pacienteId, fecha: Date.now(), motivo: motivoInicial })
  const set = (k: keyof Consulta) => (e: { target: { value: string } }) => setC({ ...c, [k]: e.target.value })
  const setNum = (k: 'costo' | 'pagado') => (e: { target: { value: string } }) =>
    setC({ ...c, [k]: e.target.value === '' ? undefined : Number(e.target.value) })

  async function guardar(e: FormEvent) {
    e.preventDefault()
    if (!c.motivo.trim()) return
    await db.consultas.put(c)
    onGuardado()
  }

  const fechaInput = new Date(c.fecha - new Date(c.fecha).getTimezoneOffset() * 60000).toISOString().slice(0, 16)

  return (
    <form onSubmit={guardar} className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <Campo label="Fecha y hora">
          <input className="input" type="datetime-local" value={fechaInput} onChange={(e) => setC({ ...c, fecha: new Date(e.target.value).getTime() })} />
        </Campo>
        <Campo label="Pieza(s)"><input className="input" placeholder="Ej: 36, 37" value={c.piezas ?? ''} onChange={set('piezas')} /></Campo>
      </div>
      <Campo label="Motivo de consulta *"><input className="input" value={c.motivo} onChange={set('motivo')} required autoFocus /></Campo>
      <Campo label="Diagnóstico"><textarea className="input" rows={2} value={c.diagnostico ?? ''} onChange={set('diagnostico')} /></Campo>
      <Campo label="Tratamiento realizado"><textarea className="input" rows={2} value={c.tratamiento ?? ''} onChange={set('tratamiento')} /></Campo>
      <Campo label="Indicaciones / notas"><textarea className="input" rows={2} value={c.notas ?? ''} onChange={set('notas')} /></Campo>
      <div className="grid grid-cols-2 gap-3">
        <Campo label="Costo (Bs)"><input className="input" type="number" inputMode="decimal" min="0" step="any" value={c.costo ?? ''} onChange={setNum('costo')} /></Campo>
        <Campo label="Pagado (Bs)"><input className="input" type="number" inputMode="decimal" min="0" step="any" value={c.pagado ?? ''} onChange={setNum('pagado')} /></Campo>
      </div>
      <button className="btn-primary w-full">{inicial ? 'Guardar cambios' : 'Guardar consulta'}</button>
    </form>
  )
}
