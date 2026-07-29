import { google } from 'googleapis';
import { getValidAccessToken } from './auth';
import type { YTChannelData, YTVideo, YTAnalytics } from './types';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function parseDurationSeconds(iso: string): number {
  const m = iso.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/)
  if (!m) return 0
  return (parseInt(m[1] ?? '0') * 3600) + (parseInt(m[2] ?? '0') * 60) + parseInt(m[3] ?? '0')
}

// ─── Channel data ─────────────────────────────────────────────────────────────

export async function getChannelData(): Promise<YTChannelData> {
  const accessToken = await getValidAccessToken();
  const youtube = google.youtube('v3');

  const response = await youtube.channels.list({
    part: ['statistics'],
    mine: true,
    access_token: accessToken,
  });

  const channel = response.data.items?.[0];
  if (!channel?.statistics) throw new Error('Channel not found');

  return {
    subscriberCount: parseInt(channel.statistics.subscriberCount || '0'),
    viewCount: parseInt(channel.statistics.viewCount || '0'),
    videoCount: parseInt(channel.statistics.videoCount || '0'),
  };
}

// ─── Recent videos (with duration for Shorts detection) ───────────────────────

export async function getRecentVideos(maxResults = 10, days?: number): Promise<YTVideo[]> {
  const accessToken = await getValidAccessToken();
  const youtube = google.youtube('v3');

  const channelResp = await youtube.channels.list({
    part: ['id'],
    mine: true,
    access_token: accessToken,
  });

  const channelId = channelResp.data.items?.[0]?.id;
  if (!channelId) throw new Error('Channel not found');

  // If days is specified, only return videos published within that period
  const publishedAfter = days
    ? new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString()
    : undefined

  const searchResp = await youtube.search.list({
    part: ['id'],
    channelId,
    type: ['video'],
    order: 'date',
    maxResults,
    ...(publishedAfter ? { publishedAfter } : {}),
    access_token: accessToken,
  });

  const videoIds = searchResp.data.items
    ?.map((item) => item.id?.videoId)
    .filter(Boolean) as string[] ?? [];

  if (!videoIds.length) return [];

  // Include contentDetails for duration + snippet for tags/description (Shorts detection)
  const videosResp = await youtube.videos.list({
    part: ['snippet', 'statistics', 'contentDetails', 'localizations'],
    id: videoIds,
    access_token: accessToken,
  });

  return (
    videosResp.data.items?.map((item) => {
      const duration = item.contentDetails?.duration ?? 'PT0S'
      const durationSeconds = parseDurationSeconds(duration)

      // Short = até 3 minutos (180s). Acima disso = Long.
      const isShort = durationSeconds > 0 && durationSeconds <= 180

      return {
        id: item.id || '',
        title: item.snippet?.title || '',
        publishedAt: item.snippet?.publishedAt || '',
        thumbnail: item.snippet?.thumbnails?.medium?.url || '',
        duration,
        isShort,
        views: parseInt(item.statistics?.viewCount || '0'),
        likes: parseInt(item.statistics?.likeCount || '0'),
        comments: parseInt(item.statistics?.commentCount || '0'),
        // Period stats default to 0 — merged later by getVideoMetrics
        periodViews: 0,
        avgWatchTime: 0,
        avgWatchPct: 0,
        subscribersGained: 0,
      }
    }) ?? []
  );
}

// ─── Per-video analytics for the selected period ──────────────────────────────

export async function getVideoMetrics(
  videoIds: string[],
  days: number,
): Promise<Record<string, { periodViews: number; avgWatchTime: number; avgWatchPct: number; subscribersGained: number }>> {
  if (!videoIds.length) return {}

  const accessToken = await getValidAccessToken()
  const youtubeAnalytics = google.youtubeAnalytics('v2')

  const endDate = new Date()
  const startDate = new Date()
  startDate.setDate(endDate.getDate() - days)

  const response = await youtubeAnalytics.reports.query({
    ids: 'channel==MINE',
    startDate: startDate.toISOString().split('T')[0],
    endDate: endDate.toISOString().split('T')[0],
    metrics: 'views,averageViewDuration,averageViewPercentage,subscribersGained',
    dimensions: 'video',
    sort: '-views',
    maxResults: 50,
    access_token: accessToken,
  })

  const headers = response.data.columnHeaders?.map((h) => h.name ?? '') ?? []
  const rows = response.data.rows ?? []

  const result: Record<string, { periodViews: number; avgWatchTime: number; avgWatchPct: number; subscribersGained: number }> = {}

  for (const row of rows) {
    const obj: Record<string, number | string> = {}
    headers.forEach((h, i) => {
      const val = row[i]
      obj[h] = isNaN(Number(val)) ? String(val) : Number(val)
    })

    const videoId = String(obj.video ?? '')
    if (videoId && videoIds.includes(videoId)) {
      result[videoId] = {
        periodViews: Number(obj.views ?? 0),
        avgWatchTime: Number(obj.averageViewDuration ?? 0),
        avgWatchPct: Number(obj.averageViewPercentage ?? 0),
        subscribersGained: Number(obj.subscribersGained ?? 0),
      }
    }
  }

  return result
}

// ─── Channel-level analytics (for the period cards) ───────────────────────────

export async function getAnalytics(daysBack = 28): Promise<YTAnalytics[]> {
  const accessToken = await getValidAccessToken();
  const youtubeAnalytics = google.youtubeAnalytics('v2');

  const endDate = new Date();
  const startDate = new Date(endDate.getTime() - daysBack * 24 * 60 * 60 * 1000);

  const response = await youtubeAnalytics.reports.query({
    ids: 'channel==MINE',
    startDate: startDate.toISOString().split('T')[0],
    endDate: endDate.toISOString().split('T')[0],
    metrics: 'views,estimatedMinutesWatched,averageViewDuration,subscribersGained',
    dimensions: 'day',
    sort: 'day',
    access_token: accessToken,
  });

  const headers = response.data.columnHeaders?.map((h) => h.name ?? '') ?? [];
  const rows = response.data.rows ?? [];

  return rows.map((row) => {
    const obj: Record<string, number | string> = {};
    headers.forEach((header, i) => {
      const val = row[i];
      obj[header] = isNaN(Number(val)) ? String(val) : Number(val);
    });
    return {
      date: String(obj.day ?? ''),
      views: Number(obj.views ?? 0),
      estimatedMinutesWatched: Number(obj.estimatedMinutesWatched ?? 0),
      averageViewDuration: Number(obj.averageViewDuration ?? 0),
      subscribersGained: Number(obj.subscribersGained ?? 0),
    };
  });
}
