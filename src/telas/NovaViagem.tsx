import { useEffect, useMemo, useRef, useState } from 'react'
import { getToken, rest, SUPA_KEY, SUPA_URL, userId } from '../lib/supabase'
import { buscarCapaWikipedia } from '../lib/capa'
import { erroPt } from '../lib/textos'
import type { ViagemRow } from './Viagens'

/**
 * Criar viagem em 5 cartões que abrem um de cada vez (Onde, Quando, Quem vai, Interesses, Reservas).
 * Tudo com toques — nada de digitar datas. No topo, a Lia: a pessoa conta a viagem (escrevendo ou falando)
 * e ela preenche os cartões. Nada é gravado até o "Criar viagem".
 */

type Destino = { nome: string; pais?: string | null; cc?: string | null }
type Passo = 'onde' | 'quando' | 'quem' | 'estilo' | 'interesses' | 'reservas'
const PASSOS: Passo[] = ['onde', 'quando', 'quem', 'estilo', 'interesses', 'reservas']

const bandeira = (cc?: string | null) => (cc && /^[A-Z]{2}$/i.test(cc) ? String.fromCodePoint(...cc.toUpperCase().split('').map((c) => 127397 + c.charCodeAt(0))) : '📍')

const REGIOES: [string, string][] = [['todas', 'Todas'], ['europa', 'Europa'], ['america-sul', 'América do Sul'], ['america-norte', 'América do Norte'], ['caribe', 'Caribe'], ['asia', 'Ásia'], ['oriente-medio', 'Oriente Médio'], ['africa', 'África'], ['oceania', 'Oceania'], ['brasil', 'Brasil']]
const POPULARES: Record<string, [string, string, string][]> = {
  europa: [['Paris', 'França', 'FR'], ['Lisboa', 'Portugal', 'PT'], ['Roma', 'Itália', 'IT'], ['Londres', 'Reino Unido', 'GB'], ['Madri', 'Espanha', 'ES'], ['Barcelona', 'Espanha', 'ES'], ['Amsterdã', 'Países Baixos', 'NL'], ['Porto', 'Portugal', 'PT']],
  'america-sul': [['Buenos Aires', 'Argentina', 'AR'], ['Santiago', 'Chile', 'CL'], ['Bariloche', 'Argentina', 'AR'], ['Cusco', 'Peru', 'PE'], ['Montevidéu', 'Uruguai', 'UY'], ['Cartagena', 'Colômbia', 'CO']],
  'america-norte': [['Nova York', 'Estados Unidos', 'US'], ['Orlando', 'Estados Unidos', 'US'], ['Miami', 'Estados Unidos', 'US'], ['Cidade do México', 'México', 'MX'], ['Toronto', 'Canadá', 'CA'], ['Los Angeles', 'Estados Unidos', 'US']],
  caribe: [['Cancún', 'México', 'MX'], ['Punta Cana', 'Rep. Dominicana', 'DO'], ['Aruba', 'Aruba', 'AW'], ['Curaçao', 'Curaçao', 'CW'], ['San Andrés', 'Colômbia', 'CO']],
  asia: [['Tóquio', 'Japão', 'JP'], ['Bangkok', 'Tailândia', 'TH'], ['Bali', 'Indonésia', 'ID'], ['Seul', 'Coreia do Sul', 'KR'], ['Singapura', 'Singapura', 'SG'], ['Maldivas', 'Maldivas', 'MV']],
  'oriente-medio': [['Dubai', 'Emirados Árabes', 'AE'], ['Istambul', 'Turquia', 'TR'], ['Doha', 'Catar', 'QA'], ['Jerusalém', 'Israel', 'IL'], ['Abu Dhabi', 'Emirados Árabes', 'AE']],
  africa: [['Cidade do Cabo', 'África do Sul', 'ZA'], ['Marrakech', 'Marrocos', 'MA'], ['Cairo', 'Egito', 'EG'], ['Zanzibar', 'Tanzânia', 'TZ'], ['Ilhas Maurício', 'Maurício', 'MU']],
  oceania: [['Sydney', 'Austrália', 'AU'], ['Melbourne', 'Austrália', 'AU'], ['Queenstown', 'Nova Zelândia', 'NZ'], ['Bora Bora', 'Polinésia Francesa', 'PF']],
  brasil: [['Rio de Janeiro', 'Brasil', 'BR'], ['Fernando de Noronha', 'Brasil', 'BR'], ['Gramado', 'Brasil', 'BR'], ['Salvador', 'Brasil', 'BR'], ['Jericoacoara', 'Brasil', 'BR'], ['Foz do Iguaçu', 'Brasil', 'BR']],
}
POPULARES.todas = [POPULARES.europa[0], POPULARES.europa[1], POPULARES['america-norte'][0], POPULARES['america-sul'][0], POPULARES.asia[0], POPULARES['oriente-medio'][0], POPULARES.europa[2], POPULARES.caribe[0]]

