// components/FunnelSection.tsx
'use client'
import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { motion } from 'motion/react'
import { fmtNum, fmtBRL } from '@/lib/formatters'
import { buildDateParams, type CustomRange } from '@/lib/date-utils'
import { AlertTriangle, TrendingUp } from 'lucide-react'
import type { FunnelStage, HealthMetric } from '@/lib/funnel-resolver'

// ── Page filter config ────────────────────────────────────────────────────────
// ICM3 (junho 2026): LP unificada (/imersao-claude-junho/) — frio + quente ativos.
// Dropdown permite filtrar o funil por campanha específica ou ver tudo somado.
const PAGE_FILTERS: { id: string; label: string; campaignIds: string[] | null }[] = [
  { id: 'all',       label: 'Todas as campanhas',          campaignIds: null },
  { id: 'principal', label: 'Principal (Frio)',            campaignIds: ['120246401766560745'] },
  { id: 'rmkt',      label: 'Remarketing (Quente)',        campaignIds: ['120246401766780745'] },
  { id: 'teste',     label: 'C1 — Teste de Criativo',      campaignIds: ['120246401766700745'] },
]

interface Props {
  campaignId?: string
  objective: string
  datePreset: string
  tagFilter?: string
  customRange?: CustomRange
}

// ── Rank-based widths for smooth visual funnel ──────────────────────────────
const RANK_W: Record<number, number[]> = {
  2: [94, 42],
  3: [94, 62, 32],
  4: [94, 72, 50, 28],
  5: [94, 76, 58, 40, 24],
  6: [94, 80, 64, 50, 36, 22],
}
function rankWidths(n: number): number[] {
  return RANK_W[n] ?? Array.from({ length: n }, (_, i) => Math.round(94 - (i / (n - 1)) * 72))
}

// ── Palette-derived stage colors (gold → accent gradient) ───────────────────
function stageGradient(t: number): { from: string; to: string } {
  // t: 0 = top (gold), 1 = bottom (accent)
  const r1 = Math.round(201 + t * 16)   // 201→217
  const g1 = Math.round(164 - t * 45)   // 164→119
  const b1 = Math.round(90 - t * 3)     // 90→87
  const a1 = 0.7 - t * 0.15             // 0.7→0.55

  const r2 = Math.round(190 + t * 20)
  const g2 = Math.round(150 - t * 50)
  const b2 = Math.round(80 - t * 5)
  const a2 = a1 - 0.12

  return {
    from: `rgba(${r1},${g1},${b1},${a1.toFixed(2)})`,
    to:   `rgba(${r2},${g2},${b2},${a2.toFixed(2)})`,
  }
}

// ── Health status color helpers ─────────────────────────────────────────────
const STATUS_COLORS = {
  green:  { dot: 'var(--mit-success)', bg: 'rgba(76,175,130,0.08)',  border: 'rgba(76,175,130,0.18)' },
  yellow: { dot: 'var(--mit-warning)', bg: 'rgba(240,180,41,0.08)',  border: 'rgba(240,180,41,0.18)' },
  red:    { dot: 'var(--mit-danger)',  bg: 'rgba(229,62,62,0.08)',   border: 'rgba(229,62,62,0.18)' },
}

// ── Inline health badge ─────────────────────────────────────────────────────
function HealthBadge({ metric }: { metric: HealthMetric }) {
  const c = STATUS_COLORS[metric.status]
  return (
    <div
      className="inline-flex items-center gap-1.5 px-2 py-1 rounded-md"
      style={{ background: c.bg, border: `1px solid ${c.border}` }}
      title={metric.benchmarkLabel}
    >
      <span
        className="w-1.5 h-1.5 rounded-full shrink-0"
        style={{ background: c.dot, boxShadow: `0 0 5px ${c.dot}50` }}
      />
      <span className="text-[9px] font-semibold uppercase tracking-wider" style={{ color: 'var(--mit-text-subtle)' }}>
        {metric.label}
      </span>
      <span className="text-[11px] font-mono font-bold" style={{ color: c.dot }}>
        {metric.formatted}
      </span>
    </div>
  )
}

