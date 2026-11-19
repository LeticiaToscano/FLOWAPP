import { useEffect, useRef, useState } from 'react'

/**
 * Túnel em perspectiva (adaptado do PerspectiveTunnelHero, sem framer-motion e sem Tailwind):
 * cartões com fotos saem do fundo e vêm na direção de quem olha, espalhados em espiral (ângulo de ouro),
 * com um título no centro que cresce. O avanço vem do tempo (voo automático) e também da rolagem / do arrasto,
 * suavizado por uma mola; o ponteiro move a "câmera" de leve (paralaxe).
 */

export type FotoTunel = { src: string; titulo: string }

type Cartao = { item: FotoTunel; cos: number; sin: number; rx: number; ry: number; rotZ: number; i: number }

const montar = (fotos: FotoTunel[]): Cartao[] =>
  fotos.map((item, i) => {
    const ang = i * 137.5 * (Math.PI / 180)
    return { item, cos: Math.cos(ang), sin: Math.sin(ang), rx: 0.28 + (i % 3) * 0.08, ry: 0.26 + (i % 2) * 0.09, rotZ: (i % 2 === 0 ? 1 : -1) * (3 + (i % 5) * 2), i }
  })

const faixa = (v: number, a: number, b: number) => Math.min(1, Math.max(0, (v - a) / (b - a)))
/** Interpolação por trechos, como o useTransform do framer-motion. */
const mapa = (v: number, de: number[], para: number[]) => {
  if (v <= de[0]) return para[0]
  for (let k = 1; k < de.length; k++) if (v <= de[k]) return para[k - 1] + (para[k] - para[k - 1]) * ((v - de[k - 1]) / (de[k] - de[k - 1]))
  return para[para.length - 1]
}

