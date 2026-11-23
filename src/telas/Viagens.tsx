import { useEffect, useState } from 'react'
import { VoicePoweredOrb } from '../components/ui/voice-powered-orb'
import { CirculoInicio, ordenarViagens } from '../components/inicio-circulo'

import { capaDaRegiao } from '../lib/regioes'
import { AvisoBox, enviar, type Aviso } from '../components/comum'
import { authReq, baixarArquivo, getSessao, rest, setSessao, userId } from '../lib/supabase'
import { buscarCapaWikipedia, capaPadrao } from '../lib/capa'
import { campo, erroPt } from '../lib/textos'

export type ViagemRow = {
  id: string
  titulo: string
  destino: string | null
  inicio: string | null
  fim: string | null
  tipo: string | null
  capa_url: string | null
  capa_credito: string | null
  capa_path: string | null
}

/** Fotos enviadas pela pessoa ficam no cofre privado: viram um endereço local (blob:) só nesta tela. */
export function useCapas(viagens: ViagemRow[]) {
  const [capas, setCapas] = useState<Record<string, string>>({})
  useEffect(() => {
    let vivo = true
    const urls: string[] = []
    viagens.filter((v) => v.capa_path).forEach(async (v) => {
      try {
        const url = URL.createObjectURL(await baixarArquivo(v.capa_path!))
        urls.push(url)
        if (vivo) setCapas((c) => ({ ...c, [v.id]: url }))
        else URL.revokeObjectURL(url)
      } catch { /* fica a foto do destino ou a capa padrão */ }
    })
    return () => { vivo = false; urls.forEach((u) => URL.revokeObjectURL(u)) }
  }, [viagens])
  return capas
}

/** Capa da viagem: a foto que a pessoa enviou > a imagem pronta da região > a foto do destino > a capa padrão. */
export const capaDa = (v: ViagemRow, capas: Record<string, string>) => capas[v.id] || capaDaRegiao(v) || v.capa_url || capaPadrao(v.titulo)

