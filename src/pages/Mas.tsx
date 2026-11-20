import { ChevronRight } from 'lucide-react'
import { Link } from 'react-router-dom'
import { IndicadorNube } from '../components/CuentaNube'
import { SECUNDARIOS } from '../components/Layout'
import { Encabezado } from '../components/ui'
import { useAlertasInventario } from '../lib/inventario'
import { useSync } from '../lib/sync'

const DESCRIPCION: Record<string, string> = {
  '/inventario': 'Materiales, compras y avisos de poco stock',
  '/reportes': 'Ingresos, gastos y pacientes por mes',
  '/ajustes': 'Nube, PIN, QR, precios, mensajes y respaldo',
}

export default function Mas() {
  const alertas = useAlertasInventario()
  const { sesion, estado } = useSync()
  return (
    <>
      <Encabezado titulo="Más" />
      <div className="card divide-y divide-slate-100 overflow-hidden">
        {SECUNDARIOS.map(({ to, label, icono: I }) => (
          <Link key={to} to={to} className="flex items-center gap-4 p-4 hover:bg-slate-50">
            <div className="rounded-xl bg-teal-50 p-2.5 text-teal-600"><I size={22} /></div>
            <div className="min-w-0 flex-1">
              <p className="flex items-center gap-2 font-semibold">
                {label}
                {to === '/inventario' && alertas > 0 && <span className="chip bg-amber-100 text-amber-800">{alertas} por revisar</span>}
                {to === '/ajustes' && <IndicadorNube />}
              </p>
              <p className="truncate text-sm text-slate-500">
                {to === '/ajustes' && sesion ? (estado === 'ok' ? 'Todo guardado en la nube' : DESCRIPCION[to]) : DESCRIPCION[to]}
              </p>
            </div>
            <ChevronRight size={18} className="text-slate-300" />
          </Link>
        ))}
      </div>
    </>
  )
}
