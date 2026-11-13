import { useLiveQuery } from 'dexie-react-hooks'
import { Banknote, CalendarClock, MessageCircle, Receipt, Wallet } from 'lucide-react'
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Avatar, Encabezado } from '../components/ui'
import { avisoWhatsApp, calcularSaldo, db, hoy, varsPlantilla, type Consulta, type Pago, type Paciente } from '../lib/db'
import { dinero, fechaCorta, hora } from '../lib/format'
import { useConfig } from '../lib/useConfig'

type Periodo = 'hoy' | 'mes'

function rango(periodo: Periodo) {
  const d = new Date()
  const inicio = periodo === 'hoy' ? new Date(d.getFullYear(), d.getMonth(), d.getDate()) : new Date(d.getFullYear(), d.getMonth(), 1)
  const fin = periodo === 'hoy' ? new Date(inicio.getTime() + 86400000) : new Date(d.getFullYear(), d.getMonth() + 1, 1)
  return [inicio.getTime(), fin.getTime()] as const
}

function agrupar<T extends { pacienteId: number }>(filas: T[]) {
  const m = new Map<number, T[]>()
  for (const f of filas) m.set(f.pacienteId, [...(m.get(f.pacienteId) ?? []), f])
  return m
}

export default function Caja() {
  const config = useConfig()
  const [periodo, setPeriodo] = useState<Periodo>('hoy')

  const datos = useLiveQuery(async () => {
    const [ini, fin] = rango(periodo)
    const [consultas, pagos, pacientes] = await Promise.all([db.consultas.toArray(), db.pagos.toArray(), db.pacientes.toArray()])
    const porId = new Map(pacientes.map((p) => [p.id!, p]))

    const movimientos = [
      ...consultas.filter((c) => c.fecha >= ini && c.fecha < fin && (c.pagado ?? 0) > 0)
        .map((c) => ({ fecha: c.fecha, pacienteId: c.pacienteId, concepto: c.tratamiento || c.motivo, monto: c.pagado! })),
      ...pagos.filter((p) => p.fecha >= ini && p.fecha < fin)
        .map((p) => ({ fecha: p.fecha, pacienteId: p.pacienteId, concepto: `Abono${p.nota ? ` · ${p.nota}` : ''}`, monto: p.monto })),
    ].sort((a, b) => b.fecha - a.fecha)
    const atenciones = consultas.filter((c) => c.fecha >= ini && c.fecha < fin).length

    const cPorPac = agrupar<Consulta>(consultas)
    const pPorPac = agrupar<Pago>(pagos)
    const deudores = [...cPorPac.entries()]
      .map(([id, cs]) => ({ p: porId.get(id), saldo: calcularSaldo(cs, pPorPac.get(id) ?? []) }))
      .filter((d): d is { p: Paciente; saldo: number } => !!d.p && d.saldo > 0)
      .sort((a, b) => b.saldo - a.saldo)

    // Controles: según la última consulta de cada paciente, que vencen en los próximos 14 días o ya vencieron
    const limite = new Date(); limite.setDate(limite.getDate() + 14)
    const controles = [...cPorPac.entries()]
      .map(([id, cs]) => ({ p: porId.get(id), ultima: cs.reduce((a, b) => (b.fecha > a.fecha ? b : a)) }))
      .filter((x): x is { p: Paciente; ultima: Consulta } => !!x.p && !!x.ultima.proximoControl && x.ultima.proximoControl <= hoy(limite))
      .sort((a, b) => a.ultima.proximoControl!.localeCompare(b.ultima.proximoControl!))

    return { movimientos, atenciones, deudores, controles, porId }
  }, [periodo])

  if (!datos) return null
  const total = datos.movimientos.reduce((s, m) => s + m.monto, 0)
  const porCobrar = datos.deudores.reduce((s, d) => s + d.saldo, 0)

  return (
    <>
      <Encabezado titulo="Caja" sub="Ingresos, deudas y controles pendientes" />

      <div className="mb-4 grid grid-cols-2 rounded-xl bg-slate-200/60 p-1">
        {([['hoy', 'Hoy'], ['mes', 'Este mes']] as const).map(([k, l]) => (
          <button key={k} onClick={() => setPeriodo(k)}
            className={`rounded-lg py-2 text-sm font-semibold transition ${periodo === k ? 'bg-white text-teal-700 shadow-sm' : 'text-slate-600'}`}>{l}</button>
        ))}
      </div>

      <div className="mb-6 grid grid-cols-2 gap-3">
        <div className="card col-span-2 bg-gradient-to-br from-teal-600 to-cyan-700 p-5 text-white">
          <p className="text-sm text-teal-50">Cobrado {periodo === 'hoy' ? 'hoy' : 'este mes'}</p>
          <p className="text-3xl font-bold">Bs {dinero(total)}</p>
          <p className="mt-1 text-sm text-teal-50">{datos.atenciones} consulta(s) registrada(s)</p>
        </div>
        <div className="card p-4">
          <Wallet size={18} className="mb-1 text-rose-500" />
          <p className="text-xl font-bold">Bs {dinero(porCobrar)}</p>
          <p className="text-xs text-slate-500">Por cobrar (total)</p>
        </div>
        <div className="card p-4">
          <CalendarClock size={18} className="mb-1 text-sky-500" />
          <p className="text-xl font-bold">{datos.controles.length}</p>
          <p className="text-xs text-slate-500">Controles por avisar</p>
        </div>
      </div>

      <Seccion titulo="Movimientos" icono={<Receipt size={16} />}>
        {datos.movimientos.length === 0 ? <p className="p-4 text-sm text-slate-500">Sin cobros en este periodo.</p> :
          datos.movimientos.map((m, i) => (
            <Link key={i} to={`/pacientes/${m.pacienteId}`} className="flex items-center gap-3 p-3 hover:bg-slate-50">
              <span className="w-14 shrink-0 text-xs text-slate-500">{periodo === 'hoy' ? hora(m.fecha) : fechaCorta(m.fecha).replace(/ \d{4}$/, '')}</span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{datos.porId.get(m.pacienteId)?.nombre}</p>
                <p className="truncate text-xs text-slate-500">{m.concepto}</p>
              </div>
              <span className="font-semibold text-emerald-700">+{dinero(m.monto)}</span>
            </Link>
          ))}
      </Seccion>

      <Seccion titulo="Pacientes que deben" icono={<Banknote size={16} />}>
        {datos.deudores.length === 0 ? <p className="p-4 text-sm text-slate-500">Nadie tiene deudas. 🎉</p> :
          datos.deudores.map(({ p, saldo }) => (
            <Fila key={p.id} p={p} detalle={`Debe Bs ${dinero(saldo)}`} detalleCls="text-rose-600 font-semibold"
              wa={avisoWhatsApp(p, config.plantillas.saldo, { ...varsPlantilla(config, p), saldo: dinero(saldo) })} />
          ))}
      </Seccion>

      <Seccion titulo="Controles por avisar" icono={<CalendarClock size={16} />}>
        {datos.controles.length === 0 ? <p className="p-4 text-sm text-slate-500">No hay controles próximos. Al guardar una consulta puedes marcar “Recordar control”.</p> :
          datos.controles.map(({ p, ultima }) => {
            const vencido = ultima.proximoControl! < hoy()
            return (
              <Fila key={p.id} p={p} detalle={`${vencido ? 'Venció' : 'Toca'} el ${fechaCorta(ultima.proximoControl!)}`}
                detalleCls={vencido ? 'text-amber-600 font-medium' : ''}
                wa={avisoWhatsApp(p, config.plantillas.control, varsPlantilla(config, p))} />
            )
          })}
      </Seccion>
    </>
  )
}

function Seccion({ titulo, icono, children }: { titulo: string; icono: React.ReactNode; children: React.ReactNode }) {
  return (
    <section className="mb-6">
      <h2 className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-slate-500">{icono}{titulo}</h2>
      <div className="card divide-y divide-slate-100 overflow-hidden">{children}</div>
    </section>
  )
}

function Fila({ p, detalle, detalleCls = '', wa }: { p: Paciente; detalle: string; detalleCls?: string; wa: string | null }) {
  return (
    <div className="flex items-center gap-3 p-3">
      <Link to={`/pacientes/${p.id}`} className="flex min-w-0 flex-1 items-center gap-3">
        <Avatar nombre={p.nombre} size="sm" />
        <div className="min-w-0">
          <p className="truncate text-sm font-medium">{p.nombre}</p>
          <p className={`truncate text-xs text-slate-500 ${detalleCls}`}>{detalle}</p>
        </div>
      </Link>
      {wa ? <a href={wa} target="_blank" rel="noreferrer" className="btn-soft px-3 py-2 text-xs"><MessageCircle size={15} /> Avisar</a>
        : <span className="text-xs text-slate-400">Sin teléfono</span>}
    </div>
  )
}
