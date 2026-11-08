/**
 * Integration smoke test for the play flow (Mock_Adapter + Demo_Rules, Phaser mocked
 * at the GameCanvas/bridge boundary).
 * **Validates: Requirements 15.6, 3.3, 3.4, 9.1, 10.6, 22.1, 22.3, 22.4**
 */
import { useEffect } from 'react'
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { ApiClient } from '@/api'
import { createMockAdapter } from '@/api/mock/mockAdapter'
import { answerKey } from '@/api/mock/answerKey'
import type { GameBridge, ToGameEvent } from '@/game/events'
import demoDungeon from '@/demo/demoDungeon.json'
import type { AnswerResult, Dungeon } from '@/types/api'

const h = vi.hoisted(() => ({
  api: null as unknown,
  bridge: null as unknown,
  events: [] as unknown[],
}))

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

const sent = (): ToGameEvent[] => h.events as ToGameEvent[]
const gameBridge = (): GameBridge => h.bridge as GameBridge


const dungeon = demoDungeon as unknown as Dungeon
const rooms = [...dungeon.rooms].sort((a, b) => a.order - b.order)
const [room1, room2] = rooms

let adapter: ApiClient
let user: ReturnType<typeof userEvent.setup>

const applyResults = () => sent().filter((e) => e.type === 'apply-result')
const emitEncounter = (monsterId: string) =>
  act(() => {
    gameBridge().emit({ type: 'encounter-started', monsterId })
  })
const animationDone = () =>
  act(() => {
    gameBridge().emit({ type: 'result-animation-done' })
  })
const advance = (ms: number) =>
  act(() => {
    vi.advanceTimersByTime(ms)
  })
// The heading holds a visually hidden full copy (for assistive tech) and an animated copy; read the full one.
const promptOf = (dialog: HTMLElement) =>
  within(dialog).getByRole('heading').querySelector('.sr-only')?.textContent ?? ''
const questionOf = (dialog: HTMLElement) => dungeon.questions.find((x) => x.prompt === promptOf(dialog))!
const correctButton = (dialog: HTMLElement) =>
  within(dialog).getByRole('button', { name: new RegExp(`${answerKey[questionOf(dialog).id].correct}$`) })

async function startDemo() {
  render(
    <MemoryRouter initialEntries={['/']}>
      <SessionProvider>
        <App />
      </SessionProvider>
    </MemoryRouter>,
  )
  await user.click(screen.getByRole('button', { name: /try the demo/i }))
  await vi.waitFor(() => expect(sent().some((e) => e.type === 'load-dungeon')).toBe(true))
  await vi.waitFor(() => expect(gameBridge()).toBeTruthy())
}

async function startAndEncounter() {
  await startDemo()
  const playerBar = await screen.findByRole('progressbar', { name: 'Player health' })
  expect(playerBar.getAttribute('aria-valuenow')).toBe('100')
  expect(screen.getByRole('progressbar', { name: 'Monster health' }).getAttribute('aria-valuenow')).toBe('60')
  expect(await screen.findByText('100 / 100')).toBeTruthy()
  expect(screen.getByText('XP 0')).toBeTruthy()
  emitEncounter('monster-1')
  const dialog = await screen.findByRole('dialog')
  return dialog
}

// The first encounter always shows q1 (first unanswered question of the monster).
const Q1_PROMPT = 'Which component executes program instructions?'