export function FunnelSection({ campaignId, objective, datePreset, tagFilter, customRange }: Props) {
  const [pageFilter, setPageFilter] = useState('all')

  const activePageFilter = PAGE_FILTERS.find(p => p.id === pageFilter)

  const buildUrl = (preset: string) => {
    const p = new URLSearchParams({ objective })
    if (customRange && preset === 'custom') {
      p.set('since', customRange.since)
      p.set('until', customRange.until)
    } else {
      p.set('datePreset', preset)
    }
    if (activePageFilter?.campaignIds) {
      p.set('campaignIds', activePageFilter.campaignIds.join(','))
    } else if (tagFilter !== undefined) {
      p.set('tagFilter', tagFilter)
    } else if (campaignId) {
      p.set('campaignId', campaignId)
    }
    return `/api/funnel?${p}`
  }

  const { data, isLoading, error } = useQuery({
    queryKey: ['funnel', tagFilter ?? campaignId, objective, datePreset, pageFilter, customRange],
    queryFn: async () => {
      const r = await fetch(buildUrl(datePreset))
      if (!r.ok) { const b = await r.json().catch(() => ({})); throw new Error(b?.error ?? `HTTP ${r.status}`) }
      return r.json()
    },
    refetchInterval: 5 * 60 * 1000,
    enabled: !!(tagFilter !== undefined || campaignId),
  })

  const needsFallback = !isLoading && !error && (data?.stages ?? []).length === 0 && datePreset !== 'last_7d'
  const { data: fallbackData, isLoading: fallbackLoading } = useQuery({
    queryKey: ['funnel', tagFilter ?? campaignId, objective, 'last_7d'],
    queryFn: async () => {
      const r = await fetch(buildUrl('last_7d'))
      if (!r.ok) { const b = await r.json().catch(() => ({})); throw new Error(b?.error ?? `HTTP ${r.status}`) }
      return r.json()
    },
    refetchInterval: 5 * 60 * 1000,
    enabled: needsFallback && !!(tagFilter !== undefined || campaignId),
  })

  const activeData    = needsFallback ? (fallbackData ?? data) : data
  const activeLoading = isLoading || (needsFallback && fallbackLoading)
  const isFallback    = needsFallback && (fallbackData?.stages ?? []).length > 0

  if (activeLoading) return <FunnelSkeleton />
  if (error || activeData?.error) return (
    <div className="text-red-400 p-4 rounded-xl" style={{ background: 'var(--mit-bg-card)' }}>
      Erro ao carregar funil: {activeData?.error ?? String(error)}
    </div>
  )

  const allStages: FunnelStage[] = activeData?.stages ?? []
  const health: HealthMetric[] = activeData?.health ?? []
  if (allStages.length === 0) return <EmptyState />

  const checkoutStage    = allStages.find(s => s.key === 'checkout')
  const purchaseStageRaw = allStages.find(s => s.key === 'purchases')
  const hasPendingCheckout = (checkoutStage?.value ?? 0) > 0 && (purchaseStageRaw?.value ?? 0) === 0

  const stages = allStages.filter((s, i) => {
    if (i === 0) return s.value > 0
    if (s.key === 'purchases') return s.value > 0
    return s.value > 0
  })
  if (stages.length === 0) return <EmptyState />

  const widths        = rankWidths(stages.length)
  const purchaseStage = stages.find(s => s.key === 'purchases')
  const hasRevenue    = purchaseStage?.revenue !== undefined && purchaseStage.revenue > 0

  return (
    <section
      className="rounded-xl border overflow-hidden transition-shadow duration-300"
      style={{
        background: 'var(--mit-bg-card)',
        borderColor: 'var(--mit-border)',
        boxShadow: '0 1px 3px rgba(0,0,0,0.2), inset 0 1px 0 rgba(255,255,255,0.03)',
      }}
    >
      {/* Header */}
      <div className="p-6 pb-0">
        <div className="flex items-center justify-between gap-4 flex-wrap mb-1">
          <h2 className="text-xl font-semibold" style={{ color: 'var(--mit-gold)' }}>
            Funil Completo
          </h2>
          <div className="relative inline-flex">
            <select
              value={pageFilter}
              onChange={e => setPageFilter(e.target.value)}
              className="appearance-none pl-3 pr-8 py-1.5 rounded-md text-xs font-medium cursor-pointer outline-none transition-colors duration-150 focus:ring-2"
              style={{
                background: 'var(--mit-bg-elevated)',
                color: 'var(--mit-gold)',
                border: '1px solid rgba(201,164,90,0.3)',
                minWidth: 180,
              }}
              aria-label="Filtrar funil por campanha"
            >
              {PAGE_FILTERS.map(pf => (
                <option key={pf.id} value={pf.id} style={{ background: 'var(--mit-bg-card)' }}>
                  {pf.label}
                </option>
              ))}
            </select>
            {/* custom caret */}
            <svg
              className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2"
              width="10" height="10" viewBox="0 0 10 10" fill="none"
            >
              <path d="M2 4l3 3 3-3" stroke="var(--mit-gold)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>
        </div>
        <p className="text-sm mt-1" style={{ color: 'var(--mit-text-subtle)' }}>
          {stages.length} etapas — Objetivo: {activeData?.type === 'purchase' ? 'Compra' : 'Lead'}
          {activeData?.spend && ` · Gasto: ${fmtBRL(parseFloat(activeData.spend))}`}
          {isFallback && (
            <span className="ml-2 text-[11px] px-1.5 py-0.5 rounded"
              style={{ background: 'rgba(201,164,90,0.12)', color: 'var(--mit-gold)' }}>
              ↩ últimos 7 dias
            </span>
          )}
        </p>
      </div>

      {/* ── Funnel body ── */}
      <div
        className="px-6 pt-6 pb-8"
        style={{ background: 'radial-gradient(ellipse at 50% 0%, rgba(201,164,90,0.03) 0%, transparent 60%)' }}
      >
        <div className="mx-auto" style={{ maxWidth: '480px' }}>
          {stages.map((stage, i) => {
            const topW    = widths[i]
            const bottomW = widths[i + 1] ?? Math.round(widths[i] * 0.55)
            const isLast  = i === stages.length - 1
            const nextStage = stages[i + 1]
            const t = stages.length <= 1 ? 0 : i / (stages.length - 1)
            const grad = stageGradient(t)

            // Clip-path
            const tl = (100 - topW) / 2
            const tr = (100 + topW) / 2
            const bl = (100 - bottomW) / 2
            const br = (100 + bottomW) / 2

            // Health metrics for THIS transition
            const transitionHealth = !isLast && nextStage
              ? health.filter(m => m.transition[0] === stage.key && m.transition[1] === nextStage.key)
              : []

            return (
              <motion.div
                key={stage.key}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.1, duration: 0.5, ease: [0.25, 0.46, 0.45, 0.94] }}
              >
                {/* Trapezoid stage */}
                <div className="relative w-full" style={{ height: '60px' }}>
                  {/* Shape */}
                  <div
                    style={{
                      position: 'absolute', inset: 0,
                      clipPath: `polygon(${tl}% 0%, ${tr}% 0%, ${br}% 100%, ${bl}% 100%)`,
                      background: `linear-gradient(160deg, ${grad.from}, ${grad.to})`,
                      boxShadow: '0 4px 12px rgba(0,0,0,0.2), inset 0 1px 0 rgba(255,255,255,0.08)',
                    }}
                  />
                  {/* Glass highlight */}
                  <div
                    style={{
                      position: 'absolute', inset: 0,
                      clipPath: `polygon(${tl}% 0%, ${tr}% 0%, ${br}% 100%, ${bl}% 100%)`,
                      background: 'linear-gradient(180deg, rgba(255,255,255,0.1) 0%, transparent 45%)',
                      pointerEvents: 'none',
                    }}
                  />
                  {/* Content */}
                  <div className="absolute inset-0 flex flex-col items-center justify-center z-10">
                    <div className="flex items-baseline gap-2">
                      <span
                        className="text-[11px] font-medium uppercase"
                        style={{ color: 'rgba(255,255,255,0.85)', letterSpacing: '0.12em', textShadow: '0 1px 2px rgba(0,0,0,0.25)' }}
                      >
                        {stage.label}
                      </span>
                      <span
                        className="font-mono font-bold text-lg"
                        style={{ color: '#fff', textShadow: '0 1px 3px rgba(0,0,0,0.3)' }}
                      >
                        {fmtNum(stage.value)}
                      </span>
                    </div>
                    {stage.cost !== undefined && stage.cost > 0 && (
                      <span className="text-[10px] font-mono mt-0.5" style={{ color: 'rgba(255,255,255,0.5)' }}>
                        {stage.costLabel}: {fmtBRL(stage.cost)}
                      </span>
                    )}
                  </div>
                </div>

                {/* ── Connector with health indicators ── */}
                {!isLast && (
                  <div className="flex flex-col items-center py-2.5 gap-1.5">
                    {/* Health badges inline */}
                    {transitionHealth.length > 0 && (
                      <div className="flex flex-wrap items-center justify-center gap-1.5">
                        {transitionHealth.map(m => (
                          <HealthBadge key={m.key} metric={m} />
                        ))}
                      </div>
                    )}
                    {/* Bottleneck badge */}
                    {(nextStage?.dropPct ?? 0) > 70 && (
                      <span
                        className="inline-flex items-center gap-1 text-[9px] px-1.5 py-0.5 rounded-sm font-semibold"
                        style={{ background: 'rgba(229,62,62,0.12)', color: 'var(--mit-danger)', border: '1px solid rgba(229,62,62,0.25)' }}
                      >
                        <AlertTriangle size={8} /> Gargalo
                      </span>
                    )}
                  </div>
                )}

                {/* Revenue */}
                {stage.revenue !== undefined && stage.revenue > 0 && (
                  <motion.div
                    initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                    transition={{ delay: i * 0.1 + 0.35 }}
                    className="flex items-center justify-center gap-1.5 pt-1"
                  >
                    <TrendingUp size={11} style={{ color: 'var(--mit-success)' }} />
                    <span className="text-xs font-semibold" style={{ color: 'var(--mit-success)' }}>
                      Faturamento: {fmtBRL(stage.revenue)}
                    </span>
                  </motion.div>
                )}
              </motion.div>
            )
          })}
        </div>
      </div>

      {/* ── Footer alerts ── */}
      <div className="px-6 pb-6 space-y-3">
        {/* Critical health metrics (red status based on benchmarks) */}
        {(() => {
          const redMetrics = health.filter(m => m.status === 'red')
          const yellowMetrics = health.filter(m => m.status === 'yellow')
          if (redMetrics.length === 0 && yellowMetrics.length === 0) return null

          return (
            <motion.div
              initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
              transition={{ delay: stages.length * 0.1 + 0.15 }}
              className="p-4 rounded-lg relative overflow-hidden"
              style={{
                background: redMetrics.length > 0 ? 'rgba(229,62,62,0.1)' : 'rgba(240,180,41,0.08)',
                border: `1px solid ${redMetrics.length > 0 ? 'rgba(229,62,62,0.35)' : 'rgba(240,180,41,0.3)'}`,
                boxShadow: redMetrics.length > 0
                  ? '0 0 20px rgba(229,62,62,0.08), inset 0 0 30px rgba(229,62,62,0.03)'
                  : '0 0 16px rgba(240,180,41,0.06)',
              }}
            >
              {/* Left accent bar */}
              <div
                className="absolute left-0 top-0 bottom-0 w-1 rounded-l-lg"
                style={{ background: redMetrics.length > 0 ? 'var(--mit-danger)' : 'var(--mit-warning)' }}
              />
              <div className="flex items-center gap-2 mb-3 ml-2">
                <div className="p-1.5 rounded-md"
                  style={{ background: redMetrics.length > 0 ? 'rgba(229,62,62,0.2)' : 'rgba(240,180,41,0.15)' }}>
                  <AlertTriangle size={14} style={{ color: redMetrics.length > 0 ? 'var(--mit-danger)' : 'var(--mit-warning)' }} />
                </div>
                <p className="text-sm font-bold uppercase tracking-wider"
                  style={{ color: redMetrics.length > 0 ? 'var(--mit-danger)' : 'var(--mit-warning)' }}>
                  {redMetrics.length > 0 ? 'Pontos Críticos' : 'Atenção'}
                </p>
                <span className="text-[10px] px-2 py-0.5 rounded-full font-bold font-mono ml-auto"
                  style={{
                    background: redMetrics.length > 0 ? 'rgba(229,62,62,0.2)' : 'rgba(240,180,41,0.15)',
                    color: redMetrics.length > 0 ? 'var(--mit-danger)' : 'var(--mit-warning)',
                  }}>
                  {redMetrics.length + yellowMetrics.length}
                </span>
              </div>
              <div className="space-y-2 ml-2">
                {/* Red metrics first */}
                {redMetrics.map(m => {
                  const BENCHMARK_DETAIL: Record<string, string> = {
                    ctr: 'Benchmark: acima de 2%',
                    cpm: 'Benchmark: R$80 a R$100+',
                    connect: 'Benchmark: 85% a 90%',
                    page_conv: 'Benchmark: 7% a 13%',
                    checkout_conv: 'Benchmark: 38% a 60%',
                  }
                  return (
                    <div key={m.key} className="flex items-center gap-3 p-2.5 rounded-md"
                      style={{ background: 'rgba(229,62,62,0.06)' }}>
                      <span className="w-2 h-2 rounded-full shrink-0"
                        style={{ background: 'var(--mit-danger)', boxShadow: '0 0 6px rgba(229,62,62,0.5)' }} />
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-semibold" style={{ color: 'var(--mit-text)' }}>
                          {m.label}
                        </p>
                        <p className="text-[11px]" style={{ color: 'var(--mit-text-muted)' }}>
                          {BENCHMARK_DETAIL[m.key] ?? m.benchmarkLabel}
                        </p>
                      </div>
                      <span className="text-sm font-bold font-mono shrink-0" style={{ color: 'var(--mit-danger)' }}>
                        {m.formatted}
                      </span>
                    </div>
                  )
                })}
                {/* Yellow metrics below */}
                {yellowMetrics.map(m => {
                  const BENCHMARK_DETAIL: Record<string, string> = {
                    ctr: 'Benchmark: acima de 2%',
                    cpm: 'Benchmark: R$80 a R$100+',
                    connect: 'Benchmark: 85% a 90%',
                    page_conv: 'Benchmark: 7% a 13%',
                    checkout_conv: 'Benchmark: 38% a 60%',
                  }
                  return (
                    <div key={m.key} className="flex items-center gap-3 p-2.5 rounded-md"
                      style={{ background: 'rgba(240,180,41,0.05)' }}>
                      <span className="w-2 h-2 rounded-full shrink-0"
                        style={{ background: 'var(--mit-warning)', boxShadow: '0 0 6px rgba(240,180,41,0.4)' }} />
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-semibold" style={{ color: 'var(--mit-text)' }}>
                          {m.label}
                        </p>
                        <p className="text-[11px]" style={{ color: 'var(--mit-text-muted)' }}>
                          {BENCHMARK_DETAIL[m.key] ?? m.benchmarkLabel}
                        </p>
                      </div>
                      <span className="text-sm font-bold font-mono shrink-0" style={{ color: 'var(--mit-warning)' }}>
                        {m.formatted}
                      </span>
                    </div>
                  )
                })}
              </div>
            </motion.div>
          )
        })()}

        {/* Pending checkout — urgency alert */}
        {hasPendingCheckout && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }}
            transition={{ delay: stages.length * 0.1 + 0.1 }}
            className="p-4 rounded-lg relative overflow-hidden"
            style={{
              background: 'rgba(240,180,41,0.08)',
              border: '1px solid rgba(240,180,41,0.3)',
              boxShadow: '0 0 16px rgba(240,180,41,0.06)',
            }}
          >
            <div className="absolute left-0 top-0 bottom-0 w-1 rounded-l-lg" style={{ background: 'var(--mit-warning)' }} />
            <div className="flex items-center gap-3 ml-2">
              <div className="p-1.5 rounded-md" style={{ background: 'rgba(240,180,41,0.15)' }}>
                <AlertTriangle size={14} style={{ color: 'var(--mit-warning)' }} />
              </div>
              <div className="flex-1">
                <p className="text-xs font-bold" style={{ color: 'var(--mit-warning)' }}>
                  {checkoutStage!.value} checkout{checkoutStage!.value > 1 ? 's' : ''} pendente{checkoutStage!.value > 1 ? 's' : ''}
                </p>
                <p className="text-[11px] mt-0.5" style={{ color: 'var(--mit-text-muted)' }}>
                  Nenhuma compra finalizada neste período — leads quentes esperando conversão
                </p>
              </div>
              <span
                className="text-lg font-bold font-mono shrink-0"
                style={{ color: 'var(--mit-warning)' }}
              >
                {checkoutStage!.value}
              </span>
            </div>
          </motion.div>
        )}

        {/* Revenue summary */}
        {hasRevenue && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }}
            transition={{ delay: stages.length * 0.1 + 0.3 }}
            className="flex items-center justify-between p-4 rounded-lg"
            style={{ background: 'rgba(76,175,130,0.05)', border: '1px solid rgba(76,175,130,0.12)' }}
          >
            <div>
              <p className="text-[10px] uppercase tracking-wider mb-1" style={{ color: 'var(--mit-text-subtle)' }}>Faturamento estimado</p>
              <p className="text-xl font-bold font-mono" style={{ color: 'var(--mit-success)' }}>
                {fmtBRL(purchaseStage!.revenue!)}
              </p>
            </div>
            <div className="text-right">
              <p className="text-[10px] uppercase tracking-wider mb-1" style={{ color: 'var(--mit-text-subtle)' }}>Compras · CPA</p>
              <p className="text-sm font-mono font-semibold" style={{ color: 'var(--mit-text-muted)' }}>
                {fmtNum(purchaseStage!.value)} · {purchaseStage!.cost ? fmtBRL(purchaseStage!.cost) : '—'}
              </p>
            </div>
          </motion.div>
        )}
      </div>
    </section>
  )
}

