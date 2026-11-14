/**
 * Sincronización con la nube (Supabase).
 *
 * - Todo se guarda primero en el dispositivo (funciona sin internet).
 * - Cada cambio local queda anotado en `pendientes` y se sube en cuanto hay conexión.
 * - Los cambios de otros dispositivos se bajan al abrir la app, cada minuto y en tiempo real.
 * - Si un registro cambió aquí y aún no se subió, gana la versión local.
 */
import type { RealtimeChannel, Session } from '@supabase/supabase-js'
import Dexie, { type Table, type Transaction } from 'dexie'
import { useSyncExternalStore } from 'react'
import { db, type Pendiente } from './db'
import { supabase } from './supabase'

const TABLAS = ['pacientes', 'turnos', 'citas', 'consultas', 'pagos', 'tratamientos', 'config', 'archivos', 'documentos', 'medicamentos'] as const
type NombreTabla = (typeof TABLAS)[number]
const tabla = (t: NombreTabla) => db[t] as unknown as Table<Record<string, unknown>, number | string>
const clave = (t: string, id: string) => (t === 'config' ? id : Number(id))

// ---------------------------------------------------------------- estado para la interfaz

export type EstadoSync = {
  sesion: Session | null
  estado: 'apagado' | 'sincronizando' | 'ok' | 'sin-conexion' | 'error'
  ultimo?: number
  pendientes: number
  error?: string
}
let estado: EstadoSync = { sesion: null, estado: 'apagado', pendientes: 0 }
const oyentes = new Set<() => void>()
function actualizar(cambios: Partial<EstadoSync>) {
  estado = { ...estado, ...cambios }
  oyentes.forEach((f) => f())
}
export function useSync() {
  return useSyncExternalStore((f) => (oyentes.add(f), () => oyentes.delete(f)), () => estado)
}

// ---------------------------------------------------------------- registro de cambios locales

/**
 * Ids únicos entre dispositivos (milisegundos + azar), siguen siendo números.
 * Dentro del mismo dispositivo siempre crecen, así no se repiten aunque se creen
 * muchos registros en el mismo milisegundo.
 */
let ultimoId = 0
function nuevoId() {
  ultimoId = Math.max(Date.now() * 1000 + Math.floor(Math.random() * 1000), ultimoId + 1)
  return ultimoId
}

const esRemota = (tx?: Transaction | null) => !!(tx as unknown as { __remoto?: boolean } | null)?.__remoto

// Los hooks corren dentro de la transacción de Dexie, donde no se puede escribir en otra
// tabla; por eso los cambios se juntan aquí y se anotan justo después.
const porAnotar = new Map<string, Pendiente>()
let anotando: ReturnType<typeof setTimeout> | undefined

function anotar(t: string, id: unknown) {
  porAnotar.set(`${t}/${id}`, { tabla: t, id: String(id), ts: Date.now() })
  anotando ??= setTimeout(async () => {
    anotando = undefined
    const lote = [...porAnotar.values()]
    porAnotar.clear()
    await db.pendientes.bulkPut(lote)
    contarPendientes()
    programarSubida()
  })
}

for (const t of TABLAS) {
  tabla(t).hook('creating', function (primKey, _obj, tx) {
    const key = primKey === undefined && t !== 'config' ? nuevoId() : primKey
    if (!esRemota(tx)) this.onsuccess = (k) => anotar(t, k)
    return key === primKey ? undefined : key
  })
  tabla(t).hook('updating', function (_mods, primKey, _obj, tx) {
    if (!esRemota(tx)) this.onsuccess = () => anotar(t, primKey)
  })
  tabla(t).hook('deleting', function (primKey, _obj, tx) {
    if (!esRemota(tx)) this.onsuccess = () => anotar(t, primKey)
  })
}

/** Ejecuta cambios que vienen de la nube sin volver a anotarlos como pendientes. */
async function aplicarRemoto(fn: () => Promise<void>) {
  await db.transaction('rw', [...TABLAS.map(tabla), db.pendientes, db.archivosLocal], async () => {
    (Dexie.currentTransaction as unknown as { __remoto: boolean }).__remoto = true
    await fn()
  })
}

async function contarPendientes() {
  actualizar({ pendientes: (await db.pendientes.count()) + (await db.archivosLocal.where('subido').equals(0).count()) })
}

const meta = {
  get: async (k: string) => (await db.meta.get(k))?.valor,
  set: (k: string, v: string) => db.meta.put({ clave: k, valor: v }),
}

// ---------------------------------------------------------------- subir y bajar

