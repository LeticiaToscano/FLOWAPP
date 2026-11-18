import { useEffect, useState, type FormEvent } from 'react'
import { AvisoBox, enviar, type Aviso } from '../components/comum'
import { SignInPage } from '../components/ui/sign-in-page'
import { SignUpPage } from '../components/ui/sign-up-page'
import { authReq, sessaoDe, setSessao } from '../lib/supabase'
import { campo, erroPt, senhaForte } from '../lib/textos'
import { LOGO_OURO } from '../lib/marca'
import { useCaptcha } from '../lib/captcha'

type Modo = 'entrar' | 'criar' | 'recuperar'
const voltarPara = () => encodeURIComponent(window.location.origin + '/')

/** Foto da coluna da direita (Unsplash, uso livre): jato executivo na pista ao pôr do sol. Original de 4096 px, recortado
 *  em retrato com foco no avião e em alta resolução para telas retina. */
const FOTO = 'https://images.unsplash.com/photo-1474302770737-173ee21bab63?w=2000&h=2440&fit=crop&crop=focalpoint&fp-x=0.6&fp-y=0.55&q=85&auto=format'

/** O "f" dourado e FLOW, em cima do título. */
function Marca() {
  return (
    <span className="flow-sip-marca">
      <img src={LOGO_OURO} alt="" width={56} height={57} />
      <span>FLOW</span>
    </span>
  )
}

export default function Entrar({ avisoInicial }: { avisoInicial: Aviso }) {
  const [modo, setModo] = useState<Modo>('entrar')
  const [aviso, setAviso] = useState<Aviso>(avisoInicial)
  const { caixa, pegarToken } = useCaptcha()
  const erro = (texto: string) => setAviso({ texto, erro: true })
  const trocar = (m: Modo) => { setModo(m); setAviso(null); window.scrollTo(0, 0) }

  // No login o aviso aparece embaixo, como um recado, e some sozinho
  useEffect(() => {
    if (!aviso || modo !== 'entrar') return
    const t = setTimeout(() => setAviso(null), 6000)
    return () => clearTimeout(t)
  }, [aviso, modo])

  async function aoEnviar(fd: FormData) {
    const email = campo(fd, 'email')
    if (!email) throw new Error('Informe seu e-mail.')
    const seguranca = { gotrue_meta_security: { captcha_token: await pegarToken() } }
    if (modo === 'entrar') {
      const d = await authReq('token?grant_type=password', { email, password: fd.get('password'), ...seguranca })
      setSessao(sessaoDe(d))
    } else if (modo === 'criar') {
      const password = (fd.get('password') || '').toString()
      if (!senhaForte(password)) throw new Error('password')
      const d = await authReq(`signup?redirect_to=${voltarPara()}`, { email, password, ...seguranca })
      if (d?.access_token) { setSessao(sessaoDe(d)); return }
      setModo('entrar')
      setAviso({ texto: `Enviamos um link de confirmação para ${email}. Abra o e-mail e confirme para entrar.` })
    } else {
      await authReq(`recover?redirect_to=${voltarPara()}`, { email, ...seguranca })
      setModo('entrar')
      setAviso({ texto: 'Se existir uma conta com este e-mail, enviamos um link para criar uma senha nova.' })
    }
  }
  const aoSubmeter = (e: FormEvent<HTMLFormElement>) => enviar(e, aoEnviar, erro, erroPt)

  const pagina = modo !== 'entrar' ? (
    <SignUpPage
      key={modo}
      className="flow-sip"
      theme="dark"
      modo={modo}
      heroImageSrc={FOTO}
      title={<><Marca /><span className="sip-title__light">{modo === 'criar' ? 'Criar conta' : 'Recuperar senha'}</span></>}
      aviso={<AvisoBox aviso={aviso} />}
      onSubmit={aoSubmeter}
      onSignIn={() => trocar('entrar')}
    />
  ) : (
    <SignInPage
      className="flow-sip"
      theme="dark"
      heroImageSrc={FOTO}
      title={<><Marca /><span className="sip-title__light">Boas-vindas</span></>}
      description="O luxo de não se preocupar. Entre e continue de onde parou."
      onSignIn={aoSubmeter}
      onGoogleSignIn={() => setAviso({ texto: 'O login com Google chega em breve. Por enquanto, entre com e-mail e senha.' })}
      onResetPassword={() => trocar('recuperar')}
      onCreateAccount={() => trocar('criar')}
    />
  )

  return (
    <>
      {pagina}
      {/* uma caixa só para o CAPTCHA, fora das telas, para ele não ser recriado a cada troca */}
      <div ref={caixa} className="flow-captcha" />
      {aviso && modo === 'entrar' && <div className="flow-sip-recado"><AvisoBox aviso={aviso} /></div>}
    </>
  )
}
