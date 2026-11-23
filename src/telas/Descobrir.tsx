import { useEffect, useRef, useState } from 'react'
import { getToken, rest, SUPA_KEY, SUPA_URL } from '../lib/supabase'

/**
 * "Dê swipe para descobrir": lugares do destino em cartões de tela cheia.
 * Direita = salvar · Esquerda = passar · Para cima = superlike. Cada decisão é gravada na hora
 * (tabela lugares_salvos, só para quem participa da viagem). Os salvos entram no "Gerar roteiro" e no mapa.
 */

type Lugar = { nome: string; categoria: string; descricao: string; por_que: string | null; regiao: string | null; lat: number | null; lng: number | null; duracao: string | null; wiki_titulo: string | null; emoji: string; foto?: string | null }

const CAT: Record<string, string> = { cultura: 'Cultura', historia: 'Cultura e história', gastronomia: 'Gastronomia', natureza: 'Natureza', mirante: 'Mirante', bairro: 'Bairro', compras: 'Compras', vida_noturna: 'Vida noturna', praia: 'Praia', aventura: 'Aventura', bem_estar: 'Bem-estar', familia: 'Família' }

/** Foto do lugar pela Wikipedia (imagem principal do artigo). */
async function fotoDe(l: Lugar): Promise<string | null> {
  const titulos = [l.wiki_titulo, l.nome].filter(Boolean) as string[]
  for (const t of titulos) for (const w of ['en', 'pt']) {
    try {
      const r = await fetch(`https://${w}.wikipedia.org/w/api.php?action=query&prop=pageimages&piprop=thumbnail&pithumbsize=1200&redirects=1&format=json&origin=*&titles=${encodeURIComponent(t)}`)
      const pg = Object.values((await r.json())?.query?.pages || {})[0] as any
      if (pg?.thumbnail?.source) return pg.thumbnail.source
    } catch { /* tenta a próxima */ }
  }
  return null
}