async function subir() {
  const uid = estado.sesion?.user.id
  if (!uid) return
  const lista = await db.pendientes.limit(500).toArray()
  if (!lista.length) return
  const filas = await Promise.all(lista.map(async (p) => {
    const data = TABLAS.includes(p.tabla as NombreTabla) ? await tabla(p.tabla as NombreTabla).get(clave(p.tabla, p.id)) : undefined
    return { user_id: uid, tabla: p.tabla, id: p.id, data: data ?? null, borrado: !data }
  }))
  const { error } = await supabase.from('registros').upsert(filas, { onConflict: 'user_id,tabla,id' })
  if (error) throw error
  // Solo se quitan los que no volvieron a cambiar mientras se subían
  await db.transaction('rw', db.pendientes, async () => {
    for (const p of lista) {
      const actual = await db.pendientes.get({ tabla: p.tabla, id: p.id })
      if (actual?.ts === p.ts) await db.pendientes.delete([p.tabla, p.id] as unknown as string)
    }
  })
  if (lista.length === 500) await subir()
}

async function bajar() {
  if (!estado.sesion) return
  for (;;) {
    const cursor = (await meta.get('cursor')) ?? '1970-01-01T00:00:00Z'
    const { data, error } = await supabase.from('registros')
      .select('tabla,id,data,borrado,actualizado')
      .gt('actualizado', cursor).order('actualizado', { ascending: true }).limit(1000)
    if (error) throw error
    if (!data?.length) return
    await aplicarRemoto(async () => {
      for (const r of data) {
        if (!TABLAS.includes(r.tabla)) continue
        if (porAnotar.has(`${r.tabla}/${r.id}`) || (await db.pendientes.get({ tabla: r.tabla, id: r.id }))) continue // gana lo local
        const t = tabla(r.tabla as NombreTabla)
        if (r.borrado || !r.data) {
          await t.delete(clave(r.tabla, r.id))
          if (r.tabla === 'archivos') await db.archivosLocal.delete(Number(r.id))
        } else await t.put(r.data)
      }
    })
    await meta.set('cursor', data[data.length - 1].actualizado)
    if (data.length < 1000) return
  }
}

// ---------------------------------------------------------------- imágenes (Supabase Storage)

export const BUCKET = 'archivos'
export const rutaImagen = (uid: string, id: number) => `${uid}/${id}.jpg`
export const usuarioActual = () => estado.sesion?.user.id

/** Sube las fotos tomadas en este dispositivo que aún no están en la nube. */
async function subirImagenes() {
  const uid = estado.sesion?.user.id
  if (!uid) return
  for (const a of await db.archivosLocal.where('subido').equals(0).toArray()) {
    if (!(await db.archivos.get(a.id))) { await db.archivosLocal.delete(a.id); continue } // se borró antes de subir
    const { error } = await supabase.storage.from(BUCKET).upload(rutaImagen(uid, a.id), a.blob, { contentType: 'image/jpeg', upsert: true })
    if (error) throw new Error(`No se pudo subir una foto: ${error.message}`)
    await db.archivosLocal.update(a.id, { subido: 1 })
  }
}

let enCurso: Promise<void> | null = null
let otraVez = false

/** Sube lo pendiente y baja lo nuevo. Si ya hay una sincronización en curso, repite al terminar. */
export function sincronizar(): Promise<void> {
  if (!estado.sesion) return Promise.resolve()
  if (enCurso) { otraVez = true; return enCurso }
  enCurso = (async () => {
    do {
      otraVez = false
      if (!navigator.onLine) { actualizar({ estado: 'sin-conexion' }); break }
      actualizar({ estado: 'sincronizando', error: undefined })
      try {
        await subir()
        await bajar()
        await subirImagenes()
        actualizar({ estado: 'ok', ultimo: Date.now() })
      } catch (e) {
        const msg = (e as Error).message ?? String(e)
        actualizar({ estado: navigator.onLine ? 'error' : 'sin-conexion', error: msg })
        break
      }
    } while (otraVez)
    await contarPendientes()
  })().finally(() => { enCurso = null })
  return enCurso
}

let temporizador: ReturnType<typeof setTimeout> | undefined
function programarSubida() {
  clearTimeout(temporizador)
  temporizador = setTimeout(sincronizar, 800)
}

// ---------------------------------------------------------------- primera conexión del dispositivo

/**
 * Prepara este dispositivo la primera vez que entra con una cuenta.
 * - Nube vacía: sube todo lo que haya aquí.
 * - Nube con datos: si aquí también hay pacientes, `combinar()` decide si se suben
 *   (true) o se descartan (false). Los tratamientos y ajustes siempre se toman de la nube.
 */
