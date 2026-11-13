import { useEffect, useState } from 'react'

/** Re-renderiza cada `ms` para mostrar tiempos de espera en vivo. */
export function useAhora(ms = 30000) {
  const [ahora, setAhora] = useState(Date.now())
  useEffect(() => {
    const t = setInterval(() => setAhora(Date.now()), ms)
    return () => clearInterval(t)
  }, [ms])
  return ahora
}
