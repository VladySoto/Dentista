import { useLiveQuery } from 'dexie-react-hooks'
import { AlertTriangle, Download, FileText, Loader2, Plus, Receipt, Share2, Trash2, X } from 'lucide-react'
import { useState } from 'react'
import { db, MEDICAMENTOS_EJEMPLO, type Documento, type ItemPresupuesto, type ItemReceta, type Paciente } from '../lib/db'
import { dinero, fechaCorta, normalizar } from '../lib/format'
import { compartirODescargar, pdfDocumento } from '../lib/pdf'
import { useConfig } from '../lib/useConfig'
import { Campo } from './ui'

/** Genera el PDF y lo comparte (WhatsApp, etc.) o lo descarga. */
function useExportar(paciente: Paciente) {
  const config = useConfig()
  const [ocupado, setOcupado] = useState(false)
  async function exportar(d: Documento, soloDescargar = false) {
    setOcupado(true)
    try {
      const { blob, nombre } = await pdfDocumento(d, paciente, config)
      const texto = d.tipo === 'receta' ? `Receta de ${paciente.nombre} – ${config.consultorio}` : `Presupuesto de ${paciente.nombre} – ${config.consultorio}`
      await compartirODescargar(blob, nombre, texto, soloDescargar)
    } finally {
      setOcupado(false)
    }
  }
  return { exportar, ocupado }
}

function Botones({ ocupado, onGuardar }: { ocupado: boolean; onGuardar: (descargar: boolean) => void }) {
  return (
    <div className="grid grid-cols-2 gap-2 pt-1">
      <button type="button" className="btn-primary" disabled={ocupado} onClick={() => onGuardar(false)}>
        {ocupado ? <Loader2 size={18} className="animate-spin" /> : <Share2 size={18} />} Compartir
      </button>
      <button type="button" className="btn-soft" disabled={ocupado} onClick={() => onGuardar(true)}><Download size={18} /> Descargar</button>
    </div>
  )
}

// ---------------------------------------------------------------- Receta

/** Palabras que indican alergia a un grupo de medicamentos. */
const GRUPOS_ALERGIA: [RegExp, RegExp][] = [
  [/penicilin|amoxicilin|ampicilin/, /penicilin|amoxicilin|ampicilin|augmentin/],
  [/aine|ibuprofen|aspirin|antiinflamatori/, /ibuprofen|ketorolac|naproxen|diclofenac|nimesulid|aspirin|ketoprofen/],
  [/sulfa/, /sulfa|cotrimoxazol/],
]

export function alertaAlergia(alergias: string | undefined, medicamento: string) {
  if (!alergias) return false
  const a = normalizar(alergias), m = normalizar(medicamento)
  if (a.split(/[,;.\s]+/).some((p) => p.length >= 5 && m.includes(p))) return true
  return GRUPOS_ALERGIA.some(([alergia, med]) => alergia.test(a) && med.test(m))
}

