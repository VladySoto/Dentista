import { ArrowLeft, Printer } from 'lucide-react'
import { Link } from 'react-router-dom'
import { urlTurnos, useQR } from '../lib/qr'
import { useConfig } from '../lib/useConfig'

/** Cartel para imprimir y pegar en la sala de espera. */
export default function Cartel() {
  const config = useConfig()
  const qr = useQR(config.codigoQR && urlTurnos(config.codigoQR), 900)

  if (!config.codigoQR) return (
    <div className="p-8 text-center">
      <p>Primero activa los turnos por QR en Ajustes.</p>
      <Link to="/ajustes" className="btn-primary mt-4">Ir a Ajustes</Link>
    </div>
  )

  return (
    <div className="min-h-screen bg-slate-100 print:bg-white">
      <div className="flex items-center justify-between gap-2 p-4 print:hidden">
        <Link to="/ajustes" className="btn-ghost"><ArrowLeft size={18} /> Volver</Link>
        <button className="btn-primary" onClick={() => window.print()}><Printer size={18} /> Imprimir</button>
      </div>
      <div className="mx-auto flex aspect-[210/297] w-full max-w-[210mm] flex-col items-center bg-white px-[8%] py-[7%] text-center shadow-xl print:shadow-none">
        <div className="flex items-center gap-3">
          <img src="/icon.svg" alt="" className="h-14 w-14" />
          <p className="text-3xl font-bold text-slate-800">{config.consultorio}</p>
        </div>
        <h1 className="mt-[6%] text-5xl font-black leading-tight text-teal-700">Tome su turno<br />con su celular</h1>
        {qr && <img src={qr} alt="Código QR para tomar turno" className="my-[5%] w-[62%] rounded-2xl border-8 border-teal-600 p-2" />}
        <ol className="space-y-2 text-left text-2xl text-slate-700">
          <li><b className="text-teal-700">1.</b> Abra la cámara y apunte al código</li>
          <li><b className="text-teal-700">2.</b> Escriba su nombre</li>
          <li><b className="text-teal-700">3.</b> Espere su número en pantalla</li>
        </ol>
        <p className="mt-auto rounded-2xl bg-amber-50 px-6 py-4 text-2xl font-semibold text-amber-900">
          ¿No tiene celular? Tome una ficha numerada 🎫
        </p>
        {config.horario && <p className="mt-4 text-lg text-slate-500">{config.horario}</p>}
      </div>
    </div>
  )
}
