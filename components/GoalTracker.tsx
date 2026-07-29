// components/GoalTracker.tsx
'use client'
import { useQuery } from '@tanstack/react-query'
import { Target, Lock } from 'lucide-react'
import type { CustomRange } from '@/lib/date-utils'

interface Props {
  datePreset: string
  customRange?: CustomRange
}

// ─── Duas metas empilhadas ───────────────────────────────────────────────────
// Topo  → ICM1 (abril) + ICM2 (maio): meta ANTIGA de 145, TRAVADA (edições
//          encerradas, número não muda mais).
// Baixo → ICM3 (junho): meta NOVA de 150, ao vivo. Conta a partir do dia em que
//          as vendas de junho começaram (10/06).
const LIFETIME_SINCE   = '2025-01-01'
const ICM3_CUTOFF      = '2026-06-10'   // 1ª venda da edição de junho
const LEGACY_GOAL      = 145            // meta travada ICM1 + ICM2
const ICM3_GOAL        = 150            // meta nova ICM3

interface DailyPoint { date: string; sales: number; revenue: number }

export function GoalTracker({ datePreset: _datePreset, customRange: _customRange }: Props) {
  // datePreset/customRange ignorados de propósito: as metas são acumuladas,
  // não por período. Puxamos o histórico inteiro e separamos no corte de junho.
  const { data, isLoading } = useQuery({
    queryKey: ['hotmart-lifetime'],
    queryFn: () => {
      const today = new Date().toISOString().slice(0, 10)
      return fetch(`/api/hotmart?since=${LIFETIME_SINCE}&until=${today}`).then(r => r.json())
    },
    refetchInterval: 3 * 60 * 1000,
  })

  const daily: DailyPoint[] = data?.daily ?? []
  // Comparação lexicográfica de datas ISO (YYYY-MM-DD) funciona como ordenação real.
  const legacyTotal = daily.filter(d => d.date <  ICM3_CUTOFF).reduce((s, d) => s + d.sales, 0)
  const icm3Total   = daily.filter(d => d.date >= ICM3_CUTOFF).reduce((s, d) => s + d.sales, 0)

  if (isLoading) {
    return (
      <div
        className="rounded-xl border p-4 animate-pulse space-y-4"
        style={{ background: 'var(--mit-bg-card)', borderColor: 'var(--mit-border)' }}
      >
        <div>
          <div className="h-3 w-40 rounded mb-3" style={{ background: 'var(--mit-bg-elevated)' }} />
          <div className="h-2 w-full rounded" style={{ background: 'var(--mit-bg-elevated)' }} />
        </div>
        <div>
          <div className="h-3 w-32 rounded mb-3" style={{ background: 'var(--mit-bg-elevated)' }} />
          <div className="h-2 w-full rounded" style={{ background: 'var(--mit-bg-elevated)' }} />
        </div>
      </div>
    )
  }

  return (
    <div
      className="rounded-xl border p-4 space-y-4"
      style={{ background: 'var(--mit-bg-card)', borderColor: 'var(--mit-border)' }}
    >
      {/* ── Meta ANTIGA (ICM1 + ICM2) — travada ── */}
      <GoalBar
        title="Meta ICM1 + ICM2"
        subtitle="abril · maio"
        total={legacyTotal}
        goal={LEGACY_GOAL}
        locked
      />

      {/* divisória sutil */}
      <div style={{ height: 1, background: 'var(--mit-border)' }} />

      {/* ── Meta NOVA (ICM3) — ao vivo ── */}
      <GoalBar
        title="Meta Atual"
        subtitle="junho"
        total={icm3Total}
        goal={ICM3_GOAL}
      />
    </div>
  )
}

// ─── Barra individual ─────────────────────────────────────────────────────────
function GoalBar({
  title,
  subtitle,
  total,
  goal,
  locked = false,
}: {
  title: string
  subtitle: string
  total: number
  goal: number
  locked?: boolean
}) {
  const pct = Math.min((total / goal) * 100, 100)

  // Rampa de cor: vermelho → ouro → verde. Metas travadas/concluídas em verde.
  const reached = total >= goal
  const color =
    locked
      ? (reached ? 'var(--mit-success)' : 'var(--mit-gold)')
      : pct >= 80 ? 'var(--mit-success)'
      : pct >= 40 ? 'var(--mit-gold)'
      : 'var(--mit-danger)'

  return (
    <div style={{ opacity: locked ? 0.92 : 1 }}>
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          {locked
            ? <Lock size={13} style={{ color }} />
            : <Target size={14} style={{ color }} />}
          <span className="text-xs font-semibold" style={{ color: 'var(--mit-text-muted)' }}>
            {title}
          </span>
          <span className="text-[10px] tracking-wider" style={{ color: 'var(--mit-text-subtle)' }}>
            {subtitle}
          </span>
          {locked && (
            <span
              className="text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded"
              style={{ background: 'var(--mit-bg-elevated)', color: 'var(--mit-text-subtle)' }}
            >
              {reached ? 'Concluída' : 'Travada'}
            </span>
          )}
        </div>
        <div className="flex items-baseline gap-1">
          <span className="text-lg font-bold font-mono" style={{ color }}>
            {total}
          </span>
          <span className="text-xs font-mono" style={{ color: 'var(--mit-text-subtle)' }}>
            / {goal}
          </span>
        </div>
      </div>

      {/* Barra de progresso com porcentagem dentro */}
      <div
        className="w-full rounded-full overflow-hidden relative"
        style={{ height: '22px', background: 'var(--mit-bg-elevated)' }}
      >
        <div
          className="h-full rounded-full transition-all duration-700 flex items-center justify-end pr-2"
          style={{ width: `${Math.max(pct, 12)}%`, background: color }}
        >
          <span className="text-[10px] font-bold font-mono leading-none" style={{ color: '#fff' }}>
            {pct.toFixed(0)}%
          </span>
        </div>
      </div>
    </div>
  )
}