export function RecetaForm({ paciente, onListo }: { paciente: Paciente; onListo: () => void }) {
  const guardados = useLiveQuery(() => db.medicamentos.orderBy('nombre').toArray(), [])
  const catalogo = guardados?.length ? guardados : MEDICAMENTOS_EJEMPLO
  const [meds, setMeds] = useState<ItemReceta[]>([])
  const [indicaciones, setIndicaciones] = useState('')
  const { exportar, ocupado } = useExportar(paciente)

  const agregar = (m: ItemReceta) => setMeds([...meds, { ...m }])
  const cambiar = (i: number, k: keyof ItemReceta, v: string) => setMeds(meds.map((m, j) => (j === i ? { ...m, [k]: v } : m)))

  async function guardar(descargar: boolean) {
    const lista = meds.filter((m) => m.nombre.trim())
    if (!lista.length) return alert('Agrega al menos un medicamento.')
    const peligrosos = lista.filter((m) => alertaAlergia(paciente.alergias, m.nombre))
    if (peligrosos.length && !confirm(`⚠️ ${paciente.nombre} tiene alergia a: ${paciente.alergias}\n\nRevisa: ${peligrosos.map((m) => m.nombre).join(', ')}\n\n¿Emitir la receta igual?`)) return
    const d: Documento = { pacienteId: paciente.id!, fecha: Date.now(), tipo: 'receta', medicamentos: lista, indicaciones: indicaciones.trim() || undefined }
    d.id = (await db.documentos.add(d)) as number
    await exportar(d, descargar)
    onListo()
  }

  return (
    <div className="space-y-4">
      {paciente.alergias && (
        <p className="flex gap-2 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
          <AlertTriangle size={18} className="shrink-0 text-amber-500" /> <span><b>Alergias:</b> {paciente.alergias}</span>
        </p>
      )}
      <div>
        <span className="label">Toca para agregar</span>
        <div className="flex flex-wrap gap-1.5">
          {catalogo.map((m) => {
            const peligro = alertaAlergia(paciente.alergias, m.nombre)
            return (
              <button key={m.nombre} type="button" onClick={() => agregar(m)}
                className={`chip border px-3 py-1.5 text-sm ${peligro ? 'border-rose-300 bg-rose-50 text-rose-700' : 'border-slate-200 bg-white text-slate-700 hover:border-teal-300'}`}>
                {peligro && <AlertTriangle size={13} />}{m.nombre}
              </button>
            )
          })}
          <button type="button" onClick={() => agregar({ nombre: '', indicacion: '' })} className="chip border border-dashed border-slate-300 px-3 py-1.5 text-sm text-slate-500"><Plus size={14} /> Otro</button>
        </div>
      </div>

      {meds.length > 0 && (
        <ol className="space-y-2">
          {meds.map((m, i) => {
            const peligro = alertaAlergia(paciente.alergias, m.nombre)
            return (
              <li key={i} className={`rounded-xl border p-3 ${peligro ? 'border-rose-300 bg-rose-50' : 'border-slate-200'}`}>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-bold text-teal-700">{i + 1}.</span>
                  <input className="input py-1.5 font-semibold" placeholder="Medicamento y concentración" value={m.nombre} onChange={(e) => cambiar(i, 'nombre', e.target.value)} />
                  <button type="button" className="btn-ghost p-2 text-slate-400" aria-label="Quitar" onClick={() => setMeds(meds.filter((_, j) => j !== i))}><X size={16} /></button>
                </div>
                <textarea className="input mt-2 py-1.5 text-sm" rows={2} placeholder="Dosis, cada cuánto y por cuántos días" value={m.indicacion} onChange={(e) => cambiar(i, 'indicacion', e.target.value)} />
                {peligro && <p className="mt-1 flex items-center gap-1 text-xs font-semibold text-rose-700"><AlertTriangle size={13} /> Posible alergia del paciente</p>}
              </li>
            )
          })}
        </ol>
      )}
      <Campo label="Indicaciones generales (opcional)">
        <textarea className="input" rows={2} placeholder="Ej: no comer cosas duras por 24 horas, aplicar frío…" value={indicaciones} onChange={(e) => setIndicaciones(e.target.value)} />
      </Campo>
      <Botones ocupado={ocupado} onGuardar={guardar} />
    </div>
  )
}

// ---------------------------------------------------------------- Presupuesto