export default function Descobrir({ viagemId, aoFechar }: { viagemId: string; aoFechar: (salvos: number) => void }) {
  const [lugares, setLugares] = useState<Lugar[]>([])
  const [i, setI] = useState(0)
  const [erro, setErro] = useState<string | null>(null)
  const [carregando, setCarregando] = useState(true)
  const [detalhe, setDetalhe] = useState(false)
  const [dx, setDx] = useState(0), [dy, setDy] = useState(0)
  const [saindo, setSaindo] = useState<null | 'esq' | 'dir' | 'cima'>(null)
  const salvos = useRef(0)
  const ini = useRef<{ x: number; y: number } | null>(null)

  async function buscar() {
    setCarregando(true); setErro(null)
    try {
      const r = await fetch(`${SUPA_URL}/functions/v1/descobrir-ia`, { method: 'POST', headers: { Authorization: 'Bearer ' + (await getToken()), apikey: SUPA_KEY, 'Content-Type': 'application/json' }, body: JSON.stringify({ viagem_id: viagemId }) })
      const d = await r.json().catch(() => ({}))
      if (!r.ok) throw new Error(d?.erro || 'A Lia não conseguiu sugerir agora.')
      const ls: Lugar[] = d.lugares || []
      setLugares((a) => [...a, ...ls]);
      // fotos em paralelo, sem travar os cartões
      ls.forEach((l) => { void fotoDe(l).then((f) => setLugares((a) => a.map((x) => (x === l ? { ...x, foto: f } : x)))) })
    } catch (e) { setErro(e instanceof Error ? e.message : 'Não deu certo agora.') }
    finally { setCarregando(false) }
  }
  useEffect(() => { void buscar() }, [])

  const atual = lugares[i]
  async function decidir(dec: 'salvo' | 'superlike' | 'passou') {
    if (!atual || saindo) return
    setSaindo(dec === 'passou' ? 'esq' : dec === 'salvo' ? 'dir' : 'cima')
    if (dec !== 'passou') salvos.current++
    try {
      await rest('POST', 'lugares_salvos', { viagem_id: viagemId, nome: atual.nome, categoria: atual.categoria, descricao: atual.descricao, regiao: atual.regiao, lat: atual.lat, lng: atual.lng, emoji: atual.emoji, foto_url: atual.foto || null, decisao: dec }, 'return=minimal')
    } catch { /* se falhar, segue deslizando */ }
    setTimeout(() => {
      setSaindo(null); setDx(0); setDy(0); setDetalhe(false)
      setI((n) => n + 1)
      if (i + 1 >= lugares.length - 2 && !carregando) void buscar()
    }, 260)
  }

  const down = (e: React.PointerEvent) => { (e.currentTarget as Element).setPointerCapture?.(e.pointerId); ini.current = { x: e.clientX, y: e.clientY } }
  const move = (e: React.PointerEvent) => { if (!ini.current) return; setDx(e.clientX - ini.current.x); setDy(e.clientY - ini.current.y) }
  const up = () => {
    if (!ini.current) return
    ini.current = null
    if (dy < -110 && Math.abs(dx) < 120) void decidir('superlike')
    else if (dx > 100) void decidir('salvo')
    else if (dx < -100) void decidir('passou')
    else { setDx(0); setDy(0) }
  }
  const transf = saindo === 'dir' ? 'translate(130%, 0) rotate(18deg)' : saindo === 'esq' ? 'translate(-130%, 0) rotate(-18deg)' : saindo === 'cima' ? 'translate(0, -130%)' : `translate(${dx}px, ${Math.min(dy, 40)}px) rotate(${dx / 18}deg)`

  return (
    <div className="dsc" role="dialog" aria-label="Descobrir lugares">
      <header className="dsc-topo">
        <button type="button" className="vm-redondo" onClick={() => aoFechar(salvos.current)} aria-label="Fechar">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true"><path d="M18 6 6 18M6 6l12 12" /></svg>
        </button>
        <span>Dê swipe para selecionar</span>
        <button type="button" className="dsc-concluir" onClick={() => aoFechar(salvos.current)}>✓ Concluir</button>
      </header>

      <div className="dsc-palco">
        {lugares[i + 1] && (
          <div className="dsc-cartao dsc-atras" aria-hidden="true">{lugares[i + 1].foto && <img src={lugares[i + 1].foto!} alt="" />}</div>
        )}
        {atual ? (
          <div className={'dsc-cartao' + (saindo || ini.current ? '' : ' solto')} style={{ transform: transf }}
            onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={up}>
            <div className="dsc-progresso" aria-hidden="true">{lugares.slice(i, i + 5).map((_, k) => <i key={k} className={k === 0 ? 'on' : ''} />)}</div>
            {atual.foto ? <img src={atual.foto} alt={`Foto de ${atual.nome}`} draggable={false} /> : <div className="dsc-semfoto">{atual.emoji}</div>}
            <div className="dsc-veu" />
            <span className="dsc-selo salvar" style={{ opacity: Math.max(0, Math.min(1, dx / 100)) }}>SALVAR</span>
            <span className="dsc-selo passar" style={{ opacity: Math.max(0, Math.min(1, -dx / 100)) }}>PASSAR</span>
            <span className="dsc-selo amei" style={{ opacity: Math.max(0, Math.min(1, -dy / 110)) }}>AMEI</span>
            <div className="dsc-info">
              <h2>{atual.nome}</h2>
              <div className="dsc-meta">{CAT[atual.categoria] || atual.categoria}{atual.regiao ? ' · ' + atual.regiao : ''}{atual.duracao ? ' · ' + atual.duracao : ''}</div>
              {detalhe && (
                <div className="dsc-detalhe">
                  <p>{atual.descricao}</p>
                  {atual.por_que && <p className="dsc-porque">Por que combina com você: {atual.por_que}</p>}
                </div>
              )}
              <button type="button" className="dsc-ver" onPointerDown={(e) => e.stopPropagation()} onClick={() => setDetalhe((d) => !d)}>{detalhe ? '⌄ Fechar' : '⌃ Ver detalhes'}</button>
            </div>
          </div>
        ) : (
          <div className="dsc-vazio">
            {carregando ? <><div className="dsc-girando" />A Lia está escolhendo lugares para você…</>
              : erro ? <>{erro}<button type="button" className="btn sm" onClick={() => void buscar()}>Tentar de novo</button></>
                : <>Você viu todos por agora.<button type="button" className="btn sm" onClick={() => void buscar()}>Ver mais lugares</button></>}
          </div>
        )}
      </div>

      {atual && (
        <div className="dsc-botoes">
          <button type="button" className="dsc-b passar" onClick={() => void decidir('passou')} aria-label="Passar">✕</button>
          <button type="button" className="dsc-b amei" onClick={() => void decidir('superlike')} aria-label="Amei (superlike)">★</button>
          <button type="button" className="dsc-b salvar" onClick={() => void decidir('salvo')} aria-label="Salvar">♥</button>
        </div>
      )}
    </div>
  )
}
