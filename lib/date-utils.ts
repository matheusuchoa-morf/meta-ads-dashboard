// lib/date-utils.ts
// Helper centralizado para construir query params de data

export type CustomRange = { since: string; until: string } | null

/**
 * Constrói URLSearchParams para as API routes do dashboard.
 * Se customRange presente → usa since/until (modo personalizado).
 * Senão → usa datePreset (modo padrão).
 */
export function buildDateParams(
  datePreset: string,
  customRange: CustomRange,
  tagFilter: string
): URLSearchParams {
  const params = new URLSearchParams()
  if (tagFilter) params.set('tagFilter', tagFilter)

  if (customRange && datePreset === 'custom') {
    params.set('since', customRange.since)
    params.set('until', customRange.until)
  } else {
    params.set('datePreset', datePreset)
  }

  return params
}

/**
 * Formata um range de datas para exibição no dropdown.
 * Ex: { since: '2026-04-01', until: '2026-04-13' } → "1 abr – 13 abr"
 */
export function formatDateRange(since: string, until: string): string {
  const months = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez']
  const s = new Date(since + 'T12:00:00')
  const u = new Date(until + 'T12:00:00')
  const sMonth = months[s.getMonth()]
  const uMonth = months[u.getMonth()]

  if (s.getMonth() === u.getMonth() && s.getFullYear() === u.getFullYear()) {
    return `${s.getDate()} – ${u.getDate()} ${uMonth}`
  }
  return `${s.getDate()} ${sMonth} – ${u.getDate()} ${uMonth}`
}
