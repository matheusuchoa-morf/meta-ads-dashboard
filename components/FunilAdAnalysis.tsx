// components/FunilAdAnalysis.tsx
// Análise de tráfego direto (ICM3), divisível por parte:
//  - part="metrics" → resumão (CPA/CTR/CPM/Vendas/ROAS)
//  - part="origem"  → de onde vieram as vendas (usado no Resumo)
//  - part="ads"     → por-anúncio com status (🟢/⚪) + aba Período × Gasto total
// Só anúncios de venda ICM3 (exclui tráfego de seguidores → aba Seguidores).
'use client'
import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { buildDateParams, type CustomRange } from '@/lib/date-utils'
import { sumActions, PURCHASE_PATTERNS, CHECKOUT_PATTERNS, LP_VIEW_PATTERNS } from '@/lib/action-matchers'
import { fmtBRL, fmtNum, fmtPct } from '@/lib/formatters'
import type { HotmartData } from '@/app/api/hotmart/route'

interface AdRow {
  ad_id: string
  ad_name: string
  campaign_name?: string
  effective_status?: string
  impressions: string
  clicks: string
  inline_link_clicks?: string
  spend: string
  ctr: string
  actions?: { action_type: string; value: string }[]
}

interface KPIs {
  totalSpend: number
  ctr: number
  cpm: number
}

type Part = 'metrics' | 'origem' | 'ads' | 'all'

interface Props {
  datePreset: string
  tagFilter: string
  customRange?: CustomRange
  part?: Part
}

interface AggAd {
  name: string
  active: boolean
  spend: number
  impr: number
  clicks: number
  linkClicks: number
  chk: number
  pur: number
  lpv: number
}

