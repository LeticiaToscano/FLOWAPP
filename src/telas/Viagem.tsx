import { Fragment, useCallback, useEffect, useRef, useState, type ChangeEvent } from 'react'
import { AvisoBox, enviar, Icone, type Aviso } from '../components/comum'
import { baixarArquivo, enviarArquivo, getToken, nomeDoCadastro, rest, SUPA_KEY, SUPA_URL, userId } from '../lib/supabase'
import { buscarCapaWikipedia } from '../lib/capa'
import { campo, erroPt, MOEDAS, TIPOS, tipoNome } from '../lib/textos'
import { fmtDataLonga, fmtDiaHora, fmtHora, fmtMoeda, FUSOS, fusoNome, hojeISO, localParaUtc, utcParaInput } from '../lib/tempo'
import { capaDa, useCapas, type ViagemRow } from './Viagens'
import { HandoffBeam, createSimulatedVoice, type BeamPhase } from '../components/ui/handoff-beam'
import { ClaudeChatInput } from '../components/ui/claude-style-chat-input'
import { VoicePoweredOrb } from '../components/ui/voice-powered-orb'
import { OrbePensando } from '../components/ui/orbe-pensando'
import { calar, destravarVoz, ehAVez, falar, ligarVoz, novaVez, tocar, vozLigada } from '../lib/voz'

type Row = Record<string, any>
type Aba = 'hoje' | 'reservas' | 'roteiro' | 'documentos' | 'assistente' | 'perfil'
type Msg = { papel: 'eu' | 'assistente'; texto: string }

/** Nome da concierge de IA do Flow (aparece na aba, no chat e nas respostas). */
const NOME_IA = 'Lia'

const vozOuvindo = createSimulatedVoice(11)
const vozFalando = createSimulatedVoice(29)
// Saudações da Lia na tela — o áudio de cada uma tem o mesmo texto (FRASES em supabase/functions/voz-lia)
const SAUDACOES: Record<string, { pre: string; apres: string }> = {
  ola: { pre: 'Oi', apres: '' },
  volta1: { pre: 'Oi de novo', apres: 'Que bom que você voltou. Em que mais posso te ajudar?' },
  volta2: { pre: 'Olha você aqui de novo', apres: 'Pode falar, estou te ouvindo.' },
  volta3: { pre: 'Voltou', apres: 'Ficou faltando alguma coisa da viagem? Me conta.' },
  volta4: { pre: 'Oi', apres: 'Estou aqui de novo pra você. O que vamos resolver agora?' },
}

type Reconhecedor = { lang: string; interimResults: boolean; continuous: boolean; maxAlternatives?: number; start: () => void; stop: () => void; abort?: () => void; onresult: ((e: any) => void) | null; onend: (() => void) | null; onerror: ((e: any) => void) | null }
const Reconhecimento: (new () => Reconhecedor) | undefined = typeof window !== 'undefined' ? ((window as any).SpeechRecognition || (window as any).webkitSpeechRecognition) : undefined

/** Abre um arquivo do cofre numa aba nova (a aba é aberta já no toque, para o navegador não bloquear). */
async function abrirArquivo(path: string, onErro: (t: string) => void) {
  const w = window.open('', '_blank')
  try {
    const url = URL.createObjectURL(await baixarArquivo(path))
    if (w) w.location.href = url
    else window.location.href = url
    setTimeout(() => URL.revokeObjectURL(url), 120000)
  } catch (e) {
    w?.close()
    onErro(erroPt(e))
  }
}

function Status({ r }: { r: Row }) {
  if (r.precisa_revisao) return <span className="chip warn">Revisar</span>
  if (r.status_pagamento === 'pendente') return <span className="chip warn">Falta pagar</span>
  if (r.status_pagamento === 'parcial') return <span className="chip warn">Pago em parte</span>
  return <span className="chip ok">Pago</span>
}

