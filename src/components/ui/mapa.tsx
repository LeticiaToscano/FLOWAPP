import { useEffect, useMemo, useRef, useState } from 'react'

/**
 * Mapa escuro feito à mão (sem biblioteca): blocos de imagem do mapa (256 px) montados pela posição,
 * arrastar com o dedo/mouse, zoom com pinça, roda ou botões, e alfinetes por latitude/longitude.
 * Os blocos vêm do OpenStreetMap (crédito obrigatório no canto), nas cores originais.
 */

export type Alfinete = { lat: number; lng: number; rotulo?: string; icone?: string; cor?: string; onClick?: () => void }
export type Ponto = { lat: number; lng: number }

const TAM = 256
// Stadia Maps "OSM Bright" em alta resolução (@2x), liberado pelo domínio do site, sem chave no código.
// Se a Stadia recusar (domínio ainda não cadastrado), cai para o OpenStreetMap padrão.
type Fonte = 'stadia' | 'osm'
const bloco = (f: Fonte, z: number, x: number, y: number) => f === 'stadia'
  ? `https://tiles.stadiamaps.com/tiles/osm_bright/${z}/${x}/${y}@2x.png`
  : `https://tile.openstreetmap.org/${z}/${x}/${y}.png`
let fonteDaSessao: Fonte = 'stadia'

// Projeção de Mercator (a mesma dos mapas da web), em pixels do mundo no zoom z
const paraPx = (p: Ponto, z: number) => {
  const s = TAM * 2 ** z
  const sen = Math.sin((Math.max(-85, Math.min(85, p.lat)) * Math.PI) / 180)
  return { x: ((p.lng + 180) / 360) * s, y: (0.5 - Math.log((1 + sen) / (1 - sen)) / (4 * Math.PI)) * s }
}
const dePx = (x: number, y: number, z: number): Ponto => {
  const s = TAM * 2 ** z
  const n = Math.PI - (2 * Math.PI * y) / s
  return { lng: (x / s) * 360 - 180, lat: (180 / Math.PI) * Math.atan(0.5 * (Math.exp(n) - Math.exp(-n))) }
}

