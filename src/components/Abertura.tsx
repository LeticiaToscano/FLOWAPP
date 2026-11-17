import { useEffect, useRef, useState } from 'react'
import { Lente } from './lente/lente'
import { LOGO_OURO } from '../lib/marca'

const KEY = 'flow.abertura'
/* 1) A Lente faz a revelação (~3,8 s) e o "f" fica parado no meio.
   2) A tela se dissolve no vídeo do Higgsfield: o "f" dourado da logo, sobre o verde, vira um jato de ouro
      que se afasta para o fundo da tela até sumir.
   3) Quando o avião está sumindo, o fundo se abre e os cartões entram. */
const REVELACAO = 4100 // ms até a marca ficar parada no meio
const VIDEO_VOO: string = (import.meta.env.VITE_VIDEO_VOO as string | undefined) || 'https://d2ol7oe51mr4n9.cloudfront.net/user_3Hrjdnb6LBzJK6SYxcNE6VQdZEf/ec2166fd-7b9d-4f32-bbf0-9a649352249f.mp4'
const LIBERAR_ANTES_DO_FIM = 0.9 // s antes do fim do vídeo em que os cartões começam a entrar

/** Avisa a tela de viagens que pode abrir o leque. */
const liberarCartoes = () => {
  ;(window as any).__flowAbertura = false
  window.dispatchEvent(new Event('flow:abertura-fim'))
}

/** Abertura do app: efeito Lente igual à referência (vidro claro, fundo areia), com o símbolo do Flow, e o "f"
 *  que vira avião e voa para o fundo da tela. Uma vez por sessão; "Pular" entra direto. */
export default function Abertura() {
  const [mostrar, setMostrar] = useState(() => {
    let ver = true
    try { ver = sessionStorage.getItem(KEY) !== '1' } catch { /* navegação privada */ }
    ;(window as any).__flowAbertura = ver
    return ver
  })
  const raiz = useRef<HTMLDivElement>(null)
  const palco = useRef<HTMLDivElement>(null)
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
    const espera = (ms: number) => new Promise((r) => setTimeout(r, ms))
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
      await espera(REVELACAO)
      if (parou()) return
      // A Lente se dissolve no primeiro quadro do vídeo (o "f" dourado sobre o verde)
      palco.current?.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 700, easing: 'ease-in-out', fill: 'forwards' })
      await v.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 700, easing: 'ease-in-out', fill: 'forwards' }).finished.catch(() => {})
      if (parou()) return
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
      <div ref={palco} style={{ position: 'absolute', inset: 0 }}>
        <Lente logo={LOGO_OURO} originalColors look="dark" background="#012c1b" plateColor="#0a3a27" logoColor="#e2d1a8" label="Flow" loop={false} style={{ position: 'absolute', inset: 0 }} />
      </div>
      <video
        ref={video}
        className="abertura-video"
        src={VIDEO_VOO}
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
