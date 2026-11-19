import { useEffect, useRef, useState } from 'react'
import { enviarArquivo, getToken, nomeDoCadastro, rest, SUPA_KEY, SUPA_URL, userId } from '../lib/supabase'
import { localParaUtc } from '../lib/tempo'
import { tipoNome } from '../lib/textos'
import { regiaoDe } from '../lib/regioes'
import { ClaudeChatInput } from '../components/ui/claude-style-chat-input'
import { VoicePoweredOrb } from '../components/ui/voice-powered-orb'
import { OrbePensando } from '../components/ui/orbe-pensando'

/**
 * A Lia na entrada do app: a pessoa já chega conversando com ela. A Lia entende a viagem, cria a viagem,
 * abre uma existente, ajusta o perfil e lê comprovantes (PDF/print/texto) para montar a viagem inteira.
 * Tudo que muda algo aparece num cartão e só acontece com o toque da pessoa.
 */

type Row = Record<string, any>
type ReservaLida = Row & { tipo: string; inicio_local: string | null; fuso_inicio: string; fim_local: string | null; fuso_fim: string; duvida: string | null }
type Proposta = { reservas: ReservaLida[]; viagem: { destino: string | null; inicio: string | null; fim: string | null }; arquivo: File | null; feita?: string }
type Acao = { acao: string; dados: Row; estado?: 'feita' | 'cancelada' | 'erro'; viagemId?: string }
type Msg = { papel: 'eu' | 'assistente'; texto: string; acoes?: Acao[]; proposta?: Proposta }

const Reconhecimento: any = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition

