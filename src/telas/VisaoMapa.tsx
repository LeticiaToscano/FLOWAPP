import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import Mapa, { type Alfinete, type Ponto } from '../components/ui/mapa'

/**
 * A viagem sobre o mapa: mapa escuro ao fundo, centrado no destino, e uma folha que sobe por cima,
 * com abas "Visão geral" e "Dia 1, Dia 2…". A visão geral mostra cartões: clima típico da época,
 * feriados no período, estatísticas, descobrir lugares, nota e checklist de documentos.
 */

type Row = Record<string, any>
export type Geo = Ponto & { pais?: string; nome?: string }

const DIA = 864e5
const fmtDia = (iso: string) => new Date(iso + 'T12:00:00').toLocaleDateString('pt-BR', { day: 'numeric', month: 'short' }).replace('.', '')
const somaDias = (iso: string, n: number) => new Date(new Date(iso + 'T12:00:00').getTime() + n * DIA).toISOString().slice(0, 10)

/** Destino → coordenadas e país (geocodificação aberta do Open-Meteo, guardada no aparelho). */
export async function geocodificar(lugar: string): Promise<Geo | null> {
  const nome = lugar.replace(/\s*\([A-Z]{3}\)\s*/g, '').split(/[,·–]/)[0].trim()
  if (!nome) return null
  const chave = 'flow.geo2.' + nome.toLowerCase()
  try { const c = localStorage.getItem(chave); if (c) return JSON.parse(c) } catch { /* segue */ }
  try {
    const r = await fetch(`https://geocoding-api.open-meteo.com/v1/search?count=1&language=pt&format=json&name=${encodeURIComponent(nome)}`)
    const d = await r.json()
    const g = d?.results?.[0]
    if (!g) return null
    const geo = { lat: g.latitude, lng: g.longitude, pais: g.country_code, nome: g.name }
    try { localStorage.setItem(chave, JSON.stringify(geo)) } catch { /* segue */ }
    return geo
  } catch { return null }
}

/** Cidades da viagem, na ordem: hotéis primeiro; senão chegadas de voo/trem (sem a volta); senão o que estiver no destino. */
function lugaresDaViagem(v: Row, reservas: Row[]): string[] {
  const porData = (a: Row, b: Row) => String(a.inicio || '').localeCompare(String(b.inicio || ''))
  let l: string[] = reservas.filter((r) => r.tipo === 'hotel' && r.destino).sort(porData).map((r) => r.destino)
  if (!l.length) {
    const c = reservas.filter((r) => r.destino && ['voo', 'trem', 'onibus'].includes(r.tipo)).sort(porData)
    l = c.slice(0, Math.max(1, c.length - 1)).map((r) => r.destino)
  }
  if (!l.length) {
    const d = String(v.destino || v.titulo || '')
    const dentro = d.match(/\(([^)]+)\)/)?.[1]
    l = dentro ? dentro.split(/,|\s+e\s+/) : d.split(/,|\s+e\s+/)
  }
  const vistos = new Set<string>(), out: string[] = []
  for (const x of l) {
    const k = x.replace(/\s*\([^)]*\)\s*/g, '').trim().toLowerCase()
    if (k && !vistos.has(k)) { vistos.add(k); out.push(x.trim()) }
  }
  return out.slice(0, 10)
}