describe('play flow smoke test', () => {
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

  it('continuous flow: one encounter, three auto-advanced questions, room cleared', async () => {
    const clearSpy = vi.spyOn(adapter, 'clearRoom')
    await startDemo()
    let encounters = 0
    act(() => {
      gameBridge().emit({ type: 'encounter-started', monsterId: room1.monster.id })
    })
    encounters++
    const dialog = await screen.findByRole('dialog')

    const seen: string[] = []
    for (let i = 0; i < 3; i++) {
      if (i > 0) {
        // Auto-advance: the next question shows up in the SAME dialog without a new encounter.
        await vi.waitFor(() => expect(promptOf(dialog)).not.toBe(seen[i - 1]))
        expect(screen.getByRole('dialog')).toBe(dialog)
      }
      const q = questionOf(dialog)
      expect(room1.monster.question_ids).toContain(q.id)
      seen.push(q.prompt)
      await user.click(correctButton(dialog))
      await vi.waitFor(() => expect(applyResults()).toHaveLength(i + 1))
      animationDone()
      await screen.findByText('Correct!')
      advance(1200)
    }

    await vi.waitFor(() => expect(clearSpy).toHaveBeenCalledTimes(1))
    await vi.waitFor(() =>
      expect(sent().some((e) => e.type === 'gate-open' && e.roomId === room1.id)).toBe(true),
    )
    await vi.waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
    expect(await screen.findByText(/Room cleared/)).toBeTruthy()
    expect(encounters).toBe(1)
    expect(new Set(seen).size).toBe(3)
    expect(clearSpy).toHaveBeenCalledTimes(1)
  })

  it('correct answer: sends apply-result and updates HUD (Next skips the delay)', async () => {
    const dialog = await startAndEncounter()
    expect(promptOf(dialog)).toBe(Q1_PROMPT)

    await user.click(correctButton(dialog))

    await vi.waitFor(() => expect(applyResults()).toHaveLength(1))
    const applied = applyResults()[0] as { result: AnswerResult }
    expect(applied.result.correct).toBe(true)
    expect(applied.result.damage_dealt).toBe(20)

    animationDone()
    await user.click(await screen.findByRole('button', { name: 'Next' }))

    await vi.waitFor(() =>
      expect(screen.getByRole('progressbar', { name: 'Monster health' }).getAttribute('aria-valuenow')).toBe('40'),
    )
    expect(screen.getByText('XP 10')).toBeTruthy()
    // Next presented the following question without a new encounter.
    await vi.waitFor(() => expect(promptOf(dialog)).not.toBe(Q1_PROMPT))
  })

  it('wrong answer: HP 90, no XP, source line, then auto-advances after 2000 ms', async () => {
    const dialog = await startAndEncounter()

    await user.click(within(dialog).getByRole('button', { name: /Monitor$/ }))

    await vi.waitFor(() => expect(applyResults()).toHaveLength(1))
    expect((applyResults()[0] as { result: AnswerResult }).result.correct).toBe(false)

    animationDone()
    expect((await screen.findAllByText(/Incorrect/)).length).toBeGreaterThan(0)
    expect(await screen.findByText(/From your notes: page/)).toBeTruthy()
    await vi.waitFor(() =>
      expect(screen.getByRole('progressbar', { name: 'Player health' }).getAttribute('aria-valuenow')).toBe('90'),
    )
    expect(screen.getByText('XP 0')).toBeTruthy()

    advance(2000)
    await vi.waitFor(() => expect(promptOf(dialog)).not.toBe(Q1_PROMPT))
    expect(screen.getByRole('dialog')).toBe(dialog)
    expect(sent().filter((e) => e.type === 'apply-result')).toHaveLength(1)
  })

  it('duplicate click protection: rapid click + key produce one submitAttempt', async () => {
    const submitSpy = vi.spyOn(adapter, 'submitAttempt')
    const dialog = await startAndEncounter()
    const button = correctButton(dialog)

    fireEvent.click(button)
    fireEvent.click(button)
    fireEvent.keyDown(window, { key: '1' })

    await vi.waitFor(() => expect(applyResults()).toHaveLength(1))
    expect(submitSpy).toHaveBeenCalledTimes(1)
    expect(applyResults()).toHaveLength(1)
  })

  it('submit failure keeps the same attempt_id on retry', async () => {
    const submitSpy = vi.spyOn(adapter, 'submitAttempt').mockRejectedValueOnce(new Error('network'))
    const dialog = await startAndEncounter()
    const label = answerKey[questionOf(dialog).id].correct

    await user.click(within(dialog).getByRole('button', { name: new RegExp(`${label}$`) }))
    expect(await screen.findByRole('alert')).toBeTruthy()
    expect(applyResults()).toHaveLength(0)

    await user.click(within(dialog).getByRole('button', { name: new RegExp(`${label}$`) }))
    await vi.waitFor(() => expect(applyResults()).toHaveLength(1))
    expect(submitSpy).toHaveBeenCalledTimes(2)
    const first = submitSpy.mock.calls[0][1].attempt_id
    const second = submitSpy.mock.calls[1][1].attempt_id
    expect(first).toBeTruthy()
    expect(second).toBe(first)
    await vi.waitFor(() => expect(screen.queryByRole('alert')).toBeNull())
  })

  it('Esc in a question opens pause with Retreat; retreat then a new encounter asks the next question', async () => {
    const dialog = await startAndEncounter()
    expect(promptOf(dialog)).toBe(Q1_PROMPT)

    await user.keyboard('{Escape}')
    const pause = await screen.findByRole('dialog', { name: 'Paused' })
    await user.click(within(pause).getByRole('button', { name: /Retreat from battle/ }))

    await vi.waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())

    emitEncounter('monster-1')
    const dialog2 = await screen.findByRole('dialog')
    expect(promptOf(dialog2)).not.toBe(Q1_PROMPT)
    expect(room1.monster.question_ids).toContain(questionOf(dialog2).id)
  })

  it('keeps set-view-inset at 0 (panel sits below the stage) when the panel opens and after it closes', async () => {
    const insets = () =>
      sent().flatMap((e) => (e.type === 'set-view-inset' ? [e.bottomFraction] : []))
    await startAndEncounter()
    await vi.waitFor(() => expect(insets().at(-1)).toBe(0))

    await user.keyboard('{Escape}')
    const pause = await screen.findByRole('dialog', { name: 'Paused' })
    await user.click(within(pause).getByRole('button', { name: /Retreat from battle/ }))
    await vi.waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
    await vi.waitFor(() => expect(insets().at(-1)).toBe(0))
  })

  it('sends encounter-open with the entry side when the pop-up opens and encounter-close on retreat', async () => {
    await startAndEncounter()
    expect(sent().filter((e) => e.type === 'encounter-open')).toEqual([
      { type: 'encounter-open', monsterId: 'monster-1', side: 'right' },
    ])
    expect(sent().some((e) => e.type === 'encounter-close')).toBe(false)

    await user.keyboard('{Escape}')
    const pause = await screen.findByRole('dialog', { name: 'Paused' })
    await user.click(within(pause).getByRole('button', { name: /Retreat from battle/ }))
    await vi.waitFor(() => expect(sent().some((e) => e.type === 'encounter-close')).toBe(true))
  })

  it('clears room 1, opens the gate, enters room 2 and asks room 2 questions', async () => {
    await startDemo()
    const load = sent().find((e) => e.type === 'load-dungeon') as Extract<ToGameEvent, { type: 'load-dungeon' }>
    expect(load.rooms).toHaveLength(5)

    // One encounter; the remaining questions follow automatically (Next skips the delay).
    emitEncounter(room1.monster.id)
    const dialog = await screen.findByRole('dialog')
    for (let i = 0; i < 3; i++) {
      const q = questionOf(dialog)
      expect(room1.monster.question_ids).toContain(q.id)
      await user.click(correctButton(dialog))
      await vi.waitFor(() => expect(applyResults()).toHaveLength(i + 1))
      animationDone()
      await user.click(await screen.findByRole('button', { name: 'Next' }))
      if (i < 2) await vi.waitFor(() => expect(questionOf(dialog).id).not.toBe(q.id))
    }

    await vi.waitFor(() =>
      expect(sent().some((e) => e.type === 'gate-open' && e.roomId === room1.id)).toBe(true),
    )
    expect(await screen.findByText(/Room cleared/)).toBeTruthy()

    act(() => {
      gameBridge().emit({ type: 'gate-opened', roomId: room1.id })
      gameBridge().emit({ type: 'room-entered', roomId: room2.id })
    })
    expect(await screen.findByText(`Room 2 of 5: ${room2.label}`)).toBeTruthy()

    emitEncounter(room2.monster.id)
    const dialog2 = await screen.findByRole('dialog')
    const q2 = dungeon.questions.find((x) => x.prompt === promptOf(dialog2))
    expect(q2).toBeTruthy()
    expect(room2.monster.question_ids).toContain(q2!.id)
  })
})
