'use client'
import { useQuery } from '@tanstack/react-query'
import {
  ComposedChart, Area, XAxis, YAxis, Tooltip,
  ResponsiveContainer, CartesianGrid,
} from 'recharts'
import { fmtBRL } from '@/lib/formatters'
import { buildDateParams, type CustomRange } from '@/lib/date-utils'

interface Props {
  datePreset: string
  tagFilter: string
  customRange?: CustomRange
}

interface TrendPoint {
  date: string
  spend: number
  roas: number
  revenue: number
  cpa: number
  purchases: number
  leads: number
  cpl: number
}

function formatDate(date: string) {
  const parts = date.split('-')
  return `${parts[2]}/${parts[1]}`
}

const spendFmt = (v: number) =>
  v >= 1000 ? `R$${(v / 1000).toFixed(0)}k` : v >= 1 ? `R$${v.toFixed(0)}` : 'R$0'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function MainTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null
  const point = payload[0]?.payload as TrendPoint
  return (
    <div
      className="rounded-lg border p-3 text-xs shadow-xl"
      style={{
        background: 'var(--mit-bg-elevated)',
        borderColor: 'var(--mit-border)',
        minWidth: 160,
      }}
    >
      <p className="mb-2 font-mono" style={{ color: 'var(--mit-text-subtle)' }}>
        {formatDate(label)}
      </p>
      {/* Gasto */}
      <div className="flex items-center justify-between gap-4 mb-1">
        <div className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full shrink-0" style={{ background: 'var(--mit-accent)' }} />
          <span style={{ color: 'var(--mit-text-subtle)' }}>Gasto</span>
        </div>
        <span className="font-mono font-bold" style={{ color: 'var(--mit-text)' }}>
          {fmtBRL(point.spend)}
        </span>
      </div>
      {/* Vendas */}
      {point.purchases > 0 && (
        <div className="flex items-center justify-between gap-4 mb-1">
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full shrink-0" style={{ background: 'var(--mit-success)' }} />
            <span style={{ color: 'var(--mit-text-subtle)' }}>Vendas</span>
          </div>
          <span className="font-mono font-bold" style={{ color: 'var(--mit-success)' }}>
            {point.purchases}
          </span>
        </div>
      )}
      {/* ROAS */}
      {point.roas > 0 && (
        <div className="flex items-center justify-between gap-4 mb-1">
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full shrink-0" style={{ background: '#C9A45A' }} />
            <span style={{ color: 'var(--mit-text-subtle)' }}>ROAS</span>
          </div>
          <span className="font-mono font-bold" style={{ color: 'var(--mit-text)' }}>
            {point.roas.toFixed(2)}x
          </span>
        </div>
      )}
      {/* Total gerado */}
      {point.revenue > 0 && (
        <div className="mt-2 pt-2 border-t" style={{ borderColor: 'rgba(255,255,255,0.08)' }}>
          <div className="flex items-center justify-between gap-4">
            <span style={{ color: 'var(--mit-text-subtle)' }}>Total gerado</span>
            <span className="font-mono font-bold" style={{ color: 'var(--mit-success)' }}>
              {fmtBRL(point.revenue)}
            </span>
          </div>
        </div>
      )}
    </div>
  )
}