const mx = (g: Ponto) => (g.lng + 180) / 360 * 256
const my = (g: Ponto) => { const s = Math.sin(g.lat * Math.PI / 180); return (0.5 - Math.log((1 + s) / (1 - s)) / (4 * Math.PI)) * 256 }
/** Centro e zoom que mostram todas as cidades na parte do mapa que a folha não cobre. */
function enquadrar(ps: Ponto[]): { c: Ponto; z: number } | null {
  if (!ps.length) return null
  if (ps.length === 1) return { c: ps[0], z: 12 }
  const xs = ps.map(mx), ys = ps.map(my)
  const x0 = Math.min(...xs), x1 = Math.max(...xs), y0 = Math.min(...ys), y1 = Math.max(...ys)
  const W = window.innerWidth * 0.8, H = Math.max(120, window.innerHeight * 0.34 - 120)
  const z = Math.max(2, Math.min(12, Math.log2(Math.min(W / Math.max(x1 - x0, 1e-6), H / Math.max(y1 - y0, 1e-6))) - 0.1))
  const cx = (x0 + x1) / 2, cy = (y0 + y1) / 2
  return { c: { lng: cx / 256 * 360 - 180, lat: Math.atan(Math.sinh(Math.PI * (1 - 2 * cy / 256))) * 180 / Math.PI }, z }
}

type Clima = { min: number; max: number; chuva: number; luz: number; estacao: string; emoji: string }
/** Clima típico: média das mesmas datas no ano passado (arquivo histórico aberto do Open-Meteo). */
async function climaTipico(g: Geo, inicio: string, fim: string): Promise<Clima | null> {
  const chave = `flow.clima.${g.lat.toFixed(2)},${g.lng.toFixed(2)}.${inicio}.${fim}`
  try { const c = localStorage.getItem(chave); if (c) return JSON.parse(c) } catch { /* segue */ }
  const anoAntes = (iso: string) => `${Number(iso.slice(0, 4)) - 1}${iso.slice(4)}`
  const ate = fim > somaDias(inicio, 20) ? somaDias(inicio, 20) : fim
  try {
    const r = await fetch(`https://archive-api.open-meteo.com/v1/archive?latitude=${g.lat}&longitude=${g.lng}&start_date=${anoAntes(inicio)}&end_date=${anoAntes(ate)}&daily=temperature_2m_max,temperature_2m_min,precipitation_sum,daylight_duration&timezone=auto`)
    const d = (await r.json())?.daily
    if (!d?.temperature_2m_max?.length) return null
    const med = (a: number[]) => a.filter((x) => x != null).reduce((s, x) => s + x, 0) / Math.max(1, a.filter((x) => x != null).length)
    const mes = Number(inicio.slice(5, 7))
    const norte = g.lat >= 0
    const est = (norte ? [11, 12, 1, 2].includes(mes) : [5, 6, 7, 8].includes(mes)) ? (mes === 11 || mes === 5 ? 'Outono' : 'Inverno')
      : (norte ? [3, 4, 5].includes(mes) : [9, 10, 11].includes(mes)) ? 'Primavera'
        : (norte ? [6, 7, 8].includes(mes) : [12, 1, 2].includes(mes)) ? 'Verão' : 'Outono'
    const clima = {
      min: Math.round(Math.min(...d.temperature_2m_min.filter((x: number) => x != null))),
      max: Math.round(Math.max(...d.temperature_2m_max.filter((x: number) => x != null))),
      chuva: Math.round(med(d.precipitation_sum) * 10) / 10,
      luz: Math.round(med(d.daylight_duration) / 60),
      estacao: est,
      emoji: { Inverno: '❄️', Primavera: '🌸', 'Verão': '☀️', Outono: '🍂' }[est] || '🌤️',
    }
    try { localStorage.setItem(chave, JSON.stringify(clima)) } catch { /* segue */ }
    return clima
  } catch { return null }
}

/** Feriados nacionais do país do destino dentro das datas da viagem (Nager.Date, aberto). */
async function feriados(pais: string, inicio: string, fim: string): Promise<{ data: string; nome: string }[]> {
  const anos = [...new Set([inicio.slice(0, 4), fim.slice(0, 4)])]
  const lista: { data: string; nome: string }[] = []
  for (const ano of anos) {
    const chave = `flow.feriados.${pais}.${ano}`
    let dados: any[] | null = null
    try { const c = localStorage.getItem(chave); if (c) dados = JSON.parse(c) } catch { /* segue */ }
    if (!dados) {
      try {
        const r = await fetch(`https://date.nager.at/api/v3/PublicHolidays/${ano}/${pais}`)
        dados = r.ok ? await r.json() : []
        try { localStorage.setItem(chave, JSON.stringify(dados)) } catch { /* segue */ }
      } catch { dados = [] }
    }
    for (const f of dados || []) if (f.date >= inicio && f.date <= fim && f.global !== false) lista.push({ data: f.date, nome: f.localName || f.name })
  }
  return lista
}

