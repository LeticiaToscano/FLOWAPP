/* Foto de capa da viagem.
   1) foto enviada pela pessoa (cofre privado), 2) foto livre do destino na Wikipédia, 3) capa padrão desenhada. */

/** Busca uma foto do destino na Wikipédia (sem chave, sem aprovação). Fotos do Wikimedia Commons pedem crédito. */
export async function buscarCapaWikipedia(destino: string): Promise<{ url: string; credito: string } | null> {
  const termo = destino.trim()
  if (!termo) return null
  for (const lang of ['pt', 'en']) {
    const u = `https://${lang}.wikipedia.org/w/api.php?action=query&format=json&origin=*&redirects=1&generator=search&gsrlimit=1&gsrsearch=${encodeURIComponent(termo)}&prop=pageimages&piprop=thumbnail&pithumbsize=1000`
    try {
      const r = await fetch(u)
      if (!r.ok) continue
      const d = await r.json()
      const paginas = d?.query?.pages ? Object.values(d.query.pages) as any[] : []
      const src = paginas[0]?.thumbnail?.source as string | undefined
      if (src && src.startsWith('https://upload.wikimedia.org/')) {
        return { url: src, credito: 'Foto: Wikimedia Commons' }
      }
    } catch { /* tenta o próximo idioma */ }
  }
  return null
}

const xml = (s: string) => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' }[c] as string))

/** Capa padrão (retrato 4:7) com a inicial da viagem. */
export function capaPadrao(titulo: string) {
  const letra = xml((titulo || 'V').trim().charAt(0).toUpperCase())
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 1120"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#1C1A16"/><stop offset="1" stop-color="#000000"/></linearGradient></defs><rect width="640" height="1120" fill="url(#g)"/><text x="320" y="640" text-anchor="middle" font-family="system-ui,sans-serif" font-size="300" font-weight="700" fill="#E2D1A8">${letra}</text></svg>`
  return 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg)
}

/** Cartão "Nova viagem" para o leque. */
export const CARTAO_NOVA = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 1120"><rect width="640" height="1120" fill="#0E0E0E"/><rect x="24" y="24" width="592" height="1072" rx="64" fill="none" stroke="#E2D1A8" stroke-width="4" stroke-dasharray="18 14"/><path d="M320 470v180M230 560h180" stroke="#E2D1A8" stroke-width="22" stroke-linecap="round"/><text x="320" y="760" text-anchor="middle" font-family="system-ui,sans-serif" font-size="56" font-weight="600" fill="#F4EEDF">Nova viagem</text></svg>`
)