function EmptyState() {
  return (
    <section className="rounded-xl border p-6 flex flex-col items-center justify-center min-h-[200px] gap-2"
      style={{ background: 'var(--mit-bg-card)', borderColor: 'var(--mit-border)' }}>
      <p className="text-sm font-medium" style={{ color: 'var(--mit-text-muted)' }}>Sem dados de funil para este período</p>
      <p className="text-xs" style={{ color: 'var(--mit-text-subtle)' }}>Nenhuma impressão registrada</p>
    </section>
  )
}

function FunnelSkeleton() {
  return (
    <section className="rounded-xl border p-6 animate-pulse" style={{ background: 'var(--mit-bg-card)', borderColor: 'var(--mit-border)' }}>
      <div className="h-5 w-40 rounded mb-2" style={{ background: 'var(--mit-bg-elevated)' }} />
      <div className="h-3 w-64 rounded mb-8" style={{ background: 'var(--mit-bg-elevated)' }} />
      <div className="mx-auto" style={{ maxWidth: '480px' }}>
        {[94, 72, 50, 28].map((w, i) => (
          <div key={i} className="mb-4 mx-auto" style={{ width: `${w}%`, height: '60px', background: 'var(--mit-bg-elevated)', borderRadius: '4px' }} />
        ))}
      </div>
    </section>
  )
}
