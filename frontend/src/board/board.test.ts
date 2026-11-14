import { describe, expect, it } from 'vitest'
import { formatCountdown, formatWeekReset } from './countdown'
import { MIN_BOARD_INTERVAL_MS, nextPollDelay, randomJitter, REFETCH_JITTER_MS } from './pollScheduler'
import { buildLiveBoardView } from './boardView'

describe('countdown', () => {
  it('formats m:ss and h:mm:ss', () => {
    expect(formatCountdown(65_000, 0)).toBe('1:05')
    expect(formatCountdown(3_725_000, 0)).toBe('1:02:05')
    expect(formatCountdown(0, 5)).toBe('0:00')
  })
  it('formats the weekly reset in the board zone and falls back to UTC for an invalid zone', () => {
    const week = { timezone: 'UTC', resets_at: '2026-11-23T00:00:00Z' }
    expect(formatWeekReset(week, 'UTC')).toBe('Resets Monday 00:00 UTC')
    expect(formatWeekReset({ ...week, timezone: 'Nowhere/Land' }, 'UTC')).toBe('Resets Monday 00:00 UTC')
    expect(formatWeekReset(week, 'Europe/Berlin')).toMatch(/^Resets Monday 00:00 UTC \(your time: Monday 01:00 /)
    expect(formatWeekReset({ timezone: 'UTC', resets_at: 'bad' })).toBe('')
  })
})

describe('pollScheduler', () => {
  it('waits for next_refresh_at plus jitter, the 60 s gap and Retry-After', () => {
    const base = { now: 100_000, nextRefreshAt: 104_000, lastFetchAt: 0, visible: true }
    expect(nextPollDelay(base)).toBe(4000)
    expect(nextPollDelay({ ...base, jitterMs: 500 })).toBe(4500)
    expect(nextPollDelay({ ...base, lastFetchAt: 100_000 })).toBe(MIN_BOARD_INTERVAL_MS)
    expect(nextPollDelay({ ...base, retryAfterUntil: 200_000 })).toBe(100_000)
    expect(nextPollDelay({ ...base, visible: false })).toBeNull()
    expect(nextPollDelay({ ...base, lastFetchAt: null, nextRefreshAt: null })).toBe(0)
  })
  it('keeps the jitter within bounds', () => {
    expect(randomJitter(() => 0)).toBe(0)
    expect(randomJitter(() => 0.999999)).toBeLessThanOrEqual(REFETCH_JITTER_MS)
  })
})

describe('boardView', () => {
  it('is empty without entries', () => {
    expect(buildLiveBoardView({ entries: [] })).toEqual({ podium: [], rows: [], empty: true })
  })
})
