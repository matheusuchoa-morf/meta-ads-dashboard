'use client'
import { useQuery } from '@tanstack/react-query'
import { motion } from 'motion/react'
import { fmtBRL, fmtNum, fmtPct } from '@/lib/formatters'
import { buildDateParams, type CustomRange } from '@/lib/date-utils'
import {
  DollarSign, TrendingUp, Target, MousePointer, Zap, Users,
  ShoppingCart, Receipt,
} from 'lucide-react'
import type { HotmartData } from '@/app/api/hotmart/route'

interface Props {
  datePreset: string
  tagFilter: string
  customRange?: CustomRange
}

interface KPIs {
  totalSpend: number
  totalReach: number
  roas: number
  cpa: number
  cpl: number
  ctr: number
  cpm: number
  totalPurchases: number
  totalLeads: number
  totalClicks: number
  totalImpressions: number
}

function calcDeltaPct(current: number, previous: number): number | null {
  if (!previous || previous === 0) return null
  return ((current - previous) / previous) * 100
}

function DeltaBadge({
  current,
  previous,
  inverted = false,
  mini = false,
}: {
  current: number
  previous: number
  inverted?: boolean
  mini?: boolean
}) {
  const delta = calcDeltaPct(current, previous)
  if (delta === null) return null

  const isPositive = delta >= 0
  const isGood = inverted ? !isPositive : isPositive
  const color = isGood ? 'var(--mit-success)' : 'var(--mit-danger)'
  const bg = isGood ? 'rgba(76,175,130,0.12)' : 'rgba(229,62,62,0.12)'
  const symbol = isPositive ? '▲' : '▼'
  const label = `${symbol} ${Math.abs(delta).toFixed(1)}%`

  if (mini) {
    return (
      <span className="text-xs font-mono font-semibold" style={{ color }}>
        {label}
      </span>
    )
  }

  return (
    <span
      className="inline-flex items-center px-2 py-0.5 rounded text-xs font-mono font-semibold"
      style={{ background: bg, color }}
    >
      {label}
    </span>
  )
}

// ─── Hero card definitions ──────────────────────────────────────────────────
type HeroKey = 'totalSpend' | 'faturamento' | 'roasReal'

interface HeroDef {
  key: HeroKey
  label: string
  sublabel?: string
  fmt: (v: number) => string
  icon: React.ElementType
  color: string
  inverted: boolean
}

const HERO_DEFS: HeroDef[] = [
  {
    key: 'totalSpend',
    label: 'Gasto Total',
    sublabel: 'Meta Ads',
    fmt: (v) => fmtBRL(v),
    icon: DollarSign,
    color: 'var(--mit-accent)',
    inverted: false,
  },
  {
    key: 'faturamento',
    label: 'Faturamento',
    sublabel: 'Hotmart',
    fmt: (v) => fmtBRL(v),
    icon: Receipt,
    color: 'var(--mit-success)',
    inverted: false,
  },
  {
    key: 'roasReal',
    label: 'ROAS Real',
    sublabel: 'Hotmart ÷ Meta',
    fmt: (v) => v.toFixed(2) + 'x',
    icon: TrendingUp,
    color: 'var(--mit-gold)',
    inverted: false,
  },
]

// ─── Mini card definitions ──────────────────────────────────────────────────
type MiniKey = 'cpaReal' | 'ctr' | 'cpm' | 'vendas'

interface MiniDef {
  key: MiniKey
  label: string
  fmt: (v: number) => string
  icon: React.ElementType
  color: string
  inverted: boolean
}

