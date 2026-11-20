import { useLiveQuery } from 'dexie-react-hooks'
import { ChevronLeft, ChevronRight, Download, FileSpreadsheet } from 'lucide-react'
import { useState } from 'react'
import { Encabezado } from '../components/ui'
import { calcularSaldo, db, METODOS, type Consulta, type Gasto, type Pago, type Turno } from '../lib/db'
import { dinero, fechaCorta } from '../lib/format'

// Colores validados (contraste y daltonismo): cobrado = verde azulado de la app, gastos = naranja
const C_COBRADO = '#0d9488'
const C_GASTOS = '#eb6834'

const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic']
const DIAS = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom']

const rangoMes = (anio: number, mes: number) => [new Date(anio, mes, 1).getTime(), new Date(anio, mes + 1, 1).getTime()] as const
const fechaTurno = (t: Turno) => t.fin ?? t.llegada
const sinNombreEn = (ts: Turno[], ini: number, fin: number) => ts.filter((t) => fechaTurno(t) >= ini && fechaTurno(t) < fin)
const cobradoDe = (cs: Consulta[], ps: Pago[], ts: Turno[], ini: number, fin: number) =>
  cs.filter((c) => c.fecha >= ini && c.fecha < fin).reduce((s, c) => s + (c.pagado ?? 0), 0) +
  ps.filter((p) => p.fecha >= ini && p.fecha < fin).reduce((s, p) => s + p.monto, 0) +
  sinNombreEn(ts, ini, fin).reduce((s, t) => s + t.cobro!.pagado, 0)
const gastosDe = (gs: Gasto[], ini: number, fin: number) => gs.filter((g) => g.fecha >= ini && g.fecha < fin).reduce((s, g) => s + g.monto, 0)

