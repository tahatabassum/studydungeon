/**
 * Campaign flow with the Mock_Adapter (Phaser mocked at the GameCanvas/bridge boundary):
 * landing -> floor map -> play only that floor -> boss defeated -> scorecard -> updated map.
 * **Validates: Requirements 6.1, 6.2, 6.3, 6.4, 6.5, 5.10**
 */
import { useEffect } from 'react'
import { act, cleanup, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { ApiClient } from '@/api'
import { ApiError } from '@/api/errors'
import { createMockAdapter } from '@/api/mock/mockAdapter'
import { answerKey } from '@/api/mock/answerKey'
import demoDungeon from '@/demo/demoDungeon.json'
import type { GameBridge, ToGameEvent } from '@/game/events'
import type { Dungeon } from '@/types/api'

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
const advance = (ms: number) =>
  act(() => {
    vi.advanceTimersByTime(ms)
  })
const promptOf = (dialog: HTMLElement) =>
  within(dialog).getByRole('heading').querySelector('.sr-only')?.textContent ?? ''

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

/** Answers every question of one encounter correctly until the scene is told to close it. */
async function defeat(monsterId: string, stopAtKill = false) {
  const from = sent().length
  act(() => {
    gameBridge().emit({ type: 'encounter-started', monsterId })
  })
  for (let i = 0; i < 12; i += 1) {
    if (sent().slice(from).some((e) => e.type === 'encounter-close')) return
    const dialog = await screen.findByRole('dialog')
    const q = dungeon.questions.find((x) => x.prompt === promptOf(dialog))!
    const before = sent().filter((e) => e.type === 'apply-result').length
    await user.click(within(dialog).getByRole('button', { name: new RegExp(`${answerKey[q.id].correct}$`) }))
    await vi.waitFor(() => expect(sent().filter((e) => e.type === 'apply-result').length).toBe(before + 1))
    const last = sent().filter((e) => e.type === 'apply-result').at(-1) as Extract<ToGameEvent, { type: 'apply-result' }>
    if (stopAtKill && last.result.monster_hp_remaining === 0) return
    act(() => {
      gameBridge().emit({ type: 'result-animation-done' })
    })
    advance(2500)
  }
  throw new Error('The monster was not defeated')
}

describe('campaign flow', () => {
  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
    adapter = createMockAdapter()
    h.api = adapter
    h.bridge = null
    h.events = []
  })
  afterEach(() => {
    cleanup()
    vi.restoreAllMocks()
    vi.useRealTimers()
  })

  it('Try the Demo opens the map with exactly 2 floors and a locked Final_Boss', async () => {
    await openMap()
    expect(screen.getByTestId('floor-node-1').getAttribute('data-status')).toBe('ready')
    expect(screen.getByTestId('floor-node-2').getAttribute('data-status')).toBe('locked')
    expect(screen.queryByTestId('floor-node-3')).toBeNull()
    expect(screen.getByTestId('final-boss-node').getAttribute('data-status')).toBe('locked')
    expect(screen.getByTestId('continue-hint').textContent).toContain('Floor 1')
  })

  it('plays only the chosen floor, finishes at its boss, then returns to an updated map', async () => {
    const startSpy = vi.spyOn(adapter, 'startRun')
    const finishSpy = vi.spyOn(adapter, 'finishRun')
    await openMap()

    await user.click(screen.getByRole('button', { name: 'Continue' }))
    advance(500)
    await vi.waitFor(() => expect(sent().some((e) => e.type === 'load-dungeon')).toBe(true))
    expect(startSpy).toHaveBeenCalledWith({ dungeon_id: 'demo-dungeon', floor_id: 'floor-1', mode: 'floor' })

    // Only Floor 1's rooms reach Phaser: two rooms, the second one is the boss, counted inside the floor.
    const load = sent().find((e) => e.type === 'load-dungeon') as Extract<ToGameEvent, { type: 'load-dungeon' }>
    expect(load.rooms.map((r) => [r.id, r.order, r.is_boss])).toEqual([
      ['room-1', 1, false],
      ['room-2', 2, true],
    ])
    expect(await screen.findByText(/Room 1 of 2/)).toBeTruthy()

    await defeat('monster-1')
    await vi.waitFor(() => expect(sent().some((e) => e.type === 'gate-open' && e.roomId === 'room-1')).toBe(true))
    act(() => {
      gameBridge().emit({ type: 'gate-opened', roomId: 'room-1' })
      gameBridge().emit({ type: 'room-entered', roomId: 'room-2' })
    })
    expect(await screen.findByText(/Room 2 of 2/)).toBeTruthy()

    await defeat('monster-2')
    await vi.waitFor(() => expect(finishSpy).toHaveBeenCalledTimes(1))
    // The killing blow on the boss arms the death sequence just before its result reaches the scene.
    const types = sent().map((e) => e.type)
    expect(types[types.lastIndexOf('apply-result') - 1]).toBe('play-boss-death')
    expect(sent().filter((e) => e.type === 'play-boss-death')).toEqual([{ type: 'play-boss-death', roomId: 'room-2' }])
    // The scene answers; the Chest lists exactly the Backend rewards, then Collect reveals the Scorecard.
    act(() => {
      gameBridge().emit({ type: 'boss-death-done', roomId: 'room-2' })
    })
    const chest = await screen.findByRole('dialog', { name: 'Treasure chest' })
    expect(within(chest).getAllByRole('listitem').map((li) => li.textContent)).toEqual(['Bonus XP+40', 'Crypt coins+60'])
    await user.click(within(chest).getByRole('button', { name: 'Collect' }))
    expect(screen.queryByRole('dialog', { name: 'Treasure chest' })).toBeNull()
    const victory = await screen.findByRole('dialog', { name: /falls!/ })
    expect(within(victory).getByText('Floor 1, The Entry Crypt cleared')).toBeTruthy()
    // The Scorecard: floor rank, topic mastery bars with band labels, leaderboard reveal, follow-up buttons.
    expect(within(victory).getByTestId('scorecard')).toBeTruthy()
    expect(within(victory).getByTestId('floor-rank')).toBeTruthy()
    expect(within(victory).getByRole('list', { name: 'Topic mastery' }).querySelectorAll('li').length).toBeGreaterThan(0)
    expect(within(victory).getByTestId('rank-reveal')).toBeTruthy()
    expect(within(victory).getByRole('button', { name: /View leaderboard/ })).toBeTruthy()
    expect(within(victory).getByRole('button', { name: /Share card/ }).getAttribute('aria-disabled')).toBeNull()
    expect(within(victory).getByRole('button', { name: /Create account/ })).toBeTruthy()

    await user.click(within(victory).getByRole('button', { name: 'Back to the map' }))
    await screen.findByRole('heading', { level: 1, name: 'Your notes became 2 floors' })
    // The map refetched: Floor 1 is cleared (with a rank) and Floor 2 is now ready.
    await vi.waitFor(() => expect(screen.getByTestId('floor-node-1').getAttribute('data-status')).toBe('cleared'))
    expect(screen.getByTestId('floor-node-2').getAttribute('data-status')).toBe('ready')
    expect(screen.getByTestId('floor-rank')).toBeTruthy()
  })

  /** Plays Floor 1 up to the boss's killing blow (the answer is sent; nothing after it is advanced). */
  async function killBoss() {
    await openMap()
    await user.click(screen.getByRole('button', { name: 'Continue' }))
    advance(500)
    await vi.waitFor(() => expect(sent().some((e) => e.type === 'load-dungeon')).toBe(true))
    await defeat('monster-1')
    await vi.waitFor(() => expect(sent().some((e) => e.type === 'gate-open' && e.roomId === 'room-1')).toBe(true))
    act(() => {
      gameBridge().emit({ type: 'gate-opened', roomId: 'room-1' })
      gameBridge().emit({ type: 'room-entered', roomId: 'room-2' })
    })
    expect(await screen.findByText(/Room 2 of 2/)).toBeTruthy()
    await defeat('monster-2', true)
  }

  it('holds the Scorecard and the Chest until the boss death sequence reports done', async () => {
    await killBoss()
    act(() => {
      gameBridge().emit({ type: 'result-animation-done' })
    })
    advance(1300)
    // The run has finished, but the sequence is still playing: neither overlay shows yet.
    await vi.waitFor(() => expect(sent().filter((e) => e.type === 'play-boss-death')).toHaveLength(1))
    expect(screen.queryByRole('dialog', { name: 'Treasure chest' })).toBeNull()
    expect(screen.queryByRole('dialog', { name: /falls!/ })).toBeNull()
    act(() => {
      gameBridge().emit({ type: 'boss-death-done', roomId: 'room-2' })
    })
    expect(await screen.findByRole('dialog', { name: 'Treasure chest' })).toBeTruthy()
    expect(screen.getByRole('dialog', { name: /falls!/ })).toBeTruthy()
  })

  it('shows them anyway after the fallback timeout when the scene never reports done', async () => {
    await killBoss()
    act(() => {
      gameBridge().emit({ type: 'result-animation-done' })
    })
    expect(screen.queryByRole('dialog', { name: 'Treasure chest' })).toBeNull()
    advance(2500)
    expect(await screen.findByRole('dialog', { name: 'Treasure chest' })).toBeTruthy()
  })

  it('shows the Backend message on the map when a start is rejected', async () => {
    await openMap()
    vi.spyOn(adapter, 'startRun').mockRejectedValueOnce(new ApiError(409, 'That floor is still locked.', 'FLOOR_LOCKED'))
    await user.click(screen.getByRole('button', { name: 'Continue' }))
    advance(500)
    const alert = await screen.findByTestId('map-error')
    expect(alert.textContent).toContain('That floor is still locked.')
    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('Your notes became 2 floors')
  })

  it('the old /play route still plays the whole dungeon (five rooms)', async () => {
    const { OpenLegacyPlay } = await import('@/pages/OpenLegacyPlay')
    render(
      <MemoryRouter initialEntries={['/']}>
        <SessionProvider>
          <OpenLegacyPlay />
          <App />
        </SessionProvider>
      </MemoryRouter>,
    )
    await vi.waitFor(() => expect(sent().some((e) => e.type === 'load-dungeon')).toBe(true))
    const load = sent().find((e) => e.type === 'load-dungeon') as Extract<ToGameEvent, { type: 'load-dungeon' }>
    expect(load.rooms).toHaveLength(5)
    expect(await screen.findByText(/Room 1 of 5/)).toBeTruthy()
  })
})
