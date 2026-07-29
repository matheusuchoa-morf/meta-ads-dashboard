// components/InvestmentSection.tsx
'use client'
import { useQuery } from '@tanstack/react-query'
import { motion } from 'motion/react'
import {
  ComposedChart, AreaChart, Area, Bar, Line, XAxis, YAxis, Tooltip,
  ResponsiveContainer, CartesianGrid, LabelList,
} from 'recharts'
import {
  DollarSign, Target, MousePointer, Zap, ShoppingCart, TrendingUp,
} from 'lucide-react'
import { fmtBRL, fmtPct } from '@/lib/formatters'
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
  leads: number
  cpl: number
  revenue: number
  cpa: number
  purchases: number
}

function formatDate(date: string) {
  const parts = date.split('-')
  return `${parts[2]}/${parts[1]}`
}

// ── Spend tooltip ─────────────────────────────────────────────────────────────
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function SpendTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null
  const point = payload[0]?.payload as TrendPoint
  return (
    <div
      className="rounded-lg border p-3 text-xs shadow-xl"
      style={{ background: 'var(--mit-bg-elevated)', borderColor: 'var(--mit-border)', minWidth: 150 }}
    >
      <p className="mb-2 font-mono" style={{ color: 'var(--mit-text-subtle)' }}>
        {formatDate(label)}
      </p>
      <div className="flex justify-between gap-4 mb-1">
        <span style={{ color: 'var(--mit-text-subtle)' }}>Investido</span>
        <span className="font-mono font-bold" style={{ color: 'var(--mit-accent)' }}>
          {fmtBRL(point.spend)}
        </span>
      </div>
      {point.revenue > 0 && (
        <div className="flex justify-between gap-4 mb-1">
          <span style={{ color: 'var(--mit-text-subtle)' }}>Receita</span>
          <span className="font-mono font-bold" style={{ color: 'var(--mit-success)' }}>
            {fmtBRL(point.revenue)}
          </span>
        </div>
      )}
      {point.roas > 0 && (
        <div className="flex justify-between gap-4">
          <span style={{ color: 'var(--mit-text-subtle)' }}>ROAS</span>
          <span className="font-mono font-bold" style={{ color: 'var(--mit-gold)' }}>
            {point.roas.toFixed(2)}x
          </span>
        </div>
      )}
    </div>
  )
}

// ── Leads tooltip ─────────────────────────────────────────────────────────────
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function LeadsTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null
  const point = payload[0]?.payload as TrendPoint
  return (
    <div
      className="rounded-lg border p-3 text-xs shadow-xl"
      style={{ background: 'var(--mit-bg-elevated)', borderColor: 'var(--mit-border)', minWidth: 150 }}
    >
      <p className="mb-2 font-mono" style={{ color: 'var(--mit-text-subtle)' }}>
        {formatDate(label)}
      </p>
      <div className="flex justify-between gap-4 mb-1">
        <span style={{ color: 'var(--mit-text-subtle)' }}>Leads</span>
        <span className="font-mono font-bold" style={{ color: 'var(--mit-accent)' }}>
          {point.leads}
        </span>
      </div>
      {point.cpl > 0 && (
        <div className="flex justify-between gap-4">
          <span style={{ color: 'var(--mit-text-subtle)' }}>CPL</span>
          <span className="font-mono font-bold" style={{ color: 'var(--mit-gold)' }}>
            {fmtBRL(point.cpl)}
          </span>
        </div>
      )}
    </div>
  )
}

function ChartSkeleton() {
  return (
    <div
      className="rounded-xl border p-6 animate-pulse"
      style={{ background: 'var(--mit-bg-card)', borderColor: 'var(--mit-border)' }}
    >
      <div className="h-4 w-40 rounded mb-1" style={{ background: 'var(--mit-bg-elevated)' }} />
      <div className="h-3 w-56 rounded mb-5" style={{ background: 'var(--mit-bg-elevated)' }} />
      <div className="h-52 rounded-lg" style={{ background: 'var(--mit-bg-elevated)' }} />
    </div>
  )
}