const MINI_DEFS: MiniDef[] = [
  {
    key: 'cpaReal',
    label: 'CPA Real',
    fmt: (v) => (v > 0 ? fmtBRL(v) : '—'),
    icon: Target,
    color: 'var(--mit-success)',
    inverted: true,
  },
  {
    key: 'ctr',
    label: 'CTR',
    fmt: (v) => fmtPct(v, 2),
    icon: MousePointer,
    color: '#60A5FA',
    inverted: false,
  },
  {
    key: 'cpm',
    label: 'CPM',
    fmt: (v) => fmtBRL(v),
    icon: Zap,
    color: 'var(--mit-warning)',
    inverted: true,
  },
  {
    key: 'vendas',
    label: 'Vendas',
    fmt: (v) => fmtNum(v),
    icon: ShoppingCart,
    color: 'var(--mit-success)',
    inverted: false,
  },
]

// ─── Component ──────────────────────────────────────────────────────────────
export function AdPerformanceSection({ datePreset, tagFilter, customRange }: Props) {
  // Meta Ads data
  const { data, isLoading, error } = useQuery({
    queryKey: ['insights', datePreset, tagFilter, customRange],
    queryFn: () =>
      fetch(`/api/insights?${buildDateParams(datePreset, customRange ?? null, tagFilter)}`)
        .then(r => r.json()),
    refetchInterval: 5 * 60 * 1000,
  })

  // Hotmart data (independent query)
  const { data: hotmart } = useQuery<HotmartData>({
    queryKey: ['hotmart', datePreset, customRange],
    queryFn: () =>
      fetch(`/api/hotmart?${buildDateParams(datePreset, customRange ?? null, '')}`)
        .then(r => {
          if (!r.ok) throw new Error('Hotmart API error')
          return r.json()
        }),
    refetchInterval: 15 * 60 * 1000,  // 15min
    staleTime: 10 * 60 * 1000,        // 10min
    retry: 1,
  })

  if (isLoading) return <KpiSkeleton />
  if (error || data?.error) {
    return (
      <div
        className="rounded-xl border p-5 text-sm text-red-400"
        style={{ background: 'var(--mit-bg-card)', borderColor: 'var(--mit-border)' }}
      >
        Erro ao carregar métricas: {data?.error ?? String(error)}
      </div>
    )
  }

  const kpis: KPIs | null = data?.kpis ?? null
  const prevKpis: KPIs | null = data?.prevKpis ?? null

  if (!kpis) {
    return (
      <div
        className="rounded-xl border p-5 text-sm"
        style={{
          background: 'var(--mit-bg-card)',
          borderColor: 'var(--mit-border)',
          color: 'var(--mit-text-subtle)',
        }}
      >
        Sem dados para o período selecionado.
      </div>
    )
  }

  // ── Cross-reference: Hotmart × Meta ──
  const hotmartRevenue = hotmart?.totalRevenue ?? 0
  const hotmartSales = hotmart?.totalSales ?? 0
  const metaSpend = kpis.totalSpend
  const roasReal = metaSpend > 0 ? hotmartRevenue / metaSpend : 0
  const cpaReal = hotmartSales > 0 ? metaSpend / hotmartSales : 0

  // Build hero values map
  const heroValues: Record<HeroKey, number> = {
    totalSpend: metaSpend,
    faturamento: hotmartRevenue,
    roasReal,
  }
  const heroPrevValues: Record<HeroKey, number | undefined> = {
    totalSpend: prevKpis?.totalSpend,
    faturamento: undefined,  // sem dado anterior do Hotmart por enquanto
    roasReal: undefined,
  }

  // Build mini values map
  const miniValues: Record<MiniKey, number> = {
    cpaReal,
    ctr: kpis.ctr,
    cpm: kpis.cpm,
    vendas: hotmartSales,
  }
  const miniPrevValues: Record<MiniKey, number | undefined> = {
    cpaReal: undefined,
    ctr: prevKpis?.ctr,
    cpm: prevKpis?.cpm,
    vendas: undefined,
  }

  return (
    <div className="space-y-3">
      {/* Hero cards: Gasto + Faturamento + ROAS Real */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {HERO_DEFS.map((def, i) => {
          const Icon = def.icon
          const raw = heroValues[def.key]
          const prev = heroPrevValues[def.key]

          // Se Hotmart não carregou ainda, mostra placeholder para cards Hotmart
          const isHotmartCard = def.key === 'faturamento' || def.key === 'roasReal'
          const hotmartLoading = isHotmartCard && !hotmart

          return (
            <motion.div
              key={def.key}
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.07, duration: 0.4, ease: 'easeOut' }}
              className="relative rounded-xl border overflow-hidden p-6"
              style={{ background: 'var(--mit-bg-card)', borderColor: 'var(--mit-border)' }}
            >
              <div
                className="absolute top-0 left-0 right-0 h-px"
                style={{
                  background: `linear-gradient(90deg, ${def.color}, transparent 70%)`,
                }}
              />

              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 mb-4">
                    <p
                      className="text-xs font-medium tracking-widest uppercase"
                      style={{ color: 'var(--mit-text-subtle)' }}
                    >
                      {def.label}
                    </p>
                    {def.sublabel && (
                      <span
                        className="text-[10px] px-1.5 py-0.5 rounded font-medium"
                        style={{
                          background: def.color + '15',
                          color: def.color,
                        }}
                      >
                        {def.sublabel}
                      </span>
                    )}
                  </div>

                  {hotmartLoading ? (
                    <div className="h-10 w-32 rounded animate-pulse" style={{ background: 'var(--mit-bg-elevated)' }} />
                  ) : (
                    <p
                      className="text-4xl font-bold font-mono leading-none mb-3"
                      style={{ color: def.color }}
                    >
                      {raw > 0 ? def.fmt(raw) : '—'}
                    </p>
                  )}

                  {!customRange && prev !== undefined && prev > 0 && (
                    <div className="flex items-center gap-2 flex-wrap">
                      <DeltaBadge current={raw} previous={prev} inverted={def.inverted} />
                      <span className="text-xs" style={{ color: 'var(--mit-text-subtle)' }}>
                        vs período anterior
                      </span>
                    </div>
                  )}
                </div>

                <div
                  className="p-3 rounded-xl shrink-0"
                  style={{ background: def.color + '18' }}
                >
                  <Icon size={22} style={{ color: def.color }} />
                </div>
              </div>
            </motion.div>
          )
        })}
      </div>

      {/* Mini cards: CPA Real, CTR, CPM, Vendas */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {MINI_DEFS.map((def, i) => {
          const Icon = def.icon
          const raw = miniValues[def.key]
          const prev = miniPrevValues[def.key]

          const isHotmartMini = def.key === 'cpaReal' || def.key === 'vendas'
          const hotmartLoading = isHotmartMini && !hotmart

          return (
            <motion.div
              key={def.key}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: (i + 3) * 0.07, duration: 0.4, ease: 'easeOut' }}
              className="rounded-xl border p-4"
              style={{
                background: 'var(--mit-bg-elevated)',
                borderColor: 'var(--mit-border)',
              }}
            >
              <div className="flex items-center justify-between mb-3">
                <p
                  className="text-xs font-medium tracking-widest uppercase"
                  style={{ color: 'var(--mit-text-subtle)' }}
                >
                  {def.label}
                </p>
                <Icon size={13} style={{ color: def.color }} />
              </div>

              {hotmartLoading ? (
                <div className="h-6 w-20 rounded animate-pulse" style={{ background: 'var(--mit-bg-card)' }} />
              ) : (
                <p
                  className="text-xl font-bold font-mono leading-none"
                  style={{ color: def.color }}
                >
                  {raw > 0 ? def.fmt(raw) : '—'}
                </p>
              )}

              {!customRange && prev !== undefined && prev > 0 && (
                <div className="mt-2">
                  <DeltaBadge
                    current={raw}
                    previous={prev}
                    inverted={def.inverted}
                    mini
                  />
                </div>
              )}
            </motion.div>
          )
        })}
      </div>

      {/* Source breakdown (se Hotmart carregou) */}
      {hotmart && hotmart.totalSales > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
          className="flex items-center gap-4 px-4 py-2.5 rounded-lg"
          style={{ background: 'var(--mit-bg-elevated)', border: '1px solid var(--mit-border)' }}
        >
          <span className="text-xs" style={{ color: 'var(--mit-text-subtle)' }}>
            Origem das vendas:
          </span>
          <SourcePill label="Meta Ads" count={hotmart.bySource.metaAds.sales} total={hotmart.totalSales} color="var(--mit-accent)" />
          <SourcePill label="Orgânico" count={hotmart.bySource.organic.sales} total={hotmart.totalSales} color="var(--mit-success)" />
          {hotmart.bySource.other.sales > 0 && (
            <SourcePill label="Outros" count={hotmart.bySource.other.sales} total={hotmart.totalSales} color="var(--mit-text-subtle)" />
          )}
          {/* Receita REAL atribuída por campanha (sck Hotmart) */}
          {(hotmart.byCampaign.frio.sales > 0 || hotmart.byCampaign.quente.sales > 0) && (
            <span className="h-4 w-px shrink-0" style={{ background: 'var(--mit-border)' }} />
          )}
          {hotmart.byCampaign.frio.sales > 0 && (
            <SourcePill label={`🔵 Frio · ${fmtBRL(hotmart.byCampaign.frio.revenue)}`} count={hotmart.byCampaign.frio.sales} total={hotmart.totalSales} color="#4A9EE8" />
          )}
          {hotmart.byCampaign.quente.sales > 0 && (
            <SourcePill label={`🔴 Quente · ${fmtBRL(hotmart.byCampaign.quente.revenue)}`} count={hotmart.byCampaign.quente.sales} total={hotmart.totalSales} color="var(--mit-danger)" />
          )}
          <span className="ml-auto text-[10px]" style={{ color: 'var(--mit-text-subtle)' }}>
            Líquido: {fmtBRL(hotmart.netRevenue)}
          </span>
        </motion.div>
      )}
    </div>
  )
}