const COMPANHIA: [string, string, string][] = [['sozinha', 'Sozinha', '🧳'], ['casal', 'Casal', '💑'], ['amigos', 'Amigos', '👯'], ['familia', 'Família', '👨‍👩‍👧']]
const INTERESSES: [string, string, string][] = [['cultura', 'Cultura e história', '🏛️'], ['gastronomia', 'Gastronomia', '🍝'], ['arte', 'Arte e museus', '🎨'], ['natureza', 'Natureza', '🌿'], ['praia', 'Praia', '🏖️'], ['compras', 'Compras', '🛍️'], ['vida_noturna', 'Vida noturna', '🍸'], ['aventura', 'Aventura', '🧗'], ['bem_estar', 'Bem-estar', '🧖']]
const RITMO: [string, string, string][] = [['tranquilo', 'Tranquilo', 'Poucas coisas por dia, com pausas'], ['equilibrado', 'Equilibrado', 'Passeios e tempo livre'], ['intenso', 'Intenso', 'Ver o máximo possível']]
const ORCAMENTO: [string, string, string][] = [['economico', 'Econômico', '$'], ['conforto', 'Conforto', '$$'], ['luxo', 'Luxo', '$$$']]
const HORARIO: [string, string, string][] = [['cedo', 'Começar cedo', '🌅'], ['tarde', 'Acordar sem pressa', '😴']]
const DESLOC: [string, string, string][] = [['a_pe', 'A pé', '🚶'], ['transporte_publico', 'Metrô e ônibus', '🚇'], ['taxi_app', 'Táxi ou app', '🚕'], ['carro', 'Carro alugado', '🚗']]
const DE_OBJETIVO: Record<string, string> = { cultura: 'cultura', gastronomia: 'gastronomia', compras: 'compras', aventura: 'aventura', vida_noturna: 'vida_noturna', descansar: 'bem_estar', explorar: 'natureza' }

const DICAS: Record<Passo, string> = {
  onde: 'Pode escolher mais de uma cidade, na ordem da viagem. Eu monto o caminho no mapa.',
  quando: 'Toque no dia da ida e depois no da volta. Ainda sem datas? Ela fica salva como ideia.',
  quem: 'Isso me ajuda a sugerir passeios e o ritmo certo para o grupo.',
  estilo: 'Com isso eu monto dias no seu ritmo: quantos passeios, que horas começar e como se deslocar.',
  interesses: 'Escolha o que mais combina com você. Uso isso nas sugestões e no roteiro.',
  reservas: 'Se já tem voo ou hotel, me mande os comprovantes depois que criar: eu leio e organizo tudo.',
}

const Reconhecimento: any = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
const MESES = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro']
const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
const curta = (s: string) => new Date(s + 'T12:00:00').toLocaleDateString('pt-BR', { day: 'numeric', month: 'short' }).replace('.', '')
const nDias = (a: string, b: string) => Math.round((new Date(b + 'T12:00:00').getTime() - new Date(a + 'T12:00:00').getTime()) / 864e5) + 1

function juntar(nomes: string[]) {
  if (nomes.length <= 1) return nomes[0] || ''
  return nomes.slice(0, -1).join(', ') + ' e ' + nomes[nomes.length - 1]
}