export default function Reportes() {
  const hoy = new Date()
  const [mes, setMes] = useState({ anio: hoy.getFullYear(), mes: hoy.getMonth() })
  const esActual = mes.anio === hoy.getFullYear() && mes.mes === hoy.getMonth()
  const mover = (d: number) => setMes(({ anio, mes }) => { const f = new Date(anio, mes + d, 1); return { anio: f.getFullYear(), mes: f.getMonth() } })

  const datos = useLiveQuery(async () => {
    const [consultas, pagos, gastos, pacientes, sinNombre] = await Promise.all([
      db.consultas.toArray(), db.pagos.toArray(), db.gastos.toArray(), db.pacientes.toArray(), db.turnos.filter((t) => !!t.cobro).toArray(),
    ])
    const [ini, fin] = rangoMes(mes.anio, mes.mes)

    const seisMeses = Array.from({ length: 6 }, (_, i) => {
      const f = new Date(mes.anio, mes.mes - 5 + i, 1)
      const [a, b] = rangoMes(f.getFullYear(), f.getMonth())
      return { etiqueta: MESES[f.getMonth()], anio: f.getFullYear(), mes: f.getMonth(), cobrado: cobradoDe(consultas, pagos, sinNombre, a, b), gastos: gastosDe(gastos, a, b) }
    })

    const delMes = consultas.filter((c) => c.fecha >= ini && c.fecha < fin)
    const anonimos = sinNombreEn(sinNombre, ini, fin)
    const tratamientos = new Map<string, number>()
    const textos = [...delMes.map((c) => c.tratamiento || c.motivo), ...anonimos.map((t) => t.cobro!.concepto ?? '')]
    for (const texto of textos) for (const t of texto.split(',').map((x) => x.trim()).filter(Boolean)) tratamientos.set(t, (tratamientos.get(t) ?? 0) + 1)
    const porDia = Array(7).fill(0) as number[]
    for (const f of [...delMes.map((c) => c.fecha), ...anonimos.map(fechaTurno)]) porDia[(new Date(f).getDay() + 6) % 7]++
    const porCategoria = new Map<string, number>()
    for (const g of gastos.filter((g) => g.fecha >= ini && g.fecha < fin)) porCategoria.set(g.categoria, (porCategoria.get(g.categoria) ?? 0) + g.monto)

    return {
      consultas, pagos, gastos, pacientes, sinNombre, seisMeses,
      cobrado: cobradoDe(consultas, pagos, sinNombre, ini, fin), totalGastos: gastosDe(gastos, ini, fin),
      atenciones: delMes.length + anonimos.length, atendidos: new Set(delMes.map((c) => c.pacienteId)).size,
      nuevos: pacientes.filter((p) => p.creado >= ini && p.creado < fin).length,
      tratamientos: [...tratamientos].sort((a, b) => b[1] - a[1]).slice(0, 8),
      porDia, porCategoria: [...porCategoria].sort((a, b) => b[1] - a[1]),
    }
  }, [mes.anio, mes.mes])

  if (!datos) return null
  const ganancia = datos.cobrado - datos.totalGastos
  const nombreMes = new Date(mes.anio, mes.mes, 1).toLocaleDateString('es', { month: 'long', year: 'numeric' })

  return (
    <>
      <Encabezado titulo="Reportes" sub="Cómo le fue al consultorio" />

      <div className="mb-4 flex items-center justify-between">
        <button className="btn-ghost p-2" onClick={() => mover(-1)} aria-label="Mes anterior"><ChevronLeft /></button>
        <p className="text-lg font-semibold first-letter:uppercase">{nombreMes}</p>
        <button className="btn-ghost p-2" onClick={() => mover(1)} disabled={esActual} aria-label="Mes siguiente"><ChevronRight /></button>
      </div>

      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-3">
        <Tile valor={`Bs ${dinero(datos.cobrado)}`} label="Cobrado" />
        <Tile valor={`Bs ${dinero(datos.totalGastos)}`} label="Gastos" />
        <Tile valor={`${ganancia < 0 ? '−' : ''}Bs ${dinero(Math.abs(ganancia))}`} label="Ganancia" tono={ganancia < 0 ? 'mal' : 'bien'} />
        <Tile valor={datos.atenciones} label="Consultas" />
        <Tile valor={datos.atendidos} label="Pacientes atendidos" />
        <Tile valor={datos.nuevos} label="Pacientes nuevos" />
      </div>

      <Tarjeta titulo="Cobrado y gastos · últimos 6 meses">
        <Leyenda items={[['Cobrado', C_COBRADO], ['Gastos', C_GASTOS]]} />
        <BarrasMeses meses={datos.seisMeses} seleccionado={mes} onElegir={(m) => setMes(m)} />
      </Tarjeta>

      <div className="grid gap-4 md:grid-cols-2">
        <Tarjeta titulo="Tratamientos más realizados">
          {datos.tratamientos.length ? <BarrasH filas={datos.tratamientos} color={C_COBRADO} formato={(n) => `${n} ${n === 1 ? 'vez' : 'veces'}`} />
            : <Vacio texto="Sin consultas este mes." />}
        </Tarjeta>
        <Tarjeta titulo="Consultas por día de la semana">
          {datos.atenciones ? <BarrasDias valores={datos.porDia} /> : <Vacio texto="Sin consultas este mes." />}
        </Tarjeta>
        <Tarjeta titulo="Gastos por categoría">
          {datos.porCategoria.length ? <BarrasH filas={datos.porCategoria} color={C_GASTOS} formato={(n) => `Bs ${dinero(n)}`} />
            : <Vacio texto="Sin gastos este mes." />}
        </Tarjeta>
        <Tarjeta titulo="Exportar a Excel">
          <p className="mb-3 text-sm text-slate-500">Archivos .csv que se abren en Excel o Google Sheets. Útiles para el contador.</p>
          <div className="flex flex-col gap-2">
            <button className="btn-primary" onClick={() => exportarMovimientos(datos, mes.anio, mes.mes)}><FileSpreadsheet size={18} /> Movimientos de {MESES[mes.mes]} {mes.anio}</button>
            <button className="btn-soft" onClick={() => exportarPacientes(datos)}><Download size={18} /> Lista de pacientes</button>
          </div>
        </Tarjeta>
      </div>
    </>
  )
}

// ---------------------------------------------------------------- piezas

function Tile({ valor, label, tono }: { valor: React.ReactNode; label: string; tono?: 'bien' | 'mal' }) {
  return (
    <div className={`card p-4 ${tono === 'mal' ? 'border-rose-200 bg-rose-50' : ''}`}>
      <p className={`text-xl font-bold tabular-nums sm:text-2xl ${tono === 'mal' ? 'text-rose-700' : tono === 'bien' ? 'text-emerald-700' : ''}`}>{valor}</p>
      <p className="text-xs text-slate-500">{label}</p>
    </div>
  )
}

const Tarjeta = ({ titulo, children }: { titulo: string; children: React.ReactNode }) => (
  <section className="card mb-4 p-4">
    <h2 className="mb-3 font-semibold">{titulo}</h2>
    {children}
  </section>
)

const Vacio = ({ texto }: { texto: string }) => <p className="py-6 text-center text-sm text-slate-400">{texto}</p>

