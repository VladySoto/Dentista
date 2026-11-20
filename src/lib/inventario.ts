import { useLiveQuery } from 'dexie-react-hooks'
import { db, hoy, type Material } from './db'

export type AlertaMaterial = 'agotado' | 'poco' | 'vencido' | 'vence-pronto'

/** Avisos de un material: poco stock y vencimiento (30 días antes). */
export function alertas(m: Material): AlertaMaterial[] {
  const a: AlertaMaterial[] = []
  if (m.cantidad <= 0) a.push('agotado')
  else if (m.cantidad <= m.minimo) a.push('poco')
  if (m.vence) {
    const limite = new Date(); limite.setDate(limite.getDate() + 30)
    if (m.vence < hoy()) a.push('vencido')
    else if (m.vence <= hoy(limite)) a.push('vence-pronto')
  }
  return a
}

/** Cuántos materiales necesitan atención (para mostrar un número en el menú). */
export function useAlertasInventario() {
  return useLiveQuery(async () => (await db.materiales.toArray()).filter((m) => alertas(m).length > 0).length, []) ?? 0
}
