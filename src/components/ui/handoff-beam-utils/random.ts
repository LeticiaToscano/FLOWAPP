/** Ruído de valor 1D com semente: devolve f(x) suave, entre 0 e 1. */
export function valueNoise1D(seed: number): (x: number) => number {
  const hash = (n: number) => {
    let h = (n * 374761393 + seed * 668265263) | 0
    h = Math.imul(h ^ (h >>> 13), 1274126177)
    return ((h ^ (h >>> 16)) >>> 0) / 4294967295
  }
  return (x: number) => {
    const i = Math.floor(x)
    const f = x - i
    const u = f * f * (3 - 2 * f)
    return hash(i) * (1 - u) + hash(i + 1) * u
  }
}
