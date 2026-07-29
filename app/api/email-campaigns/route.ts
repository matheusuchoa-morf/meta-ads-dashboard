// app/api/email-campaigns/route.ts
// ─────────────────────────────────────────────────────────────────────────────
// ActiveCampaign — Lista campanhas de email com taxas calculadas
// ─────────────────────────────────────────────────────────────────────────────
import { NextRequest, NextResponse } from 'next/server'
import { fetchEmailCampaigns } from '@/lib/activecampaign-api'
import { DEMO_MODE, DEMO_EMAIL_CAMPAIGNS } from '@/lib/demo-data'

export async function GET(req: NextRequest) {
  if (DEMO_MODE) return NextResponse.json(DEMO_EMAIL_CAMPAIGNS)

  if (!process.env.ACTIVECAMPAIGN_API_KEY) {
    return NextResponse.json(
      { error: 'ACTIVECAMPAIGN_API_KEY não configurado.' },
      { status: 503 },
    )
  }

  const days = Math.min(Number(req.nextUrl.searchParams.get('days') ?? '30'), 90)

  try {
    const allCampaigns = await fetchEmailCampaigns(50)

    // Filter by sendDate within the last `days` days
    const cutoff = new Date()
    cutoff.setUTCDate(cutoff.getUTCDate() - days)
    const campaigns = allCampaigns.filter(
      (c) => c.sendDate && new Date(c.sendDate) >= cutoff
    )

    // Summary aggregation
    const withSends = campaigns.filter((c) => c.sends > 0)
    const totalSent = withSends.reduce((sum, c) => sum + c.sends, 0)
    const avgOpenRate =
      withSends.length > 0
        ? withSends.reduce((sum, c) => sum + c.openRate, 0) / withSends.length
        : 0
    const avgClickRate =
      withSends.length > 0
        ? withSends.reduce((sum, c) => sum + c.clickRate, 0) / withSends.length
        : 0

    return NextResponse.json({
      campaigns,
      summary: {
        totalSent,
        avgOpenRate: Math.round(avgOpenRate * 100) / 100,
        avgClickRate: Math.round(avgClickRate * 100) / 100,
        campaignCount: withSends.length,
      },
      fetchedAt: new Date().toISOString(),
    })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Erro desconhecido'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
