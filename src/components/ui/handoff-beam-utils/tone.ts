import { useSyncExternalStore } from 'react'
import type { BjorkTone } from './palette'

const consulta = () => (typeof window !== 'undefined' ? window.matchMedia('(prefers-color-scheme: dark)') : null)

/** O tom pedido por prop; sem ele, segue o tema do sistema. */
export function useBjorkTone(tone?: BjorkTone): BjorkTone {
  const escuro = useSyncExternalStore(
    (cb) => { const m = consulta(); m?.addEventListener('change', cb); return () => m?.removeEventListener('change', cb) },
    () => consulta()?.matches ?? true,
    () => true,
  )
  return tone ?? (escuro ? 'dark' : 'light')
}
