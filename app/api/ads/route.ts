// app/api/ads/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { fetchAdInsights, fetchAdInsightsTimeRange, fetchAdThumbnails, fetchAdLandingPages, fetchCampaigns, fetchAdStatuses, fetchAdsList, fetchAdVideoDurations, type AdInsightData } from '@/lib/meta-api'
import { classifyCampaign } from '@/lib/campaign-classifier'
import { requireAuth } from '@/lib/auth'
import { getDriveCreative } from '@/lib/drive-creatives'
import { DEMO_MODE, DEMO_ADS } from '@/lib/demo-data'

export async function GET(req: NextRequest) {
  if (DEMO_MODE) return NextResponse.json(DEMO_ADS)
  const unauthorized = await requireAuth()
  if (unauthorized) return unauthorized

  const { searchParams } = req.nextUrl
  const datePreset = searchParams.get('datePreset') ?? 'last_7d'
  const tagFilter  = searchParams.get('tagFilter')  ?? ''
  const since      = searchParams.get('since')
  const until      = searchParams.get('until')
  const isCustomRange = !!(since && until)
  // includeActive=1 → também lista ads ATIVOS que ainda não entregaram (recém-subidos),
  // pra todo anúncio que sobe aparecer no painel automaticamente, mesmo antes de gastar.
  const includeActive = searchParams.get('includeActive') === '1'

  try {
    let campaignIds: string[] | undefined
    const campNameById = new Map<string, string>()

    if (tagFilter) {
      const allCampaigns = await fetchCampaigns()
      const filtered = allCampaigns.filter(
        c => classifyCampaign(c.name).tag === tagFilter
      )
      campaignIds = filtered.map(c => c.id)
      for (const c of filtered) campNameById.set(c.id, c.name)
      if (campaignIds.length === 0) return NextResponse.json({ ads: [] })
    }

    // Parallel: insights + thumbnails + landing pages (links do creative)
    const [insights, thumbnails, landingPages] = await Promise.all([
      isCustomRange
        ? fetchAdInsightsTimeRange(since!, until!, campaignIds)
        : fetchAdInsights(datePreset, campaignIds),
      fetchAdThumbnails(campaignIds),
      fetchAdLandingPages(campaignIds),
    ])

    // Fetch effective_status for each ad com entrega (necessário p/ toggle ON/OFF)
    const statuses = await fetchAdStatuses(insights.map(i => i.ad_id))

    // Une os ads ATIVOS sem entrega ainda (não vêm em /insights) como linhas zeradas.
    // Best-effort: se o fetchAdsList falhar (ex: rate limit), cai pros ads com
    // entrega — o enhancement NUNCA pode derrubar a tabela inteira.
    const merged: AdInsightData[] = [...insights]
    if (includeActive && campaignIds?.length) {
      try {
        const present = new Set(insights.map(i => i.ad_id))
        const liveAds = await fetchAdsList(campaignIds)
        for (const a of liveAds) {
          if (present.has(a.ad_id)) continue
          statuses[a.ad_id] = a.effective_status
          merged.push({
            ad_id: a.ad_id,
            ad_name: a.ad_name,
            campaign_id: a.campaign_id,
            campaign_name: campNameById.get(a.campaign_id ?? '') ?? '',
            impressions: '0', clicks: '0', spend: '0', ctr: '0',
            actions: [], date_start: '', date_stop: '',
          } as AdInsightData)
        }
      } catch (e) {
        console.warn('[ads] includeActive falhou (segue só com entrega):', e instanceof Error ? e.message : e)
      }
    }

    const accountNumeric = (process.env.META_AD_ACCOUNT_ID ?? '').replace('act_', '')

    // Durações de vídeo (p/ derivar o hook de 3s da curva). Best-effort + cacheado.
    // Só ads que têm curva de retenção = só vídeos (evita ler creative dos estáticos).
    let videoDurations: Record<string, number> = {}
    try {
      const videoAdIds = merged.filter(m => m.video_play_curve_actions?.length).map(m => m.ad_id)
      videoDurations = await fetchAdVideoDurations(videoAdIds)
    } catch (e) {
      console.warn('[ads] durações de vídeo falharam:', e instanceof Error ? e.message : e)
    }

    const ads = merged.map(ad => {
      const drive = getDriveCreative(ad.ad_name)
      return {
        ...ad,
        effective_status: statuses[ad.ad_id] ?? 'UNKNOWN',
        thumbnail: drive?.thumbnail ?? thumbnails[ad.ad_id] ?? null,
        landingPage: landingPages[ad.ad_id] ?? null,
        video_duration: videoDurations[ad.ad_id] ?? null,
        metaLink: drive?.link ?? `https://adsmanager.facebook.com/adsmanager/manage/ads?act=${accountNumeric}&selected_ad_ids=${ad.ad_id}`,
      }
    })

    return NextResponse.json({ ads })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
