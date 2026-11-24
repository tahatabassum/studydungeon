import { cleanup, render, screen, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { ApiClient } from '@/api'
import type { BoardEntry, BoardResponse } from '@/types/api'

const h = vi.hoisted(() => ({ api: null as unknown }))
vi.mock('@/api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/api')>()
  return { ...actual, getApi: () => Promise.resolve(h.api as ApiClient) }
})
import { LiveTopFiveCard } from './LiveTopFiveCard'

afterEach(cleanup)

const entry = (rank: number, points: number): BoardEntry => ({
  rank,
  public_id: `p_${rank}`,
  handle: `Raven#${1000 + rank}`,
  is_guest: false,
  level: 2,
  points,
  rooms_cleared: rank,
})
const board = (entries: BoardEntry[], me: BoardResponse['me'] = null): BoardResponse => ({
  board: 'overall',
  period: 'all',
  updated_at: '2026-11-24T13:00:00Z',
  next_refresh_at: '2026-11-24T13:01:00Z',
  entries,
  me,
})

function show(res: BoardResponse) {
  h.api = { getBoard: vi.fn().mockResolvedValue(res), capabilities: { liveBoard: true } }
  render(
    <MemoryRouter>
      <LiveTopFiveCard />
    </MemoryRouter>,
  )
}

describe('LiveTopFiveCard (real leaderboard on the dashboard)', () => {
  it('shows the top 5 real players with the points the server sent', async () => {
    show(board([entry(1, 2560), entry(2, 900), entry(3, 500), entry(4, 300), entry(5, 200), entry(6, 100)]))
    const card = await screen.findByTestId('board-preview')
    const items = await within(card).findAllByRole('listitem')
    expect(items).toHaveLength(5)
    expect(items[0].textContent).toContain('Raven#1001')
    expect(items[0].textContent).toContain('2,560')
  })

  it('adds the player below the top 5 with their live rank', async () => {
    show(board([entry(1, 900), entry(2, 800), entry(3, 700), entry(4, 600), entry(5, 500)], {
      live: true, public_id: 'p_me', handle: 'Bat#2231', rank: 9, points: 120, next_above: null,
      top20: { in_top20: true, cutoff_points: 0, points_needed: 0 },
    }))
    const card = await screen.findByTestId('board-preview')
    await within(card).findByText('Bat#2231')
    const me = within(card).getAllByRole('listitem').find((li) => li.getAttribute('data-me') === 'true')!
    expect(me.textContent).toContain('9')
    expect(me.textContent).toContain('120')
  })

  it('invites the first player when the board is empty', async () => {
    show(board([]))
    expect(await screen.findByText('No one is on the board yet. Clear a room to be the first.')).toBeTruthy()
  })
})