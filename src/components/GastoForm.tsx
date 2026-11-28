import { useState, type FormEvent } from 'react'
import { CATEGORIAS_GASTO, db, type Gasto, type MetodoPago } from '../lib/db'
import { MetodoSelector } from './Cobro'
import { Campo } from './ui'

const aFechaInput = (ts: number) => new Date(ts - new Date(ts).getTimezoneOffset() * 60000).toISOString().slice(0, 10)

export default function GastoForm({ inicial, onListo }: { inicial?: Gasto; onListo: () => void }) {
  const [g, setG] = useState<Gasto>(inicial ?? { fecha: Date.now(), categoria: 'Materiales', monto: 0, metodo: 'efectivo' })
  const [monto, setMonto] = useState(inicial ? String(inicial.monto) : '')

  async function guardar(e: FormEvent) {
    e.preventDefault()
    const m = Number(monto)
    if (!(m > 0)) return
    await db.gastos.put({ ...g, monto: m, descripcion: g.descripcion?.trim() || undefined })
    onListo()
  }

  return (
    <form onSubmit={guardar} className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <Campo label="Monto (Bs) *"><input className="input" type="number" inputMode="decimal" min="0" step="any" required value={monto} onChange={(e) => setMonto(e.target.value)} autoFocus /></Campo>
        <Campo label="Fecha">
          <input className="input" type="date" value={aFechaInput(g.fecha)}
            onChange={(e) => e.target.value && setG({ ...g, fecha: new Date(e.target.value + 'T12:00').getTime() })} />
        </Campo>
      </div>
      <div>
        <span className="label">Categoría</span>
        <div className="flex flex-wrap gap-1.5">
          {CATEGORIAS_GASTO.map((c) => (
            <button key={c} type="button" onClick={() => setG({ ...g, categoria: c })}
              className={`chip border px-3 py-1.5 text-sm ${g.categoria === c ? 'border-teal-700 bg-teal-700 text-white' : 'border-slate-200 bg-white text-slate-600'}`}>{c}</button>
          ))}
        </div>
      </div>
      <Campo label="Detalle (opcional)"><input className="input" placeholder="Ej: 2 cajas de anestesia, alquiler de noviembre…" value={g.descripcion ?? ''} onChange={(e) => setG({ ...g, descripcion: e.target.value })} /></Campo>
      <div>
        <span className="label">Cómo se pagó</span>
        <MetodoSelector valor={g.metodo} onChange={(m: MetodoPago) => setG({ ...g, metodo: m })} />
      </div>
      <button className="btn-primary w-full">{inicial ? 'Guardar cambios' : 'Guardar gasto'}</button>
      {inicial && (
        <button type="button" className="btn-danger w-full" onClick={async () => { if (confirm('¿Eliminar este gasto?')) { await db.gastos.delete(inicial.id!); onListo() } }}>Eliminar gasto</button>
      )}
    </form>
  )
}
