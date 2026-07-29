// app/api/funnel/daily/route.ts
// ─────────────────────────────────────────────────────────────────────────────
// "Pulsão de Métricas" — breakdown diário dos últimos 7 dias (fechados) do funil.
// Meta (impr, cpm, ctr, cliques, visitas, checkout) + Hotmart (compras, faturamento),
// unidos por data no calendário de São Paulo.
// ─────────────────────────────────────────────────────────────────────────────
import { NextRequest, NextResponse } from 'next/server'
import { fetchCampaigns, fetchDailyFunnelMetrics } from '@/lib/meta-api'
import { fetchHotmartSales } from '@/lib/hotmart-api'
import { classifyCampaign } from '@/lib/campaign-classifier'
import { sumActions, linkClicks, LP_VIEW_PATTERNS, CHECKOUT_PATTERNS } from '@/lib/action-matchers'
import { BRAZIL_OFFSET_MS } from '@/lib/brazil-date'
import { requireAuth } from '@/lib/auth'

export interface PulseDay {
  date: string          // YYYY-MM-DD (calendário SP)
  spend: number
  impressions: number
  cpm: number
  ctr: number           // %
  linkClicks: number
  visits: number        // landing_page_view
  checkout: number      // initiate_checkout
  purchases: number     // Hotmart (vendas reais)
  revenue: number       // faturamento Hotmart
}

// YYYY-MM-DD de um instante, no calendário de São Paulo
function brDateStr(ms: number): string {
  return new Date(ms - BRAZIL_OFFSET_MS).toISOString().slice(0, 10)
}

export async function GET(req: NextRequest) {
  const unauthorized = await requireAuth()
  if (unauthorized) return unauthorized

  const tagFilter = req.nextUrl.searchParams.get('tagFilter') ?? ''

  try {
    // ── Janela: 7 dias fechados terminando ONTEM (SP) ──
    // Meia-noite de hoje (SP) em UTC:
    const nowBrazilLocal = new Date(Date.now() - BRAZIL_OFFSET_MS)
    nowBrazilLocal.setUTCHours(0, 0, 0, 0)
    const todayMidnightUTC = nowBrazilLocal.getTime() + BRAZIL_OFFSET_MS
    const ONE_DAY = 24 * 60 * 60 * 1000
    const untilMs = todayMidnightUTC - ONE_DAY          // ontem 00h SP
    const sinceMs = untilMs - 6 * ONE_DAY               // 7 dias atrás

    const sinceStr = brDateStr(sinceMs)
    const untilStr = brDateStr(untilMs)

    // Lista ordenada de datas (recente → antigo)
    const dates: string[] = []
    for (let i = 0; i < 7; i++) dates.push(brDateStr(untilMs - i * ONE_DAY))

    // ── Resolve campanhas do filtro ──
    let campaignIds: string[] = []
    const allCampaigns = await fetchCampaigns()
    campaignIds = (tagFilter
      ? allCampaigns.filter(c => classifyCampaign(c.name).tag === tagFilter)
      : allCampaigns
    ).map(c => c.id)

    // ── Fetch paralelo: Meta daily + Hotmart daily ──
    // Hotmart end = início de hoje (exclui hoje, só dias fechados).
    const [metaDaily, hotmartSales] = await Promise.all([
      campaignIds.length
        ? fetchDailyFunnelMetrics(campaignIds, sinceStr, untilStr)
        : Promise.resolve([]),
      fetchHotmartSales(new Date(sinceMs), new Date(todayMidnightUTC)),
    ])

    // Meta → mapa por data
    const metaByDate = new Map<string, PulseDay>()
    for (const row of metaDaily) {
      const impressions = parseInt(row.impressions || '0', 10)
      const spend = parseFloat(row.spend || '0')
      metaByDate.set(row.date_start, {
        date: row.date_start,
        spend,
        impressions,
        cpm: row.cpm ? parseFloat(row.cpm) : (impressions > 0 ? (spend / impressions) * 1000 : 0),
        ctr: parseFloat(row.ctr || '0'),
        linkClicks: linkClicks({ outbound_clicks: row.outbound_clicks, clicks: row.clicks }),
        visits: sumActions(row.actions, LP_VIEW_PATTERNS),
        checkout: sumActions(row.actions, CHECKOUT_PATTERNS),
        purchases: 0,
        revenue: 0,
      })
    }

    // Hotmart → compras + faturamento por data (só aprovadas/completas)
    const salesByDate = new Map<string, { purchases: number; revenue: number }>()
    for (const s of hotmartSales) {
      if (s.status !== 'APPROVED' && s.status !== 'COMPLETE') continue
      const d = brDateStr(s.orderDate)
      const acc = salesByDate.get(d) ?? { purchases: 0, revenue: 0 }
      acc.purchases++
      acc.revenue += s.price
      salesByDate.set(d, acc)
    }

    // ── Monta os 7 dias (recente → antigo), preenchendo zeros ──
    const days: PulseDay[] = dates.map(date => {
      const meta = metaByDate.get(date)
      const sale = salesByDate.get(date) ?? { purchases: 0, revenue: 0 }
      return {
        date,
        spend:       meta?.spend ?? 0,
        impressions: meta?.impressions ?? 0,
        cpm:         meta?.cpm ?? 0,
        ctr:         meta?.ctr ?? 0,
        linkClicks:  meta?.linkClicks ?? 0,
        visits:      meta?.visits ?? 0,
        checkout:    meta?.checkout ?? 0,
        purchases:   sale.purchases,
        revenue:     sale.revenue,
      }
    })

    return NextResponse.json({ days, since: sinceStr, until: untilStr, fetchedAt: new Date().toISOString() })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
