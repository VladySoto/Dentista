import { CalendarDays, ListOrdered, Settings, Users } from 'lucide-react'
import { NavLink, Outlet } from 'react-router-dom'

const enlaces = [
  { to: '/', label: 'Sala de espera', corto: 'Espera', icono: ListOrdered },
  { to: '/citas', label: 'Citas', corto: 'Citas', icono: CalendarDays },
  { to: '/pacientes', label: 'Pacientes', corto: 'Pacientes', icono: Users },
  { to: '/ajustes', label: 'Ajustes', corto: 'Ajustes', icono: Settings },
]

export default function Layout() {
  return (
    <div className="min-h-screen md:flex">
      <aside className="sticky top-0 hidden h-screen w-64 shrink-0 flex-col border-r border-slate-200 bg-white p-4 md:flex">
        <div className="mb-8 flex items-center gap-3 px-2">
          <img src="/icon.svg" alt="" className="h-10 w-10" />
          <div>
            <p className="font-bold leading-tight">Consultorio</p>
            <p className="text-xs text-slate-500">Dental</p>
          </div>
        </div>
        <nav className="space-y-1">
          {enlaces.map(({ to, label, icono: I }) => (
            <NavLink key={to} to={to} end={to === '/'}
              className={({ isActive }) => `flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition ${isActive ? 'bg-teal-50 text-teal-700' : 'text-slate-600 hover:bg-slate-100'}`}>
              <I size={19} /> {label}
            </NavLink>
          ))}
        </nav>
      </aside>

      <main className="mx-auto w-full max-w-5xl px-4 pb-28 pt-6 md:px-8 md:pb-10">
        <Outlet />
      </main>

      <nav className="fixed inset-x-0 bottom-0 z-40 grid grid-cols-4 border-t border-slate-200 bg-white/90 pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden">
        {enlaces.map(({ to, corto, icono: I }) => (
          <NavLink key={to} to={to} end={to === '/'}
            className={({ isActive }) => `flex flex-col items-center gap-0.5 py-2.5 text-[11px] font-medium ${isActive ? 'text-teal-600' : 'text-slate-500'}`}>
            <I size={22} /> {corto}
          </NavLink>
        ))}
      </nav>
    </div>
  )
}
