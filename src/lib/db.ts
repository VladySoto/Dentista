import Dexie, { type EntityTable } from 'dexie'

export type EstadoDiente =
  | 'sano' | 'caries' | 'obturado' | 'endodoncia' | 'corona' | 'extraido' | 'implante' | 'ausente'

/** Caras del diente: Vestibular, Lingual/palatino, Mesial, Distal, Oclusal/incisal. */
export type Cara = 'V' | 'L' | 'M' | 'D' | 'O'
export type EstadoCara = 'caries' | 'obturado'
export type CarasDientes = Record<number, Partial<Record<Cara, EstadoCara>>>
export type Denticion = 'adulto' | 'nino' | 'mixta'

/** Cómo estaba la boca en una fecha (se guarda solo al cambiar el odontograma). */
export interface OdontogramaDia {
  id?: number
  pacienteId: number
  fecha: string // YYYY-MM-DD
  dientes: Record<number, EstadoDiente>
  caras: CarasDientes
}

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
  /** Familiar o persona de contacto (para pacientes sin celular). */
  contactoNombre?: string
  contactoParentesco?: string
  contactoTelefono?: string
  /** Enviar los avisos de WhatsApp al contacto en vez de al paciente. */
  avisarContacto?: boolean
  dientes?: Record<number, EstadoDiente>
  caras?: CarasDientes
  denticion?: Denticion
  creado: number
}

export type EstadoTurno = 'espera' | 'atencion' | 'atendido' | 'cancelado'

/** Turno de la cola de atención por orden de llegada. */
export interface Turno {
  id?: number
  /** Vacío si llegó con ficha de papel y aún no se identificó. */
  pacienteId?: number
  fecha: string // YYYY-MM-DD
  numero: number
  motivo?: string
  estado: EstadoTurno
  llegada: number
  inicio?: number
  fin?: number
  /** 'qr' si el paciente tomó turno desde su celular. */
  origen?: 'qr'
  /** Datos que escribió el paciente al tomar turno por QR. */
  nombreLlegada?: string
  documentoLlegada?: string
  telefonoLlegada?: string
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

export type MetodoPago = 'efectivo' | 'qr' | 'transferencia' | 'tarjeta'
export const METODOS: Record<MetodoPago, string> = { efectivo: 'Efectivo', qr: 'QR', transferencia: 'Transferencia', tarjeta: 'Tarjeta' }

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
  metodoPago?: MetodoPago
  notas?: string
  proximoControl?: string // YYYY-MM-DD
}

/** Abono a una deuda, fuera de una consulta. */
export interface Pago {
  id?: number
  pacienteId: number
  fecha: number
  monto: number
  metodo?: MetodoPago
  nota?: string
}

export type TipoArchivo = 'foto' | 'radiografia'

/** Foto o radiografía. La imagen completa va en Supabase Storage; aquí van los datos y una miniatura. */
export interface Archivo {
  id?: number
  pacienteId: number
  fecha: number
  tipo: TipoArchivo
  nota?: string
  ancho: number
  alto: number
  bytes: number
  /** Miniatura JPEG (data URL) para ver la galería sin descargar. */
  miniatura: string
}

/** Imagen completa guardada en este dispositivo (pendiente de subir o ya descargada). */
export interface ArchivoLocal { id: number; blob: Blob; subido: 0 | 1 }

export interface Medicamento { id?: number; nombre: string; indicacion: string }

export interface ItemReceta { nombre: string; indicacion: string }
export interface ItemPresupuesto { tratamiento: string; pieza?: string; cantidad: number; precio: number }

export type Documento =
  | { id?: number; pacienteId: number; fecha: number; tipo: 'receta'; medicamentos: ItemReceta[]; indicaciones?: string }
  | { id?: number; pacienteId: number; fecha: number; tipo: 'presupuesto'; items: ItemPresupuesto[]; descuento?: number; validezDias: number; notas?: string }

export const CATEGORIAS_GASTO = ['Materiales', 'Laboratorio', 'Alquiler', 'Servicios (luz, agua, internet)', 'Equipos y mantenimiento', 'Impuestos', 'Personal', 'Otros'] as const

export interface Gasto {
  id?: number
  fecha: number
  categoria: string
  monto: number
  descripcion?: string
  metodo?: MetodoPago
}

/** Material del consultorio (anestesia, resinas, guantes…). */
export interface Material {
  id?: number
  nombre: string
  cantidad: number
  /** Avisar cuando quede esta cantidad o menos. */
  minimo: number
  unidad?: string
  vence?: string // YYYY-MM-DD
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
  /** Matrícula o registro profesional (aparece en las recetas). */
  matricula?: string
  telefono: string
  direccion: string
  horario: string
  mesesControl: number
  /** Imagen del QR de cobro del banco (data URL) y a nombre de quién está. */
  qrPago?: string
  qrPagoTitular?: string
  /** Código secreto del QR de turnos (vacío = turnos por QR desactivados). */
  codigoQR?: string
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
  archivos: EntityTable<Archivo, 'id'>
  archivosLocal: EntityTable<ArchivoLocal, 'id'>
  documentos: EntityTable<Documento, 'id'>
  medicamentos: EntityTable<Medicamento, 'id'>
  odontogramas: EntityTable<OdontogramaDia, 'id'>
  gastos: EntityTable<Gasto, 'id'>
  materiales: EntityTable<Material, 'id'>
  /** Cambios locales que faltan subir a la nube. */
  pendientes: EntityTable<Pendiente, 'tabla'>
  /** Datos internos de la sincronización (no se sincronizan). */
  meta: EntityTable<{ clave: string; valor: string }, 'clave'>
}

