import type { ProgressInfo } from '../../types/api'

/**
 * MOCK-ONLY builders for the PROPOSED frontend-08 progress fields (notes conquered, memory strength, the
 * 12-week streak calendar, weakest concepts). The real Backend owns these numbers; the mock invents them so
 * the Progress panel has something honest to draw.
 */
export const CALENDAR_DAYS = 84

const DAY_MS = 24 * 60 * 60 * 1000

/**
 * The last 84 days, oldest first, as `YYYY-MM-DD` (UTC). Days reviewed are the Daily Haunt streak counted back
 * from today, or from yesterday when today's haunt has not been done yet.
 */
export function buildStreakCalendar(nowMs: number, dailyStreak: number, hauntDoneToday: boolean): NonNullable<ProgressInfo['streak_calendar']> {
  const days: NonNullable<ProgressInfo['streak_calendar']> = []
  for (let back = CALENDAR_DAYS - 1; back >= 0; back--) {
    const date = new Date(nowMs - back * DAY_MS).toISOString().slice(0, 10)
    const offset = hauntDoneToday ? back : back - 1
    days.push({ date, reviewed: dailyStreak > 0 && offset >= 0 && offset < dailyStreak })
  }
  return days
}

export function notesConqueredPercent(clearedTopics: number, totalTopics: number): number {
  if (totalTopics <= 0) return 0
  return Math.round((100 * Math.min(clearedTopics, totalTopics)) / totalTopics)
}
