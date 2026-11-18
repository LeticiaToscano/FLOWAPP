import { useSyncExternalStore } from 'react'

const consulta = () => (typeof window !== 'undefined' ? window.matchMedia('(prefers-reduced-motion: reduce)') : null)

/** Igual ao useReducedMotion do framer-motion: true quando o sistema pede menos movimento. */
export function useReducedMotion(): boolean {
  return useSyncExternalStore(
    (cb) => { const m = consulta(); m?.addEventListener('change', cb); return () => m?.removeEventListener('change', cb) },
    () => consulta()?.matches ?? false,
    () => false,
  )
}