export function InvestmentSection({ datePreset, tagFilter, customRange }: Props) {
  const { data, isLoading } = useQuery({
    queryKey: ['insights', datePreset, tagFilter, customRange],
    queryFn: () =>
      fetch(`/api/insights?${buildDateParams(datePreset, customRange ?? null, tagFilter)}`)
        .then(r => r.json()),
    refetchInterval: 5 * 60 * 1000,
  })

  const trend: TrendPoint[] = data?.trend ?? []
  const hasLeads = trend.some(t => t.leads > 0)
  const hasCpa   = trend.some(t => t.cpa > 0)

  if (isLoading) {
    return (
      <div className="space-y-5">
        <ChartSkeleton />
        <ChartSkeleton />
      </div>
    )
  }

  if (trend.length === 0) {
    return (
      <div
        className="rounded-xl border p-6 flex items-center justify-center min-h-[200px]"
        style={{ background: 'var(--mit-bg-card)', borderColor: 'var(--mit-border)' }}
      >
        <p className="text-sm" style={{ color: 'var(--mit-text-subtle)' }}>
          Sem dados de investimento para este período
        </p>
      </div>
    )
  }

  const totalSpend   = trend.reduce((s, t) => s + t.spend, 0)
  const totalRevenue = trend.reduce((s, t) => s + (t.revenue ?? 0), 0)
  const totalLeads   = trend.reduce((s, t) => s + (t.leads ?? 0), 0)
  const totalPurchases = trend.reduce((s, t) => s + (t.purchases ?? 0), 0)

  const daysWithData = trend.filter(t => t.spend > 0).length || 1
  const kpis = data?.kpis

  // Averages
  const avgDailyInvest = totalSpend / daysWithData
  const avgCpa = totalPurchases > 0 ? totalSpend / totalPurchases : 0
  const avgSalesDay = totalPurchases / daysWithData
  const avgRoas = kpis?.roas ?? (totalRevenue > 0 && totalSpend > 0 ? totalRevenue / totalSpend : 0)
  const avgCtr = kpis?.ctr ?? 0
  const avgCpm = kpis?.cpm ?? 0
  const avgTicket = totalPurchases > 0 ? totalRevenue / totalPurchases : 0

  // Adaptive Y-axis formatter
  const spendFmt = (v: number) =>
    v >= 1000 ? `R$${(v / 1000).toFixed(0)}k` : v >= 1 ? `R$${v.toFixed(0)}` : 'R$0'

  return (
    <div className="space-y-5">

      {/* ── Hero metrics: Invest/dia, CPA, ROAS ── */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {([
          {
            label: 'Investimento / dia',
            sublabel: 'Média',
            value: fmtBRL(avgDailyInvest),
            icon: DollarSign,
            color: 'var(--mit-accent)',
          },
          {
            label: 'CPA Médio',
            sublabel: 'Custo por aquisição',
            value: avgCpa > 0 ? fmtBRL(avgCpa) : '—',
            icon: Target,
            color: avgCpa > 0 ? 'var(--mit-success)' : 'var(--mit-text-subtle)',
          },
          {
            label: 'ROAS Médio',
            sublabel: 'Retorno sobre investimento',
            value: `${avgRoas.toFixed(2)}x`,
            icon: TrendingUp,
            color: 'var(--mit-gold)',
            extraBadge: avgTicket > 0 ? `Ticket médio: ${fmtBRL(avgTicket)}` : undefined,
          },
        ] as const).map((def, i) => {
          const Icon = def.icon
          return (
            <motion.div
              key={def.label}
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.07, duration: 0.4, ease: 'easeOut' }}
              className="relative rounded-xl border overflow-hidden p-6"
              style={{ background: 'var(--mit-bg-card)', borderColor: 'var(--mit-border)' }}
            >
              <div
                className="absolute top-0 left-0 right-0 h-px"
                style={{ background: `linear-gradient(90deg, ${def.color}, transparent 70%)` }}
              />
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 mb-4">
                    <p className="text-xs font-medium tracking-widest uppercase" style={{ color: 'var(--mit-text-subtle)' }}>
                      {def.label}
                    </p>
                    <span
                      className="text-[10px] px-1.5 py-0.5 rounded font-medium"
                      style={{ background: def.color + '15', color: def.color }}
                    >
                      {def.sublabel}
                    </span>
                  </div>
                  <p className="text-4xl font-bold font-mono leading-none" style={{ color: def.color }}>
                    {def.value}
                  </p>
                  {'extraBadge' in def && def.extraBadge && (
                    <span
                      className="inline-block mt-3 text-[10px] px-2 py-0.5 rounded font-mono font-semibold"
                      style={{ background: 'var(--mit-success)' + '15', color: 'var(--mit-success)' }}
                    >
                      {def.extraBadge}
                    </span>
                  )}
                </div>
                <div className="p-3 rounded-xl shrink-0" style={{ background: def.color + '18' }}>
                  <Icon size={22} style={{ color: def.color }} />
                </div>
              </div>
            </motion.div>
          )
        })}
      </div>

      {/* ── Mini metrics: CTR, CPM, Vendas/dia ── */}
      <div className="grid grid-cols-3 gap-3">
        {([
          {
            label: 'CTR Médio',
            value: fmtPct(avgCtr, 2),
            icon: MousePointer,
            color: '#60A5FA',
          },
          {
            label: 'CPM Médio',
            value: avgCpm > 0 ? fmtBRL(avgCpm) : '—',
            icon: Zap,
            color: 'var(--mit-warning)',
          },
          {
            label: 'Vendas / dia',
            value: avgSalesDay > 0 ? avgSalesDay.toFixed(1) : '—',
            icon: ShoppingCart,
            color: 'var(--mit-success)',
          },
        ] as const).map((def, i) => {
          const Icon = def.icon
          return (
            <motion.div
              key={def.label}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: (i + 3) * 0.07, duration: 0.4, ease: 'easeOut' }}
              className="rounded-xl border p-4"
              style={{ background: 'var(--mit-bg-elevated)', borderColor: 'var(--mit-border)' }}
            >
              <div className="flex items-center justify-between mb-3">
                <p className="text-xs font-medium tracking-widest uppercase" style={{ color: 'var(--mit-text-subtle)' }}>
                  {def.label}
                </p>
                <Icon size={13} style={{ color: def.color }} />
              </div>
              <p className="text-xl font-bold font-mono leading-none" style={{ color: def.color }}>
                {def.value}
              </p>
            </motion.div>
          )
        })}
      </div>

      {/* ── Chart 1: Daily spend ── */}
      <section
        className="rounded-xl border p-6"
        style={{ background: 'var(--mit-bg-card)', borderColor: 'var(--mit-border)' }}
      >
        <div className="mb-5 flex items-start justify-between">
          <div>
            <h2 className="text-base font-semibold" style={{ color: 'var(--mit-gold)' }}>
              Investimento Diário
            </h2>
            <p className="text-xs mt-0.5" style={{ color: 'var(--mit-text-subtle)' }}>
              Gasto por dia com rótulos de valor
            </p>
          </div>
          <div className="text-right">
            <p className="text-xs" style={{ color: 'var(--mit-text-subtle)' }}>Total investido</p>
            <p className="text-base font-bold font-mono" style={{ color: 'var(--mit-accent)' }}>
              {fmtBRL(totalSpend)}
            </p>
            {totalRevenue > 0 && (
              <>
                <p className="text-xs mt-1" style={{ color: 'var(--mit-text-subtle)' }}>Receita estimada</p>
                <p className="text-base font-bold font-mono" style={{ color: 'var(--mit-success)' }}>
                  {fmtBRL(totalRevenue)}
                </p>
              </>
            )}
          </div>
        </div>

        <ResponsiveContainer width="100%" height={220}>
          <ComposedChart data={trend} margin={{ top: 20, right: 12, left: -10, bottom: 0 }}>
            <CartesianGrid stroke="rgba(201,164,90,0.06)" vertical={false} />
            <XAxis
              dataKey="date"
              tickFormatter={formatDate}
              tick={{ fontSize: 10, fill: 'var(--mit-text-subtle)' }}
              axisLine={false}
              tickLine={false}
            />
            <YAxis
              tick={{ fontSize: 10, fill: 'var(--mit-text-subtle)' }}
              axisLine={false}
              tickLine={false}
              tickFormatter={spendFmt}
              width={44}
            />
            <Tooltip content={<SpendTooltip />} cursor={{ fill: 'rgba(201,164,90,0.04)' }} />
            <Bar
              dataKey="spend"
              name="Gasto"
              fill="var(--mit-accent)"
              radius={[4, 4, 0, 0]}
              opacity={0.85}
              maxBarSize={48}
            >
              <LabelList
                dataKey="spend"
                position="top"
                style={{ fontSize: 9, fill: 'var(--mit-text-subtle)', fontFamily: 'monospace' }}
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                formatter={(v: any) => typeof v === 'number' ? fmtBRL(v) : ''}
              />
            </Bar>
          </ComposedChart>
        </ResponsiveContainer>
      </section>

      {/* ── Chart 2: Leads + CPL (only when lead data exists) ── */}
      {hasLeads && (
        <section
          className="rounded-xl border p-6"
          style={{ background: 'var(--mit-bg-card)', borderColor: 'var(--mit-border)' }}
        >
          <div className="mb-5 flex items-start justify-between">
            <div>
              <h2 className="text-base font-semibold" style={{ color: 'var(--mit-gold)' }}>
                Leads e CPL
              </h2>
              <p className="text-xs mt-0.5" style={{ color: 'var(--mit-text-subtle)' }}>
                Volume de leads (barras) · Custo por lead (linha)
              </p>
            </div>
            <div className="text-right">
              <p className="text-xs" style={{ color: 'var(--mit-text-subtle)' }}>Total de leads</p>
              <p className="text-base font-bold font-mono" style={{ color: 'var(--mit-accent)' }}>
                {totalLeads.toLocaleString('pt-BR')}
              </p>
            </div>
          </div>

          <ResponsiveContainer width="100%" height={220}>
            <ComposedChart data={trend} margin={{ top: 8, right: 48, left: -10, bottom: 0 }}>
              <defs>
                <linearGradient id="cplGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#C9A45A" stopOpacity={0.3} />
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
              {/* Left axis: leads count */}
              <YAxis
                yAxisId="leads"
                orientation="left"
                tick={{ fontSize: 10, fill: 'var(--mit-text-subtle)' }}
                axisLine={false}
                tickLine={false}
                allowDecimals={false}
                width={36}
              />
              {/* Right axis: CPL in BRL */}
              <YAxis
                yAxisId="cpl"
                orientation="right"
                tick={{ fontSize: 10, fill: '#C9A45A' }}
                axisLine={false}
                tickLine={false}
                tickFormatter={spendFmt}
                width={48}
              />
              <Tooltip content={<LeadsTooltip />} cursor={{ fill: 'rgba(201,164,90,0.04)' }} />
              <Bar
                yAxisId="leads"
                dataKey="leads"
                name="Leads"
                fill="var(--mit-accent)"
                radius={[3, 3, 0, 0]}
                opacity={0.75}
                maxBarSize={40}
              />
              <Line
                yAxisId="cpl"
                dataKey="cpl"
                name="CPL"
                type="monotone"
                stroke="#C9A45A"
                strokeWidth={2}
                dot={{ r: 3, fill: '#C9A45A', strokeWidth: 0 }}
                activeDot={{ r: 5, fill: '#C9A45A', strokeWidth: 0 }}
              />
            </ComposedChart>
          </ResponsiveContainer>
        </section>
      )}

      {/* ── Chart 3: CPA oscillation (only when purchase data exists) ── */}
      {hasCpa && (
        <section
          className="rounded-xl border p-6"
          style={{ background: 'var(--mit-bg-card)', borderColor: 'var(--mit-border)' }}
        >
          <div className="mb-5 flex items-start justify-between">
            <div>
              <h2 className="text-base font-semibold" style={{ color: 'var(--mit-gold)' }}>
                Oscilação do CPA
              </h2>
              <p className="text-xs mt-0.5" style={{ color: 'var(--mit-text-subtle)' }}>
                Custo por aquisição diário — queda é positiva
              </p>
            </div>
            {!customRange && (() => {
              const cpaDays = trend.filter(t => t.cpa > 0)
              if (cpaDays.length < 2) return null
              const first = cpaDays[0].cpa
              const last  = cpaDays[cpaDays.length - 1].cpa
              const delta = ((last - first) / first) * 100
              const positive = delta <= 0
              return (
                <div className="text-right">
                  <p className="text-xs" style={{ color: 'var(--mit-text-subtle)' }}>Variação período</p>
                  <p className="text-base font-bold font-mono" style={{ color: positive ? 'var(--mit-success)' : 'var(--mit-danger)' }}>
                    {positive ? '↓' : '↑'} {Math.abs(delta).toFixed(1)}%
                  </p>
                </div>
              )
            })()}
          </div>

          <ResponsiveContainer width="100%" height={180}>
            <AreaChart data={trend} margin={{ top: 8, right: 12, left: -10, bottom: 0 }}>
              <defs>
                <linearGradient id="cpaInvGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#e57373" stopOpacity={0.35} />
                  <stop offset="100%" stopColor="#e57373" stopOpacity={0.02} />
                </linearGradient>
              </defs>
              <CartesianGrid stroke="rgba(229,115,115,0.06)" vertical={false} />
              <XAxis
                dataKey="date"
                tickFormatter={formatDate}
                tick={{ fontSize: 10, fill: 'var(--mit-text-subtle)' }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                tick={{ fontSize: 10, fill: 'var(--mit-text-subtle)' }}
                axisLine={false}
                tickLine={false}
                tickFormatter={spendFmt}
                width={44}
              />
              <Tooltip
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                content={({ active, payload, label }: any) => {
                  if (!active || !payload?.length) return null
                  const pt = payload[0]?.payload as TrendPoint
                  return (
                    <div className="rounded-lg border p-3 text-xs shadow-xl"
                      style={{ background: 'var(--mit-bg-elevated)', borderColor: 'var(--mit-border)', minWidth: 140 }}>
                      <p className="mb-1 font-mono" style={{ color: 'var(--mit-text-subtle)' }}>{formatDate(label)}</p>
                      <div className="flex justify-between gap-4 mb-1">
                        <span style={{ color: 'var(--mit-text-subtle)' }}>CPA</span>
                        <span className="font-mono font-bold" style={{ color: '#e57373' }}>
                          {pt.cpa > 0 ? spendFmt(pt.cpa) : '—'}
                        </span>
                      </div>
                      {pt.purchases > 0 && (
                        <div className="flex justify-between gap-4">
                          <span style={{ color: 'var(--mit-text-subtle)' }}>Compras</span>
                          <span className="font-mono font-bold" style={{ color: 'var(--mit-text)' }}>{pt.purchases}</span>
                        </div>
                      )}
                    </div>
                  )
                }}
                cursor={{ stroke: 'rgba(229,115,115,0.2)', strokeWidth: 1 }}
              />
              <Area
                dataKey="cpa"
                name="CPA"
                type="monotone"
                stroke="#e57373"
                strokeWidth={2}
                fill="url(#cpaInvGrad)"
                dot={{ r: 3, fill: '#e57373', strokeWidth: 0 }}
                activeDot={{ r: 5, fill: '#e57373', strokeWidth: 0 }}
                connectNulls={false}
              />
            </AreaChart>
          </ResponsiveContainer>
        </section>
      )}
    </div>
  )
}
