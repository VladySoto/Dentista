/**
 * Bloqueo de la app en este dispositivo (cada celular o PC tiene su propio PIN).
 * El PIN no se guarda: solo un "hash" PBKDF2 con sal, imposible de revertir.
 * La huella usa WebAuthn (el lector de huellas o rostro del propio dispositivo).
 */
import { db } from './db'

type PinGuardado = { sal: string; hash: string; iter: number; largo: number }

const b64 = (b: ArrayBuffer | Uint8Array) => btoa(String.fromCharCode(...new Uint8Array(b instanceof Uint8Array ? b : new Uint8Array(b))))
const desdeB64 = (s: string) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0))

async function derivar(pin: string, sal: Uint8Array, iter: number) {
  const clave = await crypto.subtle.importKey('raw', new TextEncoder().encode(pin), 'PBKDF2', false, ['deriveBits'])
  return b64(await crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt: sal, iterations: iter }, clave, 256))
}

const leer = async <T>(clave: string): Promise<T | undefined> => {
  const v = (await db.meta.get(clave))?.valor
  return v ? (JSON.parse(v) as T) : undefined
}
const escribir = (clave: string, v: unknown) => db.meta.put({ clave, valor: JSON.stringify(v) })

export async function estadoBloqueo() {
  const [pin, huella, minutos] = await Promise.all([leer<PinGuardado>('pin'), leer<string>('huella'), leer<number>('bloqueoMin')])
  return { tienePin: !!pin, largo: pin?.largo ?? 4, tieneHuella: !!huella, minutos: minutos ?? 5 }
}

export async function crearPin(pin: string) {
  const sal = crypto.getRandomValues(new Uint8Array(16))
  const iter = 150_000
  await escribir('pin', { sal: b64(sal), hash: await derivar(pin, sal, iter), iter, largo: pin.length } satisfies PinGuardado)
  avisarCambio()
}

export async function verificarPin(pin: string) {
  const g = await leer<PinGuardado>('pin')
  if (!g) return true
  return (await derivar(pin, desdeB64(g.sal), g.iter)) === g.hash
}

export async function quitarBloqueo() {
  await db.meta.bulkDelete(['pin', 'huella'])
  avisarCambio()
}

export const fijarMinutos = async (m: number) => { await escribir('bloqueoMin', m); avisarCambio() }

/** Avisa a la pantalla de bloqueo que cambió la configuración. */
export const avisarCambio = () => window.dispatchEvent(new Event('bloqueo-cambio'))

export async function huellaDisponible() {
  try {
    return !!window.PublicKeyCredential && (await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable())
  } catch {
    return false
  }
}

export async function activarHuella() {
  const cred = (await navigator.credentials.create({
    publicKey: {
      challenge: crypto.getRandomValues(new Uint8Array(32)),
      rp: { name: 'Consultorio Dental' },
      user: { id: crypto.getRandomValues(new Uint8Array(16)), name: 'dentista', displayName: 'Dentista' },
      pubKeyCredParams: [{ type: 'public-key', alg: -7 }, { type: 'public-key', alg: -257 }],
      authenticatorSelection: { authenticatorAttachment: 'platform', userVerification: 'required', residentKey: 'discouraged' },
      timeout: 60_000,
    },
  })) as PublicKeyCredential | null
  if (!cred) throw new Error('No se pudo registrar la huella.')
  await escribir('huella', b64(cred.rawId))
  avisarCambio()
}

export const quitarHuella = async () => { await db.meta.delete('huella'); avisarCambio() }

/** Pide la huella (o rostro) del dispositivo. Devuelve true si la persona se identificó. */
export async function verificarHuella() {
  const id = await leer<string>('huella')
  if (!id) return false
  try {
    const r = await navigator.credentials.get({
      publicKey: {
        challenge: crypto.getRandomValues(new Uint8Array(32)),
        allowCredentials: [{ type: 'public-key', id: desdeB64(id) }],
        userVerification: 'required',
        timeout: 60_000,
      },
    })
    return !!r
  } catch {
    return false
  }
}

/** Borra todos los datos de este dispositivo (cuando se olvidó el PIN y no hay cuenta en la nube). */
export async function borrarDispositivo() {
  db.close()
  await new Promise((ok) => { const r = indexedDB.deleteDatabase('consultorio-dental'); r.onsuccess = r.onerror = r.onblocked = ok })
  try { localStorage.clear() } catch { /* nada */ }
  location.href = '/'
}
