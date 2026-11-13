import { createClient } from '@supabase/supabase-js'

// Datos públicos del proyecto (la llave "publishable" está hecha para ir dentro de la app).
// La seguridad la dan las reglas de la base de datos: cada usuario solo ve sus registros.
const URL = import.meta.env.VITE_SUPABASE_URL ?? 'https://yexxophryckbcwjffklo.supabase.co'
const LLAVE = import.meta.env.VITE_SUPABASE_KEY ?? 'sb_publishable_xZZfv2FizW4-scN4-Bqx6g_xdkXrJ_M'

export const supabase = createClient(URL, LLAVE, {
  auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
})
