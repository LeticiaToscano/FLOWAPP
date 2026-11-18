/** Anuncia mudanças de estado para leitores de tela, sem aparecer na tela. */
export function LiveRegion({ message }: { message: string }) {
  return (
    <span role="status" aria-live="polite" style={{ position: 'absolute', width: 1, height: 1, overflow: 'hidden', clip: 'rect(0 0 0 0)', whiteSpace: 'nowrap' }}>
      {message}
    </span>
  )
}
