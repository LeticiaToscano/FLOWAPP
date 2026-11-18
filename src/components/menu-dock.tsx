import { useId, type ReactNode } from 'react'
import { LiquidGlassDock, type LiquidGlassDockItem } from './ui/liquid-glass-dock'

/**
 * Menu da viagem no formato da Liquid Glass Dock: uma dock de vidro presa embaixo da tela, com os ícones das abas
 * no formato dos apps do macOS (desenhos do Lucide, licença ISC). A aba aberta ganha um pontinho dourado embaixo,
 * como o app aberto na dock do Mac.
 */

export type AbaDock = 'hoje' | 'roteiro' | 'reservas' | 'documentos' | 'assistente'

const DESENHOS: Record<AbaDock, { from: string; to: string; ink?: string; desenho: ReactNode }> = {
  hoje: {
    from: '#7cc4ff', to: '#2f6fe0',
    desenho: (
      <>
        <circle cx="12" cy="12" r="4" fill="#fff" />
        <path d="M12 2v2" /><path d="M12 20v2" /><path d="m4.93 4.93 1.41 1.41" /><path d="m17.66 17.66 1.41 1.41" />
        <path d="M2 12h2" /><path d="M20 12h2" /><path d="m6.34 17.66-1.41 1.41" /><path d="m19.07 4.93-1.41 1.41" />
      </>
    ),
  },
  roteiro: {
    from: '#5ee9d3', to: '#0b8f84',
    desenho: (
      <>
        <path d="M20 10c0 4.993-5.539 10.193-7.399 11.799a1 1 0 0 1-1.202 0C9.539 20.193 4 14.993 4 10a8 8 0 0 1 16 0" fill="#fff" />
        <circle cx="12" cy="10" r="3" fill="#0e9a8d" stroke="none" />
      </>
    ),
  },
  reservas: {
    from: '#97a8ff', to: '#4c43e0',
    desenho: (
      <>
        <path d="M2 9a3 3 0 0 1 0 6v2a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-2a3 3 0 0 1 0-6V7a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2Z" fill="#fff" />
        <path d="M13 5v2" stroke="#5a50e8" /><path d="M13 17v2" stroke="#5a50e8" /><path d="M13 11v2" stroke="#5a50e8" />
      </>
    ),
  },
  documentos: {
    from: '#ffffff', to: '#dfe5ee', ink: '#2f80f2',
    desenho: (
      <>
        <path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z" fill="#5aa2ff" />
        <path d="M14 2v4a2 2 0 0 0 2 2h4" />
        <path d="M16 13H8" stroke="#fff" /><path d="M16 17H8" stroke="#fff" /><path d="M10 9H8" stroke="#fff" />
      </>
    ),
  },
  assistente: {
    from: '#ffb36b', to: '#f0582a',
    desenho: (
      <>
        <path
          d="M11.017 2.814a1 1 0 0 1 1.966 0l1.051 5.558a2 2 0 0 0 1.594 1.594l5.558 1.051a1 1 0 0 1 0 1.966l-5.558 1.051a2 2 0 0 0-1.594 1.594l-1.051 5.558a1 1 0 0 1-1.966 0l-1.051-5.558a2 2 0 0 0-1.594-1.594l-5.558-1.051a1 1 0 0 1 0-1.966l5.558-1.051a2 2 0 0 0 1.594-1.594z"
          fill="#fff"
        />
        <path d="M20 2v4" /><path d="M22 4h-4" />
        <circle cx="4" cy="20" r="2" fill="#fff" />
      </>
    ),
  },
}

export function MenuDock({ abas, atual, aoEscolher }: { abas: [AbaDock, string][]; atual: string; aoEscolher: (a: AbaDock) => void }) {
  const items: LiquidGlassDockItem[] = abas.map(([k, nome]) => {
    const d = DESENHOS[k]
    return {
      title: nome,
      icon: <AppIcon from={d.from} to={d.to} ink={d.ink} ativo={atual === k}>{d.desenho}</AppIcon>,
      onClick: () => aoEscolher(k),
    }
  })
  return <LiquidGlassDock items={items} label="Navegação da viagem" className="flow-dock" />
}

/**
 * Ícone no formato dos do macOS (o mesmo da demo da Liquid Glass Dock): corpo de 51,5 px num quadro de 64, canto de
 * 11,6 px, degradê, fio de brilho e sombra curta. Desenho do Lucide (24 × 24) no meio. `ativo` = pontinho dourado.
 */
function AppIcon({ from, to, ink = '#fff', ativo, children }: { from: string; to: string; ink?: string; ativo?: boolean; children: ReactNode }) {
  const id = 'lgd-app-' + useId().replace(/[^a-zA-Z0-9_-]/g, '')
  return (
    <svg viewBox="0 0 64 64" aria-hidden="true" focusable="false">
      <defs>
        <linearGradient id={id + '-body'} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={from} />
          <stop offset="1" stopColor={to} />
        </linearGradient>
        <filter id={id + '-shadow'} x="-20%" y="-20%" width="140%" height="140%">
          <feGaussianBlur stdDeviation="0.9" />
        </filter>
      </defs>
      <rect x="6.25" y="7.5" width="51.5" height="51.5" rx="11.6" fill="#000" opacity="0.28" filter={`url(#${id}-shadow)`} />
      <rect x="6.25" y="6.25" width="51.5" height="51.5" rx="11.6" fill={`url(#${id}-body)`} />
      <rect x="6.75" y="6.75" width="50.5" height="50.5" rx="11.1" fill="none" stroke="#fff" strokeOpacity="0.28" />
      <g transform="translate(17 17) scale(1.25)" fill="none" stroke={ink} strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
        {children}
      </g>
      {ativo && <circle cx="32" cy="61.6" r="2.3" fill="#E2D1A8" />}
    </svg>
  )
}
