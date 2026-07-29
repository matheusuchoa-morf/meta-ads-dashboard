// lib/youtube-api.ts
// ─────────────────────────────────────────────────────────────────────────────
// YouTube Data API v3 — Channel Stats & Videos
// PRÉ-ESTRUTURADO: aguarda YOUTUBE_API_KEY e YOUTUBE_CHANNEL_ID
// ─────────────────────────────────────────────────────────────────────────────

const YT_BASE = 'https://www.googleapis.com/youtube/v3'

// ─── Types ──────────────────────────────────────────────────────────────────

export interface YTChannelStats {
  subscriberCount: number
  viewCount: number
  videoCount: number
}

export interface YTVideo {
  id: string
  title: string
  publishedAt: string     // ISO 8601
  thumbnail: string
  viewCount: number
  likeCount: number
  commentCount: number
}

// ─── Config check ───────────────────────────────────────────────────────────

export function isYouTubeConfigured(): boolean {
  return !!(process.env.YOUTUBE_API_KEY?.trim() && process.env.YOUTUBE_CHANNEL_ID?.trim())
}

function getConfig() {
  const apiKey = process.env.YOUTUBE_API_KEY?.trim()
  const channelId = process.env.YOUTUBE_CHANNEL_ID?.trim()
  if (!apiKey || !channelId) {
    throw new Error('YOUTUBE_API_KEY e YOUTUBE_CHANNEL_ID não configurados')
  }
  return { apiKey, channelId }
}

// ─── Channel Stats ──────────────────────────────────────────────────────────

export async function fetchYouTubeChannelStats(): Promise<YTChannelStats> {
  const { apiKey, channelId } = getConfig()

  const params = new URLSearchParams({
    part: 'statistics',
    id: channelId,
    key: apiKey,
  })

  const res = await fetch(`${YT_BASE}/channels?${params}`)
  if (!res.ok) {
    const body = await res.text()
    throw new Error(`YouTube channels (${res.status}): ${body}`)
  }

  const json = await res.json()
  const stats = json.items?.[0]?.statistics

  if (!stats) throw new Error('Canal do YouTube não encontrado')

  return {
    subscriberCount: Number(stats.subscriberCount ?? 0),
    viewCount: Number(stats.viewCount ?? 0),
    videoCount: Number(stats.videoCount ?? 0),
  }
}

// ─── Recent Videos ──────────────────────────────────────────────────────────

export async function fetchYouTubeVideos(maxResults = 20): Promise<YTVideo[]> {
  const { apiKey, channelId } = getConfig()

  // Step 1: Search for recent video IDs
  const searchParams = new URLSearchParams({
    part: 'snippet',
    channelId,
    order: 'date',
    type: 'video',
    maxResults: String(maxResults),
    key: apiKey,
  })

  const searchRes = await fetch(`${YT_BASE}/search?${searchParams}`)
  if (!searchRes.ok) {
    const body = await searchRes.text()
    throw new Error(`YouTube search (${searchRes.status}): ${body}`)
  }

  const searchJson = await searchRes.json()
  const items = searchJson.items as Array<{
    id: { videoId: string }
    snippet: { title: string; publishedAt: string; thumbnails: { medium?: { url: string } } }
  }>

  if (!items?.length) return []

  // Step 2: Fetch stats for all video IDs in one call
  const videoIds = items.map((i) => i.id.videoId).join(',')
  const statsParams = new URLSearchParams({
    part: 'statistics',
    id: videoIds,
    key: apiKey,
  })

  const statsRes = await fetch(`${YT_BASE}/videos?${statsParams}`)
  if (!statsRes.ok) {
    const body = await statsRes.text()
    throw new Error(`YouTube videos (${statsRes.status}): ${body}`)
  }

  const statsJson = await statsRes.json()
  const statsMap = new Map<string, Record<string, string>>()
  for (const v of statsJson.items ?? []) {
    statsMap.set(v.id, v.statistics)
  }

  return items.map((item) => {
    const stats = statsMap.get(item.id.videoId)
    return {
      id: item.id.videoId,
      title: item.snippet.title,
      publishedAt: item.snippet.publishedAt,
      thumbnail: item.snippet.thumbnails?.medium?.url ?? '',
      viewCount: Number(stats?.viewCount ?? 0),
      likeCount: Number(stats?.likeCount ?? 0),
      commentCount: Number(stats?.commentCount ?? 0),
    }
  })
}
