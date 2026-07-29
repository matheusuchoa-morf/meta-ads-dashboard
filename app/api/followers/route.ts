// app/api/followers/route.ts
// ─────────────────────────────────────────────────────────────────────────────
// Tráfego para Seguidores — campanhas de distribuição (ToF). Métricas: gasto,
// alcance, CTR, visitas ao perfil (inline_link_clicks), CPP, hook rate, engajamento.
// Seguidores ganhos + custo por seguidor vêm do Instagram (nível conta, período).
// ─────────────────────────────────────────────────────────────────────────────
import { NextRequest, NextResponse } from 'next/server'
import { fetchCampaigns, fetchFollowerAdInsights, fetchAdThumbnails } from '@/lib/meta-api'
import { fetchInstagramInsights } from '@/lib/instagram-api'
import { getDriveCreative } from '@/lib/drive-creatives'
import { requireAuth } from '@/lib/auth'

// Identifica campanhas de tráfego para seguidores pelo nome ([seguidores]/[Seguidores]).
function isFollowerCampaign(name: string, objective?: string): boolean {
  const n = name.toLowerCase()
  if (n.includes('seguidor')) return true
  // fallback: tráfego puro de IG sem a palavra explícita
  return objective === 'OUTCOME_TRAFFIC' && (n.includes('trafego') || n.includes('tráfego'))
}

const PRESET_DAYS: Record<string, number> = { today: 1, last_7d: 7, last_14d: 14, last_30d: 30 }

export async function GET(req: NextRequest) {
  const unauthorized = await requireAuth()
  if (unauthorized) return unauthorized

  const { searchParams } = req.nextUrl
  const datePreset = searchParams.get('datePreset') ?? 'last_7d'
  const since = searchParams.get('since')
  const until = searchParams.get('until')
  const isCustom = !!(since && until)

  try {
    // ── Campanhas de seguidores ──
    const allCampaigns = await fetchCampaigns()
    const followerCampaigns = allCampaigns.filter(c => isFollowerCampaign(c.name, c.objective))
    const campaignIds = followerCampaigns.map(c => c.id)

    if (campaignIds.length === 0) {
      return NextResponse.json({ ads: [], followers: null, period: { since, until } })
    }

    // ── Janela em dias (para o Instagram) ──
    const days = isCustom
      ? Math.max(1, Math.round((Date.parse(until!) - Date.parse(since!)) / 86400000) + 1)
      : (PRESET_DAYS[datePreset] ?? 7)
    const todayUTC = new Date()
    const todayMidnight = Date.UTC(todayUTC.getUTCFullYear(), todayUTC.getUTCMonth(), todayUTC.getUTCDate())
    const igSince = isCustom
      ? Math.floor(Date.parse(since!) / 1000)
      : Math.floor((todayMidnight - (days - 1) * 86400000) / 1000)
    const igNow = Math.floor(Date.now() / 1000)

    // ── Fetch paralelo: insights + thumbnails + instagram ──
    const accountNumeric = (process.env.META_AD_ACCOUNT_ID ?? '').replace('act_', '')
    const [insights, thumbnails, igDaily] = await Promise.all([
      fetchFollowerAdInsights(campaignIds, isCustom ? { since: since!, until: until! } : { datePreset }),
      fetchAdThumbnails(campaignIds),
      (process.env.META_IG_USER_ID
        ? fetchInstagramInsights(igSince, igNow).catch(() => null)
        : Promise.resolve(null)),
    ])

    const ads = insights.map(ad => {
      const drive = getDriveCreative(ad.ad_name)
      return {
        ...ad,
        thumbnail: drive?.thumbnail ?? thumbnails[ad.ad_id] ?? null,
        metaLink: drive?.link ?? `https://adsmanager.facebook.com/adsmanager/manage/ads?act=${accountNumeric}&selected_ad_ids=${ad.ad_id}`,
      }
    })

    // Seguidores ganhos no período (soma do follower_count diário do IG).
    const followersGained = igDaily ? igDaily.reduce((s, d) => s + (d.followers ?? 0), 0) : null

    return NextResponse.json({
      ads,
      followers: followersGained != null ? { gained: followersGained } : null,
      period: { since, until, days },
      fetchedAt: new Date().toISOString(),
    })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