export default function Viagens({ nova, lista, avisoInicial }: { nova: boolean; lista?: boolean; avisoInicial: Aviso }) {
  const [viagens, setViagens] = useState<ViagemRow[]>([])
  const [carregado, setCarregado] = useState(false)
  const [aviso, setAviso] = useState<Aviso>(avisoInicial)
  const capas = useCapas(viagens)
  // Com a abertura na tela, a luz do círculo de baixo só liga quando ela termina (uma luz por vez).
  const [liberado, setLiberado] = useState(() => !(window as any).__flowAbertura)
  useEffect(() => {
    if (liberado) return
    const f = () => setLiberado(true)
    window.addEventListener('flow:abertura-fim', f)
    return () => window.removeEventListener('flow:abertura-fim', f)
  }, [liberado])

  useEffect(() => {
    rest<ViagemRow[]>('GET', 'viagens?select=*&order=inicio.asc.nullslast')
      .then((v) => setViagens(v || []))
      .catch((e) => setAviso({ texto: erroPt(e), erro: true }))
      .finally(() => setCarregado(true))
  }, [])

  async function criar(fd: FormData) {
    const body = {
      titulo: campo(fd, 'titulo'), destino: campo(fd, 'destino'), inicio: campo(fd, 'inicio'), fim: campo(fd, 'fim'),
      tipo: campo(fd, 'tipo'), dono_id: userId(),
    }
    if (!body.titulo) throw new Error('Dê um nome para a viagem.')
    if (body.inicio && body.fim && body.fim < body.inicio) throw new Error('A volta não pode ser antes da ida.')
    const [criada] = await rest<ViagemRow[]>('POST', 'viagens', body, 'return=representation')
    // Foto do destino (melhor esforço: se não achar, fica a capa padrão)
    const capa = await buscarCapaWikipedia(body.destino || body.titulo)
    if (capa) {
      try { await rest('PATCH', `viagens?id=eq.${criada.id}`, { capa_url: capa.url, capa_credito: capa.credito }) } catch { /* segue sem foto */ }
    }
    window.location.hash = `#/viagem/${criada.id}`
  }

  async function sair() {
    const s = getSessao()
    try { if (s) await authReq('logout', undefined, { token: s.access_token }) } catch { /* sai mesmo assim */ }
    setSessao(null)
    window.location.hash = ''
  }

  // Minhas viagens: cards com a foto, o nome, o destino e as datas, mais o card de criar uma nova
  if (lista) return <MinhasViagens viagens={viagens} carregado={carregado} capas={capas} aviso={aviso} sair={sair} />

  // Casa do app: o mesmo círculo do fim da abertura, parado — viagens para abrir ou começar uma nova
  if (!nova) {
    return (
      <div className="inicio tunel tunel-fim">
        <div className="tunel-grade" aria-hidden="true" />
        <div className="tunel-brilho" aria-hidden="true" />
        <div className="tunel-anel inicio-anel" aria-hidden="true" />
        <div className="tunel-anel tunel-anel-2 inicio-anel-2" aria-hidden="true" />
        {liberado && <div className="tunel-luz" aria-hidden="true"><VoicePoweredOrb enableVoiceControl={false} /></div>}
        <button type="button" className="inicio-sair" onClick={sair}>Sair</button>
        {aviso && <div className="inicio-aviso"><AvisoBox aviso={aviso} /></div>}
        <div className="tunel-final">
          {carregado && <CirculoInicio viagens={viagens} logada irPara={(h) => { window.location.hash = h }} />}
        </div>
      </div>
    )
  }

  return (
    <div className="viagens">
      <header className="viagens-topo">
        <h1>Nova viagem</h1>
        <a className="btn sm" href="#/viagens" style={{ textDecoration: 'none' }}>Voltar</a>
      </header>

      <div className="viagens-base">
        <AvisoBox aviso={aviso} />
        <form className="card stack" noValidate onSubmit={(e) => enviar(e, criar, (t) => setAviso({ texto: t, erro: true }), erroPt)}>
          <label>Nome da viagem<input name="titulo" required maxLength={80} placeholder="Ex.: Paris e Alpes" /></label>
          <label>Destino<input name="destino" maxLength={120} placeholder="Ex.: Paris" /></label>
          <p className="hint">Buscamos uma foto do destino automaticamente. Você pode trocar pela sua depois.</p>
          <div className="grid2">
            <label>Ida<input name="inicio" type="date" /></label>
            <label>Volta<input name="fim" type="date" /></label>
          </div>
          <label>Tipo<select name="tipo" defaultValue="internacional"><option value="internacional">Internacional</option><option value="nacional">Nacional</option></select></label>
          <div className="row">
            <button className="btn primary" type="submit" style={{ flex: 2 }}>Criar viagem</button>
            <a className="btn" href="#/viagens" style={{ flex: 1, textDecoration: 'none' }}>Cancelar</a>
          </div>
        </form>
      </div>
    </div>
  )
}

/* ---------- Minhas viagens: cartões grandes de foto (Suas viagens / Ideias de viagem) ---------- */
const DIA = 864e5
const meiaNoite = (iso: string) => new Date(iso + 'T00:00:00').getTime()
function situacao(v: ViagemRow) {
  const hoje = new Date(); hoje.setHours(0, 0, 0, 0)
  const h = hoje.getTime()
  if (!v.inicio) return { quando: 'Sem data', status: 'Ideia', tom: 'ideia' }
  const ini = meiaNoite(v.inicio), fim = v.fim ? meiaNoite(v.fim) : ini
  if (h < ini) {
    const d = Math.round((ini - h) / DIA)
    return { quando: d === 1 ? 'Amanhã' : d < 60 ? `Em ${d} dias` : `Em ${Math.round(d / 30)} meses`, status: 'Planejamento', tom: 'plano' }
  }
  if (h <= fim) return { quando: 'Agora', status: 'Em viagem', tom: 'agora' }
  const d = Math.round((h - fim) / DIA)
  return { quando: d < 60 ? `Há ${d} dias` : `Há ${Math.round(d / 30)} meses`, status: 'Concluída', tom: 'fim' }
}

