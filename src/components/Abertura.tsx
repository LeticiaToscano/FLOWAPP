import { useEffect, useRef, useState } from 'react'

const KEY = 'flow.abertura'
/* Abertura: o "f" dourado da logo, sobre fundo preto, vira um jato e voa para o fundo da tela.
   Perto do fim do vídeo os cartões das viagens são liberados. */
const VIDEO_VOO: string = (import.meta.env.VITE_VIDEO_VOO as string | undefined) || 'https://d2ol7oe51mr4n9.cloudfront.net/user_3Hrjdnb6LBzJK6SYxcNE6VQdZEf/e4c2b2c6-3fa6-491c-be7a-9013bee5cbfd.mp4'
const LIBERAR_ANTES_DO_FIM = 0.9 // s antes do fim do vídeo em que os cartões começam a entrar

/** Avisa a tela de viagens que pode abrir o leque. */
const liberarCartoes = () => {
  ;(window as any).__flowAbertura = false
  window.dispatchEvent(new Event('flow:abertura-fim'))
}

/** Abertura do app (uma vez por sessão). */
export default function Abertura() {
  const [mostrar, setMostrar] = useState(() => {
    let ver = true
    try { ver = sessionStorage.getItem(KEY) !== '1' } catch { /* navegação privada */ }
    ;(window as any).__flowAbertura = ver
    return ver
  })
  const raiz = useRef<HTMLDivElement>(null)
  const video = useRef<HTMLVideoElement>(null)
  const cancelado = useRef(false)

  function sumir() {
    const el = raiz.current
    if (!el) { setMostrar(false); return }
    el.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 600, easing: 'ease-in-out', fill: 'forwards' })
      .finished.then(() => setMostrar(false), () => setMostrar(false))
  }

  function fechar() {
    cancelado.current = true
    video.current?.pause()
    liberarCartoes()
    sumir()
  }

  useEffect(() => {
    if (!mostrar) return
    cancelado.current = false
    let vivo = true // cada montagem tem a própria sequência (o React em desenvolvimento monta duas vezes)
    const parou = () => !vivo || cancelado.current
    try { sessionStorage.setItem(KEY, '1') } catch { /* navegação privada */ }
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      const t = setTimeout(fechar, 1200)
      return () => { vivo = false; clearTimeout(t) }
    }

    const v = video.current!
    let liberou = false
    const aoTempo = () => {
      if (!liberou && v.duration && v.currentTime >= v.duration - LIBERAR_ANTES_DO_FIM) {
        liberou = true
        liberarCartoes()
        sumir()
      }
    }
    v.addEventListener('timeupdate', aoTempo)


    ;(async () => {
      // Abre direto no vídeo: o "f" dourado sobre o preto vira o jato
      v.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 500, easing: 'ease-out', fill: 'forwards' })
      try {
        await v.play()
      } catch {
        // Se o aparelho não deixar tocar o vídeo (economia de bateria), segue direto para os cartões
        if (!parou()) { liberarCartoes(); sumir() }
      }
    })()

    return () => { vivo = false; v.removeEventListener('timeupdate', aoTempo) }
  }, [mostrar])

  if (!mostrar) return null
  return (
    <div ref={raiz} className="abertura">
      <video
        ref={video}
        className="abertura-video"
        src={VIDEO_VOO}
        crossOrigin="anonymous"
        muted
        playsInline
        preload="auto"
        aria-hidden="true"
        tabIndex={-1}
      />
      <button type="button" className="abertura-pular" onClick={fechar}>Pular</button>
    </div>
  )
}