export default function PerspectiveTunnelHero({
  fotos, rotulo, titulo, subtitulo, duracao = 7000, aoTerminar, final, luz,
}: {
  fotos: FotoTunel[]
  rotulo?: string
  titulo: React.ReactNode
  subtitulo?: string
  /** Tempo do voo automático, do começo ao fim (ms). */
  duracao?: number
  aoTerminar?: () => void
  /** O que aparece dentro do círculo quando todas as fotos já passaram (o túnel para ali). */
  final?: React.ReactNode
  /** Luz que nasce do anel do meio e cresce junto com ele no fim do voo (fica por trás do conteúdo final). */
  luz?: React.ReactNode
}) {
  const [noFim, setNoFim] = useState(false)
  const raiz = useRef<HTMLDivElement>(null)
  const cartoes = useRef<(HTMLDivElement | null)[]>([])
  const tituloRef = useRef<HTMLDivElement>(null)
  const dicaRef = useRef<HTMLDivElement>(null)
  const anel1 = useRef<HTMLDivElement>(null)
  const anel2 = useRef<HTMLDivElement>(null)
  const luzRef = useRef<HTMLDivElement>(null)
  const lista = useRef(montar(fotos)).current
  const [palco, setPalco] = useState(() => ({ w: window.innerWidth, h: window.innerHeight, cel: window.innerWidth < 768 }))
  const palcoRef = useRef(palco)
  palcoRef.current = palco
  const fim = useRef(aoTerminar)
  fim.current = aoTerminar

  useEffect(() => {
    const r = () => setPalco({ w: window.innerWidth, h: window.innerHeight, cel: window.innerWidth < 768 })
    window.addEventListener('resize', r)
    return () => window.removeEventListener('resize', r)
  }, [])

  useEffect(() => {
    const el = raiz.current!
    const reduzir = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    let alvo = 0, prog = 0, vel = 0 // progresso desejado, mostrado e a velocidade da mola
    let px = 0, py = 0, cx = 0, cy = 0 // ponteiro (bruto e suavizado)
    let terminou = false
    let mostrouFim = false
    let ultimo = performance.now()
    let raf = 0

    const roda = (e: WheelEvent) => { e.preventDefault(); if (mostrouFim) return; alvo = Math.min(1, Math.max(0, alvo + e.deltaY * 0.0008)) }
    let toqueY: number | null = null
    const tIni = (e: TouchEvent) => { toqueY = e.touches[0].clientY }
    const tMov = (e: TouchEvent) => {
      if (toqueY == null || mostrouFim) return
      const y = e.touches[0].clientY
      alvo = Math.min(1, Math.max(0, alvo + (toqueY - y) * 0.0025))
      toqueY = y
    }
    const ponteiro = (e: PointerEvent) => { px = (e.clientX / window.innerWidth - 0.5) * 2; py = (e.clientY / window.innerHeight - 0.5) * 2 }
    el.addEventListener('wheel', roda, { passive: false })
    el.addEventListener('touchstart', tIni, { passive: true })
    el.addEventListener('touchmove', tMov, { passive: true })
    if (!reduzir) window.addEventListener('pointermove', ponteiro, { passive: true })

    const quadro = (agora: number) => {
      const dt = Math.min(0.05, (agora - ultimo) / 1000)
      ultimo = agora
      // voo automático: o alvo anda sozinho; a rolagem/arrasto só adianta (ou volta um pouco)
      alvo = Math.min(1, alvo + (dt * 1000) / duracao)
      if (reduzir) prog = alvo
      else { // mola (rigidez 80, amortecimento 30)
        const a = 80 * (alvo - prog) - 30 * vel
        vel += a * dt
        prog += vel * dt
      }
      cx += (px - cx) * Math.min(1, dt * 4)
      cy += (py - cy) * Math.min(1, dt * 4)

      const { w, h, cel } = palcoRef.current
      const n = lista.length
      const span = 0.55
      lista.forEach((c, k) => {
        const node = cartoes.current[k]
        if (!node) return
        const ini = (c.i / n) * (1 - span)
        const lp = faixa(prog, ini, ini + span)
        const z = mapa(lp, [0, 1], [cel ? -1200 : -1700, cel ? 350 : 500])
        const op = mapa(lp, [0, 0.18, 0.82, 0.98], [0, 1, 1, 0])
        const forca = cel ? 20 : 45
        const ox = c.cos * (w * c.rx) - cx * forca
        const oy = c.sin * (h * c.ry) - cy * forca
        node.style.transform = `translate3d(calc(-50% + ${ox}px), calc(-50% + ${oy}px), ${z}px) rotateZ(${c.rotZ}deg)`
        node.style.opacity = String(op)
      })
      if (tituloRef.current) {
        tituloRef.current.style.transform = `scale(${mapa(prog, [0, 0.5, 1], [0.7, 1, 1.35])})`
        tituloRef.current.style.opacity = String(mapa(prog, [0, 0.12, 0.76, 0.92], [0.25, 1, 1, 0]))
      }
      if (dicaRef.current) dicaRef.current.style.opacity = String(mapa(prog, [0, 0.12], [1, 0]))

      // Fim do voo: o anel do meio cresce devagar até virar o círculo final, e a luz nasce dele, tudo no ritmo do voo
      const suave = (x: number) => x * x * (3 - 2 * x)
      const e = suave(faixa(prog, 0.7, 1))
      const menor = Math.min(w, h)
      const base1 = 0.48 * menor, fim1 = Math.min(0.86 * w, 0.74 * h, 440) * (w <= 480 ? 92 / 86 : 1)
      const base2 = 0.76 * menor, fim2 = Math.min(w, 0.92 * h, 560)
      if (anel1.current) {
        anel1.current.style.transform = `scale(${1 + (fim1 / base1 - 1) * e})`
        anel1.current.style.borderColor = `rgba(226,209,168,${0.12 + 0.1 * Math.sin(Math.PI * e)})`
      }
      if (anel2.current) anel2.current.style.transform = `scale(${1 + (fim2 / base2 - 1) * e})`
      if (luzRef.current) {
        luzRef.current.style.transform = `translate(-50%,-50%) scale(${base1 / fim1 + (1 - base1 / fim1) * e})`
        luzRef.current.style.opacity = String(suave(faixa(prog, 0.66, 0.94)))
      }
      if (!mostrouFim && prog > 0.93) { mostrouFim = true; alvo = 1; setNoFim(true) }
      if (!terminou && prog > 0.985) { terminou = true; alvo = 1; fim.current?.() }
      raf = requestAnimationFrame(quadro)
    }
    raf = requestAnimationFrame(quadro)
    return () => {
      cancelAnimationFrame(raf)
      el.removeEventListener('wheel', roda)
      el.removeEventListener('touchstart', tIni)
      el.removeEventListener('touchmove', tMov)
      window.removeEventListener('pointermove', ponteiro)
    }
  }, [duracao, lista])

  const larg = palco.cel ? Math.max(130, Math.min(180, palco.w * 0.38)) : Math.max(180, Math.min(270, palco.w * 0.18))

  return (
    <div ref={raiz} className={'tunel' + (noFim ? ' tunel-fim' : '')} style={{ perspective: palco.cel ? '900px' : '1200px' }}>
      <div className="tunel-grade" aria-hidden="true" />
      <div className="tunel-brilho" aria-hidden="true" />
      <div ref={anel1} className="tunel-anel" aria-hidden="true" />
      <div ref={anel2} className="tunel-anel tunel-anel-2" aria-hidden="true" />
      {luz && <div ref={luzRef} className="tunel-luz" aria-hidden="true" style={{ opacity: 0 }}>{luz}</div>}

      <div ref={tituloRef} className="tunel-titulo">
        {rotulo && <p className="tunel-rotulo">{rotulo}</p>}
        <h1>{titulo}</h1>
        {subtitulo && <p className="tunel-sub">{subtitulo}</p>}
      </div>

      <div ref={dicaRef} className="tunel-dica" aria-hidden="true">
        <span>Deslize para explorar</span>
        <i />
      </div>

      {final && <div className="tunel-final" aria-hidden={!noFim}>{noFim && final}</div>}

      <div className="tunel-plano">
        {lista.map((c, k) => (
          <div key={k} ref={(n) => { cartoes.current[k] = n }} className="tunel-cartao" style={{ width: larg, zIndex: c.i + 1, opacity: 0 }}>
            <div className="tunel-foto">
              <img src={c.item.src} alt={c.item.titulo} draggable={false} decoding="async" />
              <div className="tunel-legenda"><span>{c.item.titulo}</span></div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
