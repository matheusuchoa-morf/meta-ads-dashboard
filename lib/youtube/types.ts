export interface YTVideo {
  id: string;
  title: string;
  publishedAt: string;
  thumbnail: string;
  duration: string;       // ISO 8601 e.g. "PT45S", "PT3M20S"
  isShort: boolean;       // duration <= 60s
  // lifetime stats (from Data API)
  views: number;
  likes: number;
  comments: number;
  // period stats (from Analytics API, varies with `days` param)
  periodViews: number;
  avgWatchTime: number;       // seconds
  avgWatchPct: number;        // % of video watched (averageViewPercentage)
  subscribersGained: number;
}

export interface YTChannelData {
  subscriberCount: number;
  viewCount: number;
  videoCount: number;
}

export interface YTAnalytics {
  date: string;
  views: number;
  estimatedMinutesWatched: number;
  averageViewDuration: number;
  subscribersGained: number;
}

export interface YTData {
  configured: boolean;
  channel?: YTChannelData;
  recentVideos?: YTVideo[];
  analytics?: YTAnalytics[];
  aggregates?: {
    totalViews: number;
    totalWatchTime: number;
    newSubscribers: number;
    avgViewDuration: number;
  };
  error?: string;
}
