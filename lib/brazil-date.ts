// lib/brazil-date.ts
// Utilities for São Paulo timezone (UTC-3, fixed — no DST since Apr/2019).
// Vercel runs in UTC; these helpers convert explicitly to the SP calendar
// so that midnight in SP doesn't become 21h of the prior day in UTC.

export const BRAZIL_OFFSET_MS = 3 * 60 * 60 * 1000 // UTC-3

/** Returns the start of today (São Paulo) expressed as a UTC Date. */
export function brazilTodayMidnightUTC(): Date {
  const nowBrazilLocal = new Date(Date.now() - BRAZIL_OFFSET_MS)
  nowBrazilLocal.setUTCHours(0, 0, 0, 0)
  return new Date(nowBrazilLocal.getTime() + BRAZIL_OFFSET_MS)
}

const PRESET_DAYS: Record<string, number> = {
  today: 0, last_7d: 7, last_14d: 14, last_30d: 30,
  last_week_mon_sun: 7, last_month: 30,
}

/** Maps a Meta-style date preset to a Brazil-anchored { start, end } range. */
export function getBrazilDateRange(preset: string): { start: Date; end: Date } {
  const end   = new Date()
  const start = brazilTodayMidnightUTC()
  start.setUTCDate(start.getUTCDate() - (PRESET_DAYS[preset] ?? 7))
  return { start, end }
}
