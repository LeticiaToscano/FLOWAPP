import { useEffect, useRef, type RefObject } from 'react'

/**
 * Roda frame(dt em segundos) a cada quadro enquanto o elemento está visível na tela e a aba está aberta.
 * fpsCap > 0 limita os quadros por segundo (usado com "reduzir movimento").
 */
export function useVisibleLoop(ref: RefObject<HTMLElement | null>, frame: (dt: number) => void, opts: { fpsCap?: number } = {}) {
  const atual = useRef(frame)
  atual.current = frame
  const cap = opts.fpsCap ?? 0

  useEffect(() => {
    const el = ref.current
    if (!el) return
    let visivel = true
    let id = 0
    let antes = 0
    const passo = (agora: number) => {
      id = requestAnimationFrame(passo)
      if (!visivel || document.hidden) { antes = agora; return }
      const dtMs = antes ? agora - antes : 16
      if (cap > 0 && dtMs < 1000 / cap) return
      antes = agora
      atual.current(Math.min(dtMs, 100) / 1000)
    }
    const io = new IntersectionObserver(([e]) => { visivel = e.isIntersecting })
    io.observe(el)
    id = requestAnimationFrame(passo)
    return () => { cancelAnimationFrame(id); io.disconnect() }
  }, [ref, cap])
}
