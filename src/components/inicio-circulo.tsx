import { useState } from 'react'
import { FLOW_MARK_OURO } from '../lib/marca'

export type ViagemCurta = { id: string; titulo: string; destino: string | null; inicio: string | null }

/** Próximas viagens primeiro (pela data de ida), depois as que já passaram (a mais recente antes). */
export function ordenarViagens<T extends ViagemCurta>(vs: T[]): T[] {
  const hoje = new Date().toISOString().slice(0, 10)
  const proximas = vs.filter((v) => !v.inicio || v.inicio >= hoje).sort((a, b) => (a.inicio || '9999').localeCompare(b.inicio || '9999'))
  const passadas = vs.filter((v) => v.inicio && v.inicio < hoje).sort((a, b) => b.inicio!.localeCompare(a.inicio!))
  return [...proximas, ...passadas]
}

const DATA = new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: 'short' })
const quando = (iso: string | null) => (iso ? DATA.format(new Date(iso + 'T12:00:00')).replace('.', '') : 'Sem data')

/** Dentro do círculo: começar a primeira viagem, ou abrir uma das viagens / criar outra. */
export function CirculoInicio({ viagens, logada, irPara }: { viagens: ViagemCurta[] | null; logada: boolean; irPara: (hash: string) => void }) {
  const [todas, setTodas] = useState(false)
  const lista = viagens ? ordenarViagens(viagens) : []
  const tem = lista.length > 0
  const visiveis = todas ? lista : lista.slice(0, 3)
  return (
    <div className="fim-tunel">
      <span className="fim-marca" aria-hidden="true" dangerouslySetInnerHTML={{ __html: FLOW_MARK_OURO }} />
      {tem ? (
        <>
          <h2>{lista.length > 1 ? 'Suas viagens' : 'Sua próxima viagem'}</h2>
          <div className={'fim-lista' + (todas ? ' fim-lista-todas' : '')}>
            {visiveis.map((v) => (
              <button key={v.id} type="button" className="fim-viagem" onClick={() => irPara(`#/viagem/${v.id}`)}>
                <span className="fim-viagem-nome">{v.titulo}</span>
                <span className="fim-viagem-data">{quando(v.inicio)}</span>
              </button>
            ))}
          </div>
          {lista.length > 3 && (
            <button type="button" className="fim-nova fim-ver" onClick={() => setTodas((t) => !t)}>
              {todas ? 'Mostrar menos' : `Ver todas (${lista.length})`}
            </button>
          )}
          <button type="button" className="fim-nova" onClick={() => irPara('#/nova')}>+ Começar uma nova</button>
        </>
      ) : (
        <>
          <h2>Comece sua<br />viagem</h2>
          <button type="button" className="fim-comecar" onClick={() => irPara(logada ? '#/nova' : '')}>
            {logada ? 'Começar' : 'Entrar e começar'}
          </button>
        </>
      )}
    </div>
  )
}
