// lib/instagram-api.ts
// ─────────────────────────────────────────────────────────────────────────────
// Instagram Graph API — Profile, Insights & Media
// Uses same META_ACCESS_TOKEN that already has instagram_manage_insights scope
// ─────────────────────────────────────────────────────────────────────────────

const GRAPH_BASE = 'https://graph.facebook.com/v21.0'

function getConfig() {
  const token = process.env.META_ACCESS_TOKEN?.trim()
  const igId = process.env.META_IG_USER_ID?.trim()
  if (!token) throw new Error('META_ACCESS_TOKEN não configurado')
  if (!igId) throw new Error('META_IG_USER_ID não configurado')
  return { token, igId }
}

// ─── Types ──────────────────────────────────────────────────────────────────

export interface IGProfile {
  username: string
  followers_count: number
  media_count: number
  profile_picture_url: string
}

export interface IGDailyInsight {
  date: string          // YYYY-MM-DD
  followers: number
  reach: number
}

export interface IGMediaPost {
  id: string
  timestamp: string     // ISO 8601
  media_type: string    // IMAGE | VIDEO | CAROUSEL_ALBUM
  caption: string
  like_count: number
  comments_count: number
  reach: number
  saved: number
  shares: number
}

// ─── Profile ────────────────────────────────────────────────────────────────

export async function fetchInstagramProfile(): Promise<IGProfile> {
  const { token, igId } = getConfig()
  const fields = 'username,followers_count,media_count,profile_picture_url'
  const res = await fetch(
    `${GRAPH_BASE}/${igId}?fields=${fields}&access_token=${token}`,
  )
  if (!res.ok) {
    const body = await res.text()
    throw new Error(`Instagram profile (${res.status}): ${body}`)
  }
  return res.json()
}

// ─── Account Insights (daily) ───────────────────────────────────────────────

export async function fetchInstagramInsights(
  since: number,  // unix seconds
  until: number,  // unix seconds
): Promise<IGDailyInsight[]> {
  const { token, igId } = getConfig()
  const metrics = 'follower_count,reach'
  const url = `${GRAPH_BASE}/${igId}/insights?metric=${metrics}&period=day&since=${since}&until=${until}&access_token=${token}`

  const res = await fetch(url)
  if (!res.ok) {
    const body = await res.text()
    throw new Error(`Instagram insights (${res.status}): ${body}`)
  }

  const json = await res.json()
  const metricsData = json.data as Array<{
    name: string
    values: Array<{ value: number; end_time: string }>
  }>

  // Pivot: metrics come as separate arrays, we need to merge by date
  const byDate = new Map<string, IGDailyInsight>()

  for (const metric of metricsData) {
    for (const point of metric.values) {
      const date = point.end_time.split('T')[0]
      const existing = byDate.get(date) ?? {
        date,
        followers: 0,
        reach: 0,
      }

      if (metric.name === 'follower_count') existing.followers = point.value
      if (metric.name === 'reach') existing.reach = point.value

      byDate.set(date, existing)
    }
  }

  return Array.from(byDate.values()).sort((a, b) => a.date.localeCompare(b.date))
}

// ─── Media (recent posts) ───────────────────────────────────────────────────

export async function fetchInstagramMedia(limit = 50): Promise<IGMediaPost[]> {
  const { token, igId } = getConfig()
  const fields = 'id,timestamp,media_type,caption,like_count,comments_count,insights.metric(reach,saved,shares)'
  const url = `${GRAPH_BASE}/${igId}/media?fields=${fields}&limit=${limit}&access_token=${token}`

  const res = await fetch(url)
  if (!res.ok) {
    const body = await res.text()
    throw new Error(`Instagram media (${res.status}): ${body}`)
  }

  const json = await res.json()
  const rawPosts = json.data as Array<Record<string, unknown>>

  return rawPosts.map((post) => {
    // Flatten nested insights
    const insights = post.insights as { data?: Array<{ name: string; values: Array<{ value: number }> }> } | undefined
    const insightsMap = new Map<string, number>()
    if (insights?.data) {
      for (const metric of insights.data) {
        insightsMap.set(metric.name, metric.values[0]?.value ?? 0)
      }
    }

    return {
      id: post.id as string,
      timestamp: post.timestamp as string,
      media_type: post.media_type as string,
      caption: (post.caption as string) ?? '',
      like_count: (post.like_count as number) ?? 0,
      comments_count: (post.comments_count as number) ?? 0,
      reach: insightsMap.get('reach') ?? 0,
      saved: insightsMap.get('saved') ?? 0,
      shares: insightsMap.get('shares') ?? 0,
    }
  })
}