async function chamar<T>(corpo: unknown): Promise<T> {
  const r = await fetch(`${SUPA_URL}/functions/v1/lia-inicio`, {
    method: 'POST',
    headers: { Authorization: 'Bearer ' + (await getToken()), apikey: SUPA_KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify(corpo),
  })
  const d = await r.json().catch(() => ({}))
  if (!r.ok) throw new Error(d?.erro || 'A Lia não respondeu agora. Tente de novo em instantes.')
  return d as T
}


const quando = (l: string | null) => (l ? new Date(l + ':00').toLocaleString('pt-BR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }) : 'sem data')
const dia = (d?: string | null) => (d ? new Date(d + 'T12:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' }) : '')

export default function LiaInicio() {
  const [chat, setChat] = useState<Msg[]>([])
  const chatRef = useRef<Msg[]>([])
  const [texto, setTexto] = useState('')
  const [carregando, setCarregando] = useState(false)
  const [aviso, setAviso] = useState<string | null>(null)
  const [ouvindo, setOuvindo] = useState(false)
  const [nome, setNome] = useState(() => (nomeDoCadastro() || '').split(' ')[0])
  const viagensRef = useRef<Row[]>([])
  // Viagem criada nesta conversa: as próximas reservas entram nela (não cria outra)
  const viagemDaConversa = useRef<string | null>(null)
  const fim = useRef<HTMLDivElement>(null)

  useEffect(() => {
    rest<Row[]>('GET', `perfis?id=eq.${userId()}&select=nome`).then((p) => { const n = (p[0]?.nome || '').split(' ')[0]; if (n) setNome(n) }).catch(() => {})
    rest<Row[]>('GET', 'viagens?select=id,titulo&limit=50').then((v) => { viagensRef.current = v }).catch(() => {})
  }, [])
  useEffect(() => { fim.current?.scrollIntoView({ behavior: 'smooth', block: 'end' }) }, [chat, carregando])

  const por = (lista: Msg[]) => { chatRef.current = lista; setChat(lista) }

  async function mandar(t: string) {
    const msg = t.trim()
    if (!msg || carregando) return
    if (msg.length > 280 && /(localizador|c[oó]digo da reserva|reserva|booking|check-?in|confirma[cç][aã]o|e-?ticket|bilhete|itiner)/i.test(msg)) { void ler(null, msg); return }
    const nova: Msg[] = [...chatRef.current, { papel: 'eu', texto: msg }]
    por(nova); setTexto(''); setCarregando(true); setAviso(null)
    try {
      const d = await chamar<{ resposta: string; acoes?: Acao[] }>({ mensagens: nova.map((m) => ({ papel: m.papel === 'eu' ? 'usuario' : 'assistente', texto: m.texto })) })
      por([...nova, { papel: 'assistente', texto: d.resposta, acoes: d.acoes?.length ? d.acoes : undefined }])
    } catch (e) {
      por([...nova, { papel: 'assistente', texto: e instanceof Error ? e.message : 'Não consegui responder agora.' }])
    } finally { setCarregando(false) }
  }

  async function ler(arquivo: File | null, colado?: string) {
    if (carregando) return
    const rotulo = arquivo ? `Enviei: ${arquivo.name}` : colado!.slice(0, 280) + (colado!.length > 280 ? '…' : '')
    const nova: Msg[] = [...chatRef.current, { papel: 'eu', texto: rotulo }]
    por(nova); setTexto(''); setCarregando(true); setAviso(null)
    try {
      // O arquivo vai para a pasta pessoal e temporária da pessoa ("entrada"); a função lê e apaga em seguida
      const corpo = arquivo ? { path: await enviarArquivo(userId(), arquivo, 'ler-', 'entrada') } : { texto: colado }
      const d = await chamar<{ resumo: string; reservas: ReservaLida[]; viagem: Proposta['viagem'] }>(corpo)
      const n = d.reservas.length
      const txt = n
        ? `${(d.resumo || `Encontrei ${n} ${n === 1 ? 'reserva' : 'reservas'}`).replace(/[.!]?\s*$/, '.')} ${viagemDaConversa.current ? 'Confira e toque em adicionar que eu coloco na viagem.' : 'Confira e toque em criar que eu monto a viagem com tudo isso.'}`
        : 'Não encontrei uma reserva nesse arquivo. Se puder, mande o PDF ou um print mais nítido.'
      por([...nova, { papel: 'assistente', texto: txt, proposta: n ? { reservas: d.reservas, viagem: d.viagem, arquivo } : undefined }])
    } catch (e) {
      por([...nova, { papel: 'assistente', texto: e instanceof Error ? e.message : 'Não consegui ler agora.' }])
    } finally { setCarregando(false) }
  }

  async function criarViagem(dados: Row): Promise<string> {
    const [v] = await rest<Row[]>('POST', 'viagens', { titulo: dados.titulo, destino: dados.destino || null, inicio: dados.inicio || null, fim: dados.fim || null, tipo: dados.tipo || 'internacional' }, 'return=representation')
    return v.id
  }

  /** Cria a viagem a partir das reservas lidas, guarda o comprovante no cofre da viagem e grava as reservas. */
  async function montarViagem(idx: number) {
    const m = chatRef.current[idx]
    if (!m?.proposta || m.proposta.feita) return
    setCarregando(true); setAviso(null)
    try {
      const p = m.proposta
      const destino = p.viagem.destino || p.reservas.find((r) => r.tipo !== 'hotel')?.destino || p.reservas[0]?.destino || null
      const nacional = regiaoDe(destino) === 'brasil'
      let viagemId = viagemDaConversa.current
      if (!viagemId) {
        viagemId = await criarViagem({ titulo: (destino || 'Nova viagem').replace(/\s*\([A-Z]{3}\)\s*/g, '').slice(0, 80), destino, inicio: p.viagem.inicio, fim: p.viagem.fim, tipo: nacional ? 'nacional' : 'internacional' })
        viagemDaConversa.current = viagemId
      } else {
        // completa só o que estiver vazio na viagem já criada
        try {
          const [v] = await rest<Row[]>('GET', `viagens?id=eq.${viagemId}&select=destino,inicio,fim`)
          const patch: Row = {}
          if (v && !v.destino && destino) patch.destino = destino
          if (v && !v.inicio && p.viagem.inicio) patch.inicio = p.viagem.inicio
          if (v && !v.fim && p.viagem.fim) patch.fim = p.viagem.fim
          if (Object.keys(patch).length) await rest('PATCH', `viagens?id=eq.${viagemId}`, patch, 'return=minimal')
        } catch { /* segue */ }
      }
      let path: string | null = null
      if (p.arquivo) { try { path = await enviarArquivo(viagemId, p.arquivo, 'reserva-') } catch { /* sem comprovante anexado */ } }
      let ok = 0
      for (const r of p.reservas) {
        const body: Row = {
          viagem_id: viagemId, tipo: r.tipo, fornecedor: r.fornecedor, codigo_reserva: r.codigo_reserva, numero_bilhete: r.numero_bilhete,
          origem: r.origem, destino: r.destino, terminal: r.terminal, assentos: r.assentos, bagagem: r.bagagem,
          inicio: localParaUtc(r.inicio_local, r.fuso_inicio), fuso_inicio: r.fuso_inicio, fim: localParaUtc(r.fim_local, r.fuso_fim), fuso_fim: r.fuso_fim,
          valor: r.valor, moeda: r.moeda || (r.valor != null ? 'BRL' : null), vence_em: r.vence_em,
          cancelamento_gratis_ate: localParaUtc(r.cancelamento_gratis_ate_local, r.fuso_inicio),
          confirmada: true, precisa_revisao: !!r.duvida, comprovante_path: path, status_pagamento: r.status_pagamento,
        }
        Object.keys(body).forEach((k) => { if (body[k] == null) delete body[k] })
        try {
          try { await rest('POST', 'reservas', { ...body, fonte: 'ia' }, 'return=minimal') }
          catch (e) { if (/fonte|check constraint|violates/i.test(String(e))) await rest('POST', 'reservas', { ...body, fonte: 'manual' }, 'return=minimal'); else throw e }
          ok++
        } catch { /* segue com as outras */ }
      }
      const lista = [...chatRef.current]
      lista[idx] = { ...m, proposta: { ...p, feita: viagemId } }
      const jaExistia = lista.some((x, i) => i < idx && x.acoes?.some((a) => a.viagemId === viagemId))
      lista.push({ papel: 'assistente', texto: jaExistia ? `Pronto! Coloquei ${ok} ${ok === 1 ? 'reserva' : 'reservas'} na viagem. Vamos abrir? Lá dentro eu continuo te ajudando a montar o roteiro.` : `Pronto! Criei a viagem${destino ? ' para ' + destino.replace(/\s*\([A-Z]{3}\)\s*/g, '') : ''} com ${ok} ${ok === 1 ? 'reserva' : 'reservas'}. Vamos abrir? Lá dentro eu continuo te ajudando a montar o roteiro.`, acoes: [{ acao: 'abrir_viagem', dados: { viagem_id: viagemId } }] })
      por(lista)
    } catch (e) {
      setAviso(e instanceof Error ? e.message : 'Não consegui criar a viagem.')
    } finally { setCarregando(false) }
  }

  function descrever(a: Acao) {
    const d = a.dados
    if (a.acao === 'criar_viagem') return { titulo: `Criar a viagem "${d.titulo}"`, detalhe: [d.destino, d.inicio && `${dia(d.inicio)}${d.fim ? ' → ' + dia(d.fim) : ''}`, d.tipo === 'nacional' ? 'Nacional' : 'Internacional'].filter(Boolean).join(' · ') }
    if (a.acao === 'abrir_viagem') return { titulo: `Abrir ${viagensRef.current.find((v) => v.id === d.viagem_id)?.titulo || 'a viagem'}` }
    if (a.acao === 'atualizar_perfil') return { titulo: 'Atualizar seu perfil', detalhe: Object.entries(d).map(([k, v]) => `${k}: ${Array.isArray(v) ? v.join(', ') : v}`.replace(/_/g, ' ')).join(' · ') }
    return { titulo: a.acao }
  }

  async function responder(idx: number, k: number, sim: boolean) {
    const m = chatRef.current[idx]
    if (!m?.acoes) return
    const marcar = (estado: Acao['estado'], viagemId?: string) => {
      const lista = [...chatRef.current]
      const acoes = [...(lista[idx].acoes || [])]
      acoes[k] = { ...acoes[k], estado, viagemId }
      lista[idx] = { ...lista[idx], acoes }
      por(lista)
    }
    const a = m.acoes[k]
    if (!sim) { marcar('cancelada'); return }
    try {
      if (a.acao === 'abrir_viagem') { window.location.hash = `#/viagem/${a.dados.viagem_id}`; return }
      if (a.acao === 'criar_viagem') {
        const viagemId = await criarViagem(a.dados)
        viagemDaConversa.current = viagemId
        marcar('feita', viagemId)
        por([...chatRef.current, { papel: 'assistente', texto: 'Viagem criada! Se tiver as reservas, mande aqui no clipe que eu coloco tudo nela, ou abra a viagem para continuar.', acoes: [{ acao: 'abrir_viagem', dados: { viagem_id: viagemId } }] }])
        viagensRef.current = [...viagensRef.current, { id: viagemId, titulo: a.dados.titulo }]
        return
      }
      if (a.acao === 'atualizar_perfil') {
        const { nome: novoNome, ...pref } = a.dados
        if (novoNome) { await rest('PATCH', `perfis?id=eq.${userId()}`, { nome: novoNome }); setNome(String(novoNome).split(' ')[0]) }
        if (Object.keys(pref).length) {
          const [atual] = await rest<Row[]>('GET', `perfil_viagem?usuario_id=eq.${userId()}&select=*`).catch(() => [] as Row[])
          await rest('POST', 'perfil_viagem?on_conflict=usuario_id', { usuario_id: userId(), objetivos: atual?.objetivos ?? [], ritmo: atual?.ritmo ?? null, horario: atual?.horario ?? null, deslocamento: atual?.deslocamento ?? [], restricoes: atual?.restricoes ?? [], imperdivel: atual?.imperdivel ?? null, ...pref, atualizado_em: new Date().toISOString() }, 'resolution=merge-duplicates,return=minimal')
        }
        marcar('feita')
      }
    } catch (e) { marcar('erro'); setAviso(e instanceof Error ? e.message : 'Não deu certo agora.') }
  }

  // Ditado: fala e a mensagem vai sozinha quando a pessoa para
  const rec = useRef<any>(null)
  function ouvir() {
    if (!Reconhecimento) return
    if (ouvindo) { rec.current?.stop(); return }
    const r = new Reconhecimento()
    r.lang = 'pt-BR'; r.interimResults = true; r.continuous = false
    let falado = ''
    r.onresult = (e: any) => { falado = Array.from(e.results as ArrayLike<any>).map((x) => x[0].transcript).join(''); setTexto(falado) }
    r.onend = () => { setOuvindo(false); rec.current = null; if (falado.trim()) void mandar(falado) }
    r.onerror = (e: any) => { setOuvindo(false); if (e?.error === 'not-allowed') setAviso('Libere o microfone para o site nas configurações do navegador.') }
    rec.current = r; setTexto(''); setOuvindo(true)
    try { r.start() } catch { setOuvindo(false) }
  }

  const ferramentas = (
    <>
      <label className="cci-ferr cci-clipe" aria-label="Mandar uma reserva (PDF ou foto)" title="Mandar reserva (PDF ou foto)" onClick={(e) => e.stopPropagation()}>
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m21.44 11.05-9.19 9.19a6 6 0 0 1-8.49-8.49l8.57-8.57A4 4 0 1 1 18 8.84l-8.59 8.57a2 2 0 0 1-2.83-2.83l8.49-8.48" /></svg>
        <input type="file" hidden accept="application/pdf,image/jpeg,image/png,image/webp,.eml,.txt" onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ''; if (f) void ler(f) }} />
      </label>
      {Reconhecimento && (
        <button type="button" className={'cci-ferr' + (ouvindo ? ' ativo' : '')} onClick={(e) => { e.stopPropagation(); ouvir() }} aria-label={ouvindo ? 'Parar de ouvir' : 'Falar com a Lia'}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 19v3" /><path d="M19 10v2a7 7 0 0 1-14 0v-2" /><rect x="9" y="2" width="6" height="13" rx="3" /></svg>
        </button>
      )}
    </>
  )

  const vazia = chat.length === 0
  return (
    <div className="lia-inicio">
      <header className="lia-inicio-topo">
        <a className="icon-btn" href="#/viagens" aria-label="Voltar ao início">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m15 18-6-6 6-6" /></svg>
        </a>
        <span className="lia-inicio-marca">Lia · sua concierge</span>
      </header>

      <main className={'lia-inicio-corpo' + (vazia ? ' vazia' : '')}>
        {vazia ? (
          <div className="lia-inicio-ola">
            <div className="lia-inicio-orbe" aria-hidden="true"><VoicePoweredOrb enableVoiceControl={ouvindo} /></div>
            <h1 className="lia-ola">Oi{nome ? `, ${nome}` : ''}! Para onde vamos?</h1>
            <p className="lia-apres">Me conte da sua viagem ou mande suas reservas (PDF, print ou o texto do e-mail) no clipe. Eu monto tudo para você.</p>
          </div>
        ) : (
          <div className="chat-msgs" aria-live="polite">
            {chat.map((m, n) => m.papel === 'eu'
              ? <div key={n} className="msg minha">{m.texto}</div>
              : (
                <div key={n} className="lia-inicio-bloco">
                  <div className="msg dela lia-resposta">{m.texto}</div>
                  {m.proposta && (
                    <div className="lia-propostas">
                      {m.proposta.reservas.map((r, k) => (
                        <div key={k} className={'lia-prop' + (m.proposta!.feita ? ' feita-ok' : '')}>
                          <div className="lia-prop-topo"><span className="chip">{tipoNome(r.tipo)}</span><strong>{r.fornecedor || tipoNome(r.tipo)}</strong>{r.codigo_reserva && <span className="lia-prop-cod">{r.codigo_reserva}</span>}</div>
                          {(r.origem || r.destino) && <div className="lia-prop-linha">{[r.origem, r.destino].filter(Boolean).join(r.tipo === 'hotel' ? ' · ' : ' → ')}</div>}
                          <div className="lia-prop-linha soft">{r.tipo === 'hotel' ? `Check-in ${quando(r.inicio_local)}${r.fim_local ? ` · Check-out ${quando(r.fim_local)}` : ''}` : `${quando(r.inicio_local)}${r.fim_local ? ` → ${quando(r.fim_local)}` : ''}`}</div>
                          {r.duvida && <div className="lia-prop-duvida">Confira: {r.duvida}</div>}
                        </div>
                      ))}
                      {m.proposta.feita
                        ? <span className="lia-prop-ok">Feito ✓</span>
                        : <button type="button" className="btn primary lia-prop-todas" disabled={carregando} onClick={() => void montarViagem(n)}>{viagemDaConversa.current ? 'Adicionar à viagem' : `Criar a viagem com ${m.proposta.reservas.length === 1 ? 'esta reserva' : `estas ${m.proposta.reservas.length} reservas`}`}</button>}
                    </div>
                  )}
                  {m.acoes && (
                    <div className="lia-propostas">
                      {m.acoes.map((a, k) => {
                        const dsc = descrever(a)
                        return (
                          <div key={k} className={'lia-prop' + (a.estado === 'feita' ? ' feita-ok' : a.estado === 'cancelada' ? ' feita-ignorada' : '')}>
                            <div className="lia-prop-topo"><strong>{dsc.titulo}</strong></div>
                            {dsc.detalhe && <div className="lia-prop-linha soft">{dsc.detalhe}</div>}
                            <div className="lia-prop-acoes">
                              {a.estado === 'feita' ? <span className="lia-prop-ok">Feito ✓</span>
                                : a.estado === 'cancelada' ? <span className="soft">Cancelado</span>
                                  : <>
                                    <button type="button" className="btn sm primary" onClick={() => void responder(n, k, true)}>{a.acao === 'abrir_viagem' ? 'Abrir viagem' : a.estado === 'erro' ? 'Tentar de novo' : 'Confirmar'}</button>
                                    {a.acao !== 'abrir_viagem' && <button type="button" className="btn sm ghost" onClick={() => void responder(n, k, false)}>Cancelar</button>}
                                  </>}
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  )}
                </div>
              ))}
            {carregando && <div className="lia-pensando"><OrbePensando tamanho={64} /></div>}
            <div ref={fim} />
          </div>
        )}
      </main>

      <div className="lia-inicio-doca">
        {aviso && <p className="lia-inicio-aviso" role="alert">{aviso}</p>}
        <ClaudeChatInput value={texto} onChange={setTexto} onSend={() => void mandar(texto)} disabled={carregando} placeholder={ouvindo ? 'Pode falar, estou ouvindo…' : 'Ex.: Vou para Lisboa em dezembro…'} ferramentas={ferramentas} />
        <p className="lia-inicio-nota">A Lia pode errar. Nada muda sem o seu toque.</p>
      </div>
    </div>
  )
}