function Leyenda({ items }: { items: [string, string][] }) {
  return (
    <div className="mb-2 flex gap-4 text-xs text-slate-600">
      {items.map(([l, c]) => <span key={l} className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm" style={{ background: c }} />{l}</span>)}
    </div>
  )
}

/** Barras agrupadas (cobrado y gastos) por mes, con detalle al tocar o pasar el cursor. */
function BarrasMeses({ meses, seleccionado, onElegir }: {
  meses: { etiqueta: string; anio: number; mes: number; cobrado: number; gastos: number }[]
  seleccionado: { anio: number; mes: number }
  onElegir: (m: { anio: number; mes: number }) => void
}) {
  const [foco, setFoco] = useState<number | null>(null)
  const max = Math.max(1, ...meses.flatMap((m) => [m.cobrado, m.gastos]))
  const W = 320, H = 150, base = 128, top = 10, ancho = W / meses.length
  const alto = (v: number) => Math.max(v > 0 ? 2 : 0, ((base - top) * v) / max)
  const f = foco !== null ? meses[foco] : null
  return (
    <div className="relative">
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img"
        aria-label={meses.map((m) => `${m.etiqueta}: cobrado ${m.cobrado}, gastos ${m.gastos}`).join('; ')}
        onMouseLeave={() => setFoco(null)}>
        {[0.5, 1].map((t) => <line key={t} x1="0" x2={W} y1={base - (base - top) * t} y2={base - (base - top) * t} stroke="#e2e8f0" strokeWidth="0.6" />)}
        <line x1="0" x2={W} y1={base} y2={base} stroke="#cbd5e1" strokeWidth="0.8" />
        {meses.map((m, i) => {
          const x = i * ancho + ancho / 2
          const sel = m.anio === seleccionado.anio && m.mes === seleccionado.mes
          const bw = Math.min(16, ancho / 3.4)
          return (
            <g key={i} opacity={foco === null || foco === i ? 1 : 0.45}>
              <rect x={x - bw - 1} y={base - alto(m.cobrado)} width={bw} height={alto(m.cobrado)} rx="2.5" fill={C_COBRADO} />
              <rect x={x + 1} y={base - alto(m.gastos)} width={bw} height={alto(m.gastos)} rx="2.5" fill={C_GASTOS} />
              <text x={x} y={H - 6} textAnchor="middle" fontSize="10" fill={sel ? '#0f172a' : '#64748b'} fontWeight={sel ? 700 : 400}>{m.etiqueta}</text>
              <rect x={i * ancho} y="0" width={ancho} height={H} fill="transparent" className="cursor-pointer"
                onMouseEnter={() => setFoco(i)} onClick={() => { setFoco(i); onElegir({ anio: m.anio, mes: m.mes }) }} />
            </g>
          )
        })}
      </svg>
      {f && (
        <div className="pointer-events-none absolute -top-2 rounded-xl bg-slate-900 px-3 py-2 text-xs text-white shadow-lg"
          style={{ left: `${Math.min(70, Math.max(0, ((foco! + 0.5) / meses.length) * 100 - 15))}%` }}>
          <p className="mb-1 font-semibold capitalize">{f.etiqueta} {f.anio}</p>
          <p className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-sm" style={{ background: C_COBRADO }} />Cobrado: Bs {dinero(f.cobrado)}</p>
          <p className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-sm" style={{ background: C_GASTOS }} />Gastos: Bs {dinero(f.gastos)}</p>
          <p className="mt-1 border-t border-white/20 pt-1">Ganancia: Bs {dinero(f.cobrado - f.gastos)}</p>
        </div>
      )}
      <p className="mt-1 text-xs text-slate-400">Toca un mes para ver su detalle.</p>
    </div>
  )
}

/** Barras horizontales con el valor escrito al lado (sirve también como tabla). */
function BarrasH({ filas, color, formato }: { filas: [string, number][]; color: string; formato: (n: number) => string }) {
  const max = Math.max(1, ...filas.map((f) => f[1]))
  return (
    <ul className="space-y-2.5">
      {filas.map(([nombre, v]) => (
        <li key={nombre}>
          <div className="mb-1 flex justify-between gap-2 text-sm">
            <span className="truncate text-slate-700">{nombre}</span>
            <span className="shrink-0 font-semibold tabular-nums text-slate-900">{formato(v)}</span>
          </div>
          <div className="h-2.5 rounded-full bg-slate-100">
            <div className="h-full rounded-full" style={{ width: `${Math.max(2, (v / max) * 100)}%`, background: color }} />
          </div>
        </li>
      ))}
    </ul>
  )
}

function BarrasDias({ valores }: { valores: number[] }) {
  const max = Math.max(1, ...valores)
  const mayor = valores.indexOf(Math.max(...valores))
  return (
    <div>
      <div className="flex h-36 items-end gap-2" role="img" aria-label={DIAS.map((d, i) => `${d}: ${valores[i]}`).join(', ')}>
        {valores.map((v, i) => (
          <div key={i} className="flex h-full flex-1 flex-col items-center justify-end gap-1">
            <span className="text-xs font-semibold tabular-nums text-slate-700">{v || ''}</span>
            <div className="w-full max-w-8 rounded-t" style={{ height: `${(v / max) * 100}%`, minHeight: v ? 3 : 0, background: C_COBRADO, opacity: i === mayor ? 1 : 0.55 }} />
          </div>
        ))}
      </div>
      <div className="mt-1 flex gap-2 border-t border-slate-200 pt-1">
        {DIAS.map((d, i) => <span key={d} className={`flex-1 text-center text-xs ${i === mayor ? 'font-bold text-slate-900' : 'text-slate-500'}`}>{d}</span>)}
      </div>
      <p className="mt-2 text-xs text-slate-500">El día con más consultas fue <b>{['lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado', 'domingo'][mayor]}</b>.</p>
    </div>
  )
}

// ---------------------------------------------------------------- exportar

type Datos = { consultas: Consulta[]; pagos: Pago[]; gastos: Gasto[]; sinNombre: Turno[]; pacientes: { id?: number; nombre: string; documento?: string; telefono?: string; fechaNacimiento?: string; alergias?: string; enfermedades?: string; creado: number }[] }

/** CSV para Excel en español: separador ";" y decimales con coma; con BOM para que respete las tildes. */
function descargarCSV(nombre: string, filas: (string | number)[][]) {
  const celda = (v: string | number) => {
    const t = typeof v === 'number' ? String(v).replace('.', ',') : v
    return /[;"\n]/.test(t) ? `"${t.replace(/"/g, '""')}"` : t
  }
  const csv = '﻿' + filas.map((f) => f.map(celda).join(';')).join('\r\n')
  const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }))
  const a = document.createElement('a')
  a.href = url; a.download = nombre; a.click()
  setTimeout(() => URL.revokeObjectURL(url), 10_000)
}

function exportarMovimientos(d: Datos, anio: number, mes: number) {
  const [ini, fin] = rangoMes(anio, mes)
  const nombre = new Map(d.pacientes.map((p) => [p.id!, p.nombre]))
  const filas: { fecha: number; fila: (string | number)[] }[] = [
    ...d.consultas.filter((c) => c.fecha >= ini && c.fecha < fin && (c.pagado ?? 0) > 0).map((c) => ({
      fecha: c.fecha, fila: [fechaCorta(c.fecha), 'Ingreso', nombre.get(c.pacienteId) ?? '', c.tratamiento || c.motivo, METODOS[c.metodoPago ?? 'efectivo'], c.pagado!],
    })),
    ...d.pagos.filter((p) => p.fecha >= ini && p.fecha < fin).map((p) => ({
      fecha: p.fecha, fila: [fechaCorta(p.fecha), 'Ingreso', nombre.get(p.pacienteId) ?? '', `Abono${p.nota ? ` (${p.nota})` : ''}`, METODOS[p.metodo ?? 'efectivo'], p.monto],
    })),
    ...sinNombreEn(d.sinNombre, ini, fin).filter((t) => t.cobro!.pagado > 0).map((t) => ({
      fecha: fechaTurno(t), fila: [fechaCorta(fechaTurno(t)), 'Ingreso', `Turno ${t.numero} (sin nombre)`, t.cobro!.concepto ?? '', METODOS[t.cobro!.metodo ?? 'efectivo'], t.cobro!.pagado],
    })),
    ...d.gastos.filter((g) => g.fecha >= ini && g.fecha < fin).map((g) => ({
      fecha: g.fecha, fila: [fechaCorta(g.fecha), 'Gasto', g.categoria, g.descripcion ?? '', METODOS[g.metodo ?? 'efectivo'], -g.monto],
    })),
  ].sort((a, b) => a.fecha - b.fecha)
  const total = filas.reduce((s, f) => s + (f.fila[5] as number), 0)
  descargarCSV(`movimientos-${anio}-${String(mes + 1).padStart(2, '0')}.csv`, [
    ['Fecha', 'Tipo', 'Paciente / categoría', 'Concepto', 'Forma de pago', 'Monto (Bs)'],
    ...filas.map((f) => f.fila),
    ['', '', '', '', 'Resultado del mes', total],
  ])
}

function exportarPacientes(d: Datos) {
  const filas = [...d.pacientes].sort((a, b) => a.nombre.localeCompare(b.nombre)).map((p) => {
    const cs = d.consultas.filter((c) => c.pacienteId === p.id)
    const ultima = cs.reduce<number>((m, c) => Math.max(m, c.fecha), 0)
    return [p.nombre, p.documento ?? '', p.telefono ?? '', p.fechaNacimiento ?? '', p.alergias ?? '', p.enfermedades ?? '',
      cs.length, ultima ? fechaCorta(ultima) : '', calcularSaldo(cs, d.pagos.filter((x) => x.pacienteId === p.id))]
  })
  descargarCSV('pacientes.csv', [['Nombre', 'CI', 'Teléfono', 'Nacimiento', 'Alergias', 'Enfermedades', 'Consultas', 'Última visita', 'Saldo (Bs)'], ...filas])
}
