import type { FormEvent, ReactNode } from 'react'

export type Aviso = { texto: string; erro?: boolean } | null

export function AvisoBox({ aviso }: { aviso: Aviso }) {
  if (!aviso) return null
  return (
    <div className={'flash ' + (aviso.erro ? 'err' : 'ok')} role={aviso.erro ? 'alert' : 'status'}>
      {aviso.texto}
    </div>
  )
}

const svg = (children: ReactNode, size = 22) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    {children}
  </svg>
)

export const Icone = {
  voltar: () => svg(<path d="M15 5l-7 7 7 7" />),
  hoje: () => svg(<path d="M3 11l9-7 9 7v9a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z" />),
  reservas: () => svg(<><rect x="3" y="6" width="18" height="12" rx="2" /><path d="M15 6v12" /></>),
  roteiro: () => svg(<><path d="M9 4L3 6v14l6-2 6 2 6-2V4l-6 2z" /><path d="M9 4v14M15 6v14" /></>),
  perfil: () => svg(<><circle cx="12" cy="8" r="4" /><path d="M4 21c1.5-4 4.5-6 8-6s6.5 2 8 6" /></>),
  documentos: () => svg(<><path d="M6 3h9l4 4v14H6z" /><path d="M14 3v5h5M9 13h7M9 17h5" /></>),
  assistente: () => svg(<path d="M4 5h16v11H9l-5 4z" />),
  enviar: () => svg(<path d="M4 12l16-8-6 16-2-7z" />, 20),
  cadeado: () => svg(<><rect x="5" y="11" width="14" height="10" rx="2" /><path d="M8 11V8a4 4 0 0 1 8 0v3" /></>, 16),
  aberto: () => svg(<><rect x="5" y="11" width="14" height="10" rx="2" /><path d="M8 11V8a4 4 0 0 1 7.5-2" /></>, 16),
}

/** Envolve um envio de formulário: trava o botão, captura o erro e mostra o aviso. */
export async function enviar(e: FormEvent<HTMLFormElement>, fn: (fd: FormData) => Promise<void>, onErro: (msg: string) => void, traduzir: (e: unknown) => string) {
  e.preventDefault()
  const form = e.currentTarget
  const btn = form.querySelector<HTMLButtonElement>('button[type="submit"]')
  const txt = btn?.textContent || ''
  if (btn) { btn.disabled = true; btn.textContent = 'Aguarde…' }
  try {
    await fn(new FormData(form))
  } catch (err) {
    onErro(traduzir(err))
    window.scrollTo(0, 0)
  } finally {
    if (btn && document.body.contains(btn)) { btn.disabled = false; btn.textContent = txt }
  }
}
