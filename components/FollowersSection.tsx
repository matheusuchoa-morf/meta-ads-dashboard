// components/FollowersSection.tsx
// Tráfego para Seguidores (ToF) — super tabela com números REAIS por anúncio,
// com toggle Hoje / Lifetime. Fonte: lib/followers-tof-data.ts (snapshot
// verificado da UI do Ads Manager, porque o Meta não expõe "Seguidores no
// Instagram" por anúncio via API).
'use client'
import { useState } from 'react'
import {
  Wallet, UserPlus, Eye, TrendingUp, ShoppingCart, BadgeDollarSign,
  ExternalLink, Radio, History,
} from 'lucide-react'
import { fmtBRL } from '@/lib/formatters'
import { TOF_FOLLOWERS, type TofMetrics, type TofPeriod } from '@/lib/followers-tof-data'

const fmtInt = (n: number) => n.toLocaleString('pt-BR')
const pct = (n: number) => `${n.toFixed(1).replace('.', ',')}%`

const convRate = (x: TofMetrics) => (x.profileVisits > 0 ? (x.followers / x.profileVisits) * 100 : 0)
const costPerFollower = (x: TofMetrics) => (x.followers > 0 ? x.spend / x.followers : null)
const cpa = (x: TofMetrics) => (x.purchases > 0 ? x.spend / x.purchases : null)

const convColor = (v: number) => (v >= 10 ? 'var(--mit-success)' : v >= 4 ? 'var(--mit-warning)' : 'var(--mit-danger)')
const costColor = (v: number | null) =>
  v == null ? 'var(--mit-text-subtle)' : v <= 5 ? 'var(--mit-success)' : v <= 20 ? 'var(--mit-warning)' : 'var(--mit-danger)'

function StatCard({ icon: Icon, label, value, sub, accent }: {
  icon: React.ComponentType<{ size?: number; style?: React.CSSProperties }>
  label: string; value: string; sub?: string; accent?: string
}) {
  return (
    <div className="rounded-xl border p-4 flex-1 min-w-0" style={{ background: 'var(--mit-bg-card)', borderColor: 'var(--mit-border)' }}>
      <div className="flex items-center gap-2 mb-2">
        <Icon size={14} style={{ color: accent ?? 'var(--mit-gold)' }} />
        <span className="text-[11px] font-semibold uppercase tracking-wider" style={{ color: 'var(--mit-text-subtle)' }}>{label}</span>
      </div>
      <div className="text-2xl font-bold font-mono" style={{ color: accent ?? 'var(--mit-text)' }}>{value}</div>
      {sub && <div className="text-[11px] mt-0.5" style={{ color: 'var(--mit-text-subtle)' }}>{sub}</div>}
    </div>
  )
}