async function prepararDispositivo(uid: string, combinar: () => Promise<boolean>) {
  if ((await meta.get('usuario')) === uid) return
  const { count, error } = await supabase.from('registros').select('id', { count: 'exact', head: true })
  if (error) throw error

  if (!count) {
    const ahora = Date.now()
    for (const t of TABLAS) {
      const ids = (await tabla(t).toCollection().primaryKeys()) as (string | number)[]
      await db.pendientes.bulkPut(ids.map((id) => ({ tabla: t, id: String(id), ts: ahora })))
    }
  } else {
    const hayDatos = (await db.pacientes.count()) + (await db.consultas.count()) + (await db.citas.count()) > 0
    const subirLocal = hayDatos && (await combinar())
    await aplicarRemoto(async () => {
      if (subirLocal) {
        await db.tratamientos.clear()
        await db.config.clear()
        await db.medicamentos.clear()
        await db.pendientes.where('tabla').anyOf('tratamientos', 'config', 'medicamentos').delete()
        const ahora = Date.now()
        for (const t of ['pacientes', 'turnos', 'citas', 'consultas', 'pagos', 'archivos', 'documentos'] as const) {
          const ids = (await tabla(t).toCollection().primaryKeys()) as (string | number)[]
          await db.pendientes.bulkPut(ids.map((id) => ({ tabla: t, id: String(id), ts: ahora })))
        }
      } else {
        for (const t of TABLAS) await tabla(t).clear()
        await db.pendientes.clear()
        await db.archivosLocal.clear()
      }
    })
  }
  await db.meta.delete('cursor')
  await meta.set('usuario', uid)
}

// ---------------------------------------------------------------- sesión

let canal: RealtimeChannel | null = null
let preguntaCombinar: () => Promise<boolean> = async () => window.confirm(
  'Este dispositivo tiene pacientes guardados que no están en la nube.\n\n' +
  'Aceptar: subirlos y combinarlos con los de la nube.\nCancelar: borrarlos de aquí y usar solo los de la nube.',
)

async function alIniciarSesion(sesion: Session) {
  actualizar({ sesion, estado: 'sincronizando' })
  try {
    await prepararDispositivo(sesion.user.id, preguntaCombinar)
  } catch (e) {
    actualizar({ estado: 'error', error: (e as Error).message })
    return
  }
  canal?.unsubscribe()
  canal = supabase.channel('registros')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'registros', filter: `user_id=eq.${sesion.user.id}` }, () => sincronizar())
    .subscribe()
  await sincronizar()
}

export async function iniciarSesion(email: string, password: string) {
  const { error } = await supabase.auth.signInWithPassword({ email, password })
  if (error) throw new Error(traducir(error.message))
}

export async function crearCuenta(email: string, password: string) {
  const { data, error } = await supabase.auth.signUp({ email, password, options: { emailRedirectTo: location.origin } })
  if (error) throw new Error(traducir(error.message))
  return { requiereConfirmar: !data.session }
}

export async function cerrarSesion() {
  canal?.unsubscribe(); canal = null
  await supabase.auth.signOut()
}

function traducir(msg: string) {
  if (/invalid login/i.test(msg)) return 'Correo o contraseña incorrectos.'
  if (/email not confirmed/i.test(msg)) return 'Falta confirmar el correo: revisa tu bandeja de entrada.'
  if (/already registered/i.test(msg)) return 'Ese correo ya tiene cuenta. Usa “Iniciar sesión”.'
  if (/password should be at least/i.test(msg)) return 'La contraseña debe tener al menos 6 caracteres.'
  if (/signups not allowed/i.test(msg)) return 'No se permiten cuentas nuevas en este consultorio.'
  if (/fetch/i.test(msg)) return 'Sin conexión a internet.'
  return msg
}

let iniciado = false
export function iniciarSincronizacion(opciones?: { preguntarCombinar?: () => Promise<boolean> }) {
  if (iniciado) return
  iniciado = true
  if (opciones?.preguntarCombinar) preguntaCombinar = opciones.preguntarCombinar
  contarPendientes()
  supabase.auth.onAuthStateChange((evento, sesion) => {
    if (evento === 'SIGNED_OUT' || !sesion) { actualizar({ sesion: null, estado: 'apagado' }); return }
    if (evento === 'INITIAL_SESSION' || evento === 'SIGNED_IN') {
      if (estado.sesion?.user.id !== sesion.user.id) setTimeout(() => alIniciarSesion(sesion))
    } else actualizar({ sesion })
  })
  window.addEventListener('online', () => sincronizar())
  document.addEventListener('visibilitychange', () => document.visibilityState === 'visible' && sincronizar())
  setInterval(() => document.visibilityState === 'visible' && sincronizar(), 60_000)
}
