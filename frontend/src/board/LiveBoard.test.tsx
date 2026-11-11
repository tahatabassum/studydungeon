import { act, cleanup, fireEvent, render, renderHook, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { ApiClient } from '@/api'
import { ApiError } from '@/api/errors'
import type { BoardEntry, BoardMe, BoardResponse } from '@/types/api'

const h = vi.hoisted(() => ({ api: null as unknown }))
vi.mock('@/api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/api')>()
  return { ...actual, getApi: () => Promise.resolve(h.api as ApiClient) }
})
import LeaderboardPage from '@/leaderboard/LeaderboardPage'
import { SessionProvider } from '@/state/SessionContext'
import { useBoard } from './useBoard'
import { useNow } from './useNow'

const NOW = Date.UTC(2026, 0, 5, 12, 0, 0)
const entry = (i: number, over: Partial<BoardEntry> = {}): BoardEntry => ({
  rank: i,
  public_id: `p_${i}`,
  handle: `Raven#${1000 + i}`,
  is_guest: false,
  level: 3,
  points: 1000 - i * 10,
  rooms_cleared: i,
  ...over,
})
const me = (over: Partial<BoardMe> = {}): BoardMe => ({
  live: true,
  rank: 25,
  points: 40,
  next_above: { rank: 24, handle: 'Raven#1024', points: 60, points_needed: 21 },
  top20: { in_top20: false, cutoff_points: 500, points_needed: 461 },
  ...over,
})
const res = (over: Partial<BoardResponse> = {}): BoardResponse => ({
  board: 'overall',
  period: 'all',
  updated_at: new Date(NOW).toISOString(),
  next_refresh_at: new Date(NOW + 3_600_000).toISOString(),
  entries: Array.from({ length: 6 }, (_, i) => entry(i + 1)),
  me: null,
  ...over,
})
const fake = (getBoard: ReturnType<typeof vi.fn>): ApiClient =>
  ({ getBoard, capabilities: { liveBoard: true }, getProgress: vi.fn().mockResolvedValue({ level: 1, total_xp: 0, xp_to_next: 10 }) }) as unknown as ApiClient

function Where() {
  const l = useLocation()
  return <div data-testid="where">{l.pathname + l.search}</div>
}
function renderPage(path = '/leaderboard') {
  return render(
    <SessionProvider>
      <MemoryRouter initialEntries={[path]}>
        <Where />
        <Routes>
          <Route path="/leaderboard" element={<LeaderboardPage />} />
          <Route path="*" element={<div />} />
        </Routes>
      </MemoryRouter>
    </SessionProvider>,
  )
}

describe('live leaderboard page', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'setInterval', 'clearInterval', 'Date'] })
    vi.setSystemTime(NOW)
  })
  afterEach(() => {
    cleanup()
    vi.useRealTimers()
  })

  it('shows podium, rows, tie-break note, update time and a ticking countdown', async () => {
    h.api = fake(vi.fn().mockResolvedValue(res()))
    renderPage()
    await act(async () => {
      await vi.advanceTimersByTimeAsync(10)
    })
    expect(screen.getByTestId('podium')).toBeTruthy()
    expect(screen.getByText('Ties go to whoever reached the total first.')).toBeTruthy()
    expect(screen.getByTestId('lb-foot').textContent).toContain('refreshes hourly')
    const before = screen.getByTestId('lb-countdown').textContent
    await act(async () => {
      await vi.advanceTimersByTimeAsync(3000)
    })
    expect(screen.getByTestId('lb-countdown').textContent).not.toBe(before)
    expect(screen.queryByText(/Ghost Rival/)).toBeNull()
  })

  it('selects tabs through URL params and by arrow keys, and shows the week reset text', async () => {
    const get = vi.fn().mockResolvedValue(res({ period: 'week', week: { timezone: 'UTC', starts_at: '2026-01-05T00:00:00Z', resets_at: '2026-01-12T00:00:00Z' } }))
    h.api = fake(get)
    renderPage('/leaderboard?board=own_notes&period=week')
    await act(async () => {
      await vi.advanceTimersByTimeAsync(10)
    })
    expect(get).toHaveBeenCalledWith({ board: 'own_notes', period: 'week' })
    expect(screen.getByTestId('lb-week-reset').textContent).toMatch(/^Resets Monday 00:00 UTC/)
    const tab = screen.getByRole('tab', { name: 'Own notes' })
    expect(tab.getAttribute('aria-selected')).toBe('true')
    fireEvent.keyDown(tab, { key: 'ArrowRight' })
    expect(screen.getByTestId('where').textContent).toContain('period=week')
    expect(screen.getByTestId('where').textContent).not.toContain('board=own_notes')
  })

  it('labels mock rivals and shows the empty state with a Play link', async () => {
    h.api = fake(vi.fn().mockResolvedValue(res({ entries: [entry(1, { is_seeded_rival: true })] })))
    renderPage()
    await act(async () => {
      await vi.advanceTimersByTimeAsync(10)
    })
    expect(screen.getAllByText('Ghost Rival - demo').length).toBeGreaterThan(0)
    cleanup()
    h.api = fake(vi.fn().mockResolvedValue(res({ entries: [] })))
    renderPage()
    await act(async () => {
      await vi.advanceTimersByTimeAsync(10)
    })
    expect(screen.getByText('Be the first to enter')).toBeTruthy()
    expect(screen.getByRole('link', { name: 'Play' }).getAttribute('href')).toBe('/choose')
  })

  it('shows the skeleton, then an error with Retry', async () => {
    const get = vi.fn().mockRejectedValueOnce(new ApiError(500, 'boom')).mockResolvedValue(res())
    h.api = fake(get)
    renderPage()
    expect(screen.getByTestId('lb-skeleton')).toBeTruthy()
    await act(async () => {
      await vi.advanceTimersByTimeAsync(10)
    })
    expect(screen.getByRole('alert')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Retry' }))
    await act(async () => {
      await vi.advanceTimersByTimeAsync(10)
    })
    expect(screen.getByTestId('podium')).toBeTruthy()
  })

  it('You panel: null me, first points, rank with pass and top-20 lines, rank 1', async () => {
    h.api = fake(vi.fn().mockResolvedValue(res({ me: null })))
    renderPage()
    await act(async () => {
      await vi.advanceTimersByTimeAsync(10)
    })
    expect(screen.getByRole('link', { name: 'Pick a name and play to join' }).getAttribute('href')).toBe('/play-as-guest')
    cleanup()
    h.api = fake(vi.fn().mockResolvedValue(res({ me: me() })))
    renderPage()
    await act(async () => {
      await vi.advanceTimersByTimeAsync(10)
    })
    const panel = screen.getByTestId('you-panel').textContent ?? ''
    expect(panel).toContain('can be ahead of the table')
    expect(panel).toContain('21 points to pass Raven#1024')
    expect(panel).toContain('461 points to enter the top 20')
    cleanup()
    h.api = fake(vi.fn().mockResolvedValue(res({ me: me({ rank: null, points: 0, reason: 'no_points_yet' }) })))
    renderPage()
    await act(async () => {
      await vi.advanceTimersByTimeAsync(10)
    })
    expect(screen.getByText('Earn your first points to join the board')).toBeTruthy()
    cleanup()
    h.api = fake(vi.fn().mockResolvedValue(res({ me: me({ rank: 1, next_above: null, top20: { in_top20: true, cutoff_points: 1, points_needed: 0 } }) })))
    renderPage()
    await act(async () => {
      await vi.advanceTimersByTimeAsync(10)
    })
    expect(screen.getByText('You lead')).toBeTruthy()
  })
})

