import { useEffect, useState } from 'react'
import { CardFanCarousel, type CardItem } from '../components/ui/card-fan-carousel'
import { AvisoBox, enviar, type Aviso } from '../components/comum'
import { authReq, baixarArquivo, getSessao, rest, setSessao, userId } from '../lib/supabase'
import { buscarCapaWikipedia, capaPadrao, CARTAO_NOVA } from '../lib/capa'
import { campo, erroPt } from '../lib/textos'
import { fmtData } from '../lib/tempo'

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

export default function Viagens({ nova, avisoInicial }: { nova: boolean; avisoInicial: Aviso }) {
  const [viagens, setViagens] = useState<ViagemRow[]>([])
  const [carregado, setCarregado] = useState(false)
  const [aviso, setAviso] = useState<Aviso>(avisoInicial)
  const capas = useCapas(viagens)
  // Com a abertura na tela, o leque espera o avião passar para abrir os cartões.
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

  const cards: CardItem[] = [
    ...viagens.map((v) => ({ imgUrl: capaDa(v, capas), alt: v.titulo + (v.destino ? ' — ' + v.destino : ''), linkUrl: `#/viagem/${v.id}` })),
    { imgUrl: CARTAO_NOVA, alt: 'Criar uma nova viagem', linkUrl: '#/nova' },
  ]

  return (
    <div className="viagens">
      <header className="viagens-topo">
        <h1>Minhas viagens</h1>
        <button type="button" className="btn sm" onClick={sair}>Sair</button>
      </header>

      {carregado && liberado && !nova && (
        <div className="viagens-leque">
          <CardFanCarousel cards={cards} theme="light" />
        </div>
      )}

      <div className="viagens-base">
        <AvisoBox aviso={aviso} />
        {!carregado && <p className="muted">Carregando suas viagens…</p>}

        {nova ? (
          <form className="card stack" noValidate onSubmit={(e) => enviar(e, criar, (t) => setAviso({ texto: t, erro: true }), erroPt)}>
            <strong>Nova viagem</strong>
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
        ) : (
          carregado && (
            <>
              {viagens.length > 0 ? (
                <nav className="lista-viagens" aria-label="Suas viagens">
                  {viagens.map((v) => (
                    <a key={v.id} href={`#/viagem/${v.id}`}>
                      {v.titulo}{v.inicio ? ` · ${fmtData(v.inicio)}` : ''}
                    </a>
                  ))}
                </nav>
              ) : (
                <p className="muted">Você ainda não tem viagens. Toque em "Nova viagem" para começar.</p>
              )}
              <a className="btn primary" href="#/nova" style={{ textDecoration: 'none' }}>Nova viagem</a>
            </>
          )
        )}
      </div>
    </div>
  )
}
