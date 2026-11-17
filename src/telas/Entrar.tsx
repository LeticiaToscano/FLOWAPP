import { useState } from 'react'
import { AvisoBox, enviar, type Aviso } from '../components/comum'
import { authReq, sessaoDe, setSessao } from '../lib/supabase'
import { campo, erroPt, senhaForte } from '../lib/textos'

type Modo = 'entrar' | 'criar' | 'recuperar'
const voltarPara = () => encodeURIComponent(window.location.origin + '/')

export default function Entrar({ avisoInicial }: { avisoInicial: Aviso }) {
  const [modo, setModo] = useState<Modo>('entrar')
  const [aviso, setAviso] = useState<Aviso>(avisoInicial)
  const erro = (texto: string) => setAviso({ texto, erro: true })
  const trocar = (m: Modo) => { setModo(m); setAviso(null) }

  async function aoEnviar(fd: FormData) {
    const email = campo(fd, 'email')
    if (!email) throw new Error('Informe seu e-mail.')
    if (modo === 'entrar') {
      const d = await authReq('token?grant_type=password', { email, password: fd.get('password') })
      setSessao(sessaoDe(d))
    } else if (modo === 'criar') {
      const password = (fd.get('password') || '').toString()
      if (!senhaForte(password)) throw new Error('password')
      const d = await authReq(`signup?redirect_to=${voltarPara()}`, { email, password })
      if (d?.access_token) { setSessao(sessaoDe(d)); return }
      setModo('entrar')
      setAviso({ texto: `Enviamos um link de confirmação para ${email}. Abra o e-mail e confirme para entrar.` })
    } else {
      await authReq(`recover?redirect_to=${voltarPara()}`, { email })
      setModo('entrar')
      setAviso({ texto: 'Se existir uma conta com este e-mail, enviamos um link para criar uma senha nova.' })
    }
  }

  const titulo = modo === 'entrar' ? 'Entrar' : modo === 'criar' ? 'Criar conta' : 'Enviar link de recuperação'
  return (
    <div className="tela">
      <div className="center">
        <div><div className="brand">Flow</div><p className="muted">O luxo de não se preocupar.</p></div>
        <AvisoBox aviso={aviso} />
        {modo !== 'recuperar' ? (
          <div className="seg" role="tablist" aria-label="Acesso">
            <button type="button" role="tab" aria-selected={modo === 'entrar'} className={modo === 'entrar' ? 'on' : ''} onClick={() => trocar('entrar')}>Entrar</button>
            <button type="button" role="tab" aria-selected={modo === 'criar'} className={modo === 'criar' ? 'on' : ''} onClick={() => trocar('criar')}>Criar conta</button>
          </div>
        ) : (
          <>
            <h1>Recuperar senha</h1>
            <p className="muted">Enviaremos um link para você criar uma senha nova.</p>
          </>
        )}
        <form key={modo} className="stack" noValidate onSubmit={(e) => enviar(e, aoEnviar, erro, erroPt)}>
          <label>E-mail<input name="email" type="email" autoComplete="email" inputMode="email" required /></label>
          {modo !== 'recuperar' && (
            <label>Senha<input name="password" type="password" required autoComplete={modo === 'criar' ? 'new-password' : 'current-password'} /></label>
          )}
          {modo === 'criar' && <p className="hint">Mínimo de 10 caracteres, com maiúscula, minúscula, número e símbolo.</p>}
          <button className="btn primary" type="submit">{titulo}</button>
        </form>
        {modo === 'entrar' && <button type="button" className="link" onClick={() => trocar('recuperar')}>Esqueci minha senha</button>}
        {modo === 'recuperar' && <button type="button" className="link" onClick={() => trocar('entrar')}>Voltar para entrar</button>}
      </div>
    </div>
  )
}
