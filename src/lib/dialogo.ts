/**
 * Diálogos y avisos propios de la app (reemplazan a confirm() y alert() del navegador).
 * - confirmar(): pregunta con botones claros; devuelve una promesa con la respuesta.
 * - avisar(): mensaje breve abajo de la pantalla, con un botón opcional (por ejemplo "Deshacer").
 * - borrarConDeshacer(): elimina y ofrece deshacer durante unos segundos.
 */
import { useSyncExternalStore } from 'react'
import { db } from './db'

export type Pregunta = {
  titulo: string
  texto?: string
  /** Texto del botón principal (por defecto "Aceptar"). */
  si?: string
  /** Texto del botón secundario (por defecto "Cancelar"). */
  no?: string
  /** Botón principal en rojo, para acciones que borran datos. */
  peligro?: boolean
}
export type Aviso = { id: number; texto: string; accion?: { texto: string; hacer: () => void | Promise<void> } }

type Estado = { pregunta: (Pregunta & { responder: (r: boolean) => void }) | null; avisos: Aviso[] }
let estado: Estado = { pregunta: null, avisos: [] }
const oyentes = new Set<() => void>()
const cambiar = (e: Partial<Estado>) => { estado = { ...estado, ...e }; oyentes.forEach((f) => f()) }
export const useDialogos = () => useSyncExternalStore((f) => (oyentes.add(f), () => oyentes.delete(f)), () => estado)

export function confirmar(p: Pregunta): Promise<boolean> {
  estado.pregunta?.responder(false)
  return new Promise((ok) => cambiar({ pregunta: { ...p, responder: (r) => { cambiar({ pregunta: null }); ok(r) } } }))
}

let siguienteId = 1
export function avisar(texto: string, accion?: Aviso['accion'], segundos = 6) {
  const id = siguienteId++
  cambiar({ avisos: [...estado.avisos.slice(-2), { id, texto, accion }] })
  setTimeout(() => cerrarAviso(id), segundos * 1000)
  return id
}
export const cerrarAviso = (id: number) => cambiar({ avisos: estado.avisos.filter((a) => a.id !== id) })

type TablaBorrable = 'consultas' | 'pagos' | 'documentos' | 'gastos' | 'materiales' | 'citas' | 'turnos' | 'tratamientos' | 'medicamentos'

/** Elimina un registro y muestra "… · Deshacer". Si se toca Deshacer, se vuelve a guardar tal cual estaba. */
export async function borrarConDeshacer(tabla: TablaBorrable, id: number, texto = 'Eliminado') {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const t = db[tabla] as any
  const copia = await t.get(id)
  if (!copia) return
  await t.delete(id)
  avisar(texto, { texto: 'Deshacer', hacer: async () => { await t.put(copia) } })
}
