// app/api/instagram/route.ts
// ─────────────────────────────────────────────────────────────────────────────
// Agrega dados do Instagram: perfil, insights diários, posts por dia
// ─────────────────────────────────────────────────────────────────────────────
import { NextRequest, NextResponse } from 'next/server'
import {
  fetchInstagramProfile,
  fetchInstagramInsights,
  fetchInstagramMedia,
} from '@/lib/instagram-api'
import { DEMO_MODE, demoBuildInstagram } from '@/lib/demo-data'

export async function GET(req: NextRequest) {
  if (DEMO_MODE) {
    const days = Math.min(Number(new URL(req.url).searchParams.get('days') ?? '7'), 30)
    return NextResponse.json(demoBuildInstagram(days))
  }
  if (!process.env.META_ACCESS_TOKEN || !process.env.META_IG_USER_ID) {
    return NextResponse.json(
      { error: 'META_ACCESS_TOKEN e META_IG_USER_ID não configurados.' },
      { status: 503 },
    )
  }

  const days = Math.min(Number(req.nextUrl.searchParams.get('days') ?? '7'), 30)

  // Align to UTC midnight so dates are clean — "days=1" means today (not "24h ago")
  const todayUTC = new Date()
  const todayMidnight = new Date(Date.UTC(
    todayUTC.getUTCFullYear(), todayUTC.getUTCMonth(), todayUTC.getUTCDate()
  ))
  const sinceDate = new Date(todayMidnight)
  sinceDate.setUTCDate(todayMidnight.getUTCDate() - (days - 1))
  const since = Math.floor(sinceDate.getTime() / 1000)
  const now = Math.floor(Date.now() / 1000)

  try {
    const [profile, dailyInsights, recentPosts] = await Promise.all([
      fetchInstagramProfile(),
      fetchInstagramInsights(since, now),
      fetchInstagramMedia(50),
    ])

    // Build posts-per-day histogram from media timestamps
    const postsByDate = new Map<string, number>()
    for (const post of recentPosts) {
      const date = post.timestamp.split('T')[0]
      postsByDate.set(date, (postsByDate.get(date) ?? 0) + 1)
    }

    // Fill missing days with 0 — iterate from sinceDate (midnight-aligned)
    const postsPerDay: Array<{ date: string; count: number }> = []
    for (let i = 0; i < days; i++) {
      const d = new Date(sinceDate)
      d.setUTCDate(sinceDate.getUTCDate() + i)
      const dateStr = d.toISOString().split('T')[0]
      postsPerDay.push({ date: dateStr, count: postsByDate.get(dateStr) ?? 0 })
    }

    // Filter recent posts to the requested period
    const cutoff = new Date(since * 1000).toISOString()
    const filteredPosts = recentPosts.filter((p) => p.timestamp >= cutoff)

    return NextResponse.json({
      profile,
      dailyInsights,
      postsPerDay,
      recentPosts: filteredPosts,
      fetchedAt: new Date().toISOString(),
    })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Erro desconhecido'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
