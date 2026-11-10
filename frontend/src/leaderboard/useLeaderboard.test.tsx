import { act, cleanup, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { ApiClient } from '../api'
import { ApiError } from '../api/errors'
import type { LeaderboardResponse } from '../types/api'
import { POLL_MS } from './constants'
import { useLeaderboard } from './useLeaderboard'

const board = (score: number): LeaderboardResponse => ({
  entries: [
    { id: 'a', rank: 1, display_name: 'A', is_guest: false, is_seeded_rival: false, level: 1, score, accuracy: 1, best_streak: 1, badge_ids: [] },
  ],
  me: { rank: null, is_provisional: false, entry: null },
  updated_at: '2026-01-01T00:00:00.000Z',
})

function setup(getLeaderboard: ReturnType<typeof vi.fn>) {
  const client = { getLeaderboard } as unknown as ApiClient
  return renderHook(
    ({ period }: { period: 'all' | 'week' }) =>
      useLeaderboard({ dungeonId: 'demo-dungeon', period, getClient: () => Promise.resolve(client) }),
    { initialProps: { period: 'all' as 'all' | 'week' } },
  )
}

const flush = () => act(async () => { await vi.advanceTimersByTimeAsync(0) })
const tick = (ms: number) => act(async () => { await vi.advanceTimersByTimeAsync(ms) })
const setVisibility = (state: 'visible' | 'hidden') => {
  Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => state })
  document.dispatchEvent(new Event('visibilitychange'))
}

describe('useLeaderboard polling (D11, Req 11.10)', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    setVisibility('visible')
  })
  afterEach(() => {
    cleanup()
    vi.useRealTimers()
  })

  it('fetches on mount, then every 30 seconds while mounted and visible', async () => {
    const get = vi.fn().mockImplementation(() => Promise.resolve(board(100)))
    const { result } = setup(get)
    await flush()
    expect(get).toHaveBeenCalledTimes(1)
    expect(get).toHaveBeenCalledWith({ dungeonId: 'demo-dungeon', period: 'all' })
    expect(result.current.status).toBe('ready')

    await tick(POLL_MS - 1)
    expect(get).toHaveBeenCalledTimes(1)
    await tick(1)
    expect(get).toHaveBeenCalledTimes(2)
    await tick(POLL_MS)
    expect(get).toHaveBeenCalledTimes(3)
  })

  it('stops polling on unmount', async () => {
    const get = vi.fn().mockImplementation(() => Promise.resolve(board(100)))
    const { unmount } = setup(get)
    await flush()
    unmount()
    await tick(POLL_MS * 4)
    expect(get).toHaveBeenCalledTimes(1)
  })

  it('does not poll while the tab is hidden, and refetches when it becomes visible', async () => {
    const get = vi.fn().mockImplementation(() => Promise.resolve(board(100)))
    setup(get)
    await flush()
    act(() => setVisibility('hidden'))
    await tick(POLL_MS * 3)
    expect(get).toHaveBeenCalledTimes(1)
    act(() => setVisibility('visible'))
    await flush()
    expect(get).toHaveBeenCalledTimes(2)
    await tick(POLL_MS)
    expect(get).toHaveBeenCalledTimes(3)
  })

  it('keeps the old rows when a poll fails and recovers on the next poll', async () => {
    const get = vi
      .fn()
      .mockResolvedValueOnce(board(100))
      .mockRejectedValueOnce(new ApiError(500, 'boom'))
      .mockResolvedValueOnce(board(250))
    const { result } = setup(get)
    await flush()
    expect(result.current.data?.entries[0].score).toBe(100)
    await tick(POLL_MS)
    expect(result.current.status).toBe('ready')
    expect(result.current.stale).toBe(true)
    expect(result.current.data?.entries[0].score).toBe(100)
    await tick(POLL_MS)
    expect(result.current.stale).toBe(false)
    expect(result.current.data?.entries[0].score).toBe(250)
  })

  it('becomes an error state when the first load fails, and Retry loads again', async () => {
    const get = vi.fn().mockRejectedValueOnce(new ApiError(500, 'Server error')).mockResolvedValue(board(100))
    const { result } = setup(get)
    await flush()
    expect(result.current.status).toBe('error')
    expect(result.current.error).toBeTruthy()
    act(() => result.current.refresh())
    await flush()
    expect(result.current.status).toBe('ready')
  })

  it('shows the skeleton again and refetches when the period changes', async () => {
    const get = vi.fn().mockImplementation(() => Promise.resolve(board(100)))
    const { result, rerender } = setup(get)
    await flush()
    rerender({ period: 'week' })
    expect(result.current.status).toBe('loading')
    await flush()
    expect(get).toHaveBeenLastCalledWith({ dungeonId: 'demo-dungeon', period: 'week' })
    expect(result.current.status).toBe('ready')
  })

  it('makes no request when disabled', async () => {
    const get = vi.fn()
    const client = { getLeaderboard: get } as unknown as ApiClient
    renderHook(() => useLeaderboard({ dungeonId: 'd', period: 'all', enabled: false, getClient: () => Promise.resolve(client) }))
    await tick(POLL_MS * 2)
    expect(get).not.toHaveBeenCalled()
  })
})
