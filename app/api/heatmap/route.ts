// app/api/heatmap/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { fetchCampaigns, fetchDailyInsights, fetchDailyInsightsTimeRange } from '@/lib/meta-api'
import { classifyCampaign } from '@/lib/campaign-classifier'
import { maxRoas } from '@/lib/action-matchers'

const DOW_NAMES = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb']

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl
  const datePreset = searchParams.get('datePreset') ?? 'last_7d'
  const tagFilter = searchParams.get('tagFilter') ?? ''
  const metric = searchParams.get('metric') ?? 'spend'
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
      return NextResponse.json({ series: [], metric })
    }

    const daily = isCustomRange
      ? await fetchDailyInsightsTimeRange(since!, until!, campaignIds)
      : await fetchDailyInsights(datePreset, campaignIds)

    // Sort chronologically
    const sorted = [...daily].sort((a, b) => a.date_start.localeCompare(b.date_start))
    if (sorted.length === 0) {
      return NextResponse.json({ series: [], metric })
    }

    // Assign each row to a week bucket (0-based from start of period)
    const startDate = sorted[0].date_start
    const [sy, sm, sd] = startDate.split('-').map(Number)
    const startMs = new Date(sy, sm - 1, sd).getTime()

    // Build a map: weekIndex -> dayOfWeek -> aggregated value
    const weekDayMap = new Map<number, Map<number, { spend: number; impressions: number; roasSum: number; roasCount: number; ctrSum: number; ctrCount: number }>>()

    for (const d of sorted) {
      const [y, m, day] = d.date_start.split('-').map(Number)
      const dateMs = new Date(y, m - 1, day).getTime()
      const weekIdx = Math.floor((dateMs - startMs) / (7 * 24 * 3600 * 1000))
      const dow = new Date(y, m - 1, day).getDay() // 0=Sun

      if (!weekDayMap.has(weekIdx)) weekDayMap.set(weekIdx, new Map())
      const weekMap = weekDayMap.get(weekIdx)!

      const prev = weekMap.get(dow) ?? { spend: 0, impressions: 0, roasSum: 0, roasCount: 0, ctrSum: 0, ctrCount: 0 }
      prev.spend += parseFloat(d.spend || '0')
      prev.impressions += parseInt(d.impressions || '0')
      const roas = maxRoas(d.purchase_roas)
      if (roas > 0) { prev.roasSum += roas; prev.roasCount++ }
      const ctr = parseFloat(d.ctr || '0')
      if (ctr > 0) { prev.ctrSum += ctr; prev.ctrCount++ }
      weekMap.set(dow, prev)
    }

    // Build ApexCharts series: one series per week, 7 data points (Mon-Sun)
    const weeks = [...weekDayMap.keys()].sort((a, b) => a - b)

    // Week label: use start date of that week
    function getWeekLabel(weekIdx: number): string {
      const weekStartMs = startMs + weekIdx * 7 * 24 * 3600 * 1000
      const d = new Date(weekStartMs)
      return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}`
    }

    function getValue(entry: { spend: number; impressions: number; roasSum: number; roasCount: number; ctrSum: number; ctrCount: number } | undefined): number {
      if (!entry) return 0
      switch (metric) {
        case 'roas': return entry.roasCount > 0 ? Math.round((entry.roasSum / entry.roasCount) * 100) / 100 : 0
        case 'ctr': return entry.ctrCount > 0 ? Math.round((entry.ctrSum / entry.ctrCount) * 100) / 100 : 0
        case 'impressions': return entry.impressions
        default: return Math.round(entry.spend * 100) / 100
      }
    }

    // Days in order: Mon(1), Tue(2), ..., Sun(0)
    const DAY_ORDER = [1, 2, 3, 4, 5, 6, 0]

    const series = weeks.map(weekIdx => ({
      name: getWeekLabel(weekIdx),
      data: DAY_ORDER.map(dow => ({
        x: DOW_NAMES[dow],
        y: getValue(weekDayMap.get(weekIdx)?.get(dow))
      }))
    }))

    return NextResponse.json({ series, metric })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