export default function NovaViagem() {
  const [aberto, setAberto] = useState<Passo>('onde')
  const [destinos, setDestinos] = useState<Destino[]>([])
  const [inicio, setInicio] = useState<string | null>(null)
  const [fim, setFim] = useState<string | null>(null)
  const [semDatas, setSemDatas] = useState(false)
  const [companhia, setCompanhia] = useState<string | null>(null)
  const [pessoas, setPessoas] = useState(2)
  const [interesses, setInteresses] = useState<string[]>([])
  const [ritmo, setRitmo] = useState<string | null>(null)
  const [orcamento, setOrcamento] = useState<string | null>(null)
  const [horario, setHorario] = useState<string | null>(null)
  const [desloc, setDesloc] = useState<string[]>([])
  const [primeiraVez, setPrimeiraVez] = useState<boolean | null>(null)
  const [imperdivel, setImperdivel] = useState('')
  const [reservas, setReservas] = useState<'tenho' | 'nao' | null>(null)
  const [titulo, setTitulo] = useState('')
  const [tituloMexido, setTituloMexido] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  const [criando, setCriando] = useState(false)

  // interesses já ditos no perfil de viagem entram marcados
  useEffect(() => {
    rest<{ objetivos?: string[]; ritmo?: string; horario?: string; deslocamento?: string[] }[]>('GET', 'perfil_viagem?select=objetivos,ritmo,horario,deslocamento').then((p) => {
      const f = p?.[0]
      const o = (f?.objetivos || []).map((x) => DE_OBJETIVO[x]).filter(Boolean)
      if (o.length) setInteresses((a) => (a.length ? a : Array.from(new Set(o))))
      if (f?.ritmo) setRitmo((r) => r ?? f.ritmo!)
      if (f?.horario) setHorario((h) => h ?? f.horario!)
      if (f?.deslocamento?.length) setDesloc((d) => (d.length ? d : f.deslocamento!.filter((x) => DESLOC.some((y) => y[0] === x))))
    }).catch(() => { /* sem perfil ainda */ })
  }, [])

  useEffect(() => { if (!tituloMexido) setTitulo(juntar(destinos.map((d) => d.nome)).slice(0, 80)) }, [destinos, tituloMexido])

  const resumo: Record<Passo, string> = {
    onde: destinos.length ? juntar(destinos.map((d) => d.nome)) : 'Escolha um destino',
    quando: semDatas ? 'Ainda não sei' : inicio ? (fim ? `${curta(inicio)} – ${curta(fim)} · ${nDias(inicio, fim)} dias` : `${curta(inicio)} – escolha a volta`) : 'Escolha as datas',
    quem: companhia ? (COMPANHIA.find((c) => c[0] === companhia)?.[1] || '') + (companhia === 'amigos' || companhia === 'familia' ? ` · ${pessoas} pessoas` : '') : 'Escolha',
    estilo: ritmo || orcamento ? [RITMO.find((r) => r[0] === ritmo)?.[1], ORCAMENTO.find((o) => o[0] === orcamento)?.[1], HORARIO.find((h) => h[0] === horario)?.[1]].filter(Boolean).join(' · ') : 'Ritmo, orçamento e horários',
    interesses: interesses.length ? INTERESSES.filter((i) => interesses.includes(i[0])).map((i) => i[1]).join(', ') : 'Opcional',
    reservas: reservas === 'tenho' ? 'Já tenho — a Lia lê' : reservas === 'nao' ? 'Ainda não reservei' : 'Opcional',
  }
  const feito: Record<Passo, boolean> = { onde: destinos.length > 0, quando: semDatas || !!(inicio && fim), quem: !!companhia, estilo: !!(ritmo && orcamento), interesses: interesses.length > 0, reservas: !!reservas }

  const proximo = () => {
    const i = PASSOS.indexOf(aberto)
    const falta = PASSOS.slice(i + 1).find((p) => !feito[p]) || PASSOS[Math.min(i + 1, PASSOS.length - 1)]
    setAberto(falta)
  }
  const ultimo = aberto === 'reservas' || PASSOS.every((p) => feito[p] || p === 'interesses' || p === 'reservas' || p === 'estilo')

  function limpar() {
    setDestinos([]); setInicio(null); setFim(null); setSemDatas(false); setCompanhia(null); setPessoas(2); setInteresses([]); setReservas(null); setRitmo(null); setOrcamento(null); setHorario(null); setDesloc([]); setPrimeiraVez(null); setImperdivel('')
    setTituloMexido(false); setErro(null); setAberto('onde')
  }

  async function criar() {
    if (!destinos.length) { setErro('Escolha pelo menos um destino.'); setAberto('onde'); return }
    setCriando(true); setErro(null)
    const nacional = destinos.every((d) => (d.cc || '').toUpperCase() === 'BR')
    const base = {
      titulo: (titulo.trim() || juntar(destinos.map((d) => d.nome))).slice(0, 80),
      destino: destinos.map((d) => d.nome).join(', ').slice(0, 120),
      inicio: semDatas ? null : inicio, fim: semDatas ? null : (fim || inicio),
      tipo: nacional ? 'nacional' : 'internacional', dono_id: userId(),
    }
    const extras = { companhia, pessoas: companhia === 'sozinha' ? 1 : companhia === 'casal' ? 2 : companhia ? pessoas : null, interesses: interesses.length ? interesses : null,
      ritmo, orcamento, horario, deslocamento: desloc.length ? desloc : null, primeira_vez: primeiraVez, imperdivel: imperdivel.trim().slice(0, 300) || null }
    try {
      let criada: ViagemRow
      try { [criada] = await rest<ViagemRow[]>('POST', 'viagens', { ...base, ...extras }, 'return=representation') }
      catch (e) {
        // banco ainda sem as colunas novas: cria só com o básico
        if (!/companhia|pessoas|interesses|ritmo|orcamento|horario|deslocamento|primeira_vez|imperdivel|column/i.test(String((e as Error)?.message))) throw e
        ;[criada] = await rest<ViagemRow[]>('POST', 'viagens', base, 'return=representation')
      }
      const capa = await buscarCapaWikipedia(destinos[0].nome)
      if (capa) { try { await rest('PATCH', `viagens?id=eq.${criada.id}`, { capa_url: capa.url, capa_credito: capa.credito }) } catch { /* segue sem foto */ } }
      if (reservas === 'tenho') { try { sessionStorage.setItem('flow.abrirLia.' + criada.id, 'ler') } catch { /* segue */ } }
      window.location.hash = `#/viagem/${criada.id}`
    } catch (e) { setErro(erroPt(e)); setCriando(false) }
  }

  // ----- Lia preenche -----
  const [pedido, setPedido] = useState('')
  const [fala, setFala] = useState<string | null>(null)
  const [pensando, setPensando] = useState(false)
  const [ouvindo, setOuvindo] = useState(false)
  const rec = useRef<any>(null)
  async function pedirLia(texto: string) {
    const t = texto.trim()
    if (!t || pensando) return
    setPensando(true); setFala(null); setErro(null)
    try {
      const r = await fetch(`${SUPA_URL}/functions/v1/lia-inicio`, {
        method: 'POST',
        headers: { Authorization: 'Bearer ' + (await getToken()), apikey: SUPA_KEY, 'Content-Type': 'application/json' },
        body: JSON.stringify({ preencher: t, atual: { destinos: destinos.map((d) => d.nome), inicio, fim, companhia, pessoas, interesses, ritmo, orcamento, horario, deslocamento: desloc, primeira_vez: primeiraVez, imperdivel } }),
      })
      const d = await r.json().catch(() => ({}))
      if (!r.ok) throw new Error(d?.erro || 'A Lia não respondeu agora.')
      const c = d.campos || {}
      if (Array.isArray(c.destinos) && c.destinos.length) setDestinos(c.destinos.map((x: any) => ({ nome: x.nome, cc: x.pais_codigo })))
      if (c.inicio) { setInicio(c.inicio); setSemDatas(false) }
      if (c.fim) setFim(c.fim)
      if (c.companhia) setCompanhia(c.companhia)
      if (c.pessoas) setPessoas(c.pessoas)
      if (Array.isArray(c.interesses) && c.interesses.length) setInteresses(c.interesses)
      if (c.ritmo) setRitmo(c.ritmo)
      if (c.orcamento) setOrcamento(c.orcamento)
      if (c.horario) setHorario(c.horario)
      if (Array.isArray(c.deslocamento) && c.deslocamento.length) setDesloc(c.deslocamento)
      if (typeof c.primeira_vez === 'boolean') setPrimeiraVez(c.primeira_vez)
      if (c.imperdivel) setImperdivel(c.imperdivel)
      setFala(d.fala || 'Preenchi o que entendi.')
      setPedido('')
      // abre o primeiro cartão que ainda falta
      const f = { onde: !!(c.destinos?.length || destinos.length), quando: !!((c.inicio || inicio) && (c.fim || fim)), quem: !!(c.companhia || companhia) }
      setAberto(!f.onde ? 'onde' : !f.quando ? 'quando' : !f.quem ? 'quem' : !((c.ritmo || ritmo) && (c.orcamento || orcamento)) ? 'estilo' : 'interesses')
    } catch (e) { setFala(e instanceof Error ? e.message : 'Não deu certo agora.') }
    finally { setPensando(false) }
  }
  function ouvir() {
    if (!Reconhecimento) return
    if (ouvindo) { rec.current?.stop(); return }
    const r = new Reconhecimento()
    r.lang = 'pt-BR'; r.interimResults = true; r.continuous = false
    let falado = ''
    r.onresult = (e: any) => { falado = Array.from(e.results as ArrayLike<any>).map((x) => x[0].transcript).join(''); setPedido(falado) }
    r.onend = () => { setOuvindo(false); rec.current = null; if (falado.trim()) void pedirLia(falado) }
    r.onerror = (e: any) => { setOuvindo(false); if (e?.error === 'not-allowed') setFala('Libere o microfone para o site nas configurações do navegador.') }
    rec.current = r; setPedido(''); setOuvindo(true)
    try { r.start() } catch { setOuvindo(false) }
  }

  const cartao = (p: Passo, icone: string, rotulo: string, corpo: React.ReactNode) => {
    const on = aberto === p
    return (
      <section className={'nv-cartao' + (on ? ' on' : '') + (feito[p] ? ' feito' : '')}>
        <button type="button" className="nv-cab" onClick={() => setAberto(p)} aria-expanded={on}>
          <span className="nv-ico" aria-hidden="true">{icone}</span>
          <span className="nv-txt"><small>{rotulo}</small><strong className={feito[p] ? '' : 'vazio'}>{resumo[p]}</strong></span>
          <span className="nv-seta" aria-hidden="true">{feito[p] && !on ? '✓' : on ? '⌄' : '›'}</span>
        </button>
        {on && (
          <div className="nv-corpo">
            <p className="nv-dica"><span className="fim-lia-orbe" aria-hidden="true" />{DICAS[p]}</p>
            {corpo}
          </div>
        )}
      </section>
    )
  }

  return (
    <div className="nv">
      <header className="nv-topo">
        <a className="vm-redondo" href="#/viagens" aria-label="Fechar">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true"><path d="M18 6 6 18M6 6l12 12" /></svg>
        </a>
        <h1>Criar viagem</h1>
        <span style={{ width: 46 }} />
      </header>

      <div className="nv-lista">
        <section className="nv-lia">
          <div className="nv-lia-cab"><span className="fim-lia-orbe" aria-hidden="true" /><strong>Conte para a Lia</strong><span>ela preenche para você</span></div>
          <form className="nv-lia-campo" onSubmit={(e) => { e.preventDefault(); void pedirLia(pedido) }}>
            <input value={pedido} onChange={(e) => setPedido(e.target.value)} maxLength={1500} placeholder={ouvindo ? 'Pode falar…' : 'Ex.: Lisboa e Paris em março, com minha irmã'} aria-label="Conte sua viagem para a Lia" />
            {Reconhecimento && (
              <button type="button" className={'nv-mic' + (ouvindo ? ' ativo' : '')} onClick={ouvir} aria-label={ouvindo ? 'Parar de ouvir' : 'Falar'}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><rect x="9" y="2" width="6" height="12" rx="3" /><path d="M5 10a7 7 0 0 0 14 0M12 17v5" /></svg>
              </button>
            )}
            <button type="submit" className="nv-enviar" disabled={!pedido.trim() || pensando} aria-label="Mandar para a Lia">{pensando ? '…' : '↑'}</button>
          </form>
          {(fala || pensando) && <p className="nv-lia-fala">{pensando ? 'Preenchendo…' : fala}</p>}
        </section>

        {cartao('onde', '🌍', 'Onde?', <Onde destinos={destinos} setDestinos={setDestinos} />)}
        {cartao('quando', '🗓️', 'Quando?', <Quando inicio={inicio} fim={fim} semDatas={semDatas} setInicio={setInicio} setFim={setFim} setSemDatas={setSemDatas} />)}
        {cartao('quem', '👥', 'Quem vai?', (
          <>
            <div className="nv-opcoes4">
              {COMPANHIA.map(([k, n, e]) => (
                <button key={k} type="button" className={'nv-opcao' + (companhia === k ? ' on' : '')} onClick={() => { setCompanhia(k); if (k === 'casal') setPessoas(2); if (k !== 'amigos' && k !== 'familia') setTimeout(proximo, 180) }}>
                  <span aria-hidden="true">{e}</span>{n}
                </button>
              ))}
            </div>
            {(companhia === 'amigos' || companhia === 'familia') && (
              <div className="nv-contador">
                <span>Quantas pessoas, contando você?</span>
                <div>
                  <button type="button" onClick={() => setPessoas((n) => Math.max(2, n - 1))} aria-label="Menos uma">−</button>
                  <strong>{pessoas}</strong>
                  <button type="button" onClick={() => setPessoas((n) => Math.min(30, n + 1))} aria-label="Mais uma">+</button>
                </div>
              </div>
            )}
          </>
        ))}
        {cartao('estilo', '🧭', 'Estilo da viagem', (
          <>
            <div className="nv-grupo">Ritmo</div>
            <div className="nv-opcoes3">
              {RITMO.map(([k, n, d]) => <button key={k} type="button" className={'nv-opcao nv-col' + (ritmo === k ? ' on' : '')} onClick={() => setRitmo(k)}><b>{n}</b><small>{d}</small></button>)}
            </div>
            <div className="nv-grupo">Orçamento</div>
            <div className="nv-opcoes3">
              {ORCAMENTO.map(([k, n, e]) => <button key={k} type="button" className={'nv-opcao nv-col' + (orcamento === k ? ' on' : '')} onClick={() => setOrcamento(k)}><b className="nv-cifrao">{e}</b><small>{n}</small></button>)}
            </div>
            <div className="nv-grupo">Seus dias</div>
            <div className="nv-chips">
              {HORARIO.map(([k, n, e]) => <button key={k} type="button" className={'nv-chip' + (horario === k ? ' on' : '')} onClick={() => setHorario(horario === k ? null : k)}><span aria-hidden="true">{e}</span>{n}</button>)}
            </div>
            <div className="nv-grupo">Como prefere se deslocar</div>
            <div className="nv-chips">
              {DESLOC.map(([k, n, e]) => <button key={k} type="button" className={'nv-chip' + (desloc.includes(k) ? ' on' : '')} onClick={() => setDesloc((a) => (a.includes(k) ? a.filter((x) => x !== k) : [...a, k]))}><span aria-hidden="true">{e}</span>{n}</button>)}
            </div>
            <div className="nv-grupo">É a primeira vez nesse destino?</div>
            <div className="nv-chips">
              <button type="button" className={'nv-chip' + (primeiraVez === true ? ' on' : '')} onClick={() => setPrimeiraVez(primeiraVez === true ? null : true)}>Sim, primeira vez</button>
              <button type="button" className={'nv-chip' + (primeiraVez === false ? ' on' : '')} onClick={() => setPrimeiraVez(primeiraVez === false ? null : false)}>Já conheço</button>
            </div>
            <label className="nv-nome">Algo que não pode faltar? (opcional)
              <input value={imperdivel} maxLength={300} onChange={(e) => setImperdivel(e.target.value)} placeholder="Ex.: ver a Torre Eiffel à noite, jantar de fado" />
            </label>
          </>
        ))}
        {cartao('interesses', '✨', 'Interesses', (
          <div className="nv-chips">
            {INTERESSES.map(([k, n, e]) => (
              <button key={k} type="button" className={'nv-chip' + (interesses.includes(k) ? ' on' : '')} onClick={() => setInteresses((a) => (a.includes(k) ? a.filter((x) => x !== k) : [...a, k]))}>
                <span aria-hidden="true">{e}</span>{n}
              </button>
            ))}
          </div>
        ))}
        {cartao('reservas', '🏨', 'Já tem reservas?', (
          <>
            <div className="nv-opcoes2">
              <button type="button" className={'nv-opcao' + (reservas === 'tenho' ? ' on' : '')} onClick={() => setReservas('tenho')}><span aria-hidden="true">📎</span>Já tenho voo ou hotel</button>
              <button type="button" className={'nv-opcao' + (reservas === 'nao' ? ' on' : '')} onClick={() => setReservas('nao')}><span aria-hidden="true">🔎</span>Ainda não reservei</button>
            </div>
            <label className="nv-nome">Nome da viagem
              <input value={titulo} maxLength={80} onChange={(e) => { setTitulo(e.target.value); setTituloMexido(true) }} placeholder="Ex.: Eurotrip" />
            </label>
          </>
        ))}
        {erro && <p className="nv-erro" role="alert">{erro}</p>}
      </div>

      <footer className="nv-rodape">
        <button type="button" className="nv-limpar" onClick={limpar}>✕ Limpar</button>
        {ultimo
          ? <button type="button" className="nv-proximo" onClick={() => void criar()} disabled={criando || !destinos.length}>{criando ? 'Criando…' : 'Criar viagem ›'}</button>
          : <button type="button" className="nv-proximo" onClick={proximo} disabled={aberto === 'onde' && !destinos.length}>Próximo ›</button>}
      </footer>
    </div>
  )
}

