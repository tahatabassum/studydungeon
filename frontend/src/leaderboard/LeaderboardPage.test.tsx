import { useEffect, type ReactNode } from 'react'
import { cleanup, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { ApiClient } from '@/api'
import { ApiError } from '@/api/errors'
import type { LeaderboardEntry, LeaderboardResponse } from '@/types/api'

const h = vi.hoisted(() => ({ api: null as unknown }))
vi.mock('@/api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/api')>()
  return { ...actual, getApi: () => Promise.resolve(h.api as ApiClient) }
})

import { SessionProvider, useSession } from '@/state/SessionContext'
import LeaderboardPage, { CLAIM_SPOT } from './LeaderboardPage'
import { clearFinishedRuns, recordFinishedRun } from './sessionRuns'

const entry = (i: number, over: Partial<LeaderboardEntry> = {}): LeaderboardEntry => ({
  id: `r${i}`,
  rank: i,
  display_name: `Rival ${i}`,
  is_guest: false,
  is_seeded_rival: true,
  level: 10 - i,
  score: 5000 - i * 400,
  accuracy: 0.9 - i * 0.02,
  best_streak: 12 - i,
  badge_ids: i === 1 ? ['boss_slayer'] : [],
  ...over,
})
const rivals = Array.from({ length: 8 }, (_, i) => entry(i + 1))
const response = (over: Partial<LeaderboardResponse> = {}): LeaderboardResponse => ({
  entries: rivals,
  me: { rank: null, is_provisional: false, entry: null },
  updated_at: '2026-01-01T12:00:00.000Z',
  ...over,
})

function fakeApi(getLeaderboard: ReturnType<typeof vi.fn>, capabilities?: unknown): ApiClient {
  return {
    getLeaderboard,
    getProgress: vi.fn().mockResolvedValue({ level: 3, total_xp: 200, xp_to_next: 100 }),
    capabilities: { liveBoard: false, ...(capabilities as object | undefined) },
  } as unknown as ApiClient
}

function Seed({ guest, children }: { guest: boolean; children: ReactNode }) {
  const { setSession } = useSession()
  useEffect(() => {
    setSession({ user: { id: 'u1', username: 'Sam', is_guest: guest }, dungeon_id: 'demo-dungeon', expires_at: '2099-01-01T00:00:00.000Z' })
  }, [guest, setSession])
  return <>{children}</>
}

function renderPage(opts: { guest?: boolean | null; path?: string } = {}) {
  const guest = opts.guest === undefined ? true : opts.guest
  const page = (
    <Routes>
      <Route path="/leaderboard" element={<LeaderboardPage />} />
      <Route path="/register" element={<p>login page</p>} />
    </Routes>
  )
  return render(
    <MemoryRouter initialEntries={[opts.path ?? '/leaderboard']}>
      <SessionProvider>{guest === null ? page : <Seed guest={guest}>{page}</Seed>}</SessionProvider>
    </MemoryRouter>,
  )
}

beforeEach(() => {
  clearFinishedRuns()
})
afterEach(() => {
  cleanup()
  clearFinishedRuns()
})

