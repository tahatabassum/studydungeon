/**
 * Practice modes with the Mock_Adapter (Phaser mocked at the GameCanvas/bridge boundary): the picker, the
 * `startRun` bodies, Weak Topics and Exam through the campaign play flow, the optional Exam timer,
 * and Replay Floor listing only cleared floors. The picker is operated by keyboard.
 * **Validates: Requirements 8.1, 8.2, 8.3, 8.4, 8.5, 8.6**
 */
import { useEffect } from 'react'
import { act, cleanup, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { ApiClient } from '@/api'
import { supportsPracticeModes } from '@/api/ApiClient'
import { answerKey } from '@/api/mock/answerKey'
import { createMockAdapter } from '@/api/mock/mockAdapter'
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
const advance = (ms: number) => act(() => void vi.advanceTimersByTime(ms))
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

/** Opens the picker from the keyboard: focus the button, press Enter. */
async function openPicker() {
  const tools = await screen.findByTestId('map-tools')
  const button = await within(tools).findByTestId('open-modes')
  act(() => button.focus())
  await user.keyboard('{Enter}')
  return screen.findByTestId('mode-picker')
}

async function defeat(monsterId: string) {
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
    act(() => {
      gameBridge().emit({ type: 'result-animation-done' })
    })
    advance(2500)
  }
  throw new Error('The monster was not defeated')
}

/** Clears Floor 1 through the adapter, so the map shows it cleared. */
async function clearFloorOne() {
  const run = await adapter.startRun({ dungeon_id: dungeon.id, floor_id: 'floor-1', mode: 'floor' })
  for (const rid of ['room-1', 'room-2']) {
    const qids = dungeon.rooms.find((r) => r.id === rid)!.monster.question_ids
    for (let i = 0; i < 20; i += 1) {
      const qid = qids[i % qids.length]
      const r = await adapter.submitAttempt(run.id, { question_id: qid, selected_answer: answerKey[qid].correct, attempt_id: `c-${rid}-${i}` })
      if (r.monster_hp_remaining === 0) break
    }
    await adapter.clearRoom(run.id, rid)
  }
  await adapter.finishRun(run.id)
}