/* ---------- Onde: busca + regiões + populares (vários destinos) ---------- */
function Onde({ destinos, setDestinos }: { destinos: Destino[]; setDestinos: (f: (d: Destino[]) => Destino[]) => void }) {
  const [q, setQ] = useState('')
  const [regiao, setRegiao] = useState('todas')
  const [achados, setAchados] = useState<Destino[]>([])
  useEffect(() => {
    const t = q.trim()
    if (t.length < 2) { setAchados([]); return }
    let vivo = true
    const id = setTimeout(async () => {
      try {
        const r = await fetch(`https://geocoding-api.open-meteo.com/v1/search?count=8&language=pt&format=json&name=${encodeURIComponent(t)}`)
        const d = await r.json()
        const vistos = new Set<string>()
        const l: Destino[] = []
        for (const g of d?.results || []) {
          const k = `${g.name}|${g.country_code}`
          if (vistos.has(k)) continue
          vistos.add(k)
          l.push({ nome: g.name, pais: [g.admin1 && g.admin1 !== g.name ? g.admin1 : null, g.country].filter(Boolean).join(', '), cc: g.country_code })
        }
        if (vivo) setAchados(l)
      } catch { if (vivo) setAchados([]) }
    }, 280)
    return () => { vivo = false; clearTimeout(id) }
  }, [q])
  const tem = (n: string) => destinos.some((d) => d.nome.toLowerCase() === n.toLowerCase())
  const alternar = (d: Destino) => setDestinos((a) => (a.some((x) => x.nome.toLowerCase() === d.nome.toLowerCase()) ? a.filter((x) => x.nome.toLowerCase() !== d.nome.toLowerCase()) : [...a, d].slice(0, 10)))
  const lista: Destino[] = q.trim().length >= 2 ? achados : (POPULARES[regiao] || []).map(([nome, pais, cc]) => ({ nome, pais, cc }))

  return (
    <>
      {destinos.length > 0 && (
        <div className="nv-escolhidos">
          {destinos.map((d, i) => (
            <button key={d.nome} type="button" className="nv-escolhido" onClick={() => alternar(d)} aria-label={`Tirar ${d.nome}`}>
              <b>{i + 1}</b>{bandeira(d.cc)} {d.nome} <span aria-hidden="true">✕</span>
            </button>
          ))}
        </div>
      )}
      <div className="nv-busca">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true"><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></svg>
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar cidade ou país…" aria-label="Buscar destino" />
      </div>
      {q.trim().length < 2 && (
        <div className="nv-regioes">
          {REGIOES.map(([k, n]) => <button key={k} type="button" className={'nv-regiao' + (regiao === k ? ' on' : '')} onClick={() => setRegiao(k)}>{n}</button>)}
        </div>
      )}
      <div className="nv-dest-tit">{q.trim().length >= 2 ? 'Resultados' : '🔥 Destinos populares'}</div>
      <div className="nv-destinos">
        {lista.map((d) => (
          <button key={d.nome + d.cc} type="button" className={'nv-destino' + (tem(d.nome) ? ' on' : '')} onClick={() => { alternar(d); setQ('') }}>
            <span className="nv-bandeira" aria-hidden="true">{bandeira(d.cc)}</span>
            <span className="nv-dest-txt"><strong>{d.nome}</strong><small>{d.pais}</small></span>
            <span className="nv-marca" aria-hidden="true">{tem(d.nome) ? '✓' : '+'}</span>
          </button>
        ))}
        {q.trim().length >= 2 && !lista.length && <p className="nv-vazio">Nada encontrado. Tente outro nome.</p>}
      </div>
    </>
  )
}