export function TrendChart({ datePreset, tagFilter, customRange }: Props) {
  const { data, isLoading } = useQuery({
    queryKey: ['insights', datePreset, tagFilter, customRange],
    queryFn: () =>
      fetch(`/api/insights?${buildDateParams(datePreset, customRange ?? null, tagFilter)}`)
        .then(r => r.json()),
    refetchInterval: 5 * 60 * 1000,
  })

  const trend: TrendPoint[] = data?.trend ?? []

  if (isLoading) {
    return (
      <section
        className="rounded-xl border p-6 animate-pulse"
        style={{ background: 'var(--mit-bg-card)', borderColor: 'var(--mit-border)' }}
      >
        <div className="h-4 w-28 rounded mb-1" style={{ background: 'var(--mit-bg-elevated)' }} />
        <div className="h-3 w-40 rounded mb-5" style={{ background: 'var(--mit-bg-elevated)' }} />
        <div className="h-60 rounded-lg" style={{ background: 'var(--mit-bg-elevated)' }} />
      </section>
    )
  }

  if (trend.length === 0) return null

  const totalSpend   = trend.reduce((s, t) => s + t.spend, 0)
  const totalRevenue = trend.reduce((s, t) => s + t.revenue, 0)
  const totalPurchases = trend.reduce((s, t) => s + t.purchases, 0)
  const avgCpa = totalPurchases > 0 ? totalSpend / totalPurchases : 0

  return (
    <section
      className="rounded-xl border p-6"
      style={{ background: 'var(--mit-bg-card)', borderColor: 'var(--mit-border)' }}
    >
      <div className="mb-4">
        <h2 className="text-base font-semibold" style={{ color: 'var(--mit-gold)' }}>
          Tendência
        </h2>
        <p className="text-xs mt-0.5" style={{ color: 'var(--mit-text-subtle)' }}>
          Gasto diário (área) · ROAS (linha)
        </p>
      </div>

      {/* ── Visible stats row above chart ── */}
      <div className="flex flex-wrap items-center gap-x-6 gap-y-2 mb-4">
        <div>
          <p className="text-[10px] uppercase tracking-wider" style={{ color: 'var(--mit-text-subtle)' }}>Investido</p>
          <p className="text-sm font-bold font-mono" style={{ color: 'var(--mit-accent)' }}>
            {fmtBRL(totalSpend)}
          </p>
        </div>
        {totalRevenue > 0 && (
          <div>
            <p className="text-[10px] uppercase tracking-wider" style={{ color: 'var(--mit-text-subtle)' }}>Total Gerado</p>
            <p className="text-sm font-bold font-mono" style={{ color: 'var(--mit-success)' }}>
              {fmtBRL(totalRevenue)}
            </p>
          </div>
        )}
        {avgCpa > 0 && (
          <div>
            <p className="text-[10px] uppercase tracking-wider" style={{ color: 'var(--mit-text-subtle)' }}>CPA Médio</p>
            <p className="text-sm font-bold font-mono" style={{ color: 'var(--mit-text-muted)' }}>
              {fmtBRL(avgCpa)}
            </p>
          </div>
        )}
        {totalPurchases > 0 && (
          <div>
            <p className="text-[10px] uppercase tracking-wider" style={{ color: 'var(--mit-text-subtle)' }}>Vendas</p>
            <p className="text-sm font-bold font-mono" style={{ color: 'var(--mit-success)' }}>
              {totalPurchases}
            </p>
          </div>
        )}
      </div>

      {/* ── Mountain area chart ── */}
      <ResponsiveContainer width="100%" height={220}>
        <ComposedChart data={trend} margin={{ top: 8, right: 36, left: -10, bottom: 0 }}>
          <defs>
            <linearGradient id="spendGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--mit-accent)" stopOpacity={0.45} />
              <stop offset="100%" stopColor="var(--mit-accent)" stopOpacity={0.02} />
            </linearGradient>
            <linearGradient id="roasGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#C9A45A" stopOpacity={0.18} />
              <stop offset="100%" stopColor="#C9A45A" stopOpacity={0} />
            </linearGradient>
          </defs>

          <CartesianGrid stroke="rgba(201,164,90,0.06)" vertical={false} />

          <XAxis
            dataKey="date"
            tickFormatter={formatDate}
            tick={{ fontSize: 10, fill: 'var(--mit-text-subtle)' }}
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            yAxisId="spend"
            orientation="left"
            tick={{ fontSize: 10, fill: 'var(--mit-text-subtle)' }}
            axisLine={false}
            tickLine={false}
            tickFormatter={spendFmt}
            width={44}
          />
          <YAxis
            yAxisId="roas"
            orientation="right"
            tick={{ fontSize: 10, fill: '#C9A45A' }}
            axisLine={false}
            tickLine={false}
            tickFormatter={v => `${v.toFixed(1)}x`}
            width={36}
          />

          <Tooltip content={<MainTooltip />} cursor={{ stroke: 'rgba(201,164,90,0.15)', strokeWidth: 1 }} />

          <Area
            yAxisId="spend"
            dataKey="spend"
            name="Gasto"
            type="monotone"
            stroke="var(--mit-accent)"
            strokeWidth={2}
            fill="url(#spendGrad)"
            dot={false}
            activeDot={{ r: 4, fill: 'var(--mit-accent)', strokeWidth: 0 }}
          />
          <Area
            yAxisId="roas"
            dataKey="roas"
            name="ROAS"
            type="monotone"
            stroke="#C9A45A"
            strokeWidth={2}
            fill="url(#roasGrad)"
            dot={false}
            activeDot={{ r: 4, fill: '#C9A45A', strokeWidth: 0 }}
          />
        </ComposedChart>
      </ResponsiveContainer>
    </section>
  )
}
