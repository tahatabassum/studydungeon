import { useEffect, type ReactNode } from 'react'
import { cleanup, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { ApiClient } from '@/api'
import { ApiError } from '@/api/errors'
import { createMockAdapter } from '@/api/mock/mockAdapter'
import { clearFinishedRuns, recordFinishedRun } from '@/leaderboard/sessionRuns'

const h = vi.hoisted(() => ({ api: null as unknown }))
vi.mock('@/api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/api')>()
  return { ...actual, getApi: () => Promise.resolve(h.api as ApiClient) }
})

import { SessionProvider, useSession } from '@/state/SessionContext'
import DashboardPage from './DashboardPage'

function Seed({ guest, children }: { guest: boolean; children: ReactNode }) {
  const { setSession } = useSession()
  useEffect(() => {
    setSession({ user: { id: 'u1', username: 'Sam', is_guest: guest }, dungeon_id: 'demo-dungeon', expires_at: '2099-01-01T00:00:00.000Z' })
  }, [guest, setSession])
  return <>{children}</>
}

function Where() {
  return <p data-testid="where">{useLocation().pathname}</p>
}

function renderDash(opts: { session?: 'guest' | 'player' | null; slot?: ReactNode } = {}) {
  const session = opts.session === undefined ? 'player' : opts.session
  const page = (
    <>
      <Where />
      <Routes>
        <Route path="/dashboard" element={<DashboardPage dailyHauntSlot={opts.slot} />} />
        <Route path="*" element={<p>elsewhere</p>} />
      </Routes>
    </>
  )
  return render(
    <MemoryRouter initialEntries={['/dashboard']}>
      <SessionProvider>{session === null ? page : <Seed guest={session === 'guest'}>{page}</Seed>}</SessionProvider>
    </MemoryRouter>,
  )
}

beforeEach(() => {
  clearFinishedRuns()
  h.api = createMockAdapter({ player: true })
})
afterEach(() => {
  cleanup()
  clearFinishedRuns()
})

