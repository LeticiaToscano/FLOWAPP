import { useId, type ReactNode } from 'react'
import { LiquidGlassDock, type LiquidGlassDockItem } from './ui/liquid-glass-dock'

/**
 * Menu da viagem no formato da Liquid Glass Dock: uma dock de vidro presa embaixo da tela, com os ícones das abas
 * no formato dos apps do macOS (desenhos do Lucide, licença ISC). A aba aberta ganha um pontinho dourado embaixo,
 * como o app aberto na dock do Mac.
 */

export type AbaDock = 'hoje' | 'roteiro' | 'reservas' | 'documentos' | 'assistente' | 'perfil'

// Desenhos de linha (Lucide), todos na mesma cor: sóbrio, no lugar dos ícones coloridos
const DESENHOS: Record<AbaDock, ReactNode | null> = {
  hoje: (
    <>
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2" /><path d="M12 20v2" /><path d="m4.93 4.93 1.41 1.41" /><path d="m17.66 17.66 1.41 1.41" />
      <path d="M2 12h2" /><path d="M20 12h2" /><path d="m6.34 17.66-1.41 1.41" /><path d="m19.07 4.93-1.41 1.41" />
    </>
  ),
  roteiro: (
    <>
      <path d="M14.106 5.553a2 2 0 0 0 1.788 0l3.659-1.83A1 1 0 0 1 21 4.619v12.764a1 1 0 0 1-.553.894l-4.553 2.277a2 2 0 0 1-1.788 0l-4.212-2.106a2 2 0 0 0-1.788 0l-3.659 1.83A1 1 0 0 1 3 19.381V6.618a1 1 0 0 1 .553-.894l4.553-2.277a2 2 0 0 1 1.788 0z" />
      <path d="M15 5.764v15" /><path d="M9 3.236v15" />
    </>
  ),
  reservas: (
    <>
      <path d="M2 9a3 3 0 0 1 0 6v2a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-2a3 3 0 0 1 0-6V7a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2Z" />
      <path d="M13 5v2" /><path d="M13 17v2" /><path d="M13 11v2" />
    </>
  ),
  documentos: (
    <>
      <path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z" />
      <path d="M14 2v4a2 2 0 0 0 2 2h4" />
      <path d="M10 9H8" /><path d="M16 13H8" /><path d="M16 17H8" />
    </>
  ),
  assistente: null, // a Lia usa a bola dela (ver Orbe abaixo)
  perfil: (
    <>
      <circle cx="12" cy="8" r="5" />
      <path d="M20 21a8 8 0 0 0-16 0" />
    </>
  ),
}

export function MenuDock({ abas, atual, aoEscolher }: { abas: [AbaDock, string][]; atual: string; aoEscolher: (a: AbaDock) => void }) {
  const items: LiquidGlassDockItem[] = abas.map(([k, nome]) => {
    return {
      title: nome,
      icon: <AppIcon ativo={atual === k}>{DESENHOS[k]}</AppIcon>,
      onClick: () => aoEscolher(k),
    }
  })
  return <LiquidGlassDock items={items} label="Navegação da viagem" className="flow-dock" />
}

/**
 * Ícone sóbrio: placa grafite (degradê escuro, borda fina, um brilho suave no canto de cima) com o desenho em linha
 * branca. A aba aberta fica com o desenho e o pontinho em dourado champanhe.
 */
function AppIcon({ ativo, children }: { ativo?: boolean; children: ReactNode }) {
  const id = 'lgd-app-' + useId().replace(/[^a-zA-Z0-9_-]/g, '')
  const tinta = ativo ? '#E2D1A8' : '#F2F2F2'
  return (
    <svg viewBox="0 0 64 64" aria-hidden="true" focusable="false">
      <defs>
        <linearGradient id={id + '-corpo'} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#2A2A2A" />
          <stop offset="1" stopColor="#141414" />
        </linearGradient>
        <linearGradient id={id + '-brilho'} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#fff" stopOpacity="0.22" />
          <stop offset="0.5" stopColor="#fff" stopOpacity="0" />
        </linearGradient>
        <filter id={id + '-sombra'} x="-20%" y="-20%" width="140%" height="140%">
          <feGaussianBlur stdDeviation="1.2" />
        </filter>
      </defs>
      <rect x="6.25" y="8" width="51.5" height="51.5" rx="14" fill="#000" opacity="0.45" filter={`url(#${id}-sombra)`} />
      <rect x="6.25" y="6.25" width="51.5" height="51.5" rx="14" fill={`url(#${id}-corpo)`} />
      <rect x="6.25" y="6.25" width="51.5" height="51.5" rx="14" fill={`url(#${id}-brilho)`} />
      <rect x="6.75" y="6.75" width="50.5" height="50.5" rx="13.5" fill="none" stroke={ativo ? '#E2D1A8' : '#fff'} strokeOpacity={ativo ? 0.45 : 0.14} />
      {children
        ? (
          <g transform="translate(19.4 19.4) scale(1.05)" fill="none" stroke={tinta} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
            {children}
          </g>
        )
        : <Orbe id={id} />}
      {ativo && <circle cx="32" cy="61.6" r="2.1" fill="#E2D1A8" />}
    </svg>
  )
}

/** A bola da Lia em miniatura: anel fino de luz (branco-azulado em cima, azul, roxo embaixo), com um brilho em volta. */
function Orbe({ id }: { id: string }) {
  return (
    <g>
      <defs>
        <linearGradient id={id + '-anel'} x1="0.85" y1="0.1" x2="0.15" y2="0.9">
          <stop offset="0" stopColor="#E8F7FF" />
          <stop offset="0.35" stopColor="#6CB8FF" />
          <stop offset="0.7" stopColor="#6A4BE8" />
          <stop offset="1" stopColor="#3B1E8F" />
        </linearGradient>
        <radialGradient id={id + '-miolo'} cx="0.5" cy="0.5" r="0.5">
          <stop offset="0.7" stopColor="#000" />
          <stop offset="1" stopColor="#1B1440" />
        </radialGradient>
        <filter id={id + '-luz'} x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="1.6" />
        </filter>
      </defs>
      <circle cx="32" cy="32" r="12.5" fill="none" stroke={`url(#${id}-anel)`} strokeWidth="3" opacity="0.7" filter={`url(#${id}-luz)`} />
      <circle cx="32" cy="32" r="12.5" fill={`url(#${id}-miolo)`} stroke={`url(#${id}-anel)`} strokeWidth="1.6" />
    </g>
  )
}
