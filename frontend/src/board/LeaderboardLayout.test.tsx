/**
 * Leaderboard layout markup (jsdom has no layout, so these check text, structure and inline styles).
 * **Validates: Requirements 3.3, 4.4, 4.5, 5.1, 5.5, 6.1**
 */
import { useEffect, type ReactNode } from 'react'
import { act, cleanup, render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { ApiClient } from '@/api'
import type { BoardEntry, BoardMe, BoardResponse } from '@/types/api'

const h = vi.hoisted(() => ({ api: null as unknown }))
vi.mock('@/api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/api')>()
  return { ...actual, getApi: () => Promise.resolve(h.api as ApiClient) }
})
import LeaderboardPage from '@/leaderboard/LeaderboardPage'
import { SessionProvider, useSession } from '@/state/SessionContext'

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
const board = (n: number, over: Partial<BoardResponse> = {}): BoardResponse => ({
  board: 'overall',
  period: 'all',
  updated_at: new Date(NOW).toISOString(),
  next_refresh_at: new Date(NOW + 3_600_000).toISOString(),
  entries: Array.from({ length: n }, (_, i) => entry(i + 1)),
  me: null,
  ...over,
})
const me = (over: Partial<BoardMe> = {}): BoardMe => ({
  live: true,
  rank: 25,
  points: 1,
  next_above: { rank: 24, handle: 'Raven#1024', points: 2, points_needed: 1 },
  top20: { in_top20: false, cutoff_points: 3, points_needed: 2 },
  ...over,
})
const fake = (res: BoardResponse): ApiClient =>
  ({
    getBoard: vi.fn().mockResolvedValue(res),
    capabilities: { liveBoard: true },
    getProgress: vi.fn().mockResolvedValue({ level: 1, total_xp: 0, xp_to_next: 10 }),
  }) as unknown as ApiClient

function Seed({ children }: { children: ReactNode }) {
  const { setUser } = useSession()
  useEffect(() => {
    setUser({ id: 'u1', username: 'sam', is_guest: false })
  }, [setUser])
  return <>{children}</>
}

async function show(res: BoardResponse) {
  h.api = fake(res)
  const view = render(
    <SessionProvider>
      <MemoryRouter initialEntries={['/leaderboard']}>
        <Seed>
          <Routes>
            <Route path="/leaderboard" element={<LeaderboardPage />} />
          </Routes>
        </Seed>
      </MemoryRouter>
    </SessionProvider>,
  )
  await act(async () => {
    await vi.advanceTimersByTimeAsync(10)
  })
  return view
}

describe('leaderboard layout', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'setInterval', 'clearInterval', 'Date'] })
    vi.setSystemTime(NOW)
  })
  afterEach(() => {
    cleanup()
    vi.useRealTimers()
  })

  it('labels the panel "Your live rank" and uses "1 point" and "2 points"', async () => {
    await show(board(6, { me: me() }))
    const text = screen.getByTestId('you-panel').textContent ?? ''
    expect(text).toContain('Your live rank')
    expect(text).toContain('Updates instantly. The table refreshes hourly.')
    expect(text).toContain('1 Leaderboard point')
    expect(text).not.toContain('1 Leaderboard points')
    expect(text).toContain('1 point to pass Raven#1024')
    expect(text).toContain('2 points to enter the top 20')
  })

  it('shows exactly one Dashboard link', async () => {
    await show(board(6))
    expect(screen.getAllByRole('link', { name: /Dashboard/ })).toHaveLength(1)
  })

  it('gives a long name a title and truncates through CSS classes', async () => {
    const long = 'W'.repeat(30)
    await show(board(6, { entries: Array.from({ length: 6 }, (_, i) => entry(i + 1, i === 4 ? { display_name: long } : {})) }))
    const el = screen.getAllByText(long).find((n) => n.classList.contains('sd-lb__nametext'))
    expect(el?.getAttribute('title')).toBe(long)
  })

  it.each([0, 1, 3, 8, 20])('renders %i entries without an error', async (n) => {
    await show(board(n))
    expect(screen.queryByRole('alert')).toBeNull()
    if (n === 0) expect(screen.getByText('Be the first to enter')).toBeTruthy()
    else expect(screen.getByTestId('podium')).toBeTruthy()
    if (n === 1 || n === 3) expect(screen.getByTestId('lb-rows-empty')).toBeTruthy()
  })

  it('splits ranks 4 to 20 into two columns of up to 9 when there are many rows', async () => {
    await show(board(20))
    const table = screen.getByRole('table', { name: 'Rankings' })
    expect(table.getAttribute('data-many')).toBe('true')
    expect(table.style.getPropertyValue('--lb-half')).toBe('9')
    expect(table.querySelectorAll('tbody tr')).toHaveLength(17)
    cleanup()
    await show(board(8))
    expect(screen.getByRole('table', { name: 'Rankings' }).getAttribute('data-many')).toBeNull()
  })

  it('the skeleton has no inline height style', async () => {
    h.api = { ...fake(board(3)), getBoard: () => new Promise(() => {}) } as unknown as ApiClient
    render(
      <SessionProvider>
        <MemoryRouter initialEntries={['/leaderboard']}>
          <Routes>
            <Route path="/leaderboard" element={<LeaderboardPage />} />
          </Routes>
        </MemoryRouter>
      </SessionProvider>,
    )
    await act(async () => {
      await vi.advanceTimersByTimeAsync(10)
    })
    const skel = screen.getByTestId('lb-skeleton')
    expect(skel.querySelectorAll('[style*="height"]')).toHaveLength(0)
  })
})
