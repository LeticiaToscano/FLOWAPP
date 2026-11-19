/* Conexão com o Supabase do Flow (projeto FLOW TRIP).
   A chave "publishable" é feita para ficar no app: quem protege os dados são as regras (RLS) do banco.
   NUNCA coloque aqui a chave secret / service_role. */
export const SUPA_URL = 'https://hhitkbgzyrfhxstxonej.supabase.co'
export const SUPA_KEY = 'sb_publishable_6RPyLtVK6h_uh2AfQ8hs7g__b-H1uhG'
const SESSION_KEY = 'flow.session'
const MAX_FILE = 20 * 1024 * 1024

export type Sessao = {
  access_token: string
  refresh_token: string
  expires_at: number
  user: { id: string; email?: string } | null
}

function carregar(): Sessao | null {
  try { return JSON.parse(localStorage.getItem(SESSION_KEY) || 'null') } catch { return null }
}

let sessao: Sessao | null = carregar()
const ouvintes = new Set<(s: Sessao | null) => void>()

export const getSessao = () => sessao
export const userId = () => sessao?.user?.id
/** Nome que a pessoa informou no cadastro (fica nos dados do login). */
export const nomeDoCadastro = (): string => String((sessao?.user as { user_metadata?: { nome?: string } } | null)?.user_metadata?.nome || '').trim()
export function setSessao(s: Sessao | null) {
  sessao = s
  if (s) localStorage.setItem(SESSION_KEY, JSON.stringify(s))
  else localStorage.removeItem(SESSION_KEY)
  ouvintes.forEach((f) => f(s))
}
export function onSessao(f: (s: Sessao | null) => void) {
  ouvintes.add(f)
  return () => { ouvintes.delete(f) }
}
export const sessaoDe = (d: any): Sessao => ({
  access_token: d.access_token,
  refresh_token: d.refresh_token,
  expires_at: Math.floor(Date.now() / 1000) + (d.expires_in || 3600),
  user: d.user || null,
})

async function lerResposta(r: Response) {
  const txt = await r.text()
  try { return txt ? JSON.parse(txt) : null } catch { return { message: txt } }
}

export async function authReq(path: string, body?: unknown, opts: { method?: string; token?: string } = {}) {
  const headers: Record<string, string> = { apikey: SUPA_KEY, 'Content-Type': 'application/json' }
  if (opts.token) headers.Authorization = 'Bearer ' + opts.token
  const r = await fetch(`${SUPA_URL}/auth/v1/${path}`, { method: opts.method || 'POST', headers, body: body ? JSON.stringify(body) : undefined })
  const data = await lerResposta(r)
  if (!r.ok) throw new Error((data && (data.msg || data.message || data.error_description || data.error)) || 'Erro ' + r.status)
  return data
}

export async function getToken() {
  if (!sessao) throw new Error('Sessão expirada. Entre de novo.')
  if (sessao.expires_at - 60 < Date.now() / 1000) {
    try {
      const d = await authReq('token?grant_type=refresh_token', { refresh_token: sessao.refresh_token })
      setSessao(sessaoDe(d))
    } catch {
      setSessao(null)
      throw new Error('Sua sessão expirou. Entre de novo.')
    }
  }
  return sessao!.access_token
}

export async function rest<T = any>(method: string, path: string, body?: unknown, prefer?: string): Promise<T> {
  const token = await getToken()
  const headers: Record<string, string> = { apikey: SUPA_KEY, Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' }
  if (prefer) headers.Prefer = prefer
  const r = await fetch(`${SUPA_URL}/rest/v1/${path}`, { method, headers, body: body !== undefined ? JSON.stringify(body) : undefined })
  const data = await lerResposta(r)
  if (!r.ok) throw new Error((data && (data.message || data.hint)) || 'Erro ' + r.status)
  return data as T
}

const caminho = (p: string) => p.split('/').map(encodeURIComponent).join('/')

/** Envia um arquivo para o cofre privado, em <id da viagem>/<arquivo>. */
export async function enviarArquivo(viagemId: string, file: File, prefixo = '') {
  if (file.size > MAX_FILE) throw new Error('Arquivo maior que 20 MB. Mande só as páginas das reservas ou prints delas.')
  const nome = file.name.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^\w.\-]+/g, '_').slice(-80)
  const path = `${viagemId}/${prefixo}${crypto.randomUUID()}-${nome}`
  const token = await getToken()
  const r = await fetch(`${SUPA_URL}/storage/v1/object/comprovantes/${caminho(path)}`, {
    method: 'POST',
    headers: { apikey: SUPA_KEY, Authorization: 'Bearer ' + token, 'Content-Type': file.type || 'application/octet-stream', 'x-upsert': 'false' },
    body: file,
  })
  if (!r.ok) {
    const d = await lerResposta(r)
    throw new Error((d && (d.message || d.error)) || 'Erro ' + r.status)
  }
  return path
}

/** Baixa um arquivo do cofre privado (só funciona para quem participa da viagem). */
export async function baixarArquivo(path: string) {
  const token = await getToken()
  const r = await fetch(`${SUPA_URL}/storage/v1/object/authenticated/comprovantes/${caminho(path)}`, {
    headers: { apikey: SUPA_KEY, Authorization: 'Bearer ' + token },
  })
  if (!r.ok) throw new Error('Não foi possível abrir o arquivo.')
  return r.blob()
}
