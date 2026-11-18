export type SpringConfig = { stiffness: number; damping: number; mass: number }
export type SpringState = { x: number; v: number }

/** Avança uma mola rumo ao alvo (Euler semi-implícito, em passos pequenos para ficar estável). */
export function stepSpring(s: SpringState, alvo: number, c: SpringConfig, dt: number) {
  if (dt <= 0) return
  const passos = Math.max(1, Math.ceil(dt / (1 / 240)))
  const h = dt / passos
  for (let i = 0; i < passos; i++) {
    const a = (-c.stiffness * (s.x - alvo) - c.damping * s.v) / c.mass
    s.v += a * h
    s.x += s.v * h
  }
}
