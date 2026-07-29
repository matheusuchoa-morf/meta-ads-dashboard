// app/api/campaigns/route.ts
import { NextResponse } from 'next/server'
import { fetchCampaigns } from '@/lib/meta-api'
import { classifyCampaign } from '@/lib/campaign-classifier'
import { requireAuth } from '@/lib/auth'

export async function GET() {
  const unauthorized = await requireAuth()
  if (unauthorized) return unauthorized

  try {
    const campaigns = await fetchCampaigns()
    const tagged = campaigns.map(c => ({
      ...c,
      tag: classifyCampaign(c.name)
    }))
    return NextResponse.json({ campaigns: tagged })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
