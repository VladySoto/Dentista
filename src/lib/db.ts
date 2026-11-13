import Dexie, { type EntityTable } from 'dexie'

export type EstadoDiente =
  | 'sano' | 'caries' | 'obturado' | 'endodoncia' | 'corona' | 'extraido' | 'implante' | 'ausente'

export interface Paciente {
  id?: number
  nombre: string
  documento?: string
  telefono?: string
  fechaNacimiento?: string
  sexo?: 'F' | 'M' | 'O' | ''
  direccion?: string
  alergias?: string
  enfermedades?: string
  medicamentos?: string
  notas?: string
  dientes?: Record<number, EstadoDiente>
  creado: number
}

export type EstadoTurno = 'espera' | 'atencion' | 'atendido' | 'cancelado'

/** Turno de la cola de atención por orden de llegada. */
export interface Turno {
  id?: number
  pacienteId: number
  fecha: string // YYYY-MM-DD
  numero: number
  motivo?: string
  estado: EstadoTurno
  llegada: number
  inicio?: number
  fin?: number
}

export type EstadoCita = 'pendiente' | 'confirmada' | 'llego' | 'cancelada'

export interface Cita {
  id?: number
  pacienteId: number
  fecha: string // YYYY-MM-DD
  hora: string // HH:mm
  motivo?: string
  estado: EstadoCita
}

export interface Consulta {
  id?: number
  pacienteId: number
  fecha: number
  motivo: string
  diagnostico?: string
  tratamiento?: string
  piezas?: string
  costo?: number
  pagado?: number
  notas?: string
  proximoControl?: string // YYYY-MM-DD
}

/** Abono a una deuda, fuera de una consulta. */
export interface Pago {
  id?: number
  pacienteId: number
  fecha: number
  monto: number
  nota?: string
}

export interface Tratamiento {
  id?: number
  nombre: string
  precio: number
}

export interface Config {
  id: 'general'
  consultorio: string
  dentista: string
  telefono: string
  direccion: string
  horario: string
  mesesControl: number
  plantillas: { cita: string; control: string; saldo: string }
}

export const CONFIG_INICIAL: Config = {
  id: 'general',
  consultorio: 'Consultorio Dental',
  dentista: '',
  telefono: '',
  direccion: '',
  horario: 'Lunes a viernes 8:00–12:00 y 15:00–19:00 · Sábados 8:00–12:00',
  mesesControl: 6,
  plantillas: {
    cita: 'Hola {nombre} 👋, le recordamos su cita en {consultorio} el {fecha} a las {hora}. ¿Nos confirma su asistencia? 🦷',
    control: 'Hola {nombre} 👋, ya pasaron unos meses desde su última visita a {consultorio}. Le recomendamos venir a su control dental. Atendemos {horario}. 🦷',
    saldo: 'Hola {nombre} 👋, le escribimos de {consultorio}. Le recordamos que tiene un saldo pendiente de Bs {saldo}. ¡Gracias!',
  },
}

// Precios de ejemplo: se editan desde Ajustes
const TRATAMIENTOS_INICIALES: Omit<Tratamiento, 'id'>[] = [
  { nombre: 'Consulta / revisión', precio: 50 },
  { nombre: 'Limpieza', precio: 150 },
  { nombre: 'Resina', precio: 200 },
  { nombre: 'Curación temporal', precio: 80 },
  { nombre: 'Extracción simple', precio: 150 },
  { nombre: 'Extracción de muela del juicio', precio: 500 },
  { nombre: 'Endodoncia', precio: 600 },
  { nombre: 'Sellante', precio: 80 },
  { nombre: 'Blanqueamiento', precio: 800 },
  { nombre: 'Corona', precio: 1200 },
]

export const db = new Dexie('consultorio-dental') as Dexie & {
  pacientes: EntityTable<Paciente, 'id'>
  turnos: EntityTable<Turno, 'id'>
  citas: EntityTable<Cita, 'id'>
  consultas: EntityTable<Consulta, 'id'>
  pagos: EntityTable<Pago, 'id'>
  tratamientos: EntityTable<Tratamiento, 'id'>
  config: EntityTable<Config, 'id'>
}

db.version(1).stores({
  pacientes: '++id, nombre, documento, telefono, creado',
  turnos: '++id, pacienteId, fecha, estado, [fecha+numero]',
  citas: '++id, pacienteId, fecha, [fecha+hora], estado',
  consultas: '++id, pacienteId, fecha',
})

