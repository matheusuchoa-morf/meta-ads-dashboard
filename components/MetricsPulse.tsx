// components/MetricsPulse.tsx
// "Pulsão de Métricas" — planilha diária dos últimos 7 dias do funil.
'use client'
import { useQuery } from '@tanstack/react-query'
import { Activity, Star } from 'lucide-react'
import { fmtBRL, fmtNum } from '@/lib/formatters'

interface PulseDay {
  date: string
  spend: number
  impressions: number
  cpm: number
  ctr: number
  linkClicks: number
  visits: number
  checkout: number
  purchases: number
  revenue: number
}

interface Props {
  tagFilter: string
}

const WEEKDAYS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb']

function dayHeader(date: string): { wd: string; dm: string } {
  const [y, m, d] = date.split('-').map(Number)
  const wd = WEEKDAYS[new Date(Date.UTC(y, m - 1, d, 12)).getUTCDay()]
  const dm = `${String(d).padStart(2, '0')}/${String(m).padStart(2, '0')}`
  return { wd, dm }
}

const pct = (n: number) => `${n.toFixed(1).replace('.', ',')}%`

// Benchmark conversão (compras ÷ visitas): 🔴 < 2% · 🟡 2–6% · 🟢 ≥ 6%
function convColor(p: number | null): string {
  if (p == null) return 'var(--mit-text-subtle)'
  if (p >= 6) return 'var(--mit-success)'
  if (p >= 2) return 'var(--mit-warning)'
  return 'var(--mit-danger)'
}

interface RowDef {
  label: string
  star?: boolean
  group?: boolean                    // linha "forte" sombreada (métricas derivadas/%)
  cell: (d: PulseDay) => string      // valor formatado por dia
  cellColor?: (d: PulseDay) => string
}

// Ordem (escada de taxas do funil):
// Visitas → Checkout → (%) Página → Compras → (%) Checkout → ⭐(%) Conversão
const ROWS: RowDef[] = [
  { label: 'Investimento',    cell: d => fmtBRL(d.spend) },
  { label: 'CPM', group: true, cell: d => fmtBRL(d.cpm) },
  { label: 'Impressões',      cell: d => fmtNum(d.impressions) },
  { label: 'CTR', group: true, cell: d => pct(d.ctr) },
  { label: 'Cliques no Link', cell: d => fmtNum(d.linkClicks) },
  { label: 'Visitas',         cell: d => fmtNum(d.visits) },
  { label: 'Checkout',        cell: d => fmtNum(d.checkout) },
  { label: '(%) Página', group: true,
    cell: d => (d.visits > 0 ? pct((d.checkout / d.visits) * 100) : '—') },
  { label: 'Compras',         cell: d => (d.purchases > 0 ? fmtNum(d.purchases) : '—') },
  { label: '(%) Checkout', group: true,
    cell: d => (d.checkout > 0 ? pct((d.purchases / d.checkout) * 100) : '—') },
  { label: '(%) Conversão', star: true,
    cell: d => (d.visits > 0 ? pct((d.purchases / d.visits) * 100) : '—'),
    cellColor: d => convColor(d.visits > 0 ? (d.purchases / d.visits) * 100 : null) },
]

function PulseSkeleton() {
  return (
    <section
      className="rounded-xl border p-6 animate-pulse"
      style={{ background: 'var(--mit-bg-card)', borderColor: 'var(--mit-border)' }}
    >
      <div className="h-5 w-48 rounded mb-2" style={{ background: 'var(--mit-bg-elevated)' }} />
      <div className="h-3 w-64 rounded mb-6" style={{ background: 'var(--mit-bg-elevated)' }} />
      {[...Array(11)].map((_, i) => (
        <div key={i} className="h-7 w-full rounded mb-1.5" style={{ background: 'var(--mit-bg-elevated)' }} />
      ))}
    </section>
  )
}