export function PresupuestoForm({ paciente, onListo }: { paciente: Paciente; onListo: () => void }) {
  const tratamientos = useLiveQuery(() => db.tratamientos.orderBy('nombre').toArray(), [])
  const [items, setItems] = useState<ItemPresupuesto[]>([])
  const [descuento, setDescuento] = useState('')
  const [validez, setValidez] = useState('30')
  const [notas, setNotas] = useState('')
  const { exportar, ocupado } = useExportar(paciente)

  const cambiar = (i: number, k: keyof ItemPresupuesto, v: string) =>
    setItems(items.map((it, j) => (j === i ? { ...it, [k]: k === 'cantidad' || k === 'precio' ? Math.max(0, Number(v) || 0) : v } : it)))
  const subtotal = items.reduce((s, it) => s + it.cantidad * it.precio, 0)
  const desc = Math.min(Number(descuento) || 0, subtotal)

  async function guardar(descargar: boolean) {
    const lista = items.filter((it) => it.tratamiento.trim())
    if (!lista.length) return alert('Agrega al menos un tratamiento.')
    const d: Documento = {
      pacienteId: paciente.id!, fecha: Date.now(), tipo: 'presupuesto', items: lista,
      descuento: desc || undefined, validezDias: Math.max(1, Number(validez) || 30), notas: notas.trim() || undefined,
    }
    d.id = (await db.documentos.add(d)) as number
    await exportar(d, descargar)
    onListo()
  }

  return (
    <div className="space-y-4">
      <div>
        <span className="label">Toca para agregar</span>
        <div className="flex flex-wrap gap-1.5">
          {tratamientos?.map((t) => (
            <button key={t.id} type="button" onClick={() => setItems([...items, { tratamiento: t.nombre, cantidad: 1, precio: t.precio }])}
              className="chip border border-slate-200 bg-white px-3 py-1.5 text-sm text-slate-700 hover:border-teal-300">
              {t.nombre} <span className="text-slate-400">{dinero(t.precio)}</span>
            </button>
          ))}
          <button type="button" onClick={() => setItems([...items, { tratamiento: '', cantidad: 1, precio: 0 }])} className="chip border border-dashed border-slate-300 px-3 py-1.5 text-sm text-slate-500"><Plus size={14} /> Otro</button>
        </div>
      </div>

      {items.length > 0 && (
        <div className="space-y-2">
          {items.map((it, i) => (
            <div key={i} className="rounded-xl border border-slate-200 p-3">
              <div className="flex items-center gap-2">
                <input className="input py-1.5 font-semibold" placeholder="Tratamiento" value={it.tratamiento} onChange={(e) => cambiar(i, 'tratamiento', e.target.value)} />
                <button type="button" className="btn-ghost p-2 text-slate-400" aria-label="Quitar" onClick={() => setItems(items.filter((_, j) => j !== i))}><X size={16} /></button>
              </div>
              <div className="mt-2 grid grid-cols-[1fr_4rem_5.5rem] gap-2 text-sm">
                <input className="input py-1.5" placeholder="Pieza" aria-label="Pieza" value={it.pieza ?? ''} onChange={(e) => cambiar(i, 'pieza', e.target.value)} />
                <input className="input py-1.5 text-center" type="number" min="1" inputMode="numeric" aria-label="Cantidad" value={it.cantidad} onChange={(e) => cambiar(i, 'cantidad', e.target.value)} />
                <input className="input py-1.5 text-right" type="number" min="0" inputMode="decimal" aria-label="Precio" value={it.precio} onChange={(e) => cambiar(i, 'precio', e.target.value)} />
              </div>
              <p className="mt-1 text-right text-xs text-slate-500">Subtotal Bs {dinero(it.cantidad * it.precio)}</p>
            </div>
          ))}
        </div>
      )}

      <div className="grid grid-cols-2 gap-3">
        <Campo label="Descuento (Bs)"><input className="input" type="number" min="0" inputMode="decimal" value={descuento} onChange={(e) => setDescuento(e.target.value)} /></Campo>
        <Campo label="Válido por (días)"><input className="input" type="number" min="1" inputMode="numeric" value={validez} onChange={(e) => setValidez(e.target.value)} /></Campo>
      </div>
      <Campo label="Notas (opcional)"><textarea className="input" rows={2} placeholder="Ej: se puede pagar en 3 cuotas" value={notas} onChange={(e) => setNotas(e.target.value)} /></Campo>
      <div className="flex items-center justify-between rounded-xl bg-teal-50 px-4 py-3">
        <span className="font-semibold text-teal-900">Total</span>
        <span className="text-xl font-bold text-teal-700">Bs {dinero(subtotal - desc)}</span>
      </div>
      <Botones ocupado={ocupado} onGuardar={guardar} />
    </div>
  )
}

// ---------------------------------------------------------------- En el historial

export function DocumentoItem({ d, paciente }: { d: Documento; paciente: Paciente }) {
  const { exportar, ocupado } = useExportar(paciente)
  const receta = d.tipo === 'receta'
  const resumen = receta
    ? d.medicamentos.map((m) => m.nombre).join(', ')
    : `${d.items.map((it) => it.tratamiento).join(', ')} · Bs ${dinero(d.items.reduce((s, it) => s + it.cantidad * it.precio, 0) - (d.descuento ?? 0))}`
  return (
    <li className="relative">
      <span className={`absolute -left-[27px] top-4 h-3 w-3 rounded-full border-2 border-white ring-2 ${receta ? 'bg-violet-500 ring-violet-100' : 'bg-amber-500 ring-amber-100'}`} />
      <div className={`rounded-2xl border p-3 ${receta ? 'border-violet-100 bg-violet-50/50' : 'border-amber-100 bg-amber-50/50'}`}>
        <div className="flex items-start gap-2">
          {receta ? <FileText size={18} className="mt-0.5 shrink-0 text-violet-600" /> : <Receipt size={18} className="mt-0.5 shrink-0 text-amber-600" />}
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold">{receta ? 'Receta' : 'Presupuesto'} <span className="font-normal text-slate-500">· {fechaCorta(d.fecha)}</span></p>
            <p className="line-clamp-2 text-xs text-slate-600">{resumen}</p>
          </div>
        </div>
        <div className="mt-2 flex items-center gap-1">
          <button className="btn-ghost px-2.5 py-1.5 text-xs" disabled={ocupado} onClick={() => exportar(d)}><Share2 size={14} /> Compartir</button>
          <button className="btn-ghost px-2.5 py-1.5 text-xs" disabled={ocupado} onClick={() => exportar(d, true)}><Download size={14} /> PDF</button>
          <button className="btn-ghost ml-auto p-1.5 text-slate-400 hover:text-rose-600" aria-label="Eliminar"
            onClick={() => confirm(receta ? '¿Eliminar esta receta?' : '¿Eliminar este presupuesto?') && db.documentos.delete(d.id!)}><Trash2 size={14} /></button>
        </div>
      </div>
    </li>
  )
}
