import { useEffect, useRef, useState } from 'react'
import type React from 'react'
import { FLOW_MARK_OURO } from '../lib/marca'

const KEY = 'flow.abertura'

/* Abertura (no estilo da entrada da Nexo, com um aviãozinho):
   1. fundo preto; um aviãozinho dourado entra voando numa curva e deixa um fio de luz champanhe;
   2. ele pousa no centro e vira o "f" dourado da logo;
   3. o "f" desliza para o lado e o nome FLOW aparece ao lado dele;
   4. a abertura some e os cartões das viagens entram. Uma vez por sessão. */

// Caminho do voo (num quadro de 400 × 400): entra pela esquerda rente, como numa pista, decola suave e chega ao centro
const VOO = 'M -60 238 C 40 238 110 238 150 226 C 176 218 186 200 200 200'
const T_VOO = 1350

/** Avisa a tela de viagens que pode abrir o leque. */
const liberarCartoes = () => {
  ;(window as any).__flowAbertura = false
  window.dispatchEvent(new Event('flow:abertura-fim'))
}

export default function Abertura() {
  const [mostrar, setMostrar] = useState(() => {
    let ver = true
    try { ver = sessionStorage.getItem(KEY) !== '1' } catch { /* navegação privada */ }
    ;(window as any).__flowAbertura = ver
    return ver
  })
  const raiz = useRef<HTMLDivElement>(null)
  const palco = useRef<SVGSVGElement>(null)
  const rastro = useRef<SVGPathElement>(null)
  const aviao = useRef<SVGGElement>(null)
  const voando = useRef<SVGGElement>(null)
  const marca = useRef<HTMLSpanElement>(null)
  const nome = useRef<HTMLSpanElement>(null)
  const encerrou = useRef(false)

  function sumir() {
    if (encerrou.current) return
    encerrou.current = true
    liberarCartoes()
    const el = raiz.current
    if (!el) { setMostrar(false); return }
    el.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 650, easing: 'ease-in-out', fill: 'forwards' })
      .finished.then(() => setMostrar(false), () => setMostrar(false))
  }

  useEffect(() => {
    if (!mostrar) return
    encerrou.current = false
    try { sessionStorage.setItem(KEY, '1') } catch { /* navegação privada */ }
    const timers: number[] = []
    const depois = (ms: number, f: () => void) => { timers.push(window.setTimeout(f, ms)) }
    const anim = (el: Element | null, k: Keyframe[], o: KeyframeAnimationOptions) => el?.animate(k, { fill: 'forwards', ...o })

    // Sem animação (preferência do sistema): só a logo, parada, e segue
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      if (palco.current) palco.current.style.display = 'none'
      if (marca.current) marca.current.style.opacity = '1'
      if (nome.current) { nome.current.style.maxWidth = '200px'; nome.current.style.opacity = '1' }
      depois(1200, sumir)
      return () => timers.forEach(clearTimeout)
    }

    // 1. O voo: a cada quadro, o avião vai para o ponto da curva e o fio de luz se desenha até ele (sempre juntos)
    const r = rastro.current!
    const comp = r.getTotalLength()
    r.style.strokeDasharray = `${comp}`
    r.style.strokeDashoffset = `${comp}`
    const voo = voando.current!
    const ease = (x: number) => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2)
    let raf = 0
    const inicio = performance.now()
    const quadro = (agora: number) => {
      const t = Math.min(1, (agora - inicio) / T_VOO)
      const d = ease(t) * comp
      const pt = r.getPointAtLength(d)
      const fr = r.getPointAtLength(Math.min(comp, d + 1))
      const atras = r.getPointAtLength(Math.max(0, d - 1))
      const ang = (Math.atan2(fr.y - atras.y, fr.x - atras.x) * 180) / Math.PI
      voo.setAttribute('transform', `translate(${pt.x} ${pt.y}) rotate(${ang})`)
      r.style.strokeDashoffset = `${comp - d}`
      if (t < 1) raf = requestAnimationFrame(quadro)
    }
    raf = requestAnimationFrame(quadro)
    anim(aviao.current, [{ opacity: 0 }, { opacity: 1 }], { duration: 250, easing: 'ease-out' })

    // 2. Pousa: o fio some, o avião vira o "f" dourado
    depois(T_VOO - 120, () => {
      anim(r, [{ opacity: 1 }, { opacity: 0 }], { duration: 600, easing: 'ease-out' })
      anim(aviao.current, [{ opacity: 1 }, { opacity: 0 }], { duration: 320, easing: 'ease-in' })
      anim(marca.current, [{ opacity: 0, transform: 'scale(.92)', filter: 'blur(4px)' }, { opacity: 1, transform: 'scale(1)', filter: 'blur(0)' }], { duration: 700, easing: 'cubic-bezier(.22,1,.36,1)' })
    })

    // 3. O "f" desliza para o lado e o nome FLOW aparece
    depois(T_VOO + 600, () => {
      anim(nome.current, [{ maxWidth: '0px', clipPath: 'inset(0 100% 0 0)' }, { maxWidth: '200px', clipPath: 'inset(0 0 0 0)' }], { duration: 1000, easing: 'cubic-bezier(.65,0,.35,1)' })
      anim(nome.current, [{ opacity: 0, letterSpacing: '.9em' }, { opacity: 1, letterSpacing: '.5em' }], { duration: 1300, easing: 'cubic-bezier(.22,1,.36,1)' })
    })

    // 4. Some e libera os cartões
    depois(T_VOO + 2500, sumir)
    return () => { timers.forEach(clearTimeout); cancelAnimationFrame(raf) }
  }, [mostrar])

  if (!mostrar) return null
  return (
    <div ref={raiz} className="abertura" aria-hidden="true">
      <svg ref={palco} className="abertura-palco" viewBox="0 0 400 400">
        <defs>
          <linearGradient id="abertura-ouro" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#FBF3DF" />
            <stop offset=".45" stopColor="#E2D1A8" />
            <stop offset=".75" stopColor="#B89A5E" />
            <stop offset="1" stopColor="#F1E3BC" />
          </linearGradient>
          <linearGradient id="abertura-fio" gradientUnits="userSpaceOnUse" x1="-60" y1="0" x2="200" y2="0">
            <stop offset="0" stopColor="#E2D1A8" stopOpacity="0" />
            <stop offset="1" stopColor="#E2D1A8" stopOpacity=".7" />
          </linearGradient>
        </defs>
        <path ref={rastro} d={VOO} fill="none" stroke="url(#abertura-fio)" strokeWidth=".7" strokeLinecap="round" />
        <g ref={voando} transform="translate(-20 310)">
          <g ref={aviao} style={{ opacity: 0, transformBox: 'fill-box', transformOrigin: 'center', scale: '.72' } as React.CSSProperties}>
          {/* aviãozinho de cima, com o nariz para a direita (o sentido do voo) */}
          <path
            fill="url(#abertura-ouro)"
            d="M11 0c0-1.2-1.3-1.9-3-1.9H3.2L-3.6-10.6h-2.6l3.4 8.7h-5.6l-2.3-3h-2l1.2 4.9-1.2 4.9h2l2.3-3h5.6l-3.4 8.7h2.6L3.2 1.9H8C9.7 1.9 11 1.2 11 0Z"
          />
          </g>
        </g>
      </svg>
      <div className="abertura-logo">
        <span ref={marca} className="abertura-marca" dangerouslySetInnerHTML={{ __html: FLOW_MARK_OURO }} />
        <span ref={nome} className="abertura-nome">FLOW</span>
      </div>
      <button type="button" className="abertura-pular" onClick={sumir} aria-hidden="false">Pular</button>
    </div>
  )
}