// ─── Source breakdown pill ──────────────────────────────────────────────────
function SourcePill({ label, count, total, color }: {
  label: string; count: number; total: number; color: string
}) {
  if (count === 0) return null
  const pct = total > 0 ? Math.round(count / total * 100) : 0
  return (
    <span className="flex items-center gap-1.5 text-xs font-medium" style={{ color }}>
      <span className="w-1.5 h-1.5 rounded-full" style={{ background: color }} />
      {label}: {count} ({pct}%)
    </span>
  )
}

// ─── Skeleton ───────────────────────────────────────────────────────────────
function KpiSkeleton() {
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {[...Array(3)].map((_, i) => (
          <div
            key={i}
            className="rounded-xl border p-6 animate-pulse"
            style={{
              background: 'var(--mit-bg-card)',
              borderColor: 'var(--mit-border)',
              height: 140,
            }}
          >
            <div className="h-2.5 w-20 rounded mb-4" style={{ background: 'var(--mit-bg-elevated)' }} />
            <div className="h-9 w-40 rounded mb-3" style={{ background: 'var(--mit-bg-elevated)' }} />
            <div className="h-5 w-24 rounded" style={{ background: 'var(--mit-bg-elevated)' }} />
          </div>
        ))}
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[...Array(4)].map((_, i) => (
          <div
            key={i}
            className="rounded-xl border p-4 animate-pulse"
            style={{
              background: 'var(--mit-bg-elevated)',
              borderColor: 'var(--mit-border)',
              height: 96,
            }}
          >
            <div className="h-2 w-12 rounded mb-3" style={{ background: 'var(--mit-bg-card)' }} />
            <div className="h-6 w-20 rounded mb-2" style={{ background: 'var(--mit-bg-card)' }} />
            <div className="h-3 w-14 rounded" style={{ background: 'var(--mit-bg-card)' }} />
          </div>
        ))}
      </div>
    </div>
  )
}
