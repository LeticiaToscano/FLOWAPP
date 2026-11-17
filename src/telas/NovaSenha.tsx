import { useState } from 'react'
import { AvisoBox, enviar, type Aviso } from '../components/comum'
import { authReq, getToken } from '../lib/supabase'
import { erroPt, senhaForte } from '../lib/textos'

export default function NovaSenha({ onPronto }: { onPronto: () => void }) {
  const [aviso, setAviso] = useState<Aviso>(null)

  async function salvar(fd: FormData) {
    const password = (fd.get('password') || '').toString()
    if (!senhaForte(password)) throw new Error('password')
    await authReq('user', { password }, { method: 'PUT', token: await getToken() })
    onPronto()
  }

  return (
    <div className="tela">
      <div className="center">
        <div className="brand">Flow</div>
        <h1>Crie uma senha nova</h1>
        <AvisoBox aviso={aviso} />
        <form className="stack" noValidate onSubmit={(e) => enviar(e, salvar, (t) => setAviso({ texto: t, erro: true }), erroPt)}>
          <label>Nova senha<input name="password" type="password" autoComplete="new-password" required /></label>
          <p className="hint">Mínimo de 10 caracteres, com maiúscula, minúscula, número e símbolo.</p>
          <button className="btn primary" type="submit">Salvar senha</button>
        </form>
      </div>
    </div>
  )
}