export function FollowersSection() {
  const snap = TOF_FOLLOWERS
  const [period, setPeriod] = useState<TofPeriod>('lifetime')
  const rows = snap.rows
  const periodLabel = period === 'today' ? snap.todayLabel : snap.lifetimeLabel

  // Totais do período selecionado
  const t = rows.reduce((a, r) => {
    const x = r[period]
    return {
      spend: a.spend + x.spend, visits: a.visits + x.profileVisits,
      followers: a.followers + x.followers, checkout: a.checkout + x.checkout, purchases: a.purchases + x.purchases,
    }
  }, { spend: 0, visits: 0, followers: 0, checkout: 0, purchases: 0 })
  const blendedConv = t.visits > 0 ? (t.followers / t.visits) * 100 : 0
  const blendedCPF = t.followers > 0 ? t.spend / t.followers : 0
  const blendedCPA = t.purchases > 0 ? t.spend / t.purchases : null

  const running = rows.filter(r => r.status === 'active')

  const thMetric = 'pb-2 px-3 font-medium text-center whitespace-nowrap'
  const tdMetric = 'py-3 px-3 text-center'
  const fmtUpdated = (() => { const [y, mo, d] = snap.updatedAt.split('-'); return `${d}/${mo}/${y}` })()

  // botão do toggle de período
  const PeriodBtn = ({ value, label }: { value: TofPeriod; label: string }) => {
    const active = period === value
    return (
      <button onClick={() => setPeriod(value)}
        className="px-3 py-1.5 text-xs font-semibold rounded-md transition-colors cursor-pointer"
        style={{
          background: active ? 'var(--mit-gold)' : 'transparent',
          color: active ? 'var(--mit-bg-dark)' : 'var(--mit-text-muted)',
        }}>
        {label}
      </button>
    )
  }

  return (
    <div className="space-y-5">
      {/* ── Aviso de veiculação ── */}
      {running.length > 0 ? (
        <div className="rounded-xl border px-4 py-3 flex items-center gap-2.5 text-sm"
          style={{ background: 'color-mix(in srgb, var(--mit-success) 12%, transparent)', borderColor: 'var(--mit-success)', color: 'var(--mit-success)' }}>
          <Radio size={16} />
          <span><strong>{running.length} anúncio{running.length > 1 ? 's' : ''} rodando agora:</strong> {running.map(r => r.adName).join(' · ')}</span>
        </div>
      ) : (
        <div className="rounded-xl border px-4 py-3 flex items-center gap-2.5 text-sm"
          style={{ background: 'var(--mit-bg-card)', borderColor: 'var(--mit-border)', color: 'var(--mit-text-subtle)' }}>
          <History size={16} />
          <span>Campanha pausada — visão histórica completa (todos os anúncios já veiculados).</span>
        </div>
      )}

      {/* ── Toggle de período ── */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="inline-flex items-center gap-1 p-1 rounded-lg border" style={{ background: 'var(--mit-bg-card)', borderColor: 'var(--mit-border)' }}>
          <PeriodBtn value="today" label="Hoje" />
          <PeriodBtn value="lifetime" label="Lifetime" />
        </div>
        <span className="text-xs" style={{ color: 'var(--mit-text-subtle)' }}>{periodLabel}</span>
      </div>

      {/* ── Cards de resumo ── */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        <StatCard icon={Wallet}      label="Investido"         value={fmtBRL(t.spend)}      sub={`${period === 'today' ? 'hoje' : 'período total'} · ${rows.length} criativos`} accent="var(--mit-accent)" />
        <StatCard icon={Eye}         label="Visitas ao perfil" value={fmtInt(t.visits)}     sub="resultado da campanha" />
        <StatCard icon={UserPlus}    label="Seguidores"        value={fmtInt(t.followers)}  sub="Seguidores no Instagram" accent="var(--mit-success)" />
        <StatCard icon={BadgeDollarSign} label="Custo / seguidor" value={t.followers > 0 ? fmtBRL(blendedCPF) : '—'} sub="investido ÷ seguidores" accent="var(--mit-gold)" />
        <StatCard icon={TrendingUp}  label="Conv. seguidor"    value={pct(blendedConv)}     sub="seguidores ÷ visitas" />
        <StatCard icon={ShoppingCart} label="Compras"          value={fmtInt(t.purchases)}  sub={blendedCPA != null ? `CPA ${fmtBRL(blendedCPA)} · ${t.checkout} checkouts` : `${t.checkout} checkouts`} />
      </div>

      {/* ── Super tabela por criativo ── */}
      <section className="rounded-xl border p-6" style={{ background: 'var(--mit-bg-card)', borderColor: 'var(--mit-border)' }}>
        <div className="mb-5 flex items-start justify-between gap-3 flex-wrap">
          <div>
            <h2 className="text-xl font-semibold" style={{ color: 'var(--mit-gold)' }}>Distribuição de Seguidores</h2>
            <p className="text-sm mt-1" style={{ color: 'var(--mit-text-subtle)' }}>
              {snap.campaignName} · {periodLabel} · atualizado em {fmtUpdated}
            </p>
          </div>
          <a href={snap.metaUrl} target="_blank" rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg transition-colors hover:opacity-80 shrink-0"
            style={{ background: 'var(--mit-bg-elevated)', color: 'var(--mit-gold)' }}>
            Ver no Meta <ExternalLink size={12} />
          </a>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[820px] text-sm">
            <thead>
              <tr className="text-xs uppercase tracking-wider" style={{ borderBottom: '1px solid var(--mit-border)', color: 'var(--mit-text-subtle)' }}>
                <th className="pb-2 pr-4 font-medium text-left">Anúncio</th>
                <th className={thMetric}>Investido</th>
                <th className={thMetric} title="Visitas ao perfil do Instagram">Visitas perfil</th>
                <th className={thMetric}>Seguidores</th>
                <th className={thMetric} title="Seguidores ÷ visitas ao perfil">Conv. seg</th>
                <th className={thMetric} title="Investido ÷ seguidores">Custo/seg</th>
                <th className={thMetric}>Checkout</th>
                <th className={thMetric}>Compras</th>
                <th className={thMetric} title="Investido ÷ compras">CPA</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(r => {
                const x = r[period]
                const conv = convRate(x)
                const cpf = costPerFollower(x)
                const adCpa = cpa(x)
                const isActive = r.status === 'active'
                const dim = period === 'today' && x.spend === 0 && x.profileVisits === 0
                return (
                  <tr key={r.adName} className="transition-colors hover:bg-white/[0.025]" style={{ borderBottom: '1px solid var(--mit-border)', opacity: dim ? 0.5 : 1 }}>
                    <td className="py-3 pr-4 text-left">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <span className="w-2 h-2 rounded-full shrink-0"
                          style={{ background: isActive ? 'var(--mit-success)' : 'var(--mit-text-subtle)' }}
                          title={isActive ? 'Rodando' : 'Desativado'} />
                        <div className="min-w-0">
                          <p className="text-sm font-medium truncate max-w-[220px]" style={{ color: 'var(--mit-text)' }} title={r.adName}>{r.adName}</p>
                          <p className="text-[10px] uppercase tracking-wide" style={{ color: isActive ? 'var(--mit-success)' : 'var(--mit-text-subtle)' }}>
                            {isActive ? 'Rodando' : 'Desativado'}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className={tdMetric}><span className="font-mono" style={{ color: 'var(--mit-text-muted)' }}>{fmtBRL(x.spend)}</span></td>
                    <td className={tdMetric}><span className="font-mono" style={{ color: 'var(--mit-text)' }}>{fmtInt(x.profileVisits)}</span></td>
                    <td className={tdMetric}><span className="font-mono font-semibold" style={{ color: 'var(--mit-success)' }}>{fmtInt(x.followers)}</span></td>
                    <td className={tdMetric}><span className="font-mono font-semibold" style={{ color: convColor(conv) }}>{pct(conv)}</span></td>
                    <td className={tdMetric}><span className="font-mono font-semibold" style={{ color: costColor(cpf) }}>{cpf != null ? fmtBRL(cpf) : '—'}</span></td>
                    <td className={tdMetric}><span className="font-mono" style={{ color: 'var(--mit-text-muted)' }}>{x.checkout || '—'}</span></td>
                    <td className={tdMetric}><span className="font-mono" style={{ color: 'var(--mit-text-muted)' }}>{x.purchases || '—'}</span></td>
                    <td className={tdMetric}><span className="font-mono" style={{ color: 'var(--mit-text-muted)' }}>{adCpa != null ? fmtBRL(adCpa) : '—'}</span></td>
                  </tr>
                )
              })}
            </tbody>
            <tfoot>
              <tr className="font-semibold" style={{ borderTop: '2px solid var(--mit-border)', color: 'var(--mit-text)' }}>
                <td className="py-3 pr-4 text-left">Subtotal ToF</td>
                <td className={tdMetric}><span className="font-mono">{fmtBRL(t.spend)}</span></td>
                <td className={tdMetric}><span className="font-mono">{fmtInt(t.visits)}</span></td>
                <td className={tdMetric}><span className="font-mono" style={{ color: 'var(--mit-success)' }}>{fmtInt(t.followers)}</span></td>
                <td className={tdMetric}><span className="font-mono" style={{ color: convColor(blendedConv) }}>{pct(blendedConv)}</span></td>
                <td className={tdMetric}><span className="font-mono" style={{ color: 'var(--mit-gold)' }}>{t.followers > 0 ? fmtBRL(blendedCPF) : '—'}</span></td>
                <td className={tdMetric}><span className="font-mono">{t.checkout || '—'}</span></td>
                <td className={tdMetric}><span className="font-mono">{t.purchases || '—'}</span></td>
                <td className={tdMetric}><span className="font-mono">{blendedCPA != null ? fmtBRL(blendedCPA) : '—'}</span></td>
              </tr>
            </tfoot>
          </table>
        </div>

        <p className="text-[11px] mt-4 leading-relaxed" style={{ color: 'var(--mit-text-subtle)' }}>
          <strong style={{ color: 'var(--mit-text-muted)' }}>Conv. seg</strong> = seguidores ÷ visitas ao perfil ·{' '}
          <strong style={{ color: 'var(--mit-text-muted)' }}>Custo/seg</strong> = investido ÷ seguidores ·{' '}
          <strong style={{ color: 'var(--mit-text-muted)' }}>CPA</strong> = investido ÷ compras.<br />
          {snap.followersNote}
        </p>
      </section>
    </div>
  )
}