export default function Mapa({ centro, zoom = 12, alfinetes = [], deslocarY = 0, className }: {
  centro: Ponto
  zoom?: number
  alfinetes?: Alfinete[]
  /** Sobe o centro visível (px), para quando uma folha cobre a parte de baixo do mapa. */
  deslocarY?: number
  className?: string
}) {
  const caixa = useRef<HTMLDivElement>(null)
  const [tam, setTam] = useState({ w: 390, h: 600 })
  const [vista, setVista] = useState({ c: centro, z: zoom })
  const [fonte, setFonte] = useState<Fonte>(fonteDaSessao)
  const falhou = () => { if (fonte === 'stadia') { fonteDaSessao = 'osm'; setFonte('osm') } }
  useEffect(() => { setVista({ c: centro, z: zoom }) }, [centro.lat, centro.lng, zoom])
  useEffect(() => {
    const el = caixa.current!
    const ro = new ResizeObserver(() => setTam({ w: el.clientWidth, h: el.clientHeight }))
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  const zi = Math.round(vista.z)
  const escala = 2 ** (vista.z - zi)
  const cpx = paraPx(vista.c, zi)
  // canto superior esquerdo da tela em pixels do mundo (no zoom inteiro zi)
  const ox = cpx.x - tam.w / 2 / escala
  const oy = cpx.y - (tam.h / 2 - deslocarY) / escala

  const blocos = useMemo(() => {
    const n = 2 ** zi
    const x0 = Math.floor(ox / TAM), y0 = Math.floor(oy / TAM)
    const x1 = Math.floor((ox + tam.w / escala) / TAM), y1 = Math.floor((oy + tam.h / escala) / TAM)
    const lista: { k: string; src: string; l: number; t: number }[] = []
    for (let x = x0; x <= x1; x++) for (let y = y0; y <= y1; y++) {
      if (y < 0 || y >= n) continue
      const xx = ((x % n) + n) % n
      lista.push({ k: `${zi}/${x}/${y}`, src: bloco(fonte, zi, xx, y), l: (x * TAM - ox) * escala, t: (y * TAM - oy) * escala })
    }
    return lista
  }, [zi, ox, oy, tam.w, tam.h, escala, fonte])

  // Arrastar e pinçar
  const toques = useRef(new Map<number, { x: number; y: number }>())
  const inicio = useRef<{ c: Ponto; z: number; dist?: number; mx: number; my: number } | null>(null)
  const pointerDown = (e: React.PointerEvent) => {
    (e.target as Element).setPointerCapture?.(e.pointerId)
    toques.current.set(e.pointerId, { x: e.clientX, y: e.clientY })
    const pts = [...toques.current.values()]
    const mx = pts.reduce((s, p) => s + p.x, 0) / pts.length, my = pts.reduce((s, p) => s + p.y, 0) / pts.length
    inicio.current = { c: vista.c, z: vista.z, dist: pts.length === 2 ? Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y) : undefined, mx, my }
  }
  const pointerMove = (e: React.PointerEvent) => {
    if (!toques.current.has(e.pointerId) || !inicio.current) return
    toques.current.set(e.pointerId, { x: e.clientX, y: e.clientY })
    const pts = [...toques.current.values()]
    const mx = pts.reduce((s, p) => s + p.x, 0) / pts.length, my = pts.reduce((s, p) => s + p.y, 0) / pts.length
    const ini = inicio.current
    let z = ini.z
    if (pts.length === 2 && ini.dist) z = Math.max(3, Math.min(18, ini.z + Math.log2(Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y) / ini.dist)))
    const p = paraPx(ini.c, z)
    setVista({ c: dePx(p.x - (mx - ini.mx), p.y - (my - ini.my), z), z })
  }
  const pointerUp = (e: React.PointerEvent) => {
    toques.current.delete(e.pointerId)
    const pts = [...toques.current.values()]
    if (pts.length) inicio.current = { c: vista.c, z: vista.z, mx: pts[0].x, my: pts[0].y }
    else inicio.current = null
  }
  const zoomEm = (dz: number) => setVista((v) => ({ c: v.c, z: Math.max(3, Math.min(18, Math.round(v.z + dz))) }))
  useEffect(() => {
    const el = caixa.current!
    const roda = (e: WheelEvent) => { e.preventDefault(); setVista((v) => ({ c: v.c, z: Math.max(3, Math.min(18, v.z - e.deltaY * 0.002)) })) }
    el.addEventListener('wheel', roda, { passive: false })
    return () => el.removeEventListener('wheel', roda)
  }, [])

  return (
    <div ref={caixa} className={'mapa' + (className ? ' ' + className : '')}
      onPointerDown={pointerDown} onPointerMove={pointerMove} onPointerUp={pointerUp} onPointerCancel={pointerUp}
      onDoubleClick={() => zoomEm(1)}>
      <div className="mapa-blocos" aria-hidden="true">
        {blocos.map((b) => (
          <img key={b.k} src={b.src} alt="" draggable={false} decoding="async"
            style={{ left: b.l, top: b.t, width: TAM * escala + 0.5, height: TAM * escala + 0.5 }}
            onError={(e) => { if (fonte === 'stadia') falhou(); else (e.target as HTMLImageElement).style.visibility = 'hidden' }} />
        ))}
      </div>
      {alfinetes.map((a, i) => {
        const p = paraPx(a, zi)
        const l = (p.x - ox) * escala, t = (p.y - oy) * escala
        if (l < -60 || t < -60 || l > tam.w + 60 || t > tam.h + 60) return null
        return (
          <button key={i} type="button" className="mapa-pino" style={{ left: l, top: t, ['--cor' as any]: a.cor || 'var(--gold)' }}
            onPointerDown={(e) => e.stopPropagation()} onClick={a.onClick} aria-label={a.rotulo || 'Lugar'}>
            <span className="mapa-pino-bola">{a.icone || ''}</span>
            {a.rotulo && <span className="mapa-pino-rotulo">{a.rotulo}</span>}
          </button>
        )
      })}
      <div className="mapa-zoom">
        <button type="button" onPointerDown={(e) => e.stopPropagation()} onClick={() => zoomEm(1)} aria-label="Aproximar">+</button>
        <button type="button" onPointerDown={(e) => e.stopPropagation()} onClick={() => zoomEm(-1)} aria-label="Afastar">−</button>
      </div>
      <a className="mapa-credito" href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer" onPointerDown={(e) => e.stopPropagation()}>{fonte === 'stadia' ? '© Stadia Maps © OpenMapTiles © OpenStreetMap' : '© OpenStreetMap'}</a>
    </div>
  )
}

/* ---------- Onde fica? Coordenadas pela Wikipedia (sem chave), guardadas no aparelho ---------- */
export async function localizar(lugar: string): Promise<Ponto | null> {
  const nome = lugar.replace(/\s*\([A-Z]{3}\)\s*/g, '').split(/[,·–-]/)[0].trim()
  if (!nome) return null
  const chave = 'flow.geo.' + nome.toLowerCase()
  try { const c = localStorage.getItem(chave); if (c) return JSON.parse(c) } catch { /* segue */ }
  for (const wiki of ['pt', 'en']) {
    try {
      const r = await fetch(`https://${wiki}.wikipedia.org/w/api.php?action=query&prop=coordinates&redirects=1&format=json&origin=*&titles=${encodeURIComponent(nome)}`)
      const d = await r.json()
      const pg = Object.values(d?.query?.pages || {})[0] as any
      const co = pg?.coordinates?.[0]
      if (co && typeof co.lat === 'number') {
        const p = { lat: co.lat, lng: co.lon }
        try { localStorage.setItem(chave, JSON.stringify(p)) } catch { /* segue */ }
        return p
      }
    } catch { /* tenta a próxima */ }
  }
  return null
}