db.version(2).stores({
  pagos: '++id, pacienteId, fecha',
  tratamientos: '++id, nombre',
  config: 'id',
})

// Primera vez: carga configuración y tratamientos de ejemplo
db.on('ready', async () => {
  if (await db.config.get('general')) return
  await db.transaction('rw', db.config, db.tratamientos, async () => {
    await db.config.put(CONFIG_INICIAL)
    if ((await db.tratamientos.count()) === 0) await db.tratamientos.bulkAdd(TRATAMIENTOS_INICIALES)
  })
})

/** Rellena una plantilla de mensaje: "Hola {nombre}" → "Hola Juan". */
export function rellenar(plantilla: string, vars: Record<string, string | number | undefined>) {
  return plantilla.replace(/\{(\w+)\}/g, (m, k) => (k in vars ? String(vars[k] ?? '') : m))
}

export function enlaceWhatsApp(telefono: string | undefined, texto?: string) {
  let tel = telefono?.replace(/\D/g, '') ?? ''
  if (!tel) return null
  if (tel.length === 8) tel = '591' + tel // número boliviano sin código de país
  return `https://wa.me/${tel}${texto ? `?text=${encodeURIComponent(texto)}` : ''}`
}

/** Saldo pendiente: lo cobrado en consultas menos lo pagado y los abonos. */
export function calcularSaldo(consultas: Consulta[], pagos: Pago[]) {
  const deuda = consultas.reduce((s, c) => s + (c.costo ?? 0) - (c.pagado ?? 0), 0)
  return Math.max(0, deuda - pagos.reduce((s, p) => s + p.monto, 0))
}

/** Pasa a atención al siguiente de la fila de hoy. Devuelve su turno o null. */
export async function llamarSiguiente() {
  const siguiente = (await db.turnos.where('fecha').equals(hoy()).sortBy('numero')).find((t) => t.estado === 'espera')
  if (!siguiente) return null
  await db.turnos.update(siguiente.id!, { estado: 'atencion', inicio: Date.now() })
  return siguiente
}

export async function registrarLlegada(pacienteId: number, motivo?: string) {
  const fecha = hoy()
  return db.transaction('rw', db.turnos, async () => {
    const ultimo = await db.turnos.where('[fecha+numero]').between([fecha, 0], [fecha, Infinity]).last()
    const numero = (ultimo?.numero ?? 0) + 1
    await db.turnos.add({ pacienteId, fecha, numero, motivo, estado: 'espera', llegada: Date.now() })
    return numero
  })
}

export async function exportarRespaldo() {
  const [pacientes, turnos, citas, consultas, pagos, tratamientos, config] = await Promise.all([
    db.pacientes.toArray(), db.turnos.toArray(), db.citas.toArray(), db.consultas.toArray(),
    db.pagos.toArray(), db.tratamientos.toArray(), db.config.toArray(),
  ])
  return { version: 2, exportado: new Date().toISOString(), pacientes, turnos, citas, consultas, pagos, tratamientos, config }
}

const TABLAS = ['pacientes', 'turnos', 'citas', 'consultas', 'pagos', 'tratamientos', 'config'] as const

export async function importarRespaldo(data: Partial<Awaited<ReturnType<typeof exportarRespaldo>>> & { version?: number }) {
  if (!data || (data.version !== 1 && data.version !== 2) || !Array.isArray(data.pacientes)) throw new Error('Archivo de respaldo no válido')
  await db.transaction('rw', TABLAS.map((t) => db[t]), async () => {
    for (const t of TABLAS) {
      const filas = data[t]
      if (!filas && (t === 'tratamientos' || t === 'config')) continue // respaldo antiguo: conserva lo actual
      await db[t].clear()
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      if (filas?.length) await (db[t] as any).bulkAdd(filas)
    }
  })
}

export function hoy(d = new Date()) {
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`
}

/** Variables comunes para las plantillas de WhatsApp. */
export function varsPlantilla(config: Config, paciente?: Paciente) {
  return {
    nombre: paciente?.nombre.split(/\s+/)[0] ?? '',
    consultorio: config.consultorio,
    dentista: config.dentista,
    horario: config.horario,
    telefono: config.telefono,
    direccion: config.direccion,
  }
}

export function sumarMeses(meses: number, desde = new Date()) {
  const d = new Date(desde)
  d.setMonth(d.getMonth() + meses)
  return hoy(d)
}
