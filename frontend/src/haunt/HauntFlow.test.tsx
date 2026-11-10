/**
 * Daily Haunt with the Mock_Adapter (Phaser mocked at the GameCanvas/bridge boundary): the button on the map,
 * the Haunted Hall built only from due items, keyboard-only play, the finale, the empty state and the
 * "coming soon" state where the backend cannot build a Daily Haunt.
 * **Validates: Requirements 7.1, 7.2, 7.3, 7.4, 7.5, 7.6**
 */
import { useEffect } from 'react'
import { act, cleanup, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { ApiClient } from '@/api'
import { answerKey } from '@/api/mock/answerKey'
import { createMockAdapter } from '@/api/mock/mockAdapter'
import demoDungeon from '@/demo/demoDungeon.json'
import type { GameBridge, RevenantSpawn, ToGameEvent } from '@/game/events'
import type { Dungeon, DueReviewsResponse } from '@/types/api'

const h = vi.hoisted(() => ({ api: null as unknown, bridge: null as unknown, events: [] as unknown[] }))

vi.mock('phaser', () => ({ default: {} }))
vi.mock('@/api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/api')>()
  return { ...actual, getApi: () => Promise.resolve(h.api as ApiClient) }
})
vi.mock('@/game/GameCanvas', () => ({
  GameCanvas: ({ bridge }: { bridge: GameBridge }) => {
    useEffect(() => {
      h.bridge = bridge
      const off = bridge.onToGame((e) => {
        h.events.push(e)
      })
      bridge.emit({ type: 'ready' })
      return off
    }, [bridge])
    return <div role="application" aria-label="Dungeon game" tabIndex={0} />
  },
}))

import App from '@/App'
import { SessionProvider } from '@/state/SessionContext'

const dungeon = demoDungeon as unknown as Dungeon
const sent = (): ToGameEvent[] => h.events as ToGameEvent[]
const gameBridge = (): GameBridge => h.bridge as GameBridge
const emit = (e: Parameters<GameBridge['emit']>[0]) => act(() => gameBridge().emit(e))
const promptOf = (dialog: HTMLElement) => within(dialog).getByRole('heading').querySelector('.sr-only')?.textContent ?? ''

let adapter: ApiClient
let user: ReturnType<typeof userEvent.setup>

async function openMap() {
  render(
    <MemoryRouter initialEntries={['/']}>
      <SessionProvider>
        <App />
      </SessionProvider>
    </MemoryRouter>,
  )
  await user.click(screen.getByRole('button', { name: /try the demo/i }))
  await screen.findByRole('heading', { level: 1, name: 'Your notes became 2 floors' })
}

const spawns = (): Extract<ToGameEvent, { type: 'spawn-revenants' }>[] =>
  sent().filter((e): e is Extract<ToGameEvent, { type: 'spawn-revenants' }> => e.type === 'spawn-revenants')

/** Walks up to a ghost, answers its question with the number key (keyboard only) and lets it rest. */
async function layToRest(spawn: RevenantSpawn) {
  act(() => {
    gameBridge().emit({ type: 'revenant-engaged', revenantId: spawn.id })
  })
  const dialog = await screen.findByRole('dialog')
  const q = dungeon.questions.find((x) => x.prompt === promptOf(dialog))!
  expect(q.id).toBe(spawn.questionId)
  const index = q.options.indexOf(answerKey[q.id].correct)
  const before = sent().filter((e) => e.type === 'apply-result').length
  await user.keyboard(String(index + 1))
  await vi.waitFor(() => expect(sent().filter((e) => e.type === 'apply-result').length).toBe(before + 1))
  emit({ type: 'result-animation-done' })
  emit({ type: 'revenant-rested', revenantId: spawn.id })
  await user.keyboard('{Enter}')
  // The question dialog closes (the finale is also a dialog, so it is not counted).
  await vi.waitFor(() =>
    expect(screen.queryAllByRole('dialog').filter((d) => d.querySelector('[data-testid="haunt-finale"]') === null)).toHaveLength(0),
  )
}

