import { useLiveQuery } from 'dexie-react-hooks'
import { CONFIG_INICIAL, db } from './db'

export function useConfig() {
  return useLiveQuery(() => db.config.get('general'), []) ?? CONFIG_INICIAL
}
