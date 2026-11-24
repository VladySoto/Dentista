import { useLiveQuery } from 'dexie-react-hooks'
import { useMemo } from 'react'
import { CONFIG_INICIAL, db } from './db'

/** Configuración del consultorio, completada con los valores iniciales de lo que falte. */
export function useConfig() {
  const c = useLiveQuery(() => db.config.get('general'), [])
  return useMemo(() => (c ? { ...CONFIG_INICIAL, ...c, plantillas: { ...CONFIG_INICIAL.plantillas, ...c.plantillas } } : CONFIG_INICIAL), [c])
}