export default function Viagem({ id }: { id: string }) {
  const [viagem, setViagem] = useState<ViagemRow | null>(null)
  const [reservas, setReservas] = useState<Row[]>([])
  const [roteiro, setRoteiro] = useState<Row[]>([])
  const [perfilViagem, setPerfilViagem] = useState<Row | null>(null)
  const [perfil, setPerfil] = useState<Row | null>(null)
  const [aba, setAba] = useState<Aba>('hoje')
  const [resForm, setResForm] = useState<string | null>(null) // 'novo' | id
  const [itemForm, setItemForm] = useState<string | null>(null) // 'novo' | id
  const [historico, setHistorico] = useState<Row[]>([])
  const [aviso, setAviso] = useState<Aviso>(null)
  // Proposta de roteiro da IA: só vira roteiro quando a pessoa confirma
  const [docs, setDocs] = useState<Row[]>([])
  const [docsCarregando, setDocsCarregando] = useState(false)
  const [docsResumo, setDocsResumo] = useState('')
  const [chat, setChat] = useState<Msg[]>([])
  const [chatCarregando, setChatCarregando] = useState(false)
  const [texto, setTexto] = useState('')
  const [ouvindo, setOuvindo] = useState(false)
  const [falando, setFalando] = useState(false)
  const [comVoz, setComVoz] = useState(vozLigada)
  // Modo conversa: ouve, envia sozinho quando a pessoa para de falar, a Lia responde em voz alta e volta a ouvir
  const [conversa, setConversa] = useState(false)
  const [visita, setVisita] = useState('ola')
  useEffect(() => () => { calar(); reconhecedor.current?.abort?.() }, [])
  const conversaRef = useRef(false)
  const textoRef = useRef('')
  const chatRef = useRef<Msg[]>([])
  const silencios = useRef(0)
  const carregandoRef = useRef(false)
  useEffect(() => { textoRef.current = texto }, [texto])
  useEffect(() => { chatRef.current = chat }, [chat])
  const reconhecedor = useRef<Reconhecedor | null>(null)
  useEffect(() => () => reconhecedor.current?.stop(), [])
  const [ia, setIa] = useState<{ carregando: boolean; resumo?: string; itens?: Row[] } | null>(null)
  const capas = useCapas(viagem ? [viagem] : [])

  const ok = (texto: string) => { setAviso({ texto }); window.scrollTo(0, 0) }
  const erro = (texto: string) => { setAviso({ texto, erro: true }); window.scrollTo(0, 0) }

  const recarregar = useCallback(async () => {
    try {
      const [v, res, rot, pv, pf, dc] = await Promise.all([
        rest<ViagemRow[]>('GET', `viagens?id=eq.${id}&select=*`),
        rest<Row[]>('GET', `reservas?viagem_id=eq.${id}&select=*&order=inicio.asc.nullslast`),
        rest<Row[]>('GET', `roteiro_itens?viagem_id=eq.${id}&select=*&order=dia.asc,hora.asc.nullslast,ordem.asc`),
        rest<Row[]>('GET', 'perfil_viagem?select=*'),
        rest<Row[]>('GET', 'perfis?select=*'),
        rest<Row[]>('GET', `documentos_checklist?viagem_id=eq.${id}&viajante_id=eq.${userId()}&select=*&order=criado_em.asc`),
      ])
      if (!v?.[0]) { window.location.hash = '#/viagens'; return }
      setViagem(v[0]); setReservas(res || []); setRoteiro(rot || [])
      let pfl = pf?.[0] || null
      const doCadastro = nomeDoCadastro()
      if (pfl && !pfl.nome && doCadastro) {
        try { await rest('PATCH', `perfis?id=eq.${userId()}`, { nome: doCadastro }); pfl = { ...pfl, nome: doCadastro } } catch { /* tenta de novo depois */ }
      }
      setPerfilViagem(pv?.[0] || null); setPerfil(pfl); setDocs(dc || [])
    } catch (e) { erro(erroPt(e)) }
  }, [id])

  useEffect(() => { recarregar() }, [recarregar])

  function irPara(a: Aba) { if (a === 'assistente' && aba !== 'assistente') void falarOla(); if (a !== 'assistente') pararConversa(); setAba(a); setResForm(null); setItemForm(null); setAviso(null); window.scrollTo(0, 0) }
  async function abrirReserva(rid: string) {
    setAba('reservas'); setResForm(rid); setHistorico([]); setAviso(null); window.scrollTo(0, 0)
    try { setHistorico(await rest<Row[]>('GET', `reserva_historico?reserva_id=eq.${rid}&select=*&order=alterado_em.desc&limit=20`) || []) } catch { /* opcional */ }
  }
  function novaReserva() { setAba('reservas'); setResForm('novo'); setHistorico([]); setAviso(null); window.scrollTo(0, 0) }

  if (!viagem) return <div className="tela loading">Carregando…</div>

  /* ---------------- Hoje ---------------- */
  function Hoje() {
    const agora = Date.now()
    const prox = reservas.filter((r) => r.inicio && new Date(r.inicio).getTime() > agora - 2 * 3600e3)[0]
    const revisar = reservas.filter((r) => r.precisa_revisao)
    const pendentes = reservas.filter((r) => r.status_pagamento !== 'pago')
    const cancel = reservas.filter((r) => {
      if (!r.cancelamento_gratis_ate) return false
      const t = new Date(r.cancelamento_gratis_ate).getTime()
      return t > agora && t - agora < 72 * 3600e3
    })
    const hoje = roteiro.filter((i) => i.dia === hojeISO())

    async function trocarCapa(e: ChangeEvent<HTMLInputElement>) {
      const f = e.target.files?.[0]
      if (!f) return
      try {
        if (!/^image\//.test(f.type)) throw new Error('Escolha uma imagem (JPG, PNG, HEIC ou WEBP).')
        ok('Enviando foto…')
        const path = await enviarArquivo(id, f, 'capa-')
        await rest('PATCH', `viagens?id=eq.${id}`, { capa_path: path })
        await recarregar(); ok('Foto da viagem atualizada.')
      } catch (err) { erro(erroPt(err)) }
    }
    async function buscarFoto() {
      try {
        const c = await buscarCapaWikipedia(viagem!.destino || viagem!.titulo)
        if (!c) { erro('Não encontramos uma foto para este destino. Envie uma foto sua.'); return }
        await rest('PATCH', `viagens?id=eq.${id}`, { capa_url: c.url, capa_credito: c.credito, capa_path: null })
        await recarregar(); ok('Foto do destino atualizada.')
      } catch (err) { erro(erroPt(err)) }
    }

    return (
      <>
        <img className="capa-mini" src={capaDa(viagem!, capas)} alt={`Foto de ${viagem!.destino || viagem!.titulo}`} />
        {!viagem!.capa_path && viagem!.capa_credito && <span className="credito">{viagem!.capa_credito}</span>}
        <p className="muted">{fmtDataLonga(hojeISO())}</p>

        {revisar.map((r) => (
          <button key={'rv' + r.id} type="button" className="card alert" onClick={() => abrirReserva(r.id)}>
            <strong>Revise: {tipoNome(r.tipo)} {r.origem || r.fornecedor || ''}</strong>
            <span className="muted" style={{ color: '#D9CFC6' }}>Há uma informação com dúvida (data, fuso ou local). Confira antes de seguir.</span>
          </button>
        ))}
        {cancel.map((r) => (
          <button key={'cc' + r.id} type="button" className="card alert" onClick={() => abrirReserva(r.id)}>
            <strong>Cancelamento grátis termina em breve</strong>
            <span className="muted" style={{ color: '#D9CFC6' }}>{tipoNome(r.tipo)} {r.fornecedor || r.destino || ''} · até {fmtDiaHora(r.cancelamento_gratis_ate, r.fuso_inicio)}</span>
          </button>
        ))}

        {prox ? (
          <section className="card">
            <div className="row between"><span className="eyebrow">Próximo passo</span><Status r={prox} /></div>
            <strong style={{ fontSize: 16 }}>{tipoNome(prox.tipo)}{prox.fornecedor ? ' · ' + prox.fornecedor : ''}</strong>
            <div className="row between" style={{ alignItems: 'flex-end' }}>
              <div>
                <div className="big">{fmtHora(prox.inicio, prox.fuso_inicio)}</div>
                <div className="muted">{prox.origem || ''}</div>
                <div className="hint">{fmtDiaHora(prox.inicio, prox.fuso_inicio)} · hora de {fusoNome(prox.fuso_inicio)}</div>
              </div>
              {prox.fim && (
                <div style={{ textAlign: 'right' }}>
                  <div className="big">{fmtHora(prox.fim, prox.fuso_fim)}</div>
                  <div className="muted">{prox.destino || ''}</div>
                  <div className="hint">hora de {fusoNome(prox.fuso_fim)}</div>
                </div>
              )}
            </div>
            <div className="grid2">
              {prox.codigo_reserva && <div className="cell"><div className="k">Código da reserva</div><div className="v">{prox.codigo_reserva}</div></div>}
              {prox.numero_bilhete && <div className="cell"><div className="k">Nº do bilhete</div><div className="v">{prox.numero_bilhete}</div></div>}
              {prox.assentos && <div className="cell"><div className="k">Assentos</div><div className="v">{prox.assentos}</div></div>}
              {prox.terminal && <div className="cell"><div className="k">Terminal / estação</div><div className="v">{prox.terminal}</div></div>}
              {prox.bagagem && <div className="cell"><div className="k">Bagagem</div><div className="v">{prox.bagagem}</div></div>}
            </div>
            <div className="row">
              {prox.comprovante_path && <button type="button" className="btn primary" style={{ flex: 1 }} onClick={() => abrirArquivo(prox.comprovante_path, erro)}>Abrir comprovante</button>}
              <button type="button" className="btn" style={{ flex: 1 }} onClick={() => abrirReserva(prox.id)}>Ver detalhes</button>
            </div>
          </section>
        ) : (
          <div className="card empty">
            <strong>Nada marcado ainda</strong>
            <p className="muted">Adicione suas reservas para o Flow montar o seu dia.</p>
            <button type="button" className="btn sm" onClick={novaReserva}>Adicionar reserva</button>
          </div>
        )}

        {hoje.length > 0 && (<><h2>Hoje no roteiro</h2>{hoje.map((i) => <Fragment key={i.id}>{Item({ i })}</Fragment>)}</>)}
        {pendentes.length > 0 && <p className="muted">{pendentes.length} reserva(s) com pagamento pendente. Veja em Reservas.</p>}

        <section className="card">
          <strong>Foto da viagem</strong>
          <p className="hint">Aparece no seu leque de viagens. Use uma foto sua ou a do destino.</p>
          <label>Enviar foto (até 10 MB)<input type="file" accept="image/jpeg,image/png,image/heic,image/webp" onChange={trocarCapa} /></label>
          <button type="button" className="btn sm" onClick={buscarFoto}>Usar foto do destino</button>
        </section>
      </>
    )
  }

  /* ---------------- Reservas ---------------- */
  function Resumo() {
    const porMoeda: Record<string, { total: number; pago: number; falta: number }> = {}
    reservas.forEach((r) => {
      if (r.valor == null) return
      const m = r.moeda || 'BRL'
      const v = Number(r.valor)
      porMoeda[m] = porMoeda[m] || { total: 0, pago: 0, falta: 0 }
      porMoeda[m].total += v
      if (r.status_pagamento === 'pago') porMoeda[m].pago += v
      else porMoeda[m].falta += v
    })
    return (
      <>
        {Object.entries(porMoeda).map(([m, s]) => (
          <section key={m} className="card">
            <div className="grid3">
              <div><div className="hint">Total</div><strong>{fmtMoeda(s.total, m)}</strong></div>
              <div><div className="hint">Pago</div><strong style={{ color: 'var(--blue)' }}>{fmtMoeda(s.pago, m)}</strong></div>
              <div><div className="hint">Falta pagar</div><strong style={{ color: 'var(--coral)' }}>{fmtMoeda(s.falta, m)}</strong></div>
            </div>
          </section>
        ))}
      </>
    )
  }

  function Reservas() {
    if (resForm) return FormReserva()
    return (
      <>
        {Resumo()}
        <button type="button" className="btn primary" onClick={novaReserva}>Adicionar reserva</button>
        {reservas.length ? reservas.map((r) => (
          <button key={r.id} type="button" className="card" onClick={() => abrirReserva(r.id)}>
            <div className="row between"><span className="hint">{tipoNome(r.tipo)}{r.inicio ? ' · ' + fmtDiaHora(r.inicio, r.fuso_inicio) : ''}</span><Status r={r} /></div>
            <strong>{r.origem || r.destino ? [r.origem, r.destino].filter(Boolean).join(' → ') : r.fornecedor || tipoNome(r.tipo)}</strong>
            {r.codigo_reserva && <span className="hint">Código {r.codigo_reserva}</span>}
            {r.cancelamento_gratis_ate && <span className="hint" style={{ color: '#F0C88E' }}>Cancelamento grátis até {fmtDiaHora(r.cancelamento_gratis_ate, r.fuso_inicio)}</span>}
          </button>
        )) : <p className="muted">Nenhuma reserva ainda. Em breve você também poderá encaminhar os e-mails de confirmação para o Flow.</p>}
      </>
    )
  }

  const CAMPOS_HIST: Record<string, string> = { inicio: 'Saída', fim: 'Chegada', origem: 'Origem', destino: 'Destino', terminal: 'Terminal', assentos: 'Assentos', codigo_reserva: 'Código', numero_bilhete: 'Bilhete', valor: 'Valor', status_pagamento: 'Pagamento', fornecedor: 'Empresa' }
  function Historico({ h }: { h: Row }) {
    const mud = Object.keys(CAMPOS_HIST).filter((k) => JSON.stringify(h.antes[k]) !== JSON.stringify(h.depois[k]))
    if (!mud.length) return null
    const fmt = (k: string, v: any, row: Row) => (k === 'inicio' ? fmtDiaHora(v, row.fuso_inicio) : k === 'fim' ? fmtDiaHora(v, row.fuso_fim) : v ?? '—')
    return (
      <div className="hint" style={{ borderTop: '1px solid var(--line)', paddingTop: 8 }}>
        <div>{new Date(h.alterado_em).toLocaleString('pt-BR')}</div>
        {mud.map((k) => (
          <div key={k}>{CAMPOS_HIST[k]}: <s>{String(fmt(k, h.antes[k], h.antes))}</s> → <strong style={{ color: 'var(--text)' }}>{String(fmt(k, h.depois[k], h.depois))}</strong></div>
        ))}
      </div>
    )
  }

  function FormReserva() {
    const novo = resForm === 'novo'
    const r: Row | undefined = novo
      ? { tipo: 'voo', fuso_inicio: 'America/Sao_Paulo', fuso_fim: 'America/Sao_Paulo', moeda: 'BRL', status_pagamento: 'pago', confirmada: true }
      : reservas.find((x) => x.id === resForm)
    if (!r) return null

    async function salvar(fd: FormData) {
      const fi = campo(fd, 'fuso_inicio') || 'America/Sao_Paulo'
      const ff = campo(fd, 'fuso_fim') || fi
      const codigo = campo(fd, 'codigo_reserva')
      const valor = campo(fd, 'valor')
      const body: Row = {
        tipo: campo(fd, 'tipo'), fornecedor: campo(fd, 'fornecedor'),
        codigo_reserva: codigo ? codigo.toUpperCase() : null, numero_bilhete: campo(fd, 'numero_bilhete'),
        origem: campo(fd, 'origem'), destino: campo(fd, 'destino'), terminal: campo(fd, 'terminal'),
        assentos: campo(fd, 'assentos'), bagagem: campo(fd, 'bagagem'),
        inicio: localParaUtc(campo(fd, 'inicio'), fi), fuso_inicio: fi, fim: localParaUtc(campo(fd, 'fim'), ff), fuso_fim: ff,
        valor: valor != null ? Number(valor) : null, moeda: campo(fd, 'moeda'),
        status_pagamento: campo(fd, 'status_pagamento'), vence_em: campo(fd, 'vence_em'),
        cancelamento_gratis_ate: localParaUtc(campo(fd, 'cancelamento_gratis_ate'), fi),
        confirmada: fd.get('confirmada') === 'on',
      }
      if (body.inicio && body.fim && body.fim < body.inicio) throw new Error('A chegada está antes da saída. Confira as datas e os fusos.')
      if (novo) {
        const [criada] = await rest<Row[]>('POST', 'reservas', { ...body, viagem_id: id, fonte: 'manual' }, 'return=representation')
        await recarregar(); setResForm(criada.id); setHistorico([])
        ok('Reserva salva. Agora você pode anexar o comprovante.')
      } else {
        await rest('PATCH', `reservas?id=eq.${resForm}`, { ...body, precisa_revisao: fd.get('precisa_revisao') === 'on' })
        setResForm(null); await recarregar(); ok('Reserva atualizada.')
      }
    }
    async function apagar() {
      if (!confirm('Apagar esta reserva? Esta ação não pode ser desfeita.')) return
      try { await rest('DELETE', `reservas?id=eq.${r!.id}`); setResForm(null); await recarregar(); ok('Reserva apagada.') } catch (e) { erro(erroPt(e)) }
    }
    async function anexar(e: ChangeEvent<HTMLInputElement>) {
      const f = e.target.files?.[0]
      if (!f) return
      try {
        ok('Enviando comprovante…')
        const path = await enviarArquivo(id, f)
        await rest('PATCH', `reservas?id=eq.${r!.id}`, { comprovante_path: path })
        await recarregar(); ok('Comprovante anexado.')
      } catch (err) { erro(erroPt(err)) }
    }

    return (
      <form key={resForm || ''} className="stack" noValidate onSubmit={(e) => enviar(e, salvar, erro, erroPt)}>
        <div className="row between"><h1>{novo ? 'Nova reserva' : 'Reserva'}</h1><button type="button" className="btn sm" onClick={() => setResForm(null)}>Fechar</button></div>
        {!novo && r.precisa_revisao && <div className="flash err">Esta reserva tem informação com dúvida. Confira data, fuso e local e desmarque "Precisa de revisão".</div>}
        <label>Tipo<select name="tipo" defaultValue={r.tipo}>{TIPOS.map(([v, n]) => <option key={v} value={v}>{n}</option>)}</select></label>
        <label>Empresa (companhia, hotel, operadora)<input name="fornecedor" maxLength={120} defaultValue={r.fornecedor || ''} /></label>
        <div className="grid2">
          <label>Código da reserva<input name="codigo_reserva" maxLength={40} defaultValue={r.codigo_reserva || ''} autoCapitalize="characters" /></label>
          <label>Nº do bilhete<input name="numero_bilhete" maxLength={40} defaultValue={r.numero_bilhete || ''} /></label>
        </div>
        <div className="grid2">
          <label>Origem<input name="origem" maxLength={120} defaultValue={r.origem || ''} /></label>
          <label>Destino<input name="destino" maxLength={120} defaultValue={r.destino || ''} /></label>
        </div>
        <label>Saída / início (hora local)<input name="inicio" type="datetime-local" defaultValue={utcParaInput(r.inicio, r.fuso_inicio)} /></label>
        <label>Fuso da saída<select name="fuso_inicio" defaultValue={r.fuso_inicio || 'America/Sao_Paulo'}>{FUSOS.map(([v, n]) => <option key={v} value={v}>{n}</option>)}</select></label>
        <label>Chegada / fim (hora local)<input name="fim" type="datetime-local" defaultValue={utcParaInput(r.fim, r.fuso_fim)} /></label>
        <label>Fuso da chegada<select name="fuso_fim" defaultValue={r.fuso_fim || 'America/Sao_Paulo'}>{FUSOS.map(([v, n]) => <option key={v} value={v}>{n}</option>)}</select></label>
        <div className="grid2">
          <label>Terminal / estação<input name="terminal" maxLength={80} defaultValue={r.terminal || ''} /></label>
          <label>Assentos<input name="assentos" maxLength={80} defaultValue={r.assentos || ''} /></label>
        </div>
        <label>Bagagem<input name="bagagem" maxLength={120} defaultValue={r.bagagem || ''} /></label>
        <div className="grid2">
          <label>Valor<input name="valor" type="number" min="0" step="0.01" inputMode="decimal" defaultValue={r.valor ?? ''} /></label>
          <label>Moeda<select name="moeda" defaultValue={r.moeda || 'BRL'}>{MOEDAS.map((m) => <option key={m} value={m}>{m}</option>)}</select></label>
        </div>
        <div className="grid2">
          <label>Pagamento<select name="status_pagamento" defaultValue={r.status_pagamento}><option value="pago">Pago</option><option value="pendente">Falta pagar</option><option value="parcial">Pago em parte</option></select></label>
          <label>Vence em<input name="vence_em" type="date" defaultValue={r.vence_em || ''} /></label>
        </div>
        <label>Cancelamento grátis até (hora da saída)<input name="cancelamento_gratis_ate" type="datetime-local" defaultValue={utcParaInput(r.cancelamento_gratis_ate, r.fuso_inicio)} /></label>
        <label className="check"><input type="checkbox" name="confirmada" defaultChecked={!!r.confirmada} /> Reserva confirmada</label>
        {!novo && <label className="check"><input type="checkbox" name="precisa_revisao" defaultChecked={!!r.precisa_revisao} /> Precisa de revisão</label>}
        {!novo ? (
          <section className="card">
            <strong>Comprovante</strong>
            {r.comprovante_path
              ? <button type="button" className="btn sm" onClick={() => abrirArquivo(r.comprovante_path, erro)}>Abrir comprovante</button>
              : <span className="muted">Nenhum comprovante anexado.</span>}
            <label>Anexar PDF ou foto (até 10 MB)<input type="file" accept="application/pdf,image/jpeg,image/png,image/heic,image/webp" onChange={anexar} /></label>
          </section>
        ) : <p className="hint">Depois de salvar, você poderá anexar o comprovante.</p>}
        <button className="btn primary" type="submit">{novo ? 'Salvar reserva' : 'Salvar alterações'}</button>
        {!novo && <button type="button" className="btn danger" onClick={apagar}>Apagar reserva</button>}
        {!novo && historico.length > 0 && (
          <section className="card"><strong>Histórico de alterações</strong>{historico.map((h) => <Fragment key={h.id}>{Historico({ h })}</Fragment>)}</section>
        )}
      </form>
    )
  }

  /* ---------------- Roteiro ---------------- */
  function Item({ i }: { i: Row }) {
    async function travar() {
      try { await rest('PATCH', `roteiro_itens?id=eq.${i.id}`, { travado: !i.travado }); await recarregar() } catch (e) { erro(erroPt(e)) }
    }
    return (
      <div className="card item">
        <span className="t">{i.hora ? String(i.hora).slice(0, 5) : '—'}</span>
        <div className="body">
          <strong style={{ fontWeight: 500 }}>{i.titulo}</strong>
          {i.regiao && <span className="hint">{i.regiao}</span>}
          {i.por_que && <span className="hint">{i.por_que}</span>}
        </div>
        <div className="row" style={{ gap: 2 }}>
          <button type="button" className="icon-btn" onClick={travar} aria-pressed={!!i.travado} aria-label={i.travado ? 'Destravar compromisso' : 'Travar compromisso'} style={{ color: i.travado ? 'var(--blue)' : 'var(--muted)' }}>
            {i.travado ? <Icone.cadeado /> : <Icone.aberto />}
          </button>
          <button type="button" className="btn sm" onClick={() => { setAba('roteiro'); setItemForm(i.id); setAviso(null) }}>Editar</button>
        </div>
      </div>
    )
  }


  /** Chama uma função de IA do servidor com o login da pessoa. */
  async function chamarIA<T>(funcao: string, corpo: unknown): Promise<T> {
    const r = await fetch(`${SUPA_URL}/functions/v1/${funcao}`, {
      method: 'POST',
      headers: { Authorization: 'Bearer ' + (await getToken()), apikey: SUPA_KEY, 'Content-Type': 'application/json' },
      body: JSON.stringify(corpo),
    })
    const d = await r.json().catch(() => ({}))
    if (!r.ok) throw new Error(d?.erro || 'A IA não respondeu agora. Tente de novo em instantes.')
    return d as T
  }

  async function verificarDocumentos() {
    destravarVoz()
    setAviso(null); setDocsCarregando(true)
    try {
      const d = await chamarIA<{ resumo: string; itens: Row[] }>('documentos-ia', { viagem_id: id })
      setDocs(d.itens || []); setDocsResumo(d.resumo || '')
      void falar('documentos')
    } catch (e) { erro(e instanceof Error ? e.message : erroPt(e)) } finally { setDocsCarregando(false) }
  }

  const STATUS_DOC: Record<string, [string, string]> = { em_dia: ['Em dia', 'chip ok'], atencao: ['Atenção', 'chip warn'], pendente: ['Pendente', 'chip pend'] }

  function Documentos() {
    const atencao = docs.filter((d) => d.status !== 'em_dia').length
    const verificado = docs.find((d) => d.verificado_em)?.verificado_em
    return (
      <>
        <div>
          <h1>Documentos</h1>
          <p className="muted">{viagem!.destino || 'Defina o destino da viagem'}{viagem!.tipo ? ` · ${viagem!.tipo === 'nacional' ? 'nacional' : 'internacional'}` : ''}</p>
        </div>
        {docsCarregando ? (
          <div className="card ia-card"><strong>Verificando nas fontes oficiais…</strong><span className="hint">A IA consulta Itamaraty, consulados e órgãos de saúde. Leva até 1 minuto.</span></div>
        ) : docs.length ? (
          <>
            <p className="soft">{docsResumo || (atencao ? `Tudo pronto, com ${atencao} ${atencao === 1 ? 'ponto' : 'pontos'} de atenção.` : 'Tudo pronto para viajar.')}</p>
            <ul className="lista-docs">
              {docs.map((d) => {
                const [rot, cls] = STATUS_DOC[d.status] || STATUS_DOC.pendente
                return (
                  <li key={d.id} className="card">
                    <div className="row between"><strong>{d.item}</strong><span className={cls}>{rot}</span></div>
                    {d.detalhe && <span className="soft">{d.detalhe}</span>}
                    <span className="hint">
                      Fonte: {d.fonte_url ? <a href={d.fonte_url} target="_blank" rel="noopener noreferrer">{d.fonte_nome || 'site oficial'}</a> : (d.fonte_nome || '—')}
                      {d.verificado_em ? ` · verificado em ${new Date(d.verificado_em + 'T12:00:00').toLocaleDateString('pt-BR')}` : ''}
                    </span>
                  </li>
                )
              })}
            </ul>
            <button type="button" className="btn" onClick={verificarDocumentos}>Verificar de novo</button>
          </>
        ) : (
          <div className="card">
            <strong>Confira o que você precisa para entrar no destino</strong>
            <span className="soft">Passaporte, visto ou autorização eletrônica, conexões, seguro, vacinas e comprovantes, com a fonte oficial de cada item.</span>
            <button type="button" className="btn primary" onClick={verificarDocumentos}>Verificar meus documentos</button>
          </div>
        )}
        <p className="hint">As regras de entrada mudam. Confirme sempre no site oficial antes de viajar. Guardamos só a nacionalidade e a validade do passaporte, nunca o número. {!perfil?.passaporte_validade && viagem!.tipo !== 'nacional' ? 'Informe a validade do passaporte no Perfil para uma conferência completa.' : ''}</p>
      </>
    )
  }

  const SUGESTOES = ['Que dia e que horas eu chego?', 'Onde está meu bilhete?', 'O que tenho amanhã?', 'Deixa amanhã mais leve']

  /** voz: a Lia responde em voz alta — só no modo "Falar com a Lia" (conversa). Por escrito, responde em texto. */
  async function perguntar(texto: string, voz = false) {
    const t = texto.trim()
    if (!t || carregandoRef.current) return
    const nova: Msg[] = [...chatRef.current, { papel: 'eu', texto: t }]
    reconhecedor.current?.abort?.()
    chatRef.current = nova; carregandoRef.current = true
    setChat(nova); setTexto(''); setChatCarregando(true); setAviso(null)
    destravarVoz()
    const avisoDemora = window.setTimeout(() => { if (!voz) void falar('pensando', true) }, 1800)
    try {
      const d = await chamarIA<{ resposta: string; audio?: string }>('assistente-ia', { viagem_id: id, voz, conversa: conversaRef.current, mensagens: nova.map((m) => ({ papel: m.papel === 'eu' ? 'usuario' : 'assistente', texto: m.texto })) })
      chatRef.current = [...nova, { papel: 'assistente', texto: d.resposta }]
      setChat(chatRef.current)
      carregandoRef.current = false
      if (voz && d.audio) {
        setFalando(true)
        const tocou = await tocar('data:audio/mpeg;base64,' + d.audio, () => { setFalando(false); if (conversaRef.current) ouvir(true) })
        if (!tocou) { setFalando(false); if (conversaRef.current) ouvir(true) }
      } else {
        setFalando(true); setTimeout(() => setFalando(false), 2600)
        if (voz && conversaRef.current) setTimeout(() => ouvir(true), 400)
      }
    } catch (e) {
      chatRef.current = [...nova, { papel: 'assistente', texto: e instanceof Error ? e.message : `A ${NOME_IA} não respondeu agora.` }]
      setChat(chatRef.current)
      if (conversaRef.current) pararConversa()
    } finally {
      window.clearTimeout(avisoDemora)
      setChatCarregando(false); carregandoRef.current = false
      setTimeout(() => document.querySelector('.chat-fim')?.scrollIntoView({ behavior: 'smooth' }), 50)
    }
  }

  /** Toda vez que a pessoa abre a Lia, ela cumprimenta em voz alta com o nome. A primeira vez do dia é a apresentação;
   *  se voltar no mesmo dia, a saudação muda (volta1…volta4, em rodízio), como numa conversa de verdade.
   *  O áudio de cada frase é gerado no servidor uma vez por nome e guardado no aparelho. Se falhar, toca a gravada geral. */
  async function falarOla() {
    destravarVoz()
    calar()
    const minha = novaVez() // se a pessoa sair e entrar de novo antes do áudio chegar, só a última saudação fala
    const hoje = hojeISO()
    let n = 0
    try {
      const v = JSON.parse(localStorage.getItem('flow.lia.visitas') || 'null')
      n = v?.dia === hoje ? (v.n || 0) + 1 : 0
      localStorage.setItem('flow.lia.visitas', JSON.stringify({ dia: hoje, n }))
    } catch { /* segue */ }
    const tipo = n === 0 ? 'ola' : `volta${((n - 1) % 4) + 1}`
    setVisita(tipo)
    if (!vozLigada()) return
    const amanha = new Date(Date.now() + 864e5).toISOString().slice(0, 10)
    if (n === 0 && viagem?.inicio && (viagem.inicio === amanha || viagem.inicio === hoje)) { void falar('boaViagem'); return }
    const nome = primeiroNome()
    if (nome) {
      try {
        const chave = `https://flow.local/voz/${tipo}/${encodeURIComponent(nome)}`
        const cache = 'caches' in window ? await caches.open('flow-voz') : null
        let resp = await cache?.match(chave)
        if (!resp) {
          const r = await fetch(`${SUPA_URL}/functions/v1/voz-lia`, { method: 'POST', headers: { Authorization: 'Bearer ' + (await getToken()), apikey: SUPA_KEY, 'Content-Type': 'application/json' }, body: JSON.stringify({ tipo }) })
          if (r.ok && (r.headers.get('Content-Type') || '').includes('audio')) { resp = r; await cache?.put(chave, r.clone()) }
        }
        if (!ehAVez(minha)) return
        const blob = resp ? await resp.blob() : null
        if (!ehAVez(minha)) return
        if (blob && await tocar(URL.createObjectURL(blob))) return
      } catch { /* cai na saudação gravada */ }
    }
    if (ehAVez(minha)) void falar('ola')
  }
  const primeiroNome = () => String(perfil?.nome || '').trim().split(/\s+/)[0]

  async function salvarNome(fd: FormData) {
    const nome = campo(fd, 'nome')
    if (!nome) throw new Error('Diga como posso te chamar.')
    await rest('PATCH', `perfis?id=eq.${userId()}`, { nome })
    setPerfil((p) => ({ ...(p || {}), nome }))
  }

  function alternarMudo() {
    const v = !comVoz
    ligarVoz(v); setComVoz(v)
    if (v) destravarVoz()
    else { calar(); setFalando(false); if (conversaRef.current) pararConversa() }
  }

  function pararConversa() {
    conversaRef.current = false; setConversa(false); calar(); reconhecedor.current?.stop()
  }
  function alternarConversa() {
    if (conversaRef.current) { pararConversa(); return }
    destravarVoz()
    if (!vozLigada()) { ligarVoz(true); setComVoz(true) }
    conversaRef.current = true; silencios.current = 0; setConversa(true); setTexto('')
    ouvir(true)
  }

  function ouvir(forcar = false) {
    if (!Reconhecimento) return
    if (ouvindo && !forcar) { reconhecedor.current?.stop(); return }
    const antigo = reconhecedor.current
    reconhecedor.current = null
    antigo?.abort?.()
    const r = new Reconhecimento()
    r.lang = 'pt-BR'; r.interimResults = true; r.continuous = false; r.maxAlternatives = 1
    let falado = ''
    const atual = () => reconhecedor.current === r
    r.onresult = (e) => {
      if (!atual()) return
      falado = Array.from(e.results as ArrayLike<any>).map((x) => x[0].transcript).join('')
      setTexto(falado)
    }
    r.onend = () => {
      if (!atual()) return
      setOuvindo(false); reconhecedor.current = null
      // Quando a pessoa para de falar, a pergunta vai sozinha (no modo conversa, a resposta vem em voz)
      if (falado.trim()) { silencios.current = 0; void perguntar(falado, conversaRef.current) }
      // Na ligação, silêncio não encerra de cara: volta a ouvir (até 3 vezes seguidas sem ninguém falar)
      else if (conversaRef.current) { if (++silencios.current < 3) ouvir(true); else pararConversa() }
    }
    r.onerror = (e) => {
      if (!atual()) return
      if (e?.error === 'not-allowed' || e?.error === 'service-not-allowed') erro('Libere o microfone para o site nas configurações do navegador.')
    }
    reconhecedor.current = r
    calar()
    setTexto('')
    setOuvindo(true)
    try { r.start() } catch { reconhecedor.current = null; setOuvindo(false) }
  }

  function Assistente() {
    const usadas = new Set(chat.filter((m) => m.papel === 'eu').map((m) => m.texto))
    const h = new Date().getHours()
    const saudacao = h < 12 ? 'bom dia' : h < 18 ? 'boa tarde' : 'boa noite'
    const nome = primeiroNome()
    const destino = viagem?.destino ? ` para ${viagem.destino}` : ''
    const vazia = !chat.length

    const microfone = Reconhecimento ? (
      <>
      <button type="button" className={'cci-ferr' + (ouvindo && !conversa ? ' ativo' : '')} onClick={(e) => { e.stopPropagation(); if (!conversa) ouvir() }} aria-label={ouvindo ? 'Parar de ouvir' : 'Falar a pergunta'} aria-pressed={ouvindo}>
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 19v3" /><path d="M19 10v2a7 7 0 0 1-14 0v-2" /><rect x="9" y="2" width="6" height="13" rx="3" /></svg>
      </button>
      <button type="button" className={'cci-ferr cci-conversa' + (conversa ? ' ativo' : '')} onClick={(e) => { e.stopPropagation(); alternarConversa() }} aria-pressed={conversa} aria-label={conversa ? 'Encerrar conversa por voz' : 'Conversar por voz com a Lia'}>
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M2 10v3" /><path d="M6 6v11" /><path d="M10 3v18" /><path d="M14 8v7" /><path d="M18 5v13" /><path d="M22 10v3" /></svg>
        <span>{conversa ? 'Encerrar' : 'Falar com a Lia'}</span>
      </button>
      </>
    ) : null

    const caixa = (
      <HandoffBeam
        phase={(chatCarregando ? 'thinking' : falando ? 'speaking' : 'listening') as BeamPhase}
        level={falando ? vozFalando : vozOuvindo}
        palette="ember"
        tone="dark"
        radius={18}
        reach={22}
        phaseLabels={{ idle: 'Pronto', listening: 'Ouvindo', thinking: 'Pensando', speaking: 'Respondendo' }}
        className="composer-beam"
      >
        <ClaudeChatInput
          value={texto}
          onChange={setTexto}
          onSend={() => perguntar(texto)}
          disabled={chatCarregando}
          placeholder={conversa ? (chatCarregando ? 'Pensando…' : falando ? 'Falando…' : 'Pode falar, estou ouvindo…') : ouvindo ? 'Pode falar, estou ouvindo…' : `Como posso ajudar na sua viagem${destino}?`}
          ferramentas={microfone}
        />
      </HandoffBeam>
    )

    const sugestoes = (
      <div className="lia-sugestoes">
        {SUGESTOES.filter((s) => !usadas.has(s)).map((s) => (
          <button key={s} type="button" className="lia-pilula" onClick={() => perguntar(s)} disabled={chatCarregando}>{s}</button>
        ))}
      </div>
    )

    if (vazia) {
      return (
        <div className="lia lia-boas-vindas">
          <button type="button" className="lia-voz" onClick={alternarMudo} aria-pressed={comVoz} aria-label={comVoz ? 'Silenciar a voz da Lia' : 'Ligar a voz da Lia'}>
            {comVoz
              ? <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M11 5 6 9H2v6h4l5 4z" /><path d="M15.5 8.5a5 5 0 0 1 0 7" /><path d="M19 5a10 10 0 0 1 0 14" /></svg>
              : <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M11 5 6 9H2v6h4l5 4z" /><path d="m22 9-6 6M16 9l6 6" /></svg>}
          </button>
          <div className="lia-orbe" aria-hidden="true">
            <VoicePoweredOrb enableVoiceControl={ouvindo || conversa} />
          </div>
          <h1 className="lia-ola">
            {(SAUDACOES[visita] || SAUDACOES.ola).pre}{nome ? ', ' : '!'}
            {nome && (
              <>
                <span className="lia-nome">
                  {nome}
                  <svg className="lia-traco" viewBox="0 0 140 24" fill="none" preserveAspectRatio="none" aria-hidden="true">
                    <path d="M6 16 Q 70 24, 134 14" stroke="currentColor" strokeWidth="3" strokeLinecap="round" fill="none" />
                  </svg>
                </span>!
              </>
            )}
          </h1>
          {!nome && (
            <form className="lia-pede-nome" noValidate onSubmit={(e) => enviar(e, salvarNome, erro, erroPt)}>
              <label htmlFor="lia-nome" className="sr-only">Como posso te chamar?</label>
              <input id="lia-nome" name="nome" placeholder="Como posso te chamar?" maxLength={60} autoComplete="given-name" />
              <button type="submit" className="lia-pilula">Pronto</button>
            </form>
          )}
          <p className="lia-apres">{visita === 'ola' || !SAUDACOES[visita]
            ? <>Que {saudacao}! Eu sou a {NOME_IA}, sua concierge. Conheço suas reservas, seu roteiro e seus documentos{destino}.</>
            : SAUDACOES[visita].apres}</p>
          {caixa}
          {sugestoes}
          <p className="lia-aviso">A {NOME_IA} pode errar. Confira informações importantes. Nada muda na viagem sem o seu sim.</p>
        </div>
      )
    }

    return (
      <div className="lia lia-conversa">
        <div className="lia-topo">
          <div className="lia-orbe-mini" aria-hidden="true"><VoicePoweredOrb enableVoiceControl={ouvindo || conversa} /></div>
          <div>
            <h1>{NOME_IA}</h1>
            <p className="muted">Sua concierge de viagem</p>
          </div>
          <button type="button" className="lia-voz" onClick={alternarMudo} aria-pressed={comVoz} aria-label={comVoz ? 'Silenciar a voz da Lia' : 'Ligar a voz da Lia'}>
            {comVoz
              ? <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M11 5 6 9H2v6h4l5 4z" /><path d="M15.5 8.5a5 5 0 0 1 0 7" /><path d="M19 5a10 10 0 0 1 0 14" /></svg>
              : <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M11 5 6 9H2v6h4l5 4z" /><path d="m22 9-6 6M16 9l6 6" /></svg>}
          </button>
        </div>
        <div className="chat-msgs" aria-live="polite">
          {chat.map((m, n) =>
            m.papel === 'eu'
              ? <div key={n} className="msg minha">{m.texto}</div>
              : (
                <div key={n} className="msg dela lia-resposta">
                  {m.texto.split(/(\s+)/).map((p, i) => (/^\s+$/.test(p) ? p : <span key={i} className="lia-palavra" style={{ animationDelay: `${Math.min(i * 22, 1600)}ms` }}>{p}</span>))}
                </div>
              ),
          )}
          {chatCarregando && <OrbePensando />}
          <div className="chat-fim" />
        </div>
        <div className="chat-doca">
          {sugestoes}
          {caixa}
          <p className="lia-aviso">A {NOME_IA} pode errar. Confira informações importantes.</p>
        </div>
      </div>
    )
  }


  async function pedirRoteiroIA() {
    destravarVoz()
    setAviso(null)
    setIa({ carregando: true })
    try {
      const r = await fetch(`${SUPA_URL}/functions/v1/roteiro-ia`, {
        method: 'POST',
        headers: { Authorization: 'Bearer ' + (await getToken()), apikey: SUPA_KEY, 'Content-Type': 'application/json' },
        body: JSON.stringify({ viagem_id: id }),
      })
      const d = await r.json().catch(() => ({}))
      if (!r.ok) throw new Error(d?.erro || 'A IA não respondeu agora. Tente de novo em instantes.')
      if (!d.itens?.length) throw new Error('A IA não encontrou nada novo para sugerir. Tente de novo mais tarde.')
      setIa({ carregando: false, resumo: d.resumo, itens: d.itens })
      void falar('roteiro')
    } catch (e) {
      setIa(null)
      erro(e instanceof Error ? e.message : erroPt(e))
    }
  }

  async function aplicarRoteiroIA() {
    if (!ia?.itens) return
    try {
      // Troca só as sugestões antigas da IA que não foram travadas; o que a pessoa criou e os travados ficam
      await rest('DELETE', `roteiro_itens?viagem_id=eq.${id}&origem=eq.ia&travado=eq.false`)
      await rest('POST', 'roteiro_itens', ia.itens.map((i) => ({ viagem_id: id, origem: 'ia', travado: false, dia: i.dia, hora: i.hora, titulo: i.titulo, regiao: i.regiao, por_que: i.por_que })), 'return=minimal')
      setIa(null)
      await recarregar()
      ok('Roteiro aplicado. Trave os compromissos que você confirmar.')
    } catch (e) { erro(erroPt(e)) }
  }

  function PropostaIA() {
    if (!ia) return null
    if (ia.carregando) return <div className="card ia-card"><strong>Montando seu roteiro…</strong><span className="hint">A IA está cruzando seu perfil, as reservas e os compromissos travados. Leva uns 30 segundos.</span></div>
    const dias: Record<string, Row[]> = {}
    ;(ia.itens || []).forEach((i) => { (dias[i.dia] = dias[i.dia] || []).push(i) })
    const antigas = roteiro.filter((i) => i.origem === 'ia' && !i.travado).length
    return (
      <div className="stack ia-proposta">
        <div className="card ia-card">
          <strong>Proposta da IA</strong>
          {ia.resumo && <span>{ia.resumo}</span>}
          <span className="hint">
            {(ia.itens || []).length} sugestões em {Object.keys(dias).length} dias.
            {antigas ? ` Vai substituir ${antigas} sugestões antigas da IA.` : ''} Seus itens e os travados não mudam.
          </span>
          <div className="row">
            <button type="button" className="btn primary" onClick={aplicarRoteiroIA}>Aplicar ao roteiro</button>
            <button type="button" className="btn" onClick={() => setIa(null)}>Descartar</button>
          </div>
        </div>
        {Object.keys(dias).sort().map((d) => (
          <div key={d} className="stack">
            <h2 className="day">{fmtDataLonga(d)}</h2>
            {dias[d].map((i, n) => (
              <div key={n} className="card">
                <strong>{i.hora ? `${String(i.hora).slice(0, 5)} · ` : ''}{i.titulo}</strong>
                {i.regiao && <span className="muted">{i.regiao}</span>}
                {i.por_que && <span className="hint">{i.por_que}</span>}
              </div>
            ))}
          </div>
        ))}
      </div>
    )
  }

  function Roteiro() {
    if (itemForm) return FormItem()
    if (ia) return PropostaIA()
    const dias: Record<string, Row[]> = {}
    roteiro.forEach((i) => { (dias[i.dia] = dias[i.dia] || []).push(i) })
    const ordem = Object.keys(dias).sort()
    return (
      <>
        <button type="button" className="btn primary" onClick={pedirRoteiroIA}>Montar roteiro com IA</button>
        <button type="button" className="btn" onClick={() => { setItemForm('novo'); setAviso(null) }}>Adicionar item</button>
        <p className="hint">O cadeado protege compromissos confirmados: com ele fechado, ninguém muda o dia ou a hora sem destravar antes.</p>
        {ordem.length ? ordem.map((d) => (
          <div key={d} className="stack">
            <h2 className="day">{fmtDataLonga(d)}</h2>
            {dias[d].map((i) => <Fragment key={i.id}>{Item({ i })}</Fragment>)}
          </div>
        )) : <p className="muted">Seu roteiro ainda está vazio. Toque em "Montar roteiro com IA" e ela monta os dias a partir do seu perfil e das suas reservas.</p>}
      </>
    )
  }

  function FormItem() {
    const novo = itemForm === 'novo'
    const i: Row | undefined = novo ? { dia: viagem!.inicio || hojeISO(), travado: false } : roteiro.find((x) => x.id === itemForm)
    if (!i) return null
    async function salvar(fd: FormData) {
      const body = { dia: campo(fd, 'dia'), hora: campo(fd, 'hora'), titulo: campo(fd, 'titulo'), regiao: campo(fd, 'regiao'), por_que: campo(fd, 'por_que'), travado: fd.get('travado') === 'on' }
      if (!body.dia || !body.titulo) throw new Error('Preencha o dia e o que vai fazer.')
      // Se o item estava travado e continua travado, o banco recusa mudar dia ou hora (cadeado).
      if (novo) await rest('POST', 'roteiro_itens', { ...body, viagem_id: id, origem: 'usuario' })
      else await rest('PATCH', `roteiro_itens?id=eq.${itemForm}`, body)
      setItemForm(null); await recarregar()
    }
    async function apagar() {
      if (!confirm('Apagar este item do roteiro?')) return
      try { await rest('DELETE', `roteiro_itens?id=eq.${i!.id}`); setItemForm(null); await recarregar() } catch (e) { erro(erroPt(e)) }
    }
    return (
      <form key={itemForm || ''} className="stack" noValidate onSubmit={(e) => enviar(e, salvar, erro, erroPt)}>
        <div className="row between"><h1>{novo ? 'Novo item' : 'Editar item'}</h1><button type="button" className="btn sm" onClick={() => setItemForm(null)}>Fechar</button></div>
        {i.travado && <div className="flash ok">Compromisso travado: para mudar dia ou hora, desmarque o cadeado primeiro.</div>}
        <div className="grid2">
          <label>Dia<input name="dia" type="date" required defaultValue={i.dia} /></label>
          <label>Hora<input name="hora" type="time" defaultValue={i.hora ? String(i.hora).slice(0, 5) : ''} /></label>
        </div>
        <label>O quê<input name="titulo" required maxLength={120} defaultValue={i.titulo || ''} /></label>
        <label>Região / bairro<input name="regiao" maxLength={120} defaultValue={i.regiao || ''} /></label>
        <label>Observação<textarea name="por_que" maxLength={400} defaultValue={i.por_que || ''} /></label>
        <label className="check"><input type="checkbox" name="travado" defaultChecked={!!i.travado} /> Compromisso confirmado (cadeado)</label>
        <button className="btn primary" type="submit">Salvar</button>
        {!novo && <button type="button" className="btn danger" onClick={apagar}>Apagar item</button>}
      </form>
    )
  }

  /* ---------------- Perfil ---------------- */
  const P_OBJ: [string, string][] = [['descansar', 'Descansar'], ['explorar', 'Explorar'], ['gastronomia', 'Gastronomia'], ['compras', 'Compras'], ['aventura', 'Aventura'], ['cultura', 'Cultura'], ['vida_noturna', 'Vida noturna']]
  const P_RITMO: [string, string][] = [['tranquilo', 'Tranquilo'], ['equilibrado', 'Equilibrado'], ['intenso', 'Intenso']]
  const P_HORA: [string, string][] = [['cedo', 'Começo cedo'], ['tarde', 'Prefiro começar mais tarde']]
  const P_DESL: [string, string][] = [['a_pe', 'A pé'], ['transporte_publico', 'Transporte público'], ['carro', 'Carro'], ['taxi_app', 'Táxi ou app']]
  const P_REST: [string, string][] = [['nenhuma', 'Nenhuma'], ['alimentacao', 'Alimentação'], ['mobilidade', 'Mobilidade'], ['altura', 'Medo de altura']]

  function Pilulas({ nome, lista, marcados, multi }: { nome: string; lista: [string, string][]; marcados: string[]; multi: boolean }) {
    return (
      <div className="pills">
        {lista.map(([v, n]) => (
          <label key={v} className="pill">
            <input type={multi ? 'checkbox' : 'radio'} name={nome} value={v} defaultChecked={marcados.includes(v)} />
            <span>{n}</span>
          </label>
        ))}
      </div>
    )
  }

  function Perfil() {
    const p = perfilViagem || {}
    const f = perfil || {}
    async function salvar(fd: FormData) {
      await rest('POST', 'perfil_viagem?on_conflict=usuario_id', {
        usuario_id: userId(),
        objetivos: fd.getAll('objetivos'), ritmo: campo(fd, 'ritmo'), horario: campo(fd, 'horario'),
        deslocamento: fd.getAll('deslocamento'), restricoes: fd.getAll('restricoes'), imperdivel: campo(fd, 'imperdivel'),
        atualizado_em: new Date().toISOString(),
      }, 'resolution=merge-duplicates,return=minimal')
      const nac = (campo(fd, 'nacionalidade') || 'BR').toUpperCase().slice(0, 2)
      await rest('PATCH', `perfis?id=eq.${userId()}`, { nome: campo(fd, 'nome') || null, nacionalidade: nac, passaporte_validade: campo(fd, 'passaporte_validade') })
      await recarregar(); ok('Perfil salvo.')
    }
    return (
      <form className="stack" noValidate onSubmit={(e) => enviar(e, salvar, erro, erroPt)}>
        <h1>Seu perfil de viagem</h1>
        <p className="muted">Destino, datas e quem vai já vêm das suas viagens. Aqui ficam só as suas preferências.</p>
        <label>Como a {NOME_IA} deve te chamar?<input name="nome" maxLength={60} autoComplete="given-name" defaultValue={f.nome || ''} placeholder="Seu nome" /></label>
        <fieldset><legend>O que você mais quer nas viagens?</legend>{Pilulas({ nome: 'objetivos', lista: P_OBJ, marcados: p.objetivos || [], multi: true })}</fieldset>
        <fieldset><legend>Qual o seu ritmo?</legend>{Pilulas({ nome: 'ritmo', lista: P_RITMO, marcados: [p.ritmo], multi: false })}</fieldset>
        <fieldset><legend>Você gosta de acordar cedo?</legend>{Pilulas({ nome: 'horario', lista: P_HORA, marcados: [p.horario], multi: false })}</fieldset>
        <fieldset><legend>Como prefere se deslocar?</legend>{Pilulas({ nome: 'deslocamento', lista: P_DESL, marcados: p.deslocamento || [], multi: true })}</fieldset>
        <fieldset>
          <legend>Alguma restrição?</legend>
          {Pilulas({ nome: 'restricoes', lista: P_REST, marcados: p.restricoes || [], multi: true })}
          <p className="hint">Fica só no seu perfil. Não é mostrado a ninguém do grupo.</p>
        </fieldset>
        <label>Algo imperdível ou que você quer evitar?<textarea name="imperdivel" maxLength={500} defaultValue={p.imperdivel || ''} /></label>
        <h2 style={{ marginTop: 8 }}>Documentos</h2>
        <div className="grid2">
          <label>Nacionalidade<input name="nacionalidade" maxLength={2} defaultValue={f.nacionalidade || 'BR'} autoCapitalize="characters" /></label>
          <label>Validade do passaporte<input name="passaporte_validade" type="date" defaultValue={f.passaporte_validade || ''} /></label>
        </div>
        <p className="hint">O Flow guarda só a validade, nunca o número do passaporte.</p>
        <button className="btn primary" type="submit">Salvar perfil</button>
      </form>
    )
  }

  const conteudo = { hoje: Hoje, reservas: Reservas, roteiro: Roteiro, documentos: Documentos, assistente: Assistente, perfil: Perfil }[aba]
  const abas: [Aba, string][] = [['hoje', 'Hoje'], ['roteiro', 'Roteiro'], ['reservas', 'Reservas'], ['documentos', 'Documentos'], ['assistente', NOME_IA]]

  return (
    <div className="tela">
      <header className="top">
        <a className="icon-btn" href="#/viagens" aria-label="Voltar para minhas viagens"><Icone.voltar /></a>
        <h1>{viagem.titulo}</h1>
        <button type="button" className="icon-btn topo-perfil" onClick={() => irPara('perfil')} aria-label="Seu perfil de viagem" aria-current={aba === 'perfil' ? 'page' : undefined}><Icone.perfil /></button>
      </header>
      <main className="main stack">
        <AvisoBox aviso={aviso} />
        {conteudo()}
      </main>
      <nav className="nav" aria-label="Navegação da viagem">
        <div className="nav-in">
          {abas.map(([k, n]) => {
            const Ic = Icone[k]
            return (
              <button key={k} type="button" onClick={() => irPara(k)} aria-current={aba === k ? 'page' : undefined}>
                <Ic /><span>{n}</span>
              </button>
            )
          })}
        </div>
      </nav>
    </div>
  )
}
