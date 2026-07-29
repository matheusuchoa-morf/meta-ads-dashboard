// app/api/debug/actions/route.ts
// Dump cru dos action_types retornados pela Insights API + config do pixel.
// Use quando a contagem de compras/leads parecer errada após troca de pixel.
import { NextRequest, NextResponse } from 'next/server'
import { fetchCampaigns, fetchInsights } from '@/lib/meta-api'
import { classifyCampaign } from '@/lib/campaign-classifier'
import { requireAuth } from '@/lib/auth'

export async function GET(req: NextRequest) {
  const unauthorized = await requireAuth()
  if (unauthorized) return unauthorized

  const datePreset = req.nextUrl.searchParams.get('datePreset') ?? 'last_7d'
  const tagFilter  = req.nextUrl.searchParams.get('tagFilter')  ?? ''

  try {
    const campaigns = await fetchCampaigns()
    const filtered = tagFilter
      ? campaigns.filter(c => classifyCampaign(c.name).tag === tagFilter)
      : campaigns

    const insights = await fetchInsights(datePreset)

    // Aggregate: unique action_types across all insights + sum of values
    const typeTotals = new Map<string, number>()
    const roasTypes  = new Map<string, number>()
    for (const i of insights) {
      for (const a of i.actions ?? []) {
        typeTotals.set(a.action_type, (typeTotals.get(a.action_type) ?? 0) + (parseFloat(a.value || '0') || 0))
      }
      for (const r of i.purchase_roas ?? []) {
        roasTypes.set(r.action_type, Math.max(roasTypes.get(r.action_type) ?? 0, parseFloat(r.value || '0') || 0))
      }
    }

    return NextResponse.json({
      config: {
        META_PIXEL_ID: process.env.META_PIXEL_ID ?? null,
        META_AD_ACCOUNT_ID: process.env.META_AD_ACCOUNT_ID?.replace(/\s+/g, '') ?? null,
        warnings: [
          !process.env.META_PIXEL_ID && 'META_PIXEL_ID não está setado — CAPI do Hotmart ficará inativo',
          /\s/.test(process.env.META_AD_ACCOUNT_ID ?? '') && 'META_AD_ACCOUNT_ID tem whitespace (\\n?) — Vercel env pull pode ter adicionado',
        ].filter(Boolean),
      },
      campaigns: filtered.length,
      datePreset,
      actionTypesFound: Object.fromEntries(
        [...typeTotals.entries()].sort((a, b) => b[1] - a[1])
      ),
      roasTypesFound: Object.fromEntries(roasTypes),
      rawSample: insights.slice(0, 3).map(i => ({
        campaign_name: i.campaign_name,
        actions: i.actions,
        purchase_roas: i.purchase_roas,
      })),
    })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
