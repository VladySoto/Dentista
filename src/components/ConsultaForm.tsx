import { useLiveQuery } from 'dexie-react-hooks'
import { Check, ChevronRight } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { db, sumarMeses, type Consulta } from '../lib/db'
import { dinero } from '../lib/format'
import { useConfig } from '../lib/useConfig'
import { BotonCobrarQR, MetodoSelector } from './Cobro'
import { Campo } from './ui'

export default function ConsultaForm({ pacienteId, inicial, motivoInicial = '', siguienteFicha, onGuardado }: {
  pacienteId: number
  inicial?: Consulta
  motivoInicial?: string
  /** Si viene de la fila: cuántos esperan (muestra "Guardar y llamar siguiente"). */
  siguienteFicha?: number
  onGuardado: (c: Consulta, siguiente: boolean) => void
}) {
  const config = useConfig()
  const tratamientos = useLiveQuery(() => db.tratamientos.orderBy('nombre').toArray(), [])
  const [c, setC] = useState<Consulta>(inicial ?? { pacienteId, fecha: Date.now(), motivo: motivoInicial })
  const [elegidos, setElegidos] = useState<string[]>([])
  const set = (k: keyof Consulta) => (e: { target: { value: string } }) => setC({ ...c, [k]: e.target.value })
  const setNum = (k: 'costo' | 'pagado') => (e: { target: { value: string } }) =>
    setC({ ...c, [k]: e.target.value === '' ? undefined : Number(e.target.value) })

  function alternar(nombre: string, precio: number) {
    const quitar = elegidos.includes(nombre)
    const lista = quitar ? elegidos.filter((n) => n !== nombre) : [...elegidos, nombre]
    setElegidos(lista)
    const textoPrevio = (c.tratamiento ?? '').split(', ').filter((t) => t && !elegidos.includes(t))
    setC({
      ...c,
      motivo: c.motivo || nombre,
      tratamiento: [...lista, ...textoPrevio].join(', '),
      costo: Math.max(0, (c.costo ?? 0) + (quitar ? -precio : precio)),
    })
  }

  async function guardar(e: FormEvent, siguiente = false) {
    e.preventDefault()
    const pago = (c.pagado ?? 0) > 0
    const final = { ...c, motivo: c.motivo.trim() || elegidos[0] || 'Consulta', metodoPago: pago ? c.metodoPago ?? 'efectivo' : undefined }
    const id = await db.consultas.put(final)
    onGuardado({ ...final, id }, siguiente)
  }

  const fechaInput = new Date(c.fecha - new Date(c.fecha).getTimezoneOffset() * 60000).toISOString().slice(0, 16)
  const debe = (c.costo ?? 0) - (c.pagado ?? 0)

  return (
    <form onSubmit={guardar} className="space-y-4">
      {!inicial && tratamientos && tratamientos.length > 0 && (
        <div>
          <span className="label">Tratamientos realizados</span>
          <div className="flex flex-wrap gap-1.5">
            {tratamientos.map((t) => {
              const on = elegidos.includes(t.nombre)
              return (
                <button key={t.id} type="button" onClick={() => alternar(t.nombre, t.precio)}
                  className={`chip border px-3 py-1.5 text-sm transition ${on ? 'border-teal-700 bg-teal-700 text-white' : 'border-slate-200 bg-white text-slate-700'}`}>
                  {on && <Check size={14} />}{t.nombre} <span className={on ? 'text-teal-100' : 'text-slate-500'}>{dinero(t.precio)}</span>
                </button>
              )
            })}
          </div>
        </div>
      )}

      <Campo label="Motivo de consulta"><input className="input" value={c.motivo} onChange={set('motivo')} placeholder="Se completa al elegir un tratamiento" /></Campo>
      <div className="grid grid-cols-2 gap-3">
        <Campo label="Pieza(s)"><input className="input" placeholder="Ej: 36, 37" value={c.piezas ?? ''} onChange={set('piezas')} /></Campo>
        <Campo label="Fecha y hora">
          <input className="input" type="datetime-local" value={fechaInput} onChange={(e) => e.target.value && setC({ ...c, fecha: new Date(e.target.value).getTime() })} />
        </Campo>
      </div>
      <Campo label="Diagnóstico"><textarea className="input" rows={2} value={c.diagnostico ?? ''} onChange={set('diagnostico')} /></Campo>
      <Campo label="Tratamiento"><textarea className="input" rows={2} value={c.tratamiento ?? ''} onChange={set('tratamiento')} /></Campo>
      <Campo label="Indicaciones / notas"><textarea className="input" rows={2} value={c.notas ?? ''} onChange={set('notas')} /></Campo>

      <div className="rounded-2xl bg-slate-50 p-4">
        <div className="grid grid-cols-2 gap-3">
          <Campo label="Costo (Bs)"><input className="input" type="number" inputMode="decimal" min="0" step="any" value={c.costo ?? ''} onChange={setNum('costo')} /></Campo>
          <Campo label="Pagó (Bs)"><input className="input" type="number" inputMode="decimal" min="0" step="any" value={c.pagado ?? ''} onChange={setNum('pagado')} /></Campo>
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <button type="button" className="btn-soft px-3 py-1.5 text-xs" onClick={() => setC({ ...c, pagado: c.costo ?? 0 })}>Pagó todo</button>
          <button type="button" className="btn-ghost px-3 py-1.5 text-xs" onClick={() => setC({ ...c, pagado: 0 })}>No pagó</button>
          {(c.costo ?? 0) > 0 && <BotonCobrarQR monto={(c.pagado ?? 0) > 0 ? c.pagado! : c.costo!}
            onPagado={() => setC({ ...c, pagado: (c.pagado ?? 0) > 0 ? c.pagado : c.costo, metodoPago: 'qr' })} />}
          {debe > 0 && <span className="ml-auto text-sm font-semibold text-rose-600">Queda debiendo Bs {dinero(debe)}</span>}
        </div>
        {(c.pagado ?? 0) > 0 && (
          <div className="mt-3">
            <span className="label">Forma de pago</span>
            <MetodoSelector valor={c.metodoPago} onChange={(m) => setC({ ...c, metodoPago: m })} />
          </div>
        )}
      </div>

      <label className="flex items-center gap-3 rounded-2xl border border-slate-200 p-3">
        <input type="checkbox" className="h-5 w-5 accent-teal-600" checked={!!c.proximoControl}
          onChange={(e) => setC({ ...c, proximoControl: e.target.checked ? sumarMeses(config.mesesControl) : undefined })} />
        <span className="text-sm">Recordar control en <b>{config.mesesControl} meses</b>
          {c.proximoControl && <span className="block text-xs text-slate-500">Aparecerá en Caja → Controles el {new Date(c.proximoControl + 'T00:00').toLocaleDateString('es')}</span>}
        </span>
      </label>

      {siguienteFicha !== undefined ? (
        <div className="space-y-2">
          {siguienteFicha > 0 && (
            <button type="button" className="btn-primary w-full py-3.5" onClick={(e) => guardar(e, true)}>
              Guardar y llamar ficha {siguienteFicha} <ChevronRight size={18} />
            </button>
          )}
          <button className={`${siguienteFicha > 0 ? 'btn-soft' : 'btn-primary'} w-full`}>Guardar y volver a la sala</button>
        </div>
      ) : (
        <button className="btn-primary w-full">{inicial ? 'Guardar cambios' : 'Guardar consulta'}</button>
      )}
    </form>
  )
}