describe('useBoard polling', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'setInterval', 'clearInterval', 'Date'] })
    vi.setSystemTime(NOW)
  })
  afterEach(() => {
    cleanup()
    vi.useRealTimers()
    Object.defineProperty(document, 'visibilityState', { value: 'visible', configurable: true })
  })
  const tick = (ms: number) =>
    act(async () => {
      await vi.advanceTimersByTimeAsync(ms)
    })

  it('makes one request per window, keeps stale rows on failure and stops on unmount', async () => {
    const get = vi
      .fn()
      .mockResolvedValueOnce(res({ next_refresh_at: new Date(NOW + 120_000).toISOString() }))
      .mockRejectedValueOnce(new ApiError(500, 'boom'))
    h.api = fake(get)
    const { result, unmount } = renderHook(() => useBoard('overall', 'all'))
    await tick(10)
    expect(get).toHaveBeenCalledTimes(1)
    await tick(100_000)
    expect(get).toHaveBeenCalledTimes(1)
    await tick(25_000)
    expect(get).toHaveBeenCalledTimes(2)
    expect(result.current.stale).toBe(true)
    expect(result.current.data?.entries.length).toBe(6)
    unmount()
    await tick(600_000)
    expect(get).toHaveBeenCalledTimes(2)
  })

  it('waits out Retry-After', async () => {
    const get = vi
      .fn()
      .mockResolvedValueOnce(res({ next_refresh_at: new Date(NOW + 1000).toISOString() }))
      .mockRejectedValueOnce(new ApiError(429, 'slow', undefined, { retryAfter: '300' }))
      .mockResolvedValue(res())
    h.api = fake(get)
    renderHook(() => useBoard('overall', 'all'))
    await tick(10)
    await tick(63_000)
    expect(get).toHaveBeenCalledTimes(2)
    await tick(200_000)
    expect(get).toHaveBeenCalledTimes(2)
    await tick(110_000)
    expect(get).toHaveBeenCalledTimes(3)
  })

  it('refetches when the tab becomes visible after 60 s, not before, and not while hidden', async () => {
    const get = vi.fn().mockResolvedValue(res())
    h.api = fake(get)
    renderHook(() => useBoard('overall', 'all'))
    await tick(10)
    Object.defineProperty(document, 'visibilityState', { value: 'hidden', configurable: true })
    document.dispatchEvent(new Event('visibilitychange'))
    await tick(4_000_000)
    expect(get).toHaveBeenCalledTimes(1)
    Object.defineProperty(document, 'visibilityState', { value: 'visible', configurable: true })
    document.dispatchEvent(new Event('visibilitychange'))
    await tick(10)
    expect(get).toHaveBeenCalledTimes(2)
  })

  it('ignores a late response of a previous board', async () => {
    let first!: (v: BoardResponse) => void
    const get = vi
      .fn()
      .mockImplementationOnce(() => new Promise<BoardResponse>((r) => (first = r)))
      .mockResolvedValue(res({ board: 'preloaded', entries: [entry(1)] }))
    h.api = fake(get)
    const { result, rerender } = renderHook(({ b }: { b: 'overall' | 'preloaded' }) => useBoard(b, 'all'), { initialProps: { b: 'overall' } })
    await tick(10)
    rerender({ b: 'preloaded' })
    await tick(10)
    await act(async () => first(res()))
    expect(result.current.data?.entries.length).toBe(1)
  })
})

describe('useNow', () => {
  it('ticks every second', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'setInterval', 'clearInterval', 'Date'] })
    const { result } = renderHook(() => useNow())
    const a = result.current
    await act(async () => {
      await vi.advanceTimersByTimeAsync(2000)
    })
    expect(result.current - a).toBeGreaterThanOrEqual(2000)
    vi.useRealTimers()
  })
})