const CORES_TIPO: Record<string, string> = { voo: '#6CB8FF', hotel: '#E2D1A8', trem: '#8FD3A1', onibus: '#8FD3A1', transfer: '#BDBDBD', carro: '#F2C98A', passeio: '#C49BFF', restaurante: '#FF9B7A', outro: '#777' }

export default function VisaoMapa(p: {
  viagem: Row
  capa: string
  reservas: Row[]
  roteiro: Row[]
  docs: Row[]
  tipoNome: (t: string) => string
  alertas: ReactNode
  proximo: ReactNode
  item: (i: Row) => ReactNode
  aoSair: () => void
  aoGerarRoteiro: () => void
  aoEditar: () => void
  aoMais: () => void
  aoDescobrir: () => void
  aoAbrirDocumentos: () => void
  aoSalvarNota: (nota: string) => Promise<void>
  salvos?: Row[]
}) {
  const v = p.viagem
  const [geo, setGeo] = useState<Geo | null>(null)
  const [pontos, setPontos] = useState<Geo[]>([])
  const [clima, setClima] = useState<Clima | null | undefined>(undefined)
  const [fer, setFer] = useState<{ data: string; nome: string }[]>([])
  const [aba, setAba] = useState('geral')
  // folha em 3 alturas: 0 = baixa (mais mapa), 1 = metade, 2 = tela quase inteira. Arrasta pela alça ou pelo topo.
  const [nivel, setNivel] = useState<0 | 1 | 2>(1)
  const alta = nivel === 2
  const setAlta = (v: boolean | ((a: boolean) => boolean)) => setNivel((n) => ((typeof v === 'function' ? v(n === 2) : v) ? 2 : 1))
  const [puxando, setPuxando] = useState<number | null>(null) // altura ao vivo enquanto arrasta
  const folhaRef = useRef<HTMLElement | null>(null)
  const alturas = () => { const h = window.innerHeight; return [Math.min(330, h * 0.42), h * 0.66, h - 76] }
  const inicioArraste = useRef<{ y: number; h: number; t: number; ultimo: number } | null>(null)
  const pegar = (e: React.PointerEvent) => {
    if ((e.target as HTMLElement).closest('.vm-abas button')) return
    inicioArraste.current = { y: e.clientY, ultimo: e.clientY, h: folhaRef.current?.getBoundingClientRect().height || alturas()[nivel], t: Date.now() }
    ;(e.currentTarget as Element).setPointerCapture?.(e.pointerId)
  }
  const mover = (e: React.PointerEvent) => {
    const a = inicioArraste.current; if (!a) return
    a.ultimo = e.clientY
    const dy = e.clientY - a.y
    if (Math.abs(dy) < 4 && puxando == null) return
    const [b, , t] = alturas()
    setPuxando(Math.max(b - 40, Math.min(t, a.h - dy)))
  }
  const soltar = (e: React.PointerEvent) => {
    const a = inicioArraste.current; inicioArraste.current = null
    if (!a) return
    // pointercancel chega sem posição confiável: usa o último ponto do arraste
    const dy = (e.type === 'pointercancel' ? a.ultimo : e.clientY) - a.y
    if (Math.abs(dy) < 6) { setPuxando(null); if ((e.target as HTMLElement).closest('.vm-alca')) setNivel((n) => (n === 2 ? 1 : 2)); return }
    const vel = dy / Math.max(1, Date.now() - a.t) // px/ms
    const hs = alturas(), atual = a.h - dy
    let n = hs.reduce((m, h, i) => (Math.abs(h - atual) < Math.abs(hs[m] - atual) ? i : m), 0) as 0 | 1 | 2
    if (vel < -0.5) n = Math.min(2, Math.max(n, nivel + 1)) as 0 | 1 | 2
    if (vel > 0.5) n = Math.max(0, Math.min(n, nivel - 1)) as 0 | 1 | 2
    setPuxando(null); setNivel(n)
  }
  const [nota, setNota] = useState<string>(v.nota || '')
  const [editandoNota, setEditandoNota] = useState(false)

  const nomes = useMemo(() => lugaresDaViagem(v, p.reservas), [v.destino, v.titulo, p.reservas])
  const chaveNomes = nomes.join('|')
  useEffect(() => {
    let vivo = true
    Promise.all(nomes.map((n) => geocodificar(n))).then(async (gs) => {
      const ok = gs.filter(Boolean) as Geo[]
      if (!vivo) return
      if (!ok.length) { setClima(null); return }
      setPontos(ok)
      const g = ok[0]
      setGeo(g)
      if (v.inicio) {
        const fim = v.fim || v.inicio
        climaTipico(g, v.inicio, fim).then((c) => vivo && setClima(c))
        if (g.pais) feriados(g.pais, v.inicio, fim).then((f) => vivo && setFer(f))
      } else setClima(null)
    })
    return () => { vivo = false }
  }, [chaveNomes, v.inicio, v.fim])
  const quadro = useMemo(() => enquadrar(pontos), [pontos])
  const desloc = Math.round(window.innerHeight * 0.5 - (90 + window.innerHeight - alturas()[nivel]) / 2)

  const dias = useMemo(() => {
    if (!v.inicio) return [] as string[]
    const fim = v.fim || v.inicio
    const n = Math.min(60, Math.round((new Date(fim + 'T12:00:00').getTime() - new Date(v.inicio + 'T12:00:00').getTime()) / DIA) + 1)
    return Array.from({ length: Math.max(1, n) }, (_, k) => somaDias(v.inicio, k))
  }, [v.inicio, v.fim])

  const porTipo = useMemo(() => {
    const c: Record<string, number> = {}
    p.reservas.forEach((r) => { c[r.tipo] = (c[r.tipo] || 0) + 1 })
    return Object.entries(c).sort((a, b) => b[1] - a[1])
  }, [p.reservas])
  const total = p.reservas.length + p.roteiro.length

  const alfinetes: Alfinete[] = useMemo(() => {
    const a: Alfinete[] = []
    pontos.forEach((g, k) => a.push({ lat: g.lat, lng: g.lng, rotulo: g.nome, icone: pontos.length > 1 ? String(k + 1) : '★' }))
    for (const s of p.salvos || []) if (typeof s.lat === 'number' && typeof s.lng === 'number') a.push({ lat: s.lat, lng: s.lng, rotulo: s.nome, icone: s.emoji || '•', cor: '#8CA0FF' })
    return a
  }, [pontos, p.salvos])

  // Arrastar a alça da folha: para cima abre, para baixo fecha

  const docsOk = p.docs.filter((d) => d.status === 'em_dia').length
  const docsPend = p.docs.filter((d) => d.status !== 'em_dia')

  const donut = () => {
    let acc = 0
    const partes = porTipo.map(([t, n]) => { const ini = acc; acc += n; return { t, ini, n } })
    const tot = Math.max(1, acc)
    const arco = (ini: number, n: number) => {
      const a0 = (ini / tot) * 2 * Math.PI - Math.PI / 2, a1 = ((ini + n) / tot) * 2 * Math.PI - Math.PI / 2
      const large = n / tot > 0.5 ? 1 : 0
      if (n === tot) return 'M 20 4 A 16 16 0 1 1 19.99 4'
      return `M ${20 + 16 * Math.cos(a0)} ${20 + 16 * Math.sin(a0)} A 16 16 0 ${large} 1 ${20 + 16 * Math.cos(a1)} ${20 + 16 * Math.sin(a1)}`
    }
    return (
      <svg viewBox="0 0 40 40" className="vm-donut" aria-hidden="true">
        <circle cx="20" cy="20" r="16" fill="none" stroke="#222" strokeWidth="7" />
        {partes.map((x) => <path key={x.t} d={arco(x.ini, x.n)} fill="none" stroke={CORES_TIPO[x.t] || '#777'} strokeWidth="7" />)}
      </svg>
    )
  }

  return (
    <div className={'vm' + (alta ? ' alta' : '')}>
      <div className="vm-mapa">
        {quadro ? <Mapa centro={quadro.c} zoom={quadro.z} alfinetes={alfinetes} deslocarY={alta ? 0 : desloc} /> : <div className="vm-mapa-vazio" />}
      </div>

      <div className="vm-botoes">
        <button type="button" className="vm-redondo" onClick={p.aoSair} aria-label="Fechar viagem">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true"><path d="M18 6 6 18M6 6l12 12" /></svg>
        </button>
        <button type="button" className="vm-redondo" onClick={p.aoEditar} aria-label="Ajustes da viagem">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z" /></svg>
        </button>
      </div>

      <section ref={folhaRef} className={'vm-folha nivel' + nivel + (puxando != null ? ' puxando' : '')} aria-label="Sua viagem" style={puxando != null ? { height: puxando } : undefined}>
        <div className="vm-pega" onPointerDown={pegar} onPointerMove={mover} onPointerUp={soltar} onPointerCancel={soltar}>
        <button type="button" className="vm-alca" aria-label={alta ? 'Baixar a folha' : 'Subir a folha'}
          onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setNivel((n) => (n === 2 ? 1 : 2)) } }}>
          <span />
        </button>

        <header className="vm-cab">
          <img src={p.capa} alt="" />
          <div>
            <h1>{v.titulo}</h1>
            <span>{v.inicio ? `${fmtDia(v.inicio)}${v.fim ? ' – ' + fmtDia(v.fim) : ''}` : 'Sem data'}{v.destino && !String(v.titulo || '').includes(v.destino) ? ' · ' + v.destino : ''}</span>
          </div>
        </header>

        <nav className="vm-abas" aria-label="Dias da viagem">
          <button type="button" className={aba === 'geral' ? 'on' : ''} onClick={() => setAba('geral')}>Visão geral</button>
          {dias.map((d, k) => <button key={d} type="button" className={aba === d ? 'on' : ''} onClick={() => { setAba(d); setAlta(true) }}>Dia {k + 1}</button>)}
        </nav>
        </div>

        <div className="vm-conteudo">
          {aba === 'geral' ? (
            <>
              {p.alertas}
              {p.proximo}

              {clima !== null && v.inicio && (
                <div className="vm-clima">
                  {clima ? (
                    <>
                      <div className="vm-clima-topo"><span className="vm-emoji">{clima.emoji}</span><strong>{clima.estacao}</strong><span className="vm-soft">Condições típicas</span></div>
                      <div className="vm-clima-linha">
                        <span>🌡️ {clima.min}°–{clima.max}°C</span>
                        <span>💧 {clima.chuva.toLocaleString('pt-BR')} mm/dia</span>
                        <span>🌅 {Math.floor(clima.luz / 60)} h {clima.luz % 60} min</span>
                      </div>
                    </>
                  ) : <div className="vm-soft">Buscando o clima da época…</div>}
                  {fer.map((f) => <div key={f.data + f.nome} className="vm-feriado">⚑ {fmtDia(f.data)} · {f.nome}</div>)}
                </div>
              )}

              <div className="vm-grade">
                <div className="vm-card vm-card-stats">
                  <div className="vm-card-tit"><span className="vm-emoji">🧭</span>Estatísticas</div>
                  <div className="vm-stats">
                    {donut()}
                    <div className="vm-stats-lista">
                      <div><span>Total</span><b>{total}</b></div>
                      {porTipo.slice(0, 3).map(([t, n]) => <div key={t}><span><i style={{ background: CORES_TIPO[t] || '#777' }} />{p.tipoNome(t)}</span><b>{n}</b></div>)}
                      {p.roteiro.length > 0 && <div><span><i style={{ background: '#555' }} />Roteiro</span><b>{p.roteiro.length}</b></div>}
                    </div>
                  </div>
                </div>

                <button type="button" className="vm-card vm-card-swipe" onClick={p.aoDescobrir}>
                  <div className="vm-card-tit"><span className="vm-emoji">🖼️</span>Dê swipe para descobrir</div>
                  <div className="vm-baralho" aria-hidden="true"><i /><i /><i /></div>
                </button>

                <div className="vm-card vm-card-nota">
                  <div className="vm-card-tit"><span className="vm-emoji">✒️</span>Nota</div>
                  {editandoNota ? (
                    <>
                      <textarea value={nota} maxLength={2000} onChange={(e) => setNota(e.target.value)} autoFocus placeholder="Ex.: Dia 1 · Hotel em Alfama" />
                      <button type="button" className="btn sm primary" onClick={async () => { await p.aoSalvarNota(nota); setEditandoNota(false) }}>Salvar</button>
                    </>
                  ) : (
                    <button type="button" className="vm-nota-txt" onClick={() => setEditandoNota(true)}>{nota || 'Toque para escrever'}</button>
                  )}
                </div>

                <button type="button" className="vm-card vm-card-check" onClick={p.aoAbrirDocumentos}>
                  <div className="vm-card-tit"><span className="vm-emoji">📋</span>Checklist</div>
                  {p.docs.length ? (
                    <>
                      <div className="vm-check-linha"><b>{docsOk}</b> de {p.docs.length} em dia</div>
                      {docsPend.slice(0, 2).map((d) => <div key={d.id} className="vm-check-item">◌ {d.item || d.titulo || d.nome}</div>)}
                    </>
                  ) : <div className="vm-soft">Toque para a Lia verificar passaporte, visto e seguro.</div>}
                </button>
              </div>
            </>
          ) : (
            <DiaDaViagem dia={aba} reservas={p.reservas} roteiro={p.roteiro} item={p.item} tipoNome={p.tipoNome} />
          )}
        </div>

        <div className="vm-acoes">
          <button type="button" className="vm-gerar" onClick={p.aoGerarRoteiro}>✨ Gerar roteiro</button>
          <button type="button" className="vm-editar" onClick={p.aoEditar}>Editar</button>
          <button type="button" className="vm-mais" onClick={p.aoMais} aria-label="Adicionar">+</button>
        </div>
      </section>
    </div>
  )
}

function DiaDaViagem({ dia, reservas, roteiro, item, tipoNome }: { dia: string; reservas: Row[]; roteiro: Row[]; item: (i: Row) => ReactNode; tipoNome: (t: string) => string }) {
  const doDia = roteiro.filter((i) => i.dia === dia)
  const res = reservas.filter((r) => (r.inicio && r.inicio.slice(0, 10) === dia) || (r.fim && r.fim.slice(0, 10) === dia))
  return (
    <div className="vm-dia">
      <h2>{new Date(dia + 'T12:00:00').toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' })}</h2>
      {res.map((r) => (
        <div key={r.id} className="vm-res"><span className="chip">{tipoNome(r.tipo)}</span><strong>{r.fornecedor || r.destino || ''}</strong><span className="vm-soft">{[r.origem, r.destino].filter(Boolean).join(' → ')}</span></div>
      ))}
      {doDia.length ? doDia.map((i) => <div key={i.id}>{item(i)}</div>) : <p className="vm-soft">Nada no roteiro neste dia ainda. Toque em "Gerar roteiro" ou peça para a Lia.</p>}
    </div>
  )
}
