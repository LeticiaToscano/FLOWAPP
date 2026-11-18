import { useCallback, useEffect, useRef } from 'react'

/**
 * CAPTCHA do Cloudflare Turnstile no login, no cadastro e na recuperação de senha.
 * A chave do site é pública (fica no navegador); a chave secreta fica só no Supabase.
 * Modo "interaction-only": quase sempre ninguém vê nada; só aparece uma caixinha quando o Cloudflare desconfia.
 */
const SITE_KEY: string = (import.meta.env.VITE_TURNSTILE_SITE_KEY as string | undefined) || '0x4AAAAAAGGOrjkhGCWnb50f'

type Turnstile = {
  render: (el: HTMLElement, opts: Record<string, unknown>) => string
  reset: (id: string) => void
  remove: (id: string) => void
}
declare global { interface Window { turnstile?: Turnstile } }

let script: Promise<void> | null = null
function carregarScript(): Promise<void> {
  if (window.turnstile) return Promise.resolve()
  if (script) return script
  script = new Promise((ok, falha) => {
    const s = document.createElement('script')
    s.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit'
    s.async = true
    s.onload = () => ok()
    s.onerror = () => { script = null; falha(new Error('Não foi possível carregar a verificação de segurança. Confira sua internet.')) }
    document.head.appendChild(s)
  })
  return script
}

/** Devolve a div onde o CAPTCHA mora e uma função que entrega um token novo (de uso único) para cada envio. */
export function useCaptcha() {
  const caixa = useRef<HTMLDivElement>(null)
  const id = useRef<string | null>(null)
  const token = useRef<string | null>(null)

  useEffect(() => {
    let vivo = true
    carregarScript().then(() => {
      if (!vivo || !caixa.current || !window.turnstile) return
      id.current = window.turnstile.render(caixa.current, {
        sitekey: SITE_KEY,
        theme: 'dark',
        language: 'pt-br',
        appearance: 'interaction-only',
        callback: (t: string) => { token.current = t },
        'expired-callback': () => { token.current = null },
        'error-callback': () => { token.current = null },
      })
    }).catch(() => { /* o erro aparece quando a pessoa tentar enviar */ })
    return () => {
      vivo = false
      if (id.current && window.turnstile) window.turnstile.remove(id.current)
      id.current = null
    }
  }, [])

  const pegarToken = useCallback(async (): Promise<string> => {
    await carregarScript()
    const ate = Date.now() + 20000
    while (!token.current && Date.now() < ate) await new Promise((r) => setTimeout(r, 250))
    const t = token.current
    if (!t) throw new Error('Confirme a verificação de segurança e tente de novo.')
    // cada token vale uma vez: já pede o próximo
    token.current = null
    if (id.current && window.turnstile) window.turnstile.reset(id.current)
    return t
  }, [])

  return { caixa, pegarToken }
}
