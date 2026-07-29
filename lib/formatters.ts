// lib/formatters.ts
export function fmtBRL(value: number): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency', currency: 'BRL', minimumFractionDigits: 2
  }).format(value)
}

export function fmtPct(value: number, decimals = 1): string {
  return `${value.toFixed(decimals)}%`
}

export function fmtNum(value: number): string {
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`
  if (value >= 1_000) return `${(value / 1_000).toFixed(1)}k`
  return value.toLocaleString('pt-BR')
}

export function dropColor(dropPct: number | undefined): string {
  if (dropPct === undefined) return 'var(--mit-text-subtle)'
  if (dropPct < 50) return 'var(--mit-success)'
  if (dropPct < 80) return 'var(--mit-warning)'
  return 'var(--mit-danger)'
}

export function deltaSign(delta: number): string {
  return delta >= 0 ? `▲ ${fmtPct(delta)}` : `▼ ${fmtPct(Math.abs(delta))}`
}

export function fmtDelta(current: number, previous: number): string {
  if (!previous || previous === 0) return '—'
  const pct = ((current - previous) / previous) * 100
  return `${pct >= 0 ? '▲' : '▼'} ${Math.abs(pct).toFixed(1)}%`
}