export interface Pendiente { tabla: string; id: string; ts: number }

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

db.version(3).stores({
  pendientes: '[tabla+id]',
  meta: 'clave',
})

db.version(4).stores({
  archivos: '++id, pacienteId, fecha',
  archivosLocal: 'id, subido',
  documentos: '++id, pacienteId, fecha',
  medicamentos: '++id, nombre',
})

db.version(5).stores({
  odontogramas: '++id, pacienteId, [pacienteId+fecha]',
})

db.version(6).stores({
  gastos: '++id, fecha, categoria',
  materiales: '++id, nombre',
})

/**
 * Lista de ejemplo de medicamentos frecuentes. No se guarda hasta que el dentista
 * la edite en Ajustes (así no se duplica entre dispositivos). Verificar dosis.
 */
export const MEDICAMENTOS_EJEMPLO: Omit<Medicamento, 'id'>[] = [
  { nombre: 'Amoxicilina 500 mg', indicacion: '1 cápsula cada 8 horas por 7 días' },
  { nombre: 'Azitromicina 500 mg', indicacion: '1 tableta cada 24 horas por 3 días' },
  { nombre: 'Metronidazol 500 mg', indicacion: '1 tableta cada 8 horas por 7 días' },
  { nombre: 'Ibuprofeno 400 mg', indicacion: '1 tableta cada 8 horas por 3 días (después de comer)' },
  { nombre: 'Paracetamol 500 mg', indicacion: '1 tableta cada 8 horas si hay dolor' },
  { nombre: 'Ketorolaco 10 mg', indicacion: '1 tableta cada 8 horas por 3 días' },
  { nombre: 'Nimesulida 100 mg', indicacion: '1 tableta cada 12 horas por 3 días' },
  { nombre: 'Clorhexidina 0,12 % (enjuague)', indicacion: 'Enjuagar 15 ml por 30 segundos cada 12 horas por 7 días' },
]

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
  const cambios = { estado: 'atencion' as const, inicio: Date.now() }
  await db.turnos.update(siguiente.id!, cambios)
  return { ...siguiente, ...cambios }
}

export async function registrarLlegada(pacienteId?: number, motivo?: string) {
  const fecha = hoy()
  return db.transaction('rw', db.turnos, async () => {
    const ultimo = await db.turnos.where('[fecha+numero]').between([fecha, 0], [fecha, Infinity]).last()
    const numero = (ultimo?.numero ?? 0) + 1
    await db.turnos.add({ pacienteId, fecha, numero, motivo, estado: 'espera', llegada: Date.now() })
    return numero
  })
}

export async function exportarRespaldo() {
  const [pacientes, turnos, citas, consultas, pagos, tratamientos, config, archivos, documentos, medicamentos, odontogramas] = await Promise.all([
    db.pacientes.toArray(), db.turnos.toArray(), db.citas.toArray(), db.consultas.toArray(),
    db.pagos.toArray(), db.tratamientos.toArray(), db.config.toArray(),
    db.archivos.toArray(), db.documentos.toArray(), db.medicamentos.toArray(), db.odontogramas.toArray(),
  ])
  const [gastos, materiales] = await Promise.all([db.gastos.toArray(), db.materiales.toArray()])
  // Las imágenes completas no van en el respaldo: quedan en la nube (aquí solo sus datos y miniaturas)
  return { version: 2, exportado: new Date().toISOString(), pacientes, turnos, citas, consultas, pagos, tratamientos, config, archivos, documentos, medicamentos, odontogramas, gastos, materiales }
}

const TABLAS = ['pacientes', 'turnos', 'citas', 'consultas', 'pagos', 'tratamientos', 'config', 'archivos', 'documentos', 'medicamentos', 'odontogramas', 'gastos', 'materiales'] as const
const OPCIONALES = new Set<string>(['tratamientos', 'config', 'archivos', 'documentos', 'medicamentos', 'odontogramas', 'gastos', 'materiales'])

export async function importarRespaldo(data: Partial<Awaited<ReturnType<typeof exportarRespaldo>>> & { version?: number }) {
  if (!data || (data.version !== 1 && data.version !== 2) || !Array.isArray(data.pacientes)) throw new Error('Archivo de respaldo no válido')
  await db.transaction('rw', [...TABLAS.map((t) => db[t]), db.pendientes], async () => {
    for (const t of TABLAS) {
      const filas = data[t]
      if (!filas && OPCIONALES.has(t)) continue // respaldo antiguo: conserva lo actual
      // Lo que se borra aquí también debe borrarse en la nube
      const ids = (await db[t].toCollection().primaryKeys()) as (string | number)[]
      await db.pendientes.bulkPut(ids.map((id) => ({ tabla: t, id: String(id), ts: Date.now() })))
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

/**
 * Enlace de WhatsApp con la plantilla rellenada. Si el aviso va al familiar,
 * lo saluda a él y aclara al final de qué paciente se trata.
 */
export function avisoWhatsApp(p: Paciente | undefined, plantilla: string, vars: Record<string, string | number | undefined>) {
  if (!p) return null
  const alContacto = !!p.contactoTelefono && (p.avisarContacto || !p.telefono)
  if (!alContacto) return enlaceWhatsApp(p.telefono, rellenar(plantilla, vars))
  const contacto = p.contactoNombre?.trim().split(/\s+/)[0] ?? ''
  const texto = rellenar(plantilla, { ...vars, nombre: contacto }).replace(/^Hola\s+([,!👋 ])/u, 'Hola$1')
  return enlaceWhatsApp(p.contactoTelefono, `${texto}\n\n(Paciente: ${p.nombre})`)
}