describe('practice modes', () => {
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

  it('Weak Topics starts with its request body, plays only the picked topics and returns to the map', async () => {
    const start = vi.spyOn(adapter, 'startRun')
    const finish = vi.spyOn(adapter, 'finishRun')
    await openMap()
    const picker = await openPicker()
    expect(within(picker).getAllByRole('button').map((b) => b.textContent)).toEqual([
      expect.stringContaining('Weak Topics'),
      expect.stringContaining('Exam'),
      expect.stringContaining('Replay Floor'),
      'Close',
    ])
    // The first option has focus: Enter starts it.
    await user.keyboard('{Enter}')
    await vi.waitFor(() => expect(sent().some((e) => e.type === 'load-dungeon')).toBe(true))
    expect(start).toHaveBeenCalledWith({ dungeon_id: dungeon.id, floor_id: null, mode: 'weak_topics' })

    const load = sent().find((e) => e.type === 'load-dungeon') as Extract<ToGameEvent, { type: 'load-dungeon' }>
    expect(load.rooms.map((r) => [r.id, r.order, r.is_boss])).toEqual([
      ['room-1', 1, false],
      ['room-2', 2, false],
    ])
    expect(await screen.findByText(/Room 1 of 2/)).toBeTruthy()

    await defeat('monster-1')
    await vi.waitFor(() => expect(sent().some((e) => e.type === 'gate-open' && e.roomId === 'room-1')).toBe(true))
    act(() => {
      gameBridge().emit({ type: 'gate-opened', roomId: 'room-1' })
      gameBridge().emit({ type: 'room-entered', roomId: 'room-2' })
    })
    await defeat('monster-2')
    // The last picked topic ends the run, even though it is not a boss.
    await vi.waitFor(() => expect(finish).toHaveBeenCalledTimes(1))
    const card = await screen.findByRole('dialog', { name: /Weak topics practiced/ })
    await user.click(within(card).getByRole('button', { name: 'Back to the map' }))
    await screen.findByRole('heading', { level: 1, name: 'Your notes became 2 floors' })
    // Practice never clears a floor.
    expect(screen.getByTestId('floor-node-1').getAttribute('data-status')).toBe('ready')
  })

  it('Exam has no timer by default and covers every topic', async () => {
    const start = vi.spyOn(adapter, 'startRun')
    await openMap()
    await openPicker()
    await user.click(screen.getByTestId('mode-exam'))
    const options = await screen.findByTestId('exam-options')
    expect((within(options).getByRole('radio', { name: 'No timer' }) as HTMLInputElement).checked).toBe(true)
    expect(within(options).getAllByRole('radio').map((r) => (r as HTMLInputElement).labels?.[0]?.textContent)).toEqual([
      'No timer',
      '10 minutes',
      '20 minutes',
      '30 minutes',
    ])
    await user.click(screen.getByTestId('exam-start'))
    await vi.waitFor(() => expect(sent().some((e) => e.type === 'load-dungeon')).toBe(true))
    expect(start).toHaveBeenCalledWith({ dungeon_id: dungeon.id, floor_id: null, mode: 'exam' })
    const load = sent().find((e) => e.type === 'load-dungeon') as Extract<ToGameEvent, { type: 'load-dungeon' }>
    expect(load.rooms).toHaveLength(5)
    expect(await screen.findByText(/Room 1 of 5/)).toBeTruthy()
    expect(screen.queryByTestId('exam-timer')).toBeNull()
  })

  it('a chosen Exam timer announces at 5 and 1 minute and ends the run at zero', async () => {
    const finish = vi.spyOn(adapter, 'finishRun')
    await openMap()
    await openPicker()
    await user.click(screen.getByTestId('mode-exam'))
    const options = await screen.findByTestId('exam-options')
    await user.click(within(options).getByRole('radio', { name: '10 minutes' }))
    await user.click(screen.getByTestId('exam-start'))
    const timer = await screen.findByTestId('exam-timer')
    expect(timer.textContent).toContain('10:00')
    const live = within(timer).getByTestId('exam-timer-live')
    expect(live.getAttribute('aria-live')).toBe('polite')
    expect(live.textContent).toBe('')

    advance(5 * 60_000)
    await vi.waitFor(() => expect(live.textContent).toBe('5 minutes left in the exam'))
    expect(timer.textContent).toContain('05:00')
    advance(4 * 60_000)
    await vi.waitFor(() => expect(live.textContent).toBe('1 minute left in the exam'))
    expect(finish).not.toHaveBeenCalled()

    advance(60_000)
    await vi.waitFor(() => expect(finish).toHaveBeenCalledTimes(1))
    await screen.findByRole('dialog', { name: /Time is up/ })
    expect(screen.queryByTestId('exam-timer')).toBeNull()
  })

  it('Replay Floor lists only cleared floors and starts with its request body', async () => {
    const start = vi.spyOn(adapter, 'startRun')
    await openMap()
    await openPicker()
    await user.click(screen.getByTestId('mode-replay'))
    const none = await screen.findByTestId('replay-options')
    expect(none.textContent).toContain('No cleared floors yet')
    expect(within(none).queryAllByTestId(/^replay-floor/)).toHaveLength(0)
    cleanup()
    h.events = []

    await clearFloorOne()
    await openMap()
    await openPicker()
    await user.click(screen.getByTestId('mode-replay'))
    const list = await screen.findByTestId('replay-options')
    expect(within(list).getByTestId('replay-floor-1')).toBeTruthy()
    expect(within(list).queryByTestId('replay-floor-2')).toBeNull()
    await user.click(within(list).getByTestId('replay-floor-1'))
    await vi.waitFor(() => expect(sent().some((e) => e.type === 'load-dungeon')).toBe(true))
    expect(start).toHaveBeenLastCalledWith({ dungeon_id: dungeon.id, floor_id: 'floor-1', mode: 'replay_floor' })
    const load = sent().find((e) => e.type === 'load-dungeon') as Extract<ToGameEvent, { type: 'load-dungeon' }>
    expect(load.rooms.map((r) => r.id)).toEqual(['room-1', 'room-2'])
  })

  it('the picker closes with Escape and starts nothing', async () => {
    const start = vi.spyOn(adapter, 'startRun')
    await openMap()
    await openPicker()
    await user.keyboard('{Escape}')
    await vi.waitFor(() => expect(screen.queryByTestId('mode-picker')).toBeNull())
    expect(start).not.toHaveBeenCalled()
  })
})

describe('practice mode support', () => {
  it('hides the modes where the backend has no run modes or the offline demo says so', () => {
    expect(supportsPracticeModes({})).toBe(true)
    const caps = { roomRevenants: false, floors: true, modes: true, dailyHaunt: false, leaderboard: true }
    expect(supportsPracticeModes({ capabilities: caps })).toBe(true)
    expect(supportsPracticeModes({ capabilities: { ...caps, practiceModes: false } })).toBe(false)
    expect(supportsPracticeModes({ capabilities: { ...caps, modes: false } })).toBe(false)
  })
})
