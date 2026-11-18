// Cores-base do HandoffBeam (o componente usa só accent e text). No Flow o feixe recebe a paleta dourada por prop.
export type BjorkTone = 'dark' | 'light'

export const BJORK_PALETTE: Record<BjorkTone, { accent: string; text: string }> = {
  dark: { accent: '#E2D1A8', text: '#F4EEDF' },
  light: { accent: '#B08537', text: '#16130C' },
}
