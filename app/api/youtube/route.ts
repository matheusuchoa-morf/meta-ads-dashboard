import { NextRequest, NextResponse } from 'next/server';
import { getChannelData, getRecentVideos, getAnalytics, getVideoMetrics } from '@/lib/youtube/analytics';
import { DEMO_MODE, DEMO_YOUTUBE } from '@/lib/demo-data'

export async function GET(req: NextRequest) {
  if (DEMO_MODE) return NextResponse.json(DEMO_YOUTUBE)

  const days = Math.min(Number(req.nextUrl.searchParams.get('days') ?? '7'), 30)

  try {
    const [channel, recentVideos, analytics] = await Promise.all([
      getChannelData(),
      getRecentVideos(20, days),
      getAnalytics(days),
    ]);

    // Fetch per-video metrics for the selected period and merge
    const videoIds = recentVideos.map((v) => v.id)
    const videoMetrics = await getVideoMetrics(videoIds, days)

    const videosWithMetrics = recentVideos.map((v) => ({
      ...v,
      ...(videoMetrics[v.id] ?? {}),
    }))

    const totalViews = analytics.reduce((sum, day) => sum + day.views, 0);
    const totalWatchTime = analytics.reduce((sum, day) => sum + day.estimatedMinutesWatched, 0);
    const newSubscribers = analytics.reduce((sum, day) => sum + day.subscribersGained, 0);

    return NextResponse.json({
      configured: true,
      channel,
      recentVideos: videosWithMetrics,
      analytics,
      aggregates: {
        totalViews,
        totalWatchTime,
        newSubscribers,
        avgViewDuration: analytics.length
          ? analytics.reduce((sum, day) => sum + day.averageViewDuration, 0) / analytics.length
          : 0,
      },
    });
  } catch (error) {
    console.error('YouTube API error:', error);
    return NextResponse.json(
      {
        configured: false,
        error: error instanceof Error ? error.message : 'Failed to fetch YouTube data',
      },
      { status: 500 }
    );
  }
}
