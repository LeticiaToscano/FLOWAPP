/**
 * Voz da Lia: falas gravadas com uma voz natural em português do Brasil (Higgsfield / ElevenLabs, voz "Marisol").
 * Um único elemento de áudio é reaproveitado e "destravado" no primeiro toque, para os navegadores de celular
 * deixarem tocar depois, quando a resposta da IA chega sem um toque da pessoa.
 * A pessoa pode silenciar a Lia; a escolha fica salva no aparelho.
 */
const CDN = 'https://d8j0ntlcm91z4.cloudfront.net/user_3Hrjdnb6LBzJK6SYxcNE6VQdZEf/'
export const FALAS = {
  ola: CDN + 'hf_20261118_200530_9b92fc57-c0e5-4cd1-8a2d-31bc10580101.mp3', // "Oi! Que bom te ver por aqui. Eu sou a Lia…"
  pensando: CDN + 'hf_20261118_200530_a2c006b3-d47c-4082-8d67-d2e2b7c9f23c.mp3', // "Só um instante, estou verificando para você."
  roteiro: CDN + 'hf_20261118_200530_032c9f61-d511-4f6c-881c-27f67c642ec7.mp3', // "Pronto! Montei seu roteiro…"
  documentos: CDN + 'hf_20261118_200703_a8e2d753-50bb-4e67-bc42-0da5fd78e4eb.mp3', // "Pronto! Já conferi seus documentos…"
  boaViagem: CDN + 'hf_20261118_200531_c6fe9f17-51c4-44ce-801b-e61f4f44e867.mp3', // "Boa viagem! Qualquer coisa, é só me chamar."
} as const
export type Fala = keyof typeof FALAS

let audio: HTMLAudioElement | null = null
const el = () => (audio ??= Object.assign(new Audio(), { preload: 'auto' }))

// Uma voz por vez: cada pedido novo de fala cancela o anterior (mesmo que ainda esteja carregando),
// e se o Flow estiver aberto em outra aba/janela, a voz de lá para quando esta começa a falar.
let vez = 0
export const novaVez = () => ++vez
export const ehAVez = (n: number) => n === vez
const canal = typeof BroadcastChannel !== 'undefined' ? new BroadcastChannel('flow-voz') : null
if (canal) canal.onmessage = () => { vez++; if (audio) { audio.onended = null; audio.pause() } }
const avisarOutras = () => { try { canal?.postMessage('falando') } catch { /* segue */ } }
// Saiu do app (trocou de aba, minimizou, bloqueou a tela): a Lia para de falar
if (typeof document !== 'undefined') document.addEventListener('visibilitychange', () => { if (document.hidden) calar() })

export const vozLigada = () => { try { return localStorage.getItem('flow.voz') !== 'off' } catch { return true } }
export function ligarVoz(sim: boolean) {
  try { localStorage.setItem('flow.voz', sim ? 'on' : 'off') } catch { /* sem armazenamento */ }
  if (!sim) audio?.pause()
}

/** Chamar dentro de um toque: libera o áudio para as falas que vêm depois sem toque. */
export function destravarVoz() {
  const a = el()
  if (a.dataset.livre) return
  a.muted = true
  a.src = FALAS.ola
  a.play().then(() => { a.pause(); a.currentTime = 0; a.muted = false; a.dataset.livre = '1' }).catch(() => { a.muted = false })
}

/** Toca um áudio qualquer (ex.: a saudação com o nome, gerada no servidor). */
export async function tocar(url: string, aoTerminar?: () => void): Promise<boolean> {
  if (!vozLigada()) return false
  const a = el()
  avisarOutras()
  a.onended = aoTerminar ? () => { a.onended = null; aoTerminar() } : null
  try { a.pause(); a.muted = false; a.src = url; a.currentTime = 0; await a.play(); return true } catch { a.onended = null; return false }
}

/** Para qualquer fala em andamento. */
export function calar() { vez++; if (audio) { audio.onended = null; audio.pause() } }

/** Toca uma fala. `umaVez` = só uma vez por sessão. Devolve false se não tocou. */
export async function falar(f: Fala, umaVez = false): Promise<boolean> {
  if (!vozLigada()) return false
  const chave = 'flow.voz.' + f
  try { if (umaVez && sessionStorage.getItem(chave)) return false } catch { /* segue */ }
  const a = el()
  avisarOutras()
  try {
    a.pause()
    a.muted = false
    a.src = FALAS[f]
    a.currentTime = 0
    await a.play()
    try { if (umaVez) sessionStorage.setItem(chave, '1') } catch { /* segue */ }
    return true
  } catch { return false }
}
