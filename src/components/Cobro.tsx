import { QrCode, Receipt } from 'lucide-react'
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { calcularSaldo, db, METODOS, type MetodoPago, type Paciente } from '../lib/db'
import { dinero } from '../lib/format'
import { compartirODescargar, pdfRecibo, type DatosRecibo } from '../lib/pdf'
import { useConfig } from '../lib/useConfig'
import { Modal } from './ui'

/** Botones para elegir cómo pagó. */
export function MetodoSelector({ valor, onChange }: { valor?: MetodoPago; onChange: (m: MetodoPago) => void }) {
  return (
    <div className="flex flex-wrap gap-1.5" role="radiogroup" aria-label="Forma de pago">
      {(Object.keys(METODOS) as MetodoPago[]).map((k) => (
        <button key={k} type="button" role="radio" aria-checked={(valor ?? 'efectivo') === k} onClick={() => onChange(k)}
          className={`chip border px-3 py-1.5 text-sm ${(valor ?? 'efectivo') === k ? 'border-teal-700 bg-teal-700 text-white' : 'border-slate-200 bg-white text-slate-600'}`}>
          {METODOS[k]}
        </button>
      ))}
    </div>
  )
}

/** Muestra el QR de cobro del banco en grande para que el paciente lo escanee. */
export function BotonCobrarQR({ monto, onPagado }: { monto: number; onPagado?: () => void }) {
  const config = useConfig()
  const [abierto, setAbierto] = useState(false)
  return (
    <>
      <button type="button" className="btn-soft px-3 py-1.5 text-xs" onClick={() => setAbierto(true)}><QrCode size={15} /> Cobrar con QR</button>
      <Modal abierto={abierto} onCerrar={() => setAbierto(false)} titulo="Cobrar con QR">
        {config.qrPago ? (
          <div className="text-center">
            <p className="text-sm text-slate-500">Monto a pagar</p>
            <p className="mb-3 text-4xl font-bold text-teal-700">Bs {dinero(monto)}</p>
            <img src={config.qrPago} alt="QR de cobro" className="mx-auto w-full max-w-xs rounded-2xl border border-slate-200 bg-white p-2" />
            {config.qrPagoTitular && <p className="mt-2 text-sm font-medium text-slate-600">{config.qrPagoTitular}</p>}
            <p className="mt-3 text-sm text-slate-500">Pídale al paciente que lo escanee con la app de su banco y le muestre el comprobante.</p>
            <button type="button" className="btn-primary mt-4 w-full" onClick={() => { onPagado?.(); setAbierto(false) }}>Ya pagó</button>
          </div>
        ) : (
          <div className="space-y-3 text-sm text-slate-600">
            <p>Todavía no cargaste el QR de cobro de tu banco.</p>
            <p>Desde la app de tu banco, genera tu QR para recibir pagos, toma una captura de pantalla y súbela en <b>Ajustes → Cobro con QR</b>.</p>
            <Link to="/ajustes" className="btn-primary w-full">Ir a Ajustes</Link>
          </div>
        )}
      </Modal>
    </>
  )
}

/** Genera el recibo en PDF y lo comparte o descarga. El saldo es el pendiente a la fecha. */
export function BotonRecibo({ paciente, datos, clase = 'btn-ghost px-2.5 py-1.5 text-xs' }: {
  paciente: Paciente; datos: Omit<DatosRecibo, 'saldo'>; clase?: string
}) {
  const config = useConfig()
  const [ocupado, setOcupado] = useState(false)
  return (
    <button type="button" className={clase} disabled={ocupado} onClick={async (e) => {
      e.stopPropagation()
      setOcupado(true)
      try {
        const [cs, ps] = await Promise.all([db.consultas.where('pacienteId').equals(paciente.id!).toArray(), db.pagos.where('pacienteId').equals(paciente.id!).toArray()])
        const { blob, nombre } = await pdfRecibo({ ...datos, saldo: calcularSaldo(cs, ps) }, paciente, config)
        await compartirODescargar(blob, nombre, `Recibo de pago – ${config.consultorio}`)
      } finally {
        setOcupado(false)
      }
    }}><Receipt size={14} /> Recibo</button>
  )
}
