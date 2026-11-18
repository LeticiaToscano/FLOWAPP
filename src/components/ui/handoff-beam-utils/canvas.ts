import { useLayoutEffect, useState, type RefObject } from 'react'

/** Largura e altura do elemento em px CSS, atualizadas quando ele muda de tamanho. */
export function useElementSize(ref: RefObject<HTMLElement | null>) {
  const [size, setSize] = useState({ width: 0, height: 0 })
  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    const medir = () => {
      const r = el.getBoundingClientRect()
      setSize((s) => (s.width === r.width && s.height === r.height ? s : { width: r.width, height: r.height }))
    }
    medir()
    const ro = new ResizeObserver(medir)
    ro.observe(el)
    return () => ro.disconnect()
  }, [ref])
  return size
}