/* ---------- Quando: calendário de toque (ida → volta) ---------- */
function Quando({ inicio, fim, semDatas, setInicio, setFim, setSemDatas }: { inicio: string | null; fim: string | null; semDatas: boolean; setInicio: (s: string | null) => void; setFim: (s: string | null) => void; setSemDatas: (b: boolean) => void }) {
  const hoje = iso(new Date())
  const [mes, setMes] = useState(() => { const b = inicio ? new Date(inicio + 'T12:00:00') : new Date(); return new Date(b.getFullYear(), b.getMonth(), 1) })
  useEffect(() => { if (inicio) { const b = new Date(inicio + 'T12:00:00'); setMes(new Date(b.getFullYear(), b.getMonth(), 1)) } }, [inicio])
  const dias = useMemo(() => {
    const ini = new Date(mes.getFullYear(), mes.getMonth(), 1)
    const vazios = ini.getDay()
    const n = new Date(mes.getFullYear(), mes.getMonth() + 1, 0).getDate()
    return [...Array(vazios).fill(null), ...Array.from({ length: n }, (_, k) => iso(new Date(mes.getFullYear(), mes.getMonth(), k + 1)))] as (string | null)[]
  }, [mes])
  const tocar = (d: string) => {
    setSemDatas(false)
    if (!inicio || (inicio && fim) || d < inicio) { setInicio(d); setFim(null) }
    else setFim(d)
  }
  const podeVoltar = mes > new Date(new Date().getFullYear(), new Date().getMonth(), 1)
  return (
    <>
      <div className="nv-semdata">
        <span>Ainda não sei as datas</span>
        <button type="button" role="switch" aria-checked={semDatas} className={'nv-chave' + (semDatas ? ' on' : '')} onClick={() => { setSemDatas(!semDatas); if (!semDatas) { setInicio(null); setFim(null) } }}><i /></button>
      </div>
      {!semDatas && (
        <div className="nv-cal">
          <div className="nv-cal-topo">
            <strong>{MESES[mes.getMonth()][0].toUpperCase() + MESES[mes.getMonth()].slice(1)} de {mes.getFullYear()}</strong>
            <div>
              <button type="button" disabled={!podeVoltar} onClick={() => setMes(new Date(mes.getFullYear(), mes.getMonth() - 1, 1))} aria-label="Mês anterior">‹</button>
              <button type="button" onClick={() => setMes(new Date(mes.getFullYear(), mes.getMonth() + 1, 1))} aria-label="Próximo mês">›</button>
            </div>
          </div>
          <div className="nv-cal-grade">
            {['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb'].map((d) => <span key={d} className="nv-cal-sem">{d}</span>)}
            {dias.map((d, i) => {
              if (!d) return <span key={'v' + i} />
              const passado = d < hoje
              const ponta = d === inicio || d === fim
              const meio = inicio && fim && d > inicio && d < fim
              return (
                <button key={d} type="button" disabled={passado} onClick={() => tocar(d)}
                  className={'nv-dia' + (ponta ? ' ponta' : '') + (meio ? ' meio' : '') + (d === inicio && fim ? ' ini' : '') + (d === fim ? ' fim' : '') + (d === hoje ? ' hoje' : '')}>
                  {Number(d.slice(8))}
                </button>
              )
            })}
          </div>
          <p className="nv-cal-legenda">{!inicio ? 'Toque no dia da ida.' : !fim ? 'Agora toque no dia da volta.' : `${curta(inicio)} – ${curta(fim)} · ${nDias(inicio, fim)} dias`}</p>
        </div>
      )}
    </>
  )
}
