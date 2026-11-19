import { useEffect, useState } from 'react'
import { VoicePoweredOrb } from '../components/ui/voice-powered-orb'
import { CirculoInicio, ordenarViagens } from '../components/inicio-circulo'
import { NovaTripCard, TripCard } from '../components/ui/trip-card'
import { fmtData } from '../lib/tempo'
import { capaDaRegiao, NOME_REGIAO, regiaoDaViagem } from '../lib/regioes'
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

export const capaDa = (v: ViagemRow, capas: Record<string, string>) => capas[v.id] || v.capa_url || capaPadrao(v.titulo)

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
  if (lista) {
    const dias = (v: ViagemRow) => (v.inicio && v.fim ? Math.round((+new Date(v.fim) - +new Date(v.inicio)) / 864e5) + 1 : null)
    const hoje = new Date().toISOString().slice(0, 10)
    return (
      <div className="viagens">
        <header className="viagens-topo">
          <a className="icon-btn" href="#/viagens" aria-label="Voltar ao início">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m15 18-6-6 6-6" /></svg>
          </a>
          <h1>Minhas viagens</h1>
          <button type="button" className="btn sm" onClick={sair}>Sair</button>
        </header>
        <div className="viagens-base viagens-base-larga">
          <AvisoBox aviso={aviso} />
          {!carregado && <p className="muted">Carregando suas viagens…</p>}
          <div className="trip-cards">
            {carregado && ordenarViagens(viagens).map((v) => {
              const d = dias(v)
              const reg = regiaoDaViagem(v)
              const tipo = reg ? NOME_REGIAO[reg] : v.tipo === 'nacional' ? 'Nacional' : 'Internacional'
              const quando = v.fim && v.fim < hoje ? 'Já aconteceu' : v.inicio && v.inicio <= hoje ? 'Acontecendo agora' : null
              return (
                <TripCard
                  key={v.id}
                  href={`#/viagem/${v.id}`}
                  imagem={capas[v.id] || capaDaRegiao(v) || capaDa(v, capas)}
                  imagemAlt={`Foto de ${v.destino || v.titulo}`}
                  rotulo={[tipo, d ? `${d} ${d === 1 ? 'dia' : 'dias'}` : null, quando].filter(Boolean).join(' · ')}
                  titulo={v.titulo}
                  local={v.destino}
                  rodape={v.inicio ? (
                    <>
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><rect width="18" height="18" x="3" y="4" rx="2" /><path d="M16 2v4M8 2v4M3 10h18" /></svg>
                      <span><strong>{fmtData(v.inicio)}</strong>{v.fim ? ` até ${fmtData(v.fim)}` : ''}</span>
                    </>
                  ) : <span>Sem data definida</span>}
                />
              )
            })}
            {carregado && <NovaTripCard href="#/nova" />}
          </div>
        </div>
      </div>
    )
  }

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