describe('LeaderboardPage', () => {
  it('is readable without a session: tabs, a top-3 podium and the rows after it, with Ghost Rival labels', async () => {
    const get = vi.fn().mockResolvedValue(response())
    h.api = fakeApi(get)
    renderPage({ guest: null })
    const podium = await screen.findByTestId('podium')
    expect(within(podium).getAllByRole('listitem').filter((li) => li.getAttribute('data-place'))).toHaveLength(3)
    const table = screen.getByRole('table', { name: 'All-time rankings' })
    // Rank, player, level, score, accuracy, best streak, badges.
    expect(within(table).getAllByRole('columnheader').map((c) => c.textContent)).toEqual([
      'Rank',
      'Player',
      'Level',
      'Score',
      'Accuracy',
      'Best streak',
      'Badges',
    ])
    expect(within(table).getAllByRole('row').length).toBe(1 + 5)
    expect(screen.getAllByText('Ghost Rival - demo')).toHaveLength(8)
    expect(screen.getByText('Rival 1')).toBeTruthy()
    expect(get).toHaveBeenCalledWith({ dungeonId: 'demo-dungeon', period: 'all', limit: 20 })
    // No stored entry, no run: no pinned row.
    expect(screen.queryByTestId('lb-me')).toBeNull()
  })

  it('shows the claim call to action to guests, who can open the sign-in page', async () => {
    h.api = fakeApi(vi.fn().mockResolvedValue(response()))
    const user = userEvent.setup()
    renderPage({ guest: true })
    const claim = await screen.findByTestId('lb-claim')
    expect(claim.textContent).toContain(CLAIM_SPOT)
    await user.click(within(claim).getByRole('button', { name: /Create account/ }))
    expect(await screen.findByText('login page')).toBeTruthy()
  })

  it('pins a highlighted provisional row for a guest who finished a run', async () => {
    h.api = fakeApi(vi.fn().mockResolvedValue(response()))
    // 3500 sits between Rival 3 (3800) and Rival 4 (3400): three rivals outrank it, so the rank is 4.
    recordFinishedRun({ dungeonId: 'demo-dungeon', score: 3500, accuracy: 0.8, bestStreak: 5, xp: 100, finishedAt: 1 })
    renderPage({ guest: true })
    const me = await screen.findByTestId('lb-me')
    expect(within(me).getByText('Provisional')).toBeTruthy()
    expect(within(me).getByText('You')).toBeTruthy()
    const row = within(me).getByRole('row')
    expect(row.getAttribute('data-me')).toBe('true')
    expect(within(row).getAllByRole('cell')[0].textContent).toContain('4')
    expect(screen.getByTestId('lb-claim').textContent).toContain('rank 4')
  })

  it('pins the stored entry of a signed-in player and hides the claim call to action', async () => {
    const mine = entry(6, { id: 'u1', is_seeded_rival: false, display_name: 'Sam', score: 100, rank: 9 })
    h.api = fakeApi(vi.fn().mockResolvedValue(response({ entries: [...rivals, mine], me: { rank: 9, is_provisional: false, entry: mine } })), undefined)
    renderPage({ guest: false })
    const me = await screen.findByTestId('lb-me')
    expect(within(me).getByText('Sam')).toBeTruthy()
    expect(within(me).queryByText('Provisional')).toBeNull()
    expect(screen.queryByTestId('lb-claim')).toBeNull()
  })

  it('switches to This week and requests that period', async () => {
    const get = vi.fn().mockResolvedValue(response())
    h.api = fakeApi(get)
    const user = userEvent.setup()
    renderPage({ guest: true })
    await screen.findByTestId('podium')
    const all = screen.getByRole('tab', { name: 'All-time' })
    const week = screen.getByRole('tab', { name: 'This week' })
    expect(all.getAttribute('aria-selected')).toBe('true')
    await user.click(week)
    expect(week.getAttribute('aria-selected')).toBe('true')
    await screen.findByRole('table', { name: 'This week rankings' })
    expect(get).toHaveBeenLastCalledWith({ dungeonId: 'demo-dungeon', period: 'week', limit: 20 })
  })

  it('moves between tabs with the arrow keys', async () => {
    h.api = fakeApi(vi.fn().mockResolvedValue(response()))
    const user = userEvent.setup()
    renderPage({ guest: true })
    await screen.findByTestId('podium')
    screen.getByRole('tab', { name: 'All-time' }).focus()
    await user.keyboard('{ArrowRight}')
    expect(screen.getByRole('tab', { name: 'This week' }).getAttribute('aria-selected')).toBe('true')
  })

  it('shows a skeleton while loading, then an error with Retry that loads the board', async () => {
    let fail = true
    const get = vi.fn().mockImplementation(() => (fail ? Promise.reject(new ApiError(500, 'Server error')) : Promise.resolve(response())))
    h.api = fakeApi(get)
    const user = userEvent.setup()
    renderPage({ guest: true })
    expect(screen.getByTestId('lb-skeleton')).toBeTruthy()
    const alert = await screen.findByRole('alert')
    expect(alert.textContent).toBeTruthy()
    fail = false
    await user.click(screen.getByRole('button', { name: 'Retry' }))
    expect(await screen.findByTestId('podium')).toBeTruthy()
  })

  it('shows an empty state when nobody is on the board', async () => {
    h.api = fakeApi(vi.fn().mockResolvedValue(response({ entries: [] })))
    renderPage({ guest: true })
    expect((await screen.findByTestId('lb-empty')).textContent).toContain('Finish a run')
  })

  it('shows a coming-soon state and makes no request when the backend has no leaderboard', async () => {
    const get = vi.fn()
    h.api = fakeApi(get, { roomRevenants: false, floors: false, modes: false, dailyHaunt: false, leaderboard: false })
    renderPage({ guest: true })
    expect((await screen.findByTestId('lb-coming-soon')).textContent).toContain('does not offer a leaderboard yet')
    expect(screen.queryByRole('tablist')).toBeNull()
    expect(get).not.toHaveBeenCalled()
  })

  it('a personal dungeon is titled as the player’s own best runs', async () => {
    h.api = fakeApi(vi.fn().mockResolvedValue(response({ entries: [] })))
    renderPage({ guest: true, path: '/leaderboard?dungeon=my-notes' })
    expect(await screen.findByText('Your best runs in this dungeon')).toBeTruthy()
  })
})
