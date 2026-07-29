// app/api/insights/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { fetchInsights, fetchInsightsTimeRange, fetchDailyInsights, InsightsData } from '@/lib/meta-api'
import { fetchCampaigns } from '@/lib/meta-api'
import { classifyCampaign } from '@/lib/campaign-classifier'
import {
  sumActions, maxRoas, linkClicks,
  PURCHASE_PATTERNS, LEAD_PATTERNS,
} from '@/lib/action-matchers'
import { DEMO_MODE, DEMO_INSIGHTS } from '@/lib/demo-data'

function aggregateInsights(insights: InsightsData[]) {
  let totalSpend = 0
  let totalImpressions = 0
  let totalClicks = 0
  let totalReach = 0
  let weightedRoas = 0
  let totalPurchases = 0
  let totalLeads = 0

  for (const i of insights) {
    const spend = parseFloat(i.spend || '0')
    const impressions = parseInt(i.impressions || '0')
    const reach = parseInt(i.reach || '0')
    const clicks = linkClicks(i)

    totalSpend += spend
    totalImpressions += impressions
    totalClicks += clicks
    totalReach += reach
    totalPurchases += sumActions(i.actions, PURCHASE_PATTERNS)
    totalLeads += sumActions(i.actions, LEAD_PATTERNS)

    const roas = maxRoas(i.purchase_roas)
    if (roas > 0) weightedRoas += roas * spend
  }

  const ctr = totalImpressions > 0 ? (totalClicks / totalImpressions) * 100 : 0
  const cpm = totalImpressions > 0 ? (totalSpend / totalImpressions) * 1000 : 0
  const roas = totalSpend > 0 ? weightedRoas / totalSpend : 0
  const cpa = totalPurchases > 0 ? totalSpend / totalPurchases : 0
  const cpl = totalLeads > 0 ? totalSpend / totalLeads : 0

  return { totalSpend, totalImpressions, totalClicks, totalReach, ctr, cpm, roas, cpa, cpl, totalPurchases, totalLeads }
}

function getPrevDateRange(datePreset: string): { since: string; until: string } {
  const days = datePreset === 'last_30d' ? 30 : datePreset === 'last_14d' ? 14 : datePreset === 'today' ? 1 : 7
  const now = new Date()
  const fmt = (d: Date) => d.toISOString().split('T')[0]
  // Previous period ends the day before current period starts
  // current: today-days … today-1
  // previous: today-2*days … today-days-1
  const prevUntil = new Date(now)
  prevUntil.setDate(now.getDate() - days - 1)
  const prevSince = new Date(now)
  prevSince.setDate(now.getDate() - 2 * days)
  return { since: fmt(prevSince), until: fmt(prevUntil) }
}

export async function GET(req: NextRequest) {
  if (DEMO_MODE) return NextResponse.json(DEMO_INSIGHTS)
  const { searchParams } = req.nextUrl
  const datePreset = searchParams.get('datePreset') ?? 'last_7d'
  const tagFilter = searchParams.get('tagFilter') ?? ''
  const since = searchParams.get('since')
  const until = searchParams.get('until')
  const isCustomRange = !!(since && until)

  try {
    const campaigns = await fetchCampaigns()
    const filtered = tagFilter
      ? campaigns.filter(c => classifyCampaign(c.name).tag === tagFilter)
      : campaigns
    const campaignIds = filtered.map(c => c.id)

    if (campaignIds.length === 0) {
      return NextResponse.json({ kpis: null, prevKpis: null, trend: [], campaigns: [] })
    }

    const prevRange = isCustomRange ? null : getPrevDateRange(datePreset)

    // Fetch current, previous, and daily trend in parallel
    const [allInsights, prevInsights, dailyRaw] = await Promise.all([
      isCustomRange
        ? fetchInsightsTimeRange(since!, until!, campaignIds)
        : fetchInsights(datePreset),
      isCustomRange
        ? Promise.resolve([])  // No comparison for custom range
        : fetchInsightsTimeRange(prevRange!.since, prevRange!.until, campaignIds),
      isCustomRange
        ? fetchInsightsTimeRange(since!, until!, campaignIds)  // Use as daily too
        : fetchDailyInsights(datePreset, campaignIds),
    ])

    // Ensure today (Brazil UTC-3) is always included in daily data
    const BRAZIL_OFFSET_MS = 3 * 60 * 60 * 1000
    const todayBrazil = new Date(Date.now() - BRAZIL_OFFSET_MS)
    const todayStr = todayBrazil.toISOString().slice(0, 10)
    const hasTodayInDaily = dailyRaw.some(d => d.date_start === todayStr)
    let daily = dailyRaw
    if (!hasTodayInDaily && datePreset !== 'today') {
      const todayDaily = await fetchDailyInsights('today', campaignIds)
      daily = [...dailyRaw, ...todayDaily]
    }

    const insights = allInsights.filter(i => campaignIds.includes(i.campaign_id))

    // Build trend: group by date, aggregate spend + roas + leads + purchases
    const trendMap = new Map<string, { spend: number; weightedRoas: number; roasWeight: number; leads: number; purchases: number }>()
    for (const d of daily) {
      const date = d.date_start
      const spend = parseFloat(d.spend || '0')
      const roas = maxRoas(d.purchase_roas)
      const leads = sumActions(d.actions, LEAD_PATTERNS)
      const purchases = sumActions(d.actions, PURCHASE_PATTERNS)
      const entry = trendMap.get(date) ?? { spend: 0, weightedRoas: 0, roasWeight: 0, leads: 0, purchases: 0 }
      entry.spend += spend
      entry.leads += leads
      entry.purchases += purchases
      if (roas > 0) { entry.weightedRoas += roas * spend; entry.roasWeight += spend }
      trendMap.set(date, entry)
    }

    const trend = [...trendMap.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, v]) => ({
        date,
        spend: Math.round(v.spend * 100) / 100,
        roas: v.roasWeight > 0 ? Math.round((v.weightedRoas / v.roasWeight) * 100) / 100 : 0,
        leads: v.leads,
        purchases: v.purchases,
        cpl: v.leads > 0 ? Math.round((v.spend / v.leads) * 100) / 100 : 0,
        cpa: v.purchases > 0 ? Math.round((v.spend / v.purchases) * 100) / 100 : 0,
        revenue: v.roasWeight > 0 ? Math.round((v.weightedRoas / v.roasWeight) * v.spend * 100) / 100 : 0,
      }))

    return NextResponse.json({
      kpis: aggregateInsights(insights),
      prevKpis: aggregateInsights(prevInsights),
      trend,
      campaignCount: filtered.length
    })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