describe('DashboardPage, signed-in player', () => {
  it('shows level and XP, Continue to the next playable floor, Play Demo, top 5, runs, counter, badges, armory and links', async () => {
    renderDash()
    const level = await screen.findByTestId('level-card')
    expect(within(level).getByText('Level 1')).toBeTruthy()
    expect(within(level).getByRole('progressbar', { name: 'XP toward the next level' })).toBeTruthy()

    const cont = await screen.findByTestId('continue-card')
    await vi.waitFor(() => expect(within(cont).getByTestId('continue-hint').textContent).toContain('Floor 1'))
    expect(within(cont).getByTestId('continue-link').getAttribute('href')).toBe('/campaign/demo-dungeon/play/floor-1')
    expect(within(cont).getByRole('link', { name: /Open the map/ }).getAttribute('href')).toBe('/campaign/demo-dungeon')
    expect(within(cont).getByRole('button', { name: 'Play Demo' })).toBeTruthy()
    expect(within(cont).getByRole('link', { name: /Upload notes/ }).getAttribute('href')).toBe('/upload')

    const board = await screen.findByTestId('board-preview')
    await vi.waitFor(() => expect(within(board).getAllByRole('listitem')).toHaveLength(5))
    expect(within(board).getByRole('link', { name: 'Full leaderboard' }).getAttribute('href')).toBe('/leaderboard')

    expect(within(screen.getByTestId('recent-runs')).getByText(/No runs yet/)).toBeTruthy()
    expect(screen.getByTestId('haunted-counter')).toBeTruthy()
    expect(within(screen.getByTestId('badges-card')).getAllByRole('listitem')).toHaveLength(8)
    expect(screen.getByTestId('armory')).toBeTruthy()
    const links = screen.getByTestId('links-card')
    expect(within(links).queryByRole('link', { name: /Upload notes/ })).toBeNull()
    expect(within(links).getByRole('button', { name: /Settings/ }).getAttribute('aria-disabled')).toBe('true')
  })

  it('shows mastery bars per topic with band labels', async () => {
    renderDash()
    const card = await screen.findByTestId('mastery-card')
    await vi.waitFor(() => expect(within(card).getAllByRole('img').length).toBeGreaterThan(3))
    expect(within(card).getByText('Floor 1, The Entry Crypt')).toBeTruthy()
    expect(within(card).getAllByText(/^Weak 0%$/).length).toBeGreaterThan(0)
  })

  it('shows the Progress panel from the mock fields, and hides it when the backend sends none', async () => {
    renderDash()
    const panel = await screen.findByTestId('progress-panel')
    expect(within(panel).getByTestId('notes-conquered')).toBeTruthy()
    expect(within(panel).getByTestId('streak-calendar')).toBeTruthy()
    // Nothing played yet: no memory strength and no weak concepts, so those blocks stay out.
    expect(within(panel).queryByTestId('memory-strength')).toBeNull()
    expect(within(panel).queryByTestId('weakest-concepts')).toBeNull()
    cleanup()

    const adapter = createMockAdapter({ player: true })
    h.api = {
      ...adapter,
      getProgress: async () => {
        const p = await adapter.getProgress()
        const { notes_conquered_percent, memory_strength, streak_calendar, weak_concepts, ...rest } = p
        void [notes_conquered_percent, memory_strength, streak_calendar, weak_concepts]
        return rest
      },
    }
    renderDash()
    await screen.findByTestId('level-card')
    expect(screen.queryByTestId('progress-panel')).toBeNull()
  })

  it('highlights the player in the top 5', async () => {
    const adapter = createMockAdapter({ player: true })
    const mine = {
      id: 'u1',
      rank: 2,
      display_name: 'Sam',
      is_guest: false,
      is_seeded_rival: false,
      level: 4,
      score: 3900,
      accuracy: 0.9,
      best_streak: 11,
      badge_ids: [],
    }
    const base = await adapter.getLeaderboard({ dungeonId: 'demo-dungeon', period: 'all' })
    h.api = {
      ...adapter,
      getLeaderboard: vi.fn().mockResolvedValue({ ...base, entries: [...base.entries, mine], me: { rank: 2, is_provisional: false, entry: mine } }),
    }
    renderDash()
    const board = await screen.findByTestId('board-preview')
    const me = await vi.waitFor(() => {
      const li = within(board).getAllByRole('listitem').find((x) => x.getAttribute('data-me') === 'true')
      if (!li) throw new Error('no me row')
      return li
    })
    expect(within(me).getByText('You')).toBeTruthy()
    expect(me.getAttribute('aria-current')).toBe('true')
  })

  it('renders the Daily Haunt slot when one is given, and nothing when not', async () => {
    const { unmount } = renderDash({ slot: <button type="button">Daily Haunt</button> })
    const slot = await screen.findByTestId('daily-haunt-slot')
    expect(within(slot).getByRole('button', { name: 'Daily Haunt' })).toBeTruthy()
    unmount()
    renderDash()
    await screen.findByTestId('continue-card')
    expect(screen.queryByTestId('daily-haunt-slot')).toBeNull()
  })

  it('Play Demo starts the demo session and opens the map', async () => {
    const user = userEvent.setup()
    const start = vi.spyOn(h.api as ApiClient, 'startDemoSession')
    renderDash()
    await user.click(await screen.findByRole('button', { name: 'Play Demo' }))
    await vi.waitFor(() => expect(screen.getByTestId('where').textContent).toBe('/campaign/demo-dungeon'))
    expect(start).toHaveBeenCalledTimes(1)
  })

  it('shows skeletons while progress is pending', async () => {
    const adapter = createMockAdapter({ player: true })
    h.api = { ...adapter, getProgress: () => new Promise(() => undefined) }
    renderDash()
    expect((await screen.findAllByTestId('card-skeleton')).length).toBeGreaterThan(0)
    expect(screen.queryByTestId('level-card')).toBeNull()
  })

  it('shows an error card with Retry when progress fails, keeps the other cards usable, and recovers', async () => {
    const adapter = createMockAdapter({ player: true })
    let fail = true
    h.api = {
      ...adapter,
      getProgress: vi.fn().mockImplementation(() => (fail ? Promise.reject(new ApiError(500, 'Server error')) : adapter.getProgress())),
    }
    const user = userEvent.setup()
    renderDash()
    const err = await screen.findByTestId('progress-error')
    expect(within(err).getByRole('alert').textContent).toBeTruthy()
    // Independent cards still work.
    expect(await screen.findByTestId('continue-card')).toBeTruthy()
    expect(await screen.findByTestId('board-preview')).toBeTruthy()
    expect(screen.queryByTestId('level-card')).toBeNull()
    fail = false
    await user.click(within(err).getByRole('button', { name: 'Retry' }))
    expect(await screen.findByTestId('level-card')).toBeTruthy()
    expect(screen.queryByTestId('progress-error')).toBeNull()
  })

  it('shows a coming-soon leaderboard card when the backend has none', async () => {
    const adapter = createMockAdapter({ player: true })
    const get = vi.fn()
    h.api = { ...adapter, getLeaderboard: get, capabilities: { roomRevenants: false, floors: true, modes: true, dailyHaunt: true, leaderboard: false } }
    renderDash()
    const card = await screen.findByTestId('board-preview')
    expect(card.textContent).toContain('coming soon')
    expect(get).not.toHaveBeenCalled()
  })
})

describe('DashboardPage, guest', () => {
  it('shows the demo card, provisional stats and a Create account call to action instead of the player cards', async () => {
    renderDash({ session: null })
    expect(await screen.findByTestId('demo-card')).toBeTruthy()
    const stats = screen.getByTestId('guest-stats')
    expect(stats.textContent).toContain('No runs yet')
    expect(within(stats).getByRole('button', { name: /Create account/ })).toBeTruthy()
    expect(screen.queryByTestId('level-card')).toBeNull()
    expect(screen.queryByTestId('links-card')).toBeNull()
    expect(within(screen.getByTestId('demo-card')).getByRole('link', { name: /Upload notes/ }).getAttribute('href')).toBe('/register')
  })

  it('shows this tab’s runs and a provisional rank on the demo board', async () => {
    recordFinishedRun({ dungeonId: 'demo-dungeon', score: 2300, accuracy: 0.8, bestStreak: 6, xp: 100, finishedAt: 1 })
    renderDash({ session: 'guest' })
    const stats = await screen.findByTestId('guest-stats')
    await vi.waitFor(() => expect(within(stats).getByText(/^#\d/)).toBeTruthy())
    expect(within(stats).getByText('2,300')).toBeTruthy()
    expect(within(stats).getByText('80%')).toBeTruthy()
  })

  it('Create account goes to the sign-in page', async () => {
    const user = userEvent.setup()
    renderDash({ session: null })
    await user.click(await screen.findByRole('button', { name: /Create account/ }))
    expect(screen.getByTestId('where').textContent).toBe('/register')
  })
})