function MinhasViagens({ viagens, carregado, capas, aviso, sair }: { viagens: ViagemRow[]; carregado: boolean; capas: Record<string, string>; aviso: Aviso; sair: () => void }) {
  const [aba, setAba] = useState<'suas' | 'ideias'>('suas')
  const [busca, setBusca] = useState<string | null>(null)
  const termo = (busca || '').trim().toLowerCase()
  const filtradas = viagens.filter((v) => !termo || `${v.titulo} ${v.destino || ''}`.toLowerCase().includes(termo))
  const ideias = filtradas.filter((v) => !v.inicio)
  const comData = ordenarViagens(filtradas.filter((v) => v.inicio))
  const grupos: [string, ViagemRow[]][] = [
    ['Acontecendo agora', comData.filter((v) => situacao(v).tom === 'agora')],
    ['Próximas viagens', comData.filter((v) => situacao(v).tom === 'plano')],
    ['Já aconteceram', comData.filter((v) => situacao(v).tom === 'fim')],
  ]
  const dias = (v: ViagemRow) => (v.inicio && v.fim ? Math.round((meiaNoite(v.fim) - meiaNoite(v.inicio)) / DIA) + 1 : null)
  const cartao = (v: ViagemRow) => {
    const st = situacao(v), d = dias(v)
    const lugar = (v.destino || v.titulo).replace(/\s*\([A-Z]{3}\)\s*/g, '')
    return (
      <a key={v.id} className="mv-cartao" href={`#/viagem/${v.id}`}>
        <img src={capaDa(v, capas)} alt="" loading="lazy" decoding="async" />
        <div className="mv-veu" />
        <div className="mv-topo">
          <span className="mv-chip">{st.quando}</span>
          {d && <span className="mv-chip">{d} {d === 1 ? 'dia' : 'dias'}</span>}
        </div>
        <div className="mv-base">
          <strong className="mv-lugar">{lugar}</strong>
          {v.destino && v.titulo.toLowerCase() !== lugar.toLowerCase() && <span className="mv-titulo">{v.titulo}</span>}
          <span className={'mv-status ' + st.tom}><i />{st.status}</span>
        </div>
      </a>
    )
  }
  return (
    <div className="mv">
      <header className="mv-cab">
        <a className="mv-redondo" href="#/viagens" aria-label="Voltar ao início">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m15 18-6-6 6-6" /></svg>
        </a>
        <span className="mv-logo">FLOW</span>
        <button type="button" className="mv-redondo mv-sair" onClick={sair} aria-label="Sair da conta">Sair</button>
      </header>

      <div className="mv-seg" role="tablist">
        <button type="button" role="tab" aria-selected={aba === 'suas'} className={aba === 'suas' ? 'on' : ''} onClick={() => setAba('suas')}>Suas viagens</button>
        <button type="button" role="tab" aria-selected={aba === 'ideias'} className={aba === 'ideias' ? 'on' : ''} onClick={() => setAba('ideias')}>Ideias de viagem</button>
      </div>

      <div className="mv-ferr">
        {busca === null
          ? <button type="button" className="mv-redondo" onClick={() => setBusca('')} aria-label="Buscar viagem"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></svg></button>
          : <input className="mv-busca" autoFocus placeholder="Buscar por nome ou destino" value={busca} onChange={(e) => setBusca(e.target.value)} onBlur={() => !busca && setBusca(null)} />}
        <a className="mv-pilula" href="#/lia"><span className="fim-lia-orbe" aria-hidden="true" />Criar com a Lia</a>
        <a className="mv-pilula" href="#/nova">+ Nova</a>
      </div>

      <AvisoBox aviso={aviso} />
      {!carregado && <p className="muted mv-vazio">Carregando suas viagens…</p>}
      {carregado && aba === 'suas' && (
        comData.length === 0
          ? <p className="muted mv-vazio">{termo ? 'Nenhuma viagem com esse nome.' : 'Nenhuma viagem com data ainda. Crie uma com a Lia ou veja suas ideias.'}</p>
          : grupos.filter(([, l]) => l.length).map(([t, l]) => (
            <section key={t} className="mv-grupo"><h2>{t}</h2>{l.map(cartao)}</section>
          ))
      )}
      {carregado && aba === 'ideias' && (
        ideias.length === 0
          ? <p className="muted mv-vazio">Viagens sem data ficam aqui, como ideias. Conte para a Lia aonde você sonha ir.</p>
          : <section className="mv-grupo">{ideias.map(cartao)}</section>
      )}
    </div>
  )
}
