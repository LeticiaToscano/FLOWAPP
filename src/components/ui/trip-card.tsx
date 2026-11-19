import type { ReactNode } from 'react'

/**
 * Card de viagem no formato do HotelCard (adaptado sem framer-motion, lucide e Tailwind):
 * foto à esquerda (em cima no celular), e ao lado um rótulo pequeno, o nome, o destino com alfinete
 * e as datas. O card inteiro é um link; ao passar o mouse ele sobe um pouco e a foto aproxima.
 */
export function TripCard({ href, imagem, imagemAlt, rotulo, titulo, local, rodape }: {
  href: string
  imagem: string
  imagemAlt: string
  rotulo: string
  titulo: string
  local?: string | null
  rodape?: ReactNode
}) {
  return (
    <a className="trip-card" href={href}>
      <div className="trip-card-foto"><img src={imagem} alt={imagemAlt} loading="lazy" decoding="async" /></div>
      <div className="trip-card-info">
        <span className="trip-card-rotulo">{rotulo}</span>
        <h3>{titulo}</h3>
        {local && (
          <div className="trip-card-linha">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M20 10c0 4.993-5.539 10.193-7.399 11.799a1 1 0 0 1-1.202 0C9.539 20.193 4 14.993 4 10a8 8 0 0 1 16 0" /><circle cx="12" cy="10" r="3" /></svg>
            <span>{local}</span>
          </div>
        )}
        {rodape && <div className="trip-card-linha trip-card-rodape">{rodape}</div>}
      </div>
    </a>
  )
}

/** O card de criar viagem, no mesmo formato. */
export function NovaTripCard({ href }: { href: string }) {
  return (
    <a className="trip-card trip-card-nova" href={href}>
      <div className="trip-card-foto trip-card-mais" aria-hidden="true">
        <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"><path d="M12 5v14M5 12h14" /></svg>
      </div>
      <div className="trip-card-info">
        <span className="trip-card-rotulo">Para onde agora?</span>
        <h3>Criar nova viagem</h3>
        <div className="trip-card-linha"><span>Voos, hotéis, roteiro e documentos num só lugar.</span></div>
      </div>
    </a>
  )
}
