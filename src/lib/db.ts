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
}

export const db = new Dexie('consultorio-dental') as Dexie & {
  pacientes: EntityTable<Paciente, 'id'>
  turnos: EntityTable<Turno, 'id'>
  citas: EntityTable<Cita, 'id'>
  consultas: EntityTable<Consulta, 'id'>
}

db.version(1).stores({
  pacientes: '++id, nombre, documento, telefono, creado',
  turnos: '++id, pacienteId, fecha, estado, [fecha+numero]',
  citas: '++id, pacienteId, fecha, [fecha+hora], estado',
  consultas: '++id, pacienteId, fecha',
})

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
  const [pacientes, turnos, citas, consultas] = await Promise.all([
    db.pacientes.toArray(), db.turnos.toArray(), db.citas.toArray(), db.consultas.toArray(),
  ])
  return { version: 1, exportado: new Date().toISOString(), pacientes, turnos, citas, consultas }
}

export async function importarRespaldo(data: Awaited<ReturnType<typeof exportarRespaldo>>) {
  if (!data || data.version !== 1) throw new Error('Archivo de respaldo no válido')
  await db.transaction('rw', [db.pacientes, db.turnos, db.citas, db.consultas], async () => {
    await Promise.all([db.pacientes.clear(), db.turnos.clear(), db.citas.clear(), db.consultas.clear()])
    await db.pacientes.bulkAdd(data.pacientes)
    await db.turnos.bulkAdd(data.turnos)
    await db.citas.bulkAdd(data.citas)
    await db.consultas.bulkAdd(data.consultas)
  })
}

export function hoy(d = new Date()) {
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`
}