const isFollower = (c: string) => /seguidor|tr[áa]fego\s*\[?\s*seguidor/i.test(c)
const isVideo = (name: string) => /^ad[vc][\s\-_|]/i.test(name.trim()) || name.trim().toLowerCase() === 'adv'
// "vivo" = rodando ou indo pro ar (revisão). Recém-subidos costumam ficar em
// PENDING_REVIEW/IN_PROCESS por alguns minutos antes de ACTIVE.
const LIVE_STATUS = new Set(['ACTIVE', 'PENDING_REVIEW', 'IN_PROCESS'])

function aggregate(ads: AdRow[]): AggAd[] {
  const map = new Map<string, AggAd>()
  for (const ad of ads) {
    if (isFollower(ad.campaign_name ?? '')) continue // só venda — ToF fica na aba Seguidores
    const key = ad.ad_name
    const cur =
      map.get(key) ??
      { name: ad.ad_name, active: false, spend: 0, impr: 0, clicks: 0, linkClicks: 0, chk: 0, pur: 0, lpv: 0 }
    if (LIVE_STATUS.has(ad.effective_status ?? '')) cur.active = true
    cur.spend += parseFloat(ad.spend ?? '0')
    cur.impr += parseInt(ad.impressions ?? '0', 10)
    cur.clicks += parseInt(ad.clicks ?? '0', 10)
    cur.linkClicks += parseInt(ad.inline_link_clicks ?? '0', 10)
    cur.chk += sumActions(ad.actions, CHECKOUT_PATTERNS)
    cur.pur += sumActions(ad.actions, PURCHASE_PATTERNS)
    cur.lpv += sumActions(ad.actions, LP_VIEW_PATTERNS)
    map.set(key, cur)
  }
  // mantém também os ativos sem entrega ainda (recém-subidos) → spend 0 mas rodando
  return [...map.values()].filter(a => a.spend > 0 || a.active).sort((a, b) => b.spend - a.spend)
}

function convColor(v: number): string {
  if (v >= 6) return 'var(--mit-success)'
  if (v >= 2) return 'var(--mit-warning)'
  return 'var(--mit-danger)'
}

export function FunilAdAnalysis({ datePreset, tagFilter, customRange, part = 'all' }: Props) {
  const [view, setView] = useState<'range' | 'life'>('range')
  const showMetrics = part === 'metrics' || part === 'all'
  const showOrigem = part === 'origem' || part === 'all'
  const showAds = part === 'ads' || part === 'all'

  const insights = useQuery({
    queryKey: ['insights', datePreset, tagFilter, customRange],
    queryFn: () =>
      fetch(`/api/insights?${buildDateParams(datePreset, customRange ?? null, tagFilter)}`).then(r => r.json()),
    refetchInterval: 5 * 60 * 1000,
  })
  const hotmart = useQuery<HotmartData>({
    queryKey: ['hotmart', datePreset, customRange],
    queryFn: () =>
      fetch(`/api/hotmart?${buildDateParams(datePreset, customRange ?? null, '')}`).then(r => {
        if (!r.ok) throw new Error('Hotmart API error')
        return r.json()
      }),
    refetchInterval: 15 * 60 * 1000,
    staleTime: 10 * 60 * 1000,
    retry: 1,
  })
  const adsRange = useQuery({
    queryKey: ['ads', datePreset, tagFilter, customRange, 'live'],
    queryFn: () =>
      fetch(`/api/ads?${buildDateParams(datePreset, customRange ?? null, tagFilter)}&includeActive=1`).then(r => r.json()),
    refetchInterval: 5 * 60 * 1000,
  })
  const adsLife = useQuery({
    queryKey: ['ads', 'maximum', tagFilter],
    queryFn: () =>
      fetch(`/api/ads?${buildDateParams('maximum', null, tagFilter)}`).then(r => r.json()),
    staleTime: 30 * 60 * 1000,
    enabled: showAds,
  })

  const kpis: KPIs | null = insights.data?.kpis ?? null
  const hm = hotmart.data
  const rangeAds: AggAd[] = aggregate(adsRange.data?.ads ?? [])
  const lifeAds: AggAd[] = aggregate(adsLife.data?.ads ?? [])

  const spend = kpis?.totalSpend ?? rangeAds.reduce((s, a) => s + a.spend, 0)
  const vendas = hm?.totalSales ?? 0
  const receita = hm?.totalRevenue ?? 0
  const roas = spend > 0 ? receita / spend : 0
  const cpa = vendas > 0 ? spend / vendas : 0
  const totalChk = rangeAds.reduce((s, a) => s + a.chk, 0)

  const card = (label: string, value: string, sub: string, color?: string) => (
    <div className="rounded-xl border p-4" style={{ background: 'var(--mit-bg-card)', borderColor: 'var(--mit-border)' }}>
      <p className="text-xs" style={{ color: 'var(--mit-text-subtle)' }}>{label}</p>
      <p className="text-2xl font-bold mt-1" style={{ color: color ?? 'var(--mit-text)' }}>{value}</p>
      <p className="text-[10.5px] mt-0.5" style={{ color: 'var(--mit-text-subtle)' }}>{sub}</p>
    </div>
  )

  const origem: { name: string; sales: number; revenue: number; color: string; empty?: boolean }[] = [
    { name: 'Meta Ads (pago)', sales: hm?.bySource.metaAds.sales ?? 0, revenue: hm?.bySource.metaAds.revenue ?? 0, color: '#D97757' },
    { name: 'Orgânico', sales: hm?.bySource.organic.sales ?? 0, revenue: hm?.bySource.organic.revenue ?? 0, color: '#C9A45A' },
    { name: 'Outros', sales: hm?.bySource.other.sales ?? 0, revenue: hm?.bySource.other.revenue ?? 0, color: '#8A9BA0' },
    { name: 'ManyChat / WhatsApp', sales: 0, revenue: 0, color: '#4CAF82', empty: true },
    { name: 'YouTube', sales: 0, revenue: 0, color: '#E53E3E', empty: true },
    { name: 'Indicação', sales: 0, revenue: 0, color: '#7F77DD', empty: true },
  ]

  const ads = view === 'range' ? rangeAds : lifeAds
  const th = 'pb-2 pr-4 font-medium text-xs uppercase tracking-wider'
  const tdr = 'py-2 pr-4 text-right'

  return (
    <div className="space-y-5">
      {/* ── Resumão (métricas) ── */}
      {showMetrics && (
        <section className="rounded-xl border p-6" style={{ background: 'var(--mit-bg-card)', borderColor: 'var(--mit-border)' }}>
          <h2 className="text-xl font-semibold mb-4" style={{ color: 'var(--mit-gold)' }}>
            Análise de tráfego direto — ICM3
          </h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {card('Gasto', fmtBRL(spend), 'tráfego pago')}
            {card('Faturamento', fmtBRL(receita), `${fmtNum(vendas)} vendas Hotmart`, 'var(--mit-gold)')}
            {card('ROAS real', roas.toFixed(2).replace('.', ','), 'receita ÷ gasto', roas >= 1 ? 'var(--mit-success)' : 'var(--mit-danger)')}
            {card('Vendas', fmtNum(vendas), 'Hotmart', 'var(--mit-accent)')}
            {card('CPA real', fmtBRL(cpa), 'gasto ÷ vendas')}
            {card('CTR', fmtPct(kpis?.ctr ?? 0), 'cliques no link')}
            {card('CPM', fmtBRL(kpis?.cpm ?? 0), 'custo/1.000 impr')}
            {card('Checkouts', fmtNum(totalChk), 'pixel')}
          </div>
        </section>
      )}

      {/* ── Origem das vendas (Resumo) ── */}
      {showOrigem && (
        <section className="rounded-xl border p-6" style={{ background: 'var(--mit-bg-card)', borderColor: 'var(--mit-border)' }}>
          <h2 className="text-xl font-semibold mb-4" style={{ color: 'var(--mit-gold)' }}>
            De onde vieram as vendas
          </h2>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-2.5">
            {origem.map(o => (
              <div
                key={o.name}
                className="rounded-lg border p-3 flex items-center gap-3"
                style={{ background: 'var(--mit-bg-elevated)', borderColor: 'var(--mit-border)', opacity: o.empty ? 0.5 : 1 }}
              >
                <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: o.color }} />
                <div>
                  <p className="text-xs font-medium">{o.name}</p>
                  <p className="text-[11px]" style={{ color: 'var(--mit-text-subtle)' }}>
                    {o.sales} venda{o.sales !== 1 ? 's' : ''} · {fmtBRL(o.revenue)}
                  </p>
                </div>
              </div>
            ))}
          </div>
          <p className="text-[11px] mt-3 leading-relaxed" style={{ color: 'var(--mit-text-subtle)' }}>
            ⚠️ ManyChat, YouTube e Indicação aparecem zerados porque a Hotmart não recebe essas UTMs até o checkout.
            A estrutura já fica pronta — quando a UTM for preservada, as vendas se distribuem automaticamente.
          </p>
        </section>
      )}

      {/* ── Por anúncio ── */}
      {showAds && (
        <section className="rounded-xl border p-6" style={{ background: 'var(--mit-bg-card)', borderColor: 'var(--mit-border)' }}>
          <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
            <h2 className="text-xl font-semibold" style={{ color: 'var(--mit-gold)' }}>
              Por anúncio — ICM3
            </h2>
            <div className="flex gap-2">
              {(['range', 'life'] as const).map(v => (
                <button
                  key={v}
                  onClick={() => setView(v)}
                  className="text-xs font-medium px-3 py-1.5 rounded-lg border transition-colors"
                  style={{
                    borderColor: 'var(--mit-border)',
                    background: view === v ? 'var(--mit-accent)' : 'transparent',
                    color: view === v ? '#1a1a1a' : 'var(--mit-text-subtle)',
                  }}
                >
                  {v === 'range' ? 'Período' : 'Gasto total (lifetime)'}
                </button>
              ))}
            </div>
          </div>

          {ads.length === 0 ? (
            <p className="text-sm" style={{ color: 'var(--mit-text-subtle)' }}>Nenhum anúncio ICM3 no período.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[640px]">
                <thead>
                  <tr className="text-left" style={{ borderBottom: '1px solid var(--mit-border)', color: 'var(--mit-text-subtle)' }}>
                    <th className={th}>Anúncio</th>
                    <th className={`${th} hidden sm:table-cell`}>Tipo</th>
                    <th className={`${th} text-right`}>{view === 'life' ? 'Gasto total' : 'Gasto'}</th>
                    <th className={`${th} text-right`}>CPM</th>
                    <th className={`${th} text-right hidden md:table-cell`}>CTR</th>
                    <th className={`${th} text-right hidden lg:table-cell`} title="Cliques no link/CTA (inline_link_clicks)">Cliques</th>
                    <th className={`${th} text-right hidden lg:table-cell`} title="Visitas à página (landing_page_view)">Página</th>
                    <th className={`${th} text-right hidden lg:table-cell`} title="Visitas à página ÷ cliques no link">Connect</th>
                    <th className={`${th} text-right hidden md:table-cell`}>Checkout</th>
                    <th className={`${th} text-right`}>Compras</th>
                    <th className={`${th} text-right`}>Conv.</th>
                    <th className={`${th} text-right`}>CPA</th>
                  </tr>
                </thead>
                <tbody>
                  {ads.map(a => {
                    const cpm = a.impr > 0 ? (a.spend / a.impr) * 1000 : 0
                    const ctr = a.impr > 0 ? (a.clicks / a.impr) * 100 : 0
                    const conv = a.lpv > 0 ? (a.pur / a.lpv) * 100 : null
                    const connect = a.linkClicks > 0 ? (a.lpv / a.linkClicks) * 100 : null
                    const cpaAd = a.pur > 0 ? a.spend / a.pur : null
                    return (
                      <tr key={a.name} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                        <td className="py-2 pr-4">
                          <span className="mr-1.5">{a.active ? '🟢' : '⚪'}</span>
                          {a.name}
                        </td>
                        <td className="py-2 pr-4 hidden sm:table-cell">
                          <span
                            className="text-[9.5px] font-bold px-1.5 py-0.5 rounded"
                            style={
                              isVideo(a.name)
                                ? { background: 'rgba(217,119,87,0.18)', color: 'var(--mit-accent)' }
                                : { background: 'rgba(201,164,90,0.18)', color: 'var(--mit-gold)' }
                            }
                          >
                            {isVideo(a.name) ? 'vídeo' : 'estático'}
                          </span>
                        </td>
                        <td className={tdr}>{fmtBRL(a.spend)}</td>
                        <td className={tdr}>{fmtBRL(cpm)}</td>
                        <td className={`${tdr} hidden md:table-cell`}>{fmtPct(ctr)}</td>
                        <td className={`${tdr} hidden lg:table-cell`}>{a.linkClicks > 0 ? fmtNum(a.linkClicks) : '—'}</td>
                        <td className={`${tdr} hidden lg:table-cell`}>{a.lpv > 0 ? fmtNum(a.lpv) : '—'}</td>
                        <td className={`${tdr} hidden lg:table-cell`}>{connect != null ? fmtPct(connect) : '—'}</td>
                        <td className={`${tdr} hidden md:table-cell`}>{fmtNum(a.chk)}</td>
                        <td className={tdr} style={{ fontWeight: a.pur > 0 ? 700 : 400 }}>{fmtNum(a.pur)}</td>
                        <td className={tdr} style={{ color: conv != null ? convColor(conv) : 'var(--mit-text-subtle)' }}>
                          {conv != null ? fmtPct(conv) : '—'}
                        </td>
                        <td className={tdr}>{cpaAd != null ? fmtBRL(cpaAd) : '—'}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
          <p className="text-[11px] mt-3" style={{ color: 'var(--mit-text-subtle)' }}>
            🟢 rodando · ⚪ pausado · Todo anúncio ICM3 que você sobe aparece aqui automaticamente — mesmo recém-ativado sem entrega
            ainda (zerado, mas 🟢). A aba “Gasto total” mostra os que já gastaram, mesmo parados há dias.
            Anúncios de seguidores (ToF) ficam na aba Seguidores.
          </p>
        </section>
      )}
    </div>
  )
}
