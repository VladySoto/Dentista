import { useLiveQuery } from 'dexie-react-hooks'
import { AlertTriangle, Minus, Package, Plus, Search, ShoppingCart } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { Campo, Encabezado, Modal, Vacio } from '../components/ui'
import { db, type Material } from '../lib/db'
import { fechaCorta, normalizar } from '../lib/format'
import { alertas, type AlertaMaterial } from '../lib/inventario'
import { borrarConDeshacer } from '../lib/dialogo'

const ETIQUETA: Record<AlertaMaterial, { texto: string; cls: string }> = {
  agotado: { texto: 'Agotado', cls: 'bg-rose-100 text-rose-700' },
  poco: { texto: 'Queda poco', cls: 'bg-amber-100 text-amber-800' },
  vencido: { texto: 'Vencido', cls: 'bg-rose-100 text-rose-700' },
  'vence-pronto': { texto: 'Vence pronto', cls: 'bg-orange-100 text-orange-800' },
}

export default function Inventario() {
  const materiales = useLiveQuery(() => db.materiales.orderBy('nombre').toArray(), [])
  const [q, setQ] = useState('')
  const [editar, setEditar] = useState<Material | 'nuevo' | null>(null)
  const [compra, setCompra] = useState<Material | null>(null)

  const lista = (materiales ?? []).filter((m) => !q || normalizar(m.nombre).includes(normalizar(q)))
  const conAviso = lista.filter((m) => alertas(m).length)
  const resto = lista.filter((m) => !alertas(m).length)
  const cambiar = (m: Material, d: number) => db.materiales.update(m.id!, { cantidad: Math.max(0, m.cantidad + d) })

  const fila = (m: Material) => {
    const a = alertas(m)
    return (
      <div key={m.id} className="flex items-center gap-2 p-3">
        <button className="min-w-0 flex-1 text-left" onClick={() => setEditar(m)}>
          <p className="truncate font-medium">{m.nombre}</p>
          <p className="flex flex-wrap items-center gap-1 text-xs text-slate-500">
            {a.map((x) => <span key={x} className={`chip ${ETIQUETA[x].cls}`}>{ETIQUETA[x].texto}</span>)}
            {m.vence && <span>Vence {fechaCorta(m.vence)}</span>}
            <span>· mín. {m.minimo}</span>
          </p>
        </button>
        <button className="btn-ghost p-2" aria-label={`Usar 1 de ${m.nombre}`} onClick={() => cambiar(m, -1)}><Minus size={18} /></button>
        <span className={`w-12 text-center text-lg font-bold ${a.includes('agotado') ? 'text-rose-600' : a.includes('poco') ? 'text-amber-600' : ''}`}>
          {m.cantidad}<span className="block text-[10px] font-normal text-slate-500">{m.unidad || 'unid.'}</span>
        </span>
        <button className="btn-ghost p-2" aria-label={`Agregar 1 de ${m.nombre}`} onClick={() => cambiar(m, 1)}><Plus size={18} /></button>
        <button className="btn-soft p-2" aria-label={`Registrar compra de ${m.nombre}`} onClick={() => setCompra(m)}><ShoppingCart size={17} /></button>
      </div>
    )
  }

  return (
    <>
      <Encabezado titulo="Inventario" sub="Materiales del consultorio"
        accion={<button className="btn-primary" onClick={() => setEditar('nuevo')} aria-label="Nuevo material"><Plus size={18} /><span className="hidden sm:inline">Material</span></button>} />

      {materiales?.length === 0 ? (
        <Vacio icono={<Package size={28} />} titulo="Sin materiales"
          texto="Agrega anestesia, resinas, guantes, agujas… con la cantidad mínima que quieres tener. Te avisaremos cuando quede poco o algo esté por vencer."
          accion={<button className="btn-primary" onClick={() => setEditar('nuevo')}><Plus size={18} /> Agregar material</button>} />
      ) : (
        <>
          <div className="relative mb-4">
            <Search size={18} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" />
            <input className="input pl-10" placeholder="Buscar material…" value={q} onChange={(e) => setQ(e.target.value)} />
          </div>
          {conAviso.length > 0 && (
            <section className="mb-5">
              <h2 className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-amber-700"><AlertTriangle size={15} /> Necesitan atención ({conAviso.length})</h2>
              <div className="card divide-y divide-slate-100 border-amber-200">{conAviso.map(fila)}</div>
            </section>
          )}
          {resto.length > 0 && (
            <section>
              <h2 className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-500">En orden</h2>
              <div className="card divide-y divide-slate-100">{resto.map(fila)}</div>
            </section>
          )}
          <p className="mt-4 text-xs text-slate-500">Usa − y + para descontar o sumar de a uno. El carrito registra una compra y, si quieres, la anota como gasto.</p>
        </>
      )}

      <Modal abierto={!!editar} onCerrar={() => setEditar(null)} titulo={editar === 'nuevo' ? 'Nuevo material' : 'Editar material'}>
        {editar && <MaterialForm key={editar === 'nuevo' ? 'n' : editar.id} inicial={editar === 'nuevo' ? undefined : editar} onListo={() => setEditar(null)} />}
      </Modal>
      <Modal abierto={!!compra} onCerrar={() => setCompra(null)} titulo={`Compra de ${compra?.nombre ?? ''}`}>
        {compra && <CompraForm material={compra} onListo={() => setCompra(null)} />}
      </Modal>
    </>
  )
}

