// app/api/funnel/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { fetchFunnelInsights, fetchFunnelInsightsTimeRange, fetchCampaigns } from '@/lib/meta-api'
import { resolveFunnelType, buildPurchaseFunnel, buildLeadFunnel, buildHealthMetrics } from '@/lib/funnel-resolver'
import { classifyCampaign } from '@/lib/campaign-classifier'
import { requireAuth } from '@/lib/auth'

// Maps each date preset to the equivalent prior period for period-over-period
const PREV_PRESET_MAP: Record<string, string> = {
  last_7d: 'last_week_mon_sun',
  last_14d: 'last_14d',
  last_30d: 'last_month',
}

export async function GET(req: NextRequest) {
  const unauthorized = await requireAuth()
  if (unauthorized) return unauthorized

  const { searchParams } = req.nextUrl
  const objective    = searchParams.get('objective') ?? 'OUTCOME_SALES'
  const datePreset   = searchParams.get('datePreset') ?? 'last_7d'
  const tagFilter    = searchParams.get('tagFilter') ?? ''
  const since        = searchParams.get('since')
  const until        = searchParams.get('until')
  const isCustomRange = !!(since && until)
  // Legacy: still accept single campaignId for backwards compat
  const singleId     = searchParams.get('campaignId') ?? ''
  // Multi-campaign filter (comma-separated) for page-level funnel
  const campaignIdsParam = searchParams.get('campaignIds') ?? ''
  const compareDatePreset = isCustomRange ? undefined : PREV_PRESET_MAP[datePreset]

  try {
    // Resolve campaign IDs: use tagFilter to get all matching campaigns
    let campaignIds: string[] = []

    if (campaignIdsParam) {
      // Multi-campaign filter (page-level funnel)
      campaignIds = campaignIdsParam.split(',').filter(Boolean)
    } else if (singleId && !tagFilter) {
      // Legacy single-campaign mode
      campaignIds = [singleId]
    } else {
      // Resolve from tag filter (or all campaigns)
      const allCampaigns = await fetchCampaigns()
      const filtered = tagFilter
        ? allCampaigns.filter(c => classifyCampaign(c.name).tag === tagFilter)
        : allCampaigns
      campaignIds = filtered.map(c => c.id)
    }

    if (campaignIds.length === 0) {
      return NextResponse.json({ type: resolveFunnelType(objective), stages: [], spend: '0' })
    }

    const { current, previous } = isCustomRange
      ? await fetchFunnelInsightsTimeRange(campaignIds, since!, until!)
      : await fetchFunnelInsights(campaignIds, datePreset, compareDatePreset)

    if (!current) {
      return NextResponse.json({ type: resolveFunnelType(objective), stages: [], health: [], spend: '0' })
    }

    const type = resolveFunnelType(objective)
    const currentData = current as unknown as Record<string, unknown>
    const previousData = previous as unknown as Record<string, unknown> | undefined
    const stages = type === 'purchase'
      ? buildPurchaseFunnel(currentData, previousData)
      : buildLeadFunnel(currentData, previousData)
    const health = buildHealthMetrics(currentData)

    return NextResponse.json({ type, stages, health, spend: current?.spend })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
