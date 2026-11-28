import { BarChart3, CalendarDays, LayoutGrid, ListOrdered, Package, Settings, Users, Wallet } from 'lucide-react'
import { NavLink, Outlet, useLocation } from 'react-router-dom'
import { useAlertasInventario } from '../lib/inventario'
import { useConfig } from '../lib/useConfig'
import { IndicadorNube } from './CuentaNube'
import RecordatorioRespaldo from './RecordatorioRespaldo'

const principales = [
  { to: '/', label: 'Sala de espera', corto: 'Espera', icono: ListOrdered },
  { to: '/citas', label: 'Citas', corto: 'Citas', icono: CalendarDays },
  { to: '/pacientes', label: 'Pacientes', corto: 'Pacientes', icono: Users },
  { to: '/caja', label: 'Caja', corto: 'Caja', icono: Wallet },
]
export const SECUNDARIOS = [
  { to: '/inventario', label: 'Inventario', icono: Package },
  { to: '/reportes', label: 'Reportes', icono: BarChart3 },
  { to: '/ajustes', label: 'Ajustes', icono: Settings },
]

const Insignia = ({ n }: { n: number }) =>
  n > 0 ? <span className="ml-auto rounded-full bg-amber-500 px-1.5 text-[11px] font-bold leading-5 text-white">{n}</span> : null

export default function Layout() {
  const config = useConfig()
  const alertas = useAlertasInventario()
  const { pathname } = useLocation()
  const enMas = pathname === '/mas' || SECUNDARIOS.some((s) => pathname.startsWith(s.to))

  const enlaceLateral = (to: string, label: string, I: typeof Users) => (
    <NavLink key={to} to={to} end={to === '/'}
      className={({ isActive }) => `flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition ${isActive ? 'bg-teal-50 text-teal-700' : 'text-slate-600 hover:bg-slate-100'}`}>
      <I size={19} /> {label}{to === '/inventario' && <Insignia n={alertas} />}
    </NavLink>
  )

  return (
    <div className="min-h-screen md:flex">
      <aside className="sticky top-0 hidden h-screen w-64 shrink-0 flex-col border-r border-slate-200 bg-white p-4 md:flex">
        <div className="mb-8 flex items-center gap-3 px-2">
          <img src="/icon.svg" alt="" className="h-10 w-10" />
          <div className="min-w-0">
            <p className="truncate font-bold leading-tight">{config.consultorio}</p>
            <p className="flex items-center gap-1.5 truncate text-xs text-slate-500"><IndicadorNube />{config.dentista || 'Nube'}</p>
          </div>
        </div>
        <nav className="space-y-1">
          {principales.map(({ to, label, icono }) => enlaceLateral(to, label, icono))}
          <div className="my-3 border-t border-slate-100" />
          {SECUNDARIOS.map(({ to, label, icono }) => enlaceLateral(to, label, icono))}
        </nav>
      </aside>

      <main className="mx-auto w-full max-w-5xl px-4 pb-28 pt-6 md:px-8 md:pb-10">
        {pathname === '/' && <RecordatorioRespaldo />}
        <Outlet />
      </main>

      <nav className="fixed inset-x-0 bottom-0 z-40 grid grid-cols-5 border-t border-slate-200 bg-white/90 pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden">
        {principales.map(({ to, corto, icono: I }) => (
          <NavLink key={to} to={to} end={to === '/'}
            className={({ isActive }) => `flex flex-col items-center gap-0.5 py-2.5 text-[11px] font-medium ${isActive ? 'text-teal-700' : 'text-slate-500'}`}>
            <I size={22} /> {corto}
          </NavLink>
        ))}
        <NavLink to="/mas" className={`flex flex-col items-center gap-0.5 py-2.5 text-[11px] font-medium ${enMas ? 'text-teal-700' : 'text-slate-500'}`}>
          <span className="relative">
            <LayoutGrid size={22} />
            <span className="absolute -right-1 -top-0.5 flex">
              {alertas > 0 ? <span className="h-2 w-2 rounded-full bg-amber-500" /> : <IndicadorNube />}
            </span>
          </span>
          Más
        </NavLink>
      </nav>
    </div>
  )
}