function MaterialForm({ inicial, onListo }: { inicial?: Material; onListo: () => void }) {
  const [m, setM] = useState({
    nombre: inicial?.nombre ?? '', cantidad: String(inicial?.cantidad ?? ''), minimo: String(inicial?.minimo ?? ''),
    unidad: inicial?.unidad ?? '', vence: inicial?.vence ?? '',
  })
  async function guardar(e: FormEvent) {
    e.preventDefault()
    if (!m.nombre.trim()) return
    await db.materiales.put({
      ...(inicial?.id ? { id: inicial.id } : {}), nombre: m.nombre.trim(), cantidad: Math.max(0, Number(m.cantidad) || 0),
      minimo: Math.max(0, Number(m.minimo) || 0), unidad: m.unidad.trim() || undefined, vence: m.vence || undefined,
    })
    onListo()
  }
  return (
    <form onSubmit={guardar} className="space-y-4">
      <Campo label="Material *"><input className="input" required placeholder="Ej: Anestesia lidocaína 2%" value={m.nombre} onChange={(e) => setM({ ...m, nombre: e.target.value })} autoFocus /></Campo>
      <div className="grid grid-cols-3 gap-3">
        <Campo label="Cantidad"><input className="input" type="number" min="0" inputMode="numeric" value={m.cantidad} onChange={(e) => setM({ ...m, cantidad: e.target.value })} /></Campo>
        <Campo label="Avisar con"><input className="input" type="number" min="0" inputMode="numeric" placeholder="Ej: 5" value={m.minimo} onChange={(e) => setM({ ...m, minimo: e.target.value })} /></Campo>
        <Campo label="Unidad"><input className="input" placeholder="cajas" value={m.unidad} onChange={(e) => setM({ ...m, unidad: e.target.value })} /></Campo>
      </div>
      <Campo label="Vence (opcional)"><input className="input" type="date" value={m.vence} onChange={(e) => setM({ ...m, vence: e.target.value })} /></Campo>
      <button className="btn-primary w-full">{inicial ? 'Guardar cambios' : 'Agregar material'}</button>
      {inicial && <button type="button" className="btn-danger w-full" onClick={async () => { await borrarConDeshacer('materiales', inicial.id!, `“${inicial.nombre}” eliminado`); onListo() }}>Eliminar material</button>}
    </form>
  )
}

function CompraForm({ material, onListo }: { material: Material; onListo: () => void }) {
  const [cantidad, setCantidad] = useState('')
  const [costo, setCosto] = useState('')
  const [vence, setVence] = useState(material.vence ?? '')
  async function guardar(e: FormEvent) {
    e.preventDefault()
    const n = Number(cantidad)
    if (!(n > 0)) return
    await db.transaction('rw', db.materiales, db.gastos, async () => {
      await db.materiales.update(material.id!, { cantidad: material.cantidad + n, vence: vence || undefined })
      if (Number(costo) > 0) await db.gastos.add({ fecha: Date.now(), categoria: 'Materiales', monto: Number(costo), descripcion: `${n} ${material.unidad || 'unid.'} de ${material.nombre}`, metodo: 'efectivo' })
    })
    onListo()
  }
  return (
    <form onSubmit={guardar} className="space-y-4">
      <p className="text-sm text-slate-500">Ahora hay <b>{material.cantidad} {material.unidad || 'unid.'}</b>.</p>
      <div className="grid grid-cols-2 gap-3">
        <Campo label="Cantidad comprada *"><input className="input" type="number" min="1" inputMode="numeric" required value={cantidad} onChange={(e) => setCantidad(e.target.value)} autoFocus /></Campo>
        <Campo label="Costo total (Bs)"><input className="input" type="number" min="0" inputMode="decimal" placeholder="Opcional" value={costo} onChange={(e) => setCosto(e.target.value)} /></Campo>
      </div>
      <Campo label="Nueva fecha de vencimiento (opcional)"><input className="input" type="date" value={vence} onChange={(e) => setVence(e.target.value)} /></Campo>
      {Number(costo) > 0 && <p className="rounded-xl bg-orange-50 p-3 text-sm text-orange-800">Se anotará un gasto de <b>Bs {costo}</b> en Caja (Materiales).</p>}
      <button className="btn-primary w-full">Registrar compra</button>
    </form>
  )
}
