/* Datas, horas e fusos, sem bibliotecas. */

export const FUSOS: [string, string][] = [
  ['America/Sao_Paulo', 'Brasília'], ['America/Manaus', 'Manaus'], ['America/Noronha', 'Fernando de Noronha'],
  ['Europe/Lisbon', 'Lisboa'], ['Europe/London', 'Londres'], ['Europe/Paris', 'Paris / Madri / Roma / Genebra'],
  ['Europe/Athens', 'Atenas'], ['America/New_York', 'Nova York / Miami'], ['America/Chicago', 'Chicago'],
  ['America/Los_Angeles', 'Los Angeles'], ['America/Buenos_Aires', 'Buenos Aires'], ['America/Santiago', 'Santiago'],
  ['America/Mexico_City', 'Cidade do México'], ['Asia/Dubai', 'Dubai'], ['Asia/Tokyo', 'Tóquio'], ['Australia/Sydney', 'Sydney'],
]
export const fusoNome = (tz?: string | null) => (FUSOS.find((f) => f[0] === tz) || [tz, tz || 'Brasília'])[1]

function tzOffset(ts: number, tz: string) {
  const o: Record<string, string> = {}
  new Intl.DateTimeFormat('en-US', { timeZone: tz, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit' })
    .formatToParts(new Date(ts)).forEach((p) => { o[p.type] = p.value })
  return Date.UTC(+o.year, +o.month - 1, +o.day, +o.hour, +o.minute, +o.second) - ts
}

/** 'AAAA-MM-DDTHH:mm' na hora local do fuso → ISO em UTC */
export function localParaUtc(local: string | null, tz: string) {
  if (!local) return null
  const [d, t] = local.split('T')
  const [Y, M, D] = d.split('-').map(Number)
  const [h, m] = (t || '00:00').split(':').map(Number)
  const palpite = Date.UTC(Y, M - 1, D, h, m)
  let utc = palpite - tzOffset(palpite, tz)
  const off2 = tzOffset(utc, tz)
  if (palpite - off2 !== utc) utc = palpite - off2
  return new Date(utc).toISOString()
}

/** ISO em UTC → valor para <input type="datetime-local"> na hora local do fuso */
export function utcParaInput(iso: string | null | undefined, tz?: string | null) {
  if (!iso) return ''
  const p: Record<string, string> = {}
  new Intl.DateTimeFormat('en-CA', { timeZone: tz || 'America/Sao_Paulo', hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })
    .formatToParts(new Date(iso)).forEach((x) => { p[x.type] = x.value })
  return `${p.year}-${p.month}-${p.day}T${p.hour}:${p.minute}`
}

export const fmtHora = (iso?: string | null, tz?: string | null) =>
  iso ? new Intl.DateTimeFormat('pt-BR', { timeZone: tz || 'America/Sao_Paulo', hour: '2-digit', minute: '2-digit' }).format(new Date(iso)) : ''
export const fmtDiaHora = (iso?: string | null, tz?: string | null) =>
  iso ? new Intl.DateTimeFormat('pt-BR', { timeZone: tz || 'America/Sao_Paulo', weekday: 'short', day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }).format(new Date(iso)) : ''
export const fmtData = (d?: string | null) => (d ? new Date(d + 'T12:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' }) : '')
export const fmtDataLonga = (d?: string | null) => (d ? new Date(d + 'T12:00:00').toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long' }) : '')
export const hojeISO = () => {
  const n = new Date()
  return `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, '0')}-${String(n.getDate()).padStart(2, '0')}`
}
export const fmtMoeda = (v: number, m?: string | null) => {
  try { return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: m || 'BRL' }).format(v) } catch { return `${m} ${v}` }
}