export function MetricsPulse({ tagFilter }: Props) {
  const { data, isLoading, error } = useQuery({
    queryKey: ['funnel-daily', tagFilter],
    queryFn: async () => {
      const r = await fetch(`/api/funnel/daily?tagFilter=${encodeURIComponent(tagFilter)}`)
      if (!r.ok) {
        const body = await r.json().catch(() => ({}))
        throw new Error(body?.error ?? `HTTP ${r.status}`)
      }
      return r.json()
    },
    refetchInterval: 10 * 60 * 1000,
  })

  if (isLoading) return <PulseSkeleton />
  if (error || data?.error) {
    return (
      <div className="text-red-400 p-4 rounded-xl" style={{ background: 'var(--mit-bg-card)' }}>
        Erro ao carregar Pulsão de Métricas: {data?.error ?? String(error)}
      </div>
    )
  }

  const days: PulseDay[] = data?.days ?? []

  return (
    <section
      className="rounded-xl border p-6"
      style={{ background: 'var(--mit-bg-card)', borderColor: 'var(--mit-border)' }}
    >
      <div className="mb-5 flex items-center gap-2">
        <Activity size={18} style={{ color: 'var(--mit-gold)' }} />
        <div>
          <h2 className="text-xl font-semibold" style={{ color: 'var(--mit-gold)' }}>
            Pulsão de Métricas
          </h2>
          <p className="text-sm mt-0.5" style={{ color: 'var(--mit-text-subtle)' }}>
            Últimos 7 dias do funil · mais recente → mais antigo
          </p>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-sm" style={{ minWidth: 640 }}>
          <thead>
            <tr>
              <th
                className="sticky left-0 z-10 text-left px-3 py-2 font-semibold text-xs uppercase tracking-wider"
                style={{ background: 'var(--mit-bg-elevated)', color: 'var(--mit-text-muted)', borderBottom: '1px solid var(--mit-border)' }}
              >
                Indicador
              </th>
              {days.map(d => {
                const { wd, dm } = dayHeader(d.date)
                return (
                  <th
                    key={d.date}
                    className="px-3 py-2 text-right font-semibold whitespace-nowrap"
                    style={{ color: 'var(--mit-text-muted)', borderBottom: '1px solid var(--mit-border)' }}
                  >
                    <span className="block text-[10px] uppercase tracking-wider" style={{ color: 'var(--mit-text-subtle)' }}>{wd}</span>
                    <span className="block text-xs font-mono">{dm}</span>
                  </th>
                )
              })}
            </tr>
          </thead>
          <tbody>
            {ROWS.map(row => {
              const isStar = !!row.star
              const rowBg = isStar
                ? 'rgba(200,164,90,0.08)'
                : row.group ? 'var(--mit-bg-elevated)' : 'transparent'
              return (
                <tr key={row.label} style={{ borderBottom: '1px solid var(--mit-border)' }}>
                  {/* Indicador (sticky) */}
                  <td
                    className="sticky left-0 z-10 px-3 py-2 whitespace-nowrap"
                    style={{
                      background: isStar ? 'rgba(200,164,90,0.10)' : row.group ? 'var(--mit-bg-elevated)' : 'var(--mit-bg-card)',
                      borderBottom: '1px solid var(--mit-border)',
                    }}
                  >
                    <span
                      className="flex items-center gap-1.5"
                      style={{
                        color: isStar ? 'var(--mit-gold)' : row.group ? 'var(--mit-text)' : 'var(--mit-text-muted)',
                        fontWeight: isStar || row.group ? 700 : 500,
                      }}
                    >
                      {isStar && <Star size={13} style={{ color: 'var(--mit-gold)', fill: 'var(--mit-gold)' }} />}
                      {row.label}
                    </span>
                  </td>
                  {/* Dias */}
                  {days.map((d, i) => (
                    <td
                      key={`${row.label}-${i}`}
                      className="px-3 py-2 text-right font-mono whitespace-nowrap"
                      style={{ background: rowBg, color: row.cellColor ? row.cellColor(d) : 'var(--mit-text-muted)', fontWeight: isStar ? 700 : 400 }}
                    >
                      {row.cell(d)}
                    </td>
                  ))}
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      <p className="text-[11px] mt-4" style={{ color: 'var(--mit-text-subtle)' }}>
        <strong style={{ color: 'var(--mit-text-muted)' }}>(%) Página</strong> = checkout ÷ visitas ·{' '}
        <strong style={{ color: 'var(--mit-text-muted)' }}>(%) Checkout</strong> = compras ÷ checkout ·{' '}
        <Star size={11} className="inline -mt-0.5" style={{ color: 'var(--mit-gold)', fill: 'var(--mit-gold)' }} />{' '}
        <strong style={{ color: 'var(--mit-text-muted)' }}>(%) Conversão</strong> = compras ÷ visitas ·{' '}
        <span style={{ color: 'var(--mit-danger)' }}>●</span> &lt; 2% ·{' '}
        <span style={{ color: 'var(--mit-warning)' }}>●</span> 2–6% ·{' '}
        <span style={{ color: 'var(--mit-success)' }}>●</span> ≥ 6%  ·  Compras = vendas reais do Hotmart (por data).
      </p>
    </section>
  )
}
