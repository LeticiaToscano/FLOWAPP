import { useEffect, useState } from 'react'
import Abertura from './components/Abertura'
import type { Aviso } from './components/comum'
import Entrar from './telas/Entrar'
import NovaSenha from './telas/NovaSenha'
import Viagens from './telas/Viagens'
import Viagem from './telas/Viagem'
import { authReq, getSessao, getToken, onSessao, setSessao, type Sessao } from './lib/supabase'

/* Rotas pelo endereço (#/viagens = círculo, #/minhas = Minhas viagens, #/nova, #/viagem/<id>). O link de confirmação do Supabase volta com
   #access_token=…, que é tratado antes de qualquer rota. */
export default function App() {
  const [sessao, setS] = useState<Sessao | null>(getSessao())
  const [rota, setRota] = useState(window.location.hash)
  const [pronto, setPronto] = useState(false)
  const [recuperando, setRecuperando] = useState(false)
  const [aviso, setAviso] = useState<Aviso>(null)

  useEffect(() => onSessao(setS), [])
  useEffect(() => {
    const f = () => setRota(window.location.hash)
    window.addEventListener('hashchange', f)
    return () => window.removeEventListener('hashchange', f)
  }, [])

  useEffect(() => {
    ;(async () => {
      const hash = window.location.hash
      if (/(^#|&)(error|error_description)=/.test(hash)) {
        history.replaceState(null, '', window.location.pathname)
        setRota('')
        setAviso({ texto: 'O link expirou ou já foi usado. Peça um novo.', erro: true })
      } else if (hash.includes('access_token=')) {
        const hp = new URLSearchParams(hash.slice(1))
        const s: Sessao = {
          access_token: hp.get('access_token') || '',
          refresh_token: hp.get('refresh_token') || '',
          expires_at: Number(hp.get('expires_at')) || Math.floor(Date.now() / 1000) + Number(hp.get('expires_in') || 3600),
          user: null,
        }
        const tipo = hp.get('type')
        history.replaceState(null, '', window.location.pathname)
        setRota('')
        setSessao(s)
        try { setSessao({ ...s, user: await authReq('user', undefined, { method: 'GET', token: s.access_token }) }) } catch { /* segue */ }
        if (tipo === 'recovery') setRecuperando(true)
        else setAviso({ texto: 'E-mail confirmado. Boas-vindas ao Flow!' })
      }
      const atual = getSessao()
      if (atual && !atual.user) {
        try { setSessao({ ...atual, user: await authReq('user', undefined, { method: 'GET', token: await getToken() }) }) } catch { setSessao(null) }
      }
      setPronto(true)
    })()
  }, [])

  let tela
  if (!pronto) tela = <div className="loading tela">Carregando…</div>
  else if (recuperando && sessao) tela = <NovaSenha onPronto={() => { setRecuperando(false); setAviso({ texto: 'Senha alterada.' }) }} />
  else if (!sessao) tela = <Entrar avisoInicial={aviso} />
  else {
    const m = rota.match(/^#\/viagem\/([0-9a-f-]{36})/)
    tela = m ? <Viagem key={m[1]} id={m[1]} /> : <Viagens nova={rota === '#/nova'} lista={rota === '#/minhas'} avisoInicial={aviso} />
  }

  return (
    <>
      <Abertura />
      {tela}
    </>
  )
}