describe('Daily Haunt', () => {
  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
    adapter = createMockAdapter({ seedRevenants: true })
    h.api = adapter
    h.bridge = null
    h.events = []
  })
  afterEach(() => {
    cleanup()
    vi.restoreAllMocks()
    vi.useRealTimers()
  })

  it('shows the due count and plays a Haunted Hall made only of due items, to the finale, by keyboard', async () => {
    const start = vi.spyOn(adapter, 'startRun')
    const clearRoom = vi.spyOn(adapter, 'clearRoom')
    const due = await adapter.getDueReviews()
    expect(due.due_count).toBe(12)
    await openMap()

    const tools = await screen.findByTestId('map-tools')
    await vi.waitFor(() => expect(within(tools).getByTestId('daily-haunt-due').textContent).toBe('12 memories due'))
    expect(within(tools).getByTestId('daily-haunt').textContent).toContain('Today\'s haunt faces 8 of them')

    await user.click(within(tools).getByTestId('daily-haunt-link'))
    await vi.waitFor(() => expect(spawns().length).toBeGreaterThan(0))
    expect(start).toHaveBeenCalledWith({ dungeon_id: dungeon.id, floor_id: null, mode: 'daily_haunt' })

    // The scene loads three display-only halls with no monster in them.
    const load = sent().find((e) => e.type === 'load-dungeon') as Extract<ToGameEvent, { type: 'load-dungeon' }>
    expect(load.rooms.map((r) => r.id)).toEqual(['hall-1', 'hall-2', 'hall-3'])
    expect(load.rooms.every((r) => r.monster.max_hp === 0 && !r.is_boss)).toBe(true)
    // The HUD counts halls and ghosts, not dungeon rooms.
    expect(screen.getByText(/Hall 1 of 3/)).toBeTruthy()
    expect(screen.getByTestId('haunted-counter').getAttribute('data-count')).toBe('8')
    expect(screen.getByTestId('hall-veil')).toBeTruthy()

    const dueIds = new Set(due.items.map((i) => i.id))
    const hallSizes = [3, 3, 2]
    for (let k = 0; k < 3; k += 1) {
      await vi.waitFor(() => expect(spawns().at(-1)?.roomId).toBe(`hall-${k + 1}`))
      const spawn = spawns().at(-1)!
      expect(spawn.revenants).toHaveLength(hallSizes[k])
      for (const g of spawn.revenants) expect(dueIds.has(g.id)).toBe(true)
      for (const g of spawn.revenants) await layToRest(g)
      if (k < 2) {
        // The gate opens only once every ghost of the hall is at rest.
        await vi.waitFor(() => expect(sent().filter((e) => e.type === 'gate-open').map((e) => (e as { roomId: string }).roomId)).toEqual(
          Array.from({ length: k + 1 }, (_, i) => `hall-${i + 1}`),
        ))
        emit({ type: 'gate-opened', roomId: `hall-${k + 1}` })
        emit({ type: 'room-entered', roomId: `hall-${k + 2}` })
      }
    }

    // No server clear exists for hall rooms, and no gate opens after the last hall.
    expect(clearRoom).not.toHaveBeenCalled()
    expect(sent().filter((e) => e.type === 'gate-open')).toHaveLength(2)

    const finale = await screen.findByTestId('haunt-finale')
    expect(within(finale).getByTestId('haunt-finale-count').textContent).toBe('8 memories laid to rest')
    expect(within(finale).getByTestId('haunt-finale-streak').textContent).toBe('Daily streak: 1 day')
    expect(finale.textContent).toContain('4 more memories are still waiting')
    // The primary button has focus: Enter goes back to the dashboard.
    await user.keyboard('{Enter}')
    await screen.findByTestId('dashboard-page')

    // The Dashboard slot shows what is left and the Backend's streak, next to the practice modes.
    const slot = await screen.findByTestId('daily-haunt-slot')
    await vi.waitFor(() => expect(within(slot).getByTestId('daily-haunt-due').textContent).toBe('4 memories due'))
    expect(within(slot).getByTestId('daily-haunt-streak').textContent).toBe('1-day streak')
    expect(within(slot).getByTestId('open-modes')).toBeTruthy()
  })

  it('the finale can also open the map', async () => {
    await openMap()
    await user.click(await screen.findByTestId('daily-haunt-link'))
    await vi.waitFor(() => expect(spawns().length).toBeGreaterThan(0))
    // Lay every ghost of every hall to rest quickly.
    for (let k = 0; k < 3; k += 1) {
      await vi.waitFor(() => expect(spawns().at(-1)?.roomId).toBe(`hall-${k + 1}`))
      for (const g of spawns().at(-1)!.revenants) await layToRest(g)
      if (k < 2) {
        await vi.waitFor(() => expect(sent().filter((e) => e.type === 'gate-open')).toHaveLength(k + 1))
        emit({ type: 'gate-opened', roomId: `hall-${k + 1}` })
        emit({ type: 'room-entered', roomId: `hall-${k + 2}` })
      }
    }
    const finale = await screen.findByTestId('haunt-finale')
    await user.click(within(finale).getByRole('button', { name: 'Open the map' }))
    await screen.findByRole('heading', { level: 1, name: 'Your notes became 2 floors' })
  })

  it('with nothing due it celebrates and gives the next due time, and the hall does not open', async () => {
    adapter = createMockAdapter({ seedRevenants: false })
    const soon = new Date(Date.now() + 3 * 3_600_000 + 60_000).toISOString()
    const none: DueReviewsResponse = { due_count: 0, next_due_at: soon, daily_streak: 2, items: [] }
    h.api = { ...adapter, getDueReviews: (() => Promise.resolve(none)) as ApiClient['getDueReviews'] }
    const start = vi.spyOn(adapter, 'startRun')
    await openMap()
    const tools = await screen.findByTestId('map-tools')
    const rest = await within(tools).findByTestId('haunt-rest')
    expect(within(rest).getByTestId('haunt-next-due').textContent).toBe('Next memory stirs in 3 h')
    expect(rest.textContent).toContain('Daily streak: 2 days')
    expect(within(tools).queryByTestId('daily-haunt-link')).toBeNull()
    expect(start).not.toHaveBeenCalled()
  })

  it('without backend support it says "coming soon" on the map, the dashboard and the haunt page', async () => {
    const real: ApiClient = {
      ...adapter,
      capabilities: { roomRevenants: false, floors: true, modes: true, practiceModes: false, dailyHaunt: false, leaderboard: true },
    }
    h.api = real
    const due = vi.spyOn(real, 'getDueReviews')
    await openMap()
    const tools = await screen.findByTestId('map-tools')
    const haunt = await within(tools).findByTestId('daily-haunt')
    expect(haunt.getAttribute('data-state')).toBe('unsupported')
    expect(haunt.textContent).toContain('Coming soon')
    expect(within(tools).getByTestId('modes-unsupported').textContent).toContain('Coming soon')
    expect(within(tools).queryByTestId('open-modes')).toBeNull()
    expect(due).not.toHaveBeenCalled()
  })
})
