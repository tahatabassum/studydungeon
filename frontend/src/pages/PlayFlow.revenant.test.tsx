/**
 * Integration test for Haunted memories (Mock_Adapter, Phaser mocked at the GameCanvas/bridge boundary):
 * a wrong answer comes back as a Revenant after the room monster is defeated, the Revenant asks the same
 * question through submitAttempt, and none of it changes the room monster, the gate or the room clear.
 * **Validates: Requirements 9.1, 9.3, 9.4, 9.5, 9.6, 9.8**
 */
import { useEffect } from 'react'
import { act, cleanup, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { ApiClient } from '@/api'
import { createMockAdapter } from '@/api/mock/mockAdapter'
import { answerKey } from '@/api/mock/answerKey'
import demoDungeon from '@/demo/demoDungeon.json'
import { REVENANT_INTRO } from '@/encounter/revenants'
import type { GameBridge, ToGameEvent } from '@/game/events'
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
import { OpenLegacyPlay } from '@/pages/OpenLegacyPlay'
import { SessionProvider } from '@/state/SessionContext'

const sent = (): ToGameEvent[] => h.events as ToGameEvent[]
const gameBridge = (): GameBridge => h.bridge as GameBridge

const dungeon = demoDungeon as unknown as Dungeon
const room1 = [...dungeon.rooms].sort((a, b) => a.order - b.order)[0]

let adapter: ApiClient
let user: ReturnType<typeof userEvent.setup>

const applyResults = () => sent().filter((e) => e.type === 'apply-result')
const emit = (e: Parameters<GameBridge['emit']>[0]) => act(() => gameBridge().emit(e))
const advance = (ms: number) => act(() => void vi.advanceTimersByTime(ms))
const promptOf = (dialog: HTMLElement) =>
  within(dialog).getByRole('heading').querySelector('.sr-only')?.textContent ?? ''
const questionOf = (dialog: HTMLElement) => dungeon.questions.find((x) => x.prompt === promptOf(dialog))!
const optionButton = (dialog: HTMLElement, text: string) => within(dialog).getByRole('button', { name: new RegExp(`${text}$`) })
const counter = () => Number(screen.getByTestId('haunted-counter').getAttribute('data-count'))
const monsterBar = () => screen.queryByRole('progressbar', { name: 'Monster health' })

/** Answers the open question wrong, or right, and settles the result (animation done, then read delay). */
async function answer(dialog: HTMLElement, correct: boolean) {
  const q = questionOf(dialog)
  const key = answerKey[q.id].correct
  const wrong = q.options.find((o) => o !== key)!
  const before = applyResults().length
  await user.click(optionButton(dialog, correct ? key : wrong))
  await vi.waitFor(() => expect(applyResults()).toHaveLength(before + 1))
  emit({ type: 'result-animation-done' })
  return q.id
}

describe('haunted memories (revenants)', () => {
  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
    adapter = createMockAdapter({ seedRevenants: false })
    h.api = adapter
    h.bridge = null
    h.events = []
  })
  afterEach(() => {
    cleanup()
    vi.restoreAllMocks()
    vi.useRealTimers()
  })

  it('a missed question returns as a Revenant that never changes the room monster or the gate flow', async () => {
    const clearSpy = vi.spyOn(adapter, 'clearRoom')
    const submitSpy = vi.spyOn(adapter, 'submitAttempt')
    render(
      <MemoryRouter initialEntries={['/']}>
        <SessionProvider>
          <OpenLegacyPlay />
          <App />
        </SessionProvider>
      </MemoryRouter>,
    )
    await vi.waitFor(() => expect(sent().some((e) => e.type === 'load-dungeon')).toBe(true))
    await vi.waitFor(() => expect(gameBridge()).toBeTruthy())
    await vi.waitFor(() => expect(counter()).toBe(0))

    // Fight the room monster: miss the first question, then answer the rest correctly.
    emit({ type: 'encounter-started', monsterId: room1.monster.id })
    const dialog = await screen.findByRole('dialog')
    // The room monster has 80 HP: correct x3 deal 20 + 20 + 30 (critical), the fourth is missed,
    // and one more correct answer (20) defeats it. The missed question is never asked again.
    let previous = ''
    let missed = ''
    for (let i = 0; i < 5; i++) {
      // Auto-advance shows the next question in the same dialog.
      if (i > 0) await vi.waitFor(() => expect(promptOf(dialog)).not.toBe(previous))
      previous = promptOf(dialog)
      const ok = i !== 3
      const qid = await answer(dialog, ok)
      if (!ok) missed = qid
      // A wrong answer opens the Memory scroll and waits for the player (Continue); a right one auto-advances.
      if (ok) advance(1200)
      else await user.click(await within(dialog).findByRole('button', { name: 'Continue' }))
    }

    // Defeated: room cleared, gate opens, and exactly one Revenant (the missed question) is sent.
    await vi.waitFor(() => expect(clearSpy).toHaveBeenCalledTimes(1))
    await vi.waitFor(() => expect(sent().some((e) => e.type === 'spawn-revenants')).toBe(true))
    const spawn = sent().find((e) => e.type === 'spawn-revenants')!
    expect(spawn).toEqual({
      type: 'spawn-revenants',
      roomId: room1.id,
      revenants: [{ id: `rev-${missed}`, questionId: missed }],
    })
    expect(sent().filter((e) => e.type === 'gate-open')).toHaveLength(1)
    await vi.waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
    await vi.waitFor(() => expect(counter()).toBe(1))
    emit({ type: 'gate-opened', roomId: room1.id })

    // Engage the Revenant: the intro line comes first, then its own question.
    const attemptsBefore = submitSpy.mock.calls.length
    const applyBefore = applyResults().length
    // The player walks to the ghost: the pop-up has finished sliding out and unmounted, so the intro line shows.
    advance(500)
    emit({ type: 'revenant-engaged', revenantId: `rev-${missed}` })
    const rev = await screen.findByRole('dialog')
    expect((await screen.findAllByText(REVENANT_INTRO)).length).toBeGreaterThan(0)
    expect(screen.getByText('A haunted memory')).toBeTruthy()
    expect(promptOf(rev)).toBe(dungeon.questions.find((q) => q.id === missed)!.prompt)
    // The room monster is not shown during the Revenant.
    expect(monsterBar()).toBeNull()

    // A correct answer goes through submitAttempt, lays the memory to rest and drops the counter.
    await user.click(optionButton(rev, answerKey[missed].correct))
    await vi.waitFor(() => expect(applyResults()).toHaveLength(applyBefore + 1))
    expect(submitSpy).toHaveBeenCalledTimes(attemptsBefore + 1)
    const result = (applyResults().at(-1) as { result: AnswerResult }).result
    expect(result.correct).toBe(true)
    expect(result.monster_hp_remaining).toBe(0)
    expect(result.damage_dealt).toBe(0)
    expect(counter()).toBe(0)
    emit({ type: 'result-animation-done' })
    expect((await screen.findAllByText('Memory laid to rest')).length).toBeGreaterThan(0)
    emit({ type: 'revenant-rested', revenantId: `rev-${missed}` })

    // The encounter ends after one question. Nothing about the room changed.
    advance(1200)
    await vi.waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
    expect(monsterBar()).toBeNull()
    expect(clearSpy).toHaveBeenCalledTimes(1)
    expect(sent().filter((e) => e.type === 'gate-open')).toHaveLength(1)
    await vi.waitFor(() => expect(counter()).toBe(0))
    expect(await adapter.getDueReviews(dungeon.id)).toEqual([])
  })

  it('real mode (roomRevenants capability off): no Revenants spawn after a clear, the counter still shows what is due', async () => {
    // The backend rejects attempts on a cleared room (C19), so room Revenants are hidden.
    const real: ApiClient = {
      ...createMockAdapter({ seedRevenants: true }),
      capabilities: { roomRevenants: false, floors: false, modes: false, dailyHaunt: false, leaderboard: false },
    }
    h.api = real
    const clearSpy = vi.spyOn(real, 'clearRoom')
    render(
      <MemoryRouter initialEntries={['/']}>
        <SessionProvider>
          <OpenLegacyPlay />
          <App />
        </SessionProvider>
      </MemoryRouter>,
    )
    await vi.waitFor(() => expect(gameBridge()).toBeTruthy())
    await vi.waitFor(() => expect(counter()).toBe(12))

    emit({ type: 'encounter-started', monsterId: room1.monster.id })
    const dialog = await screen.findByRole('dialog')
    for (let i = 0; i < 4; i++) {
      if (i > 0) await vi.waitFor(() => expect(applyResults()).toHaveLength(i))
      await vi.waitFor(() => expect(optionButton(dialog, answerKey[questionOf(dialog).id].correct)).toBeTruthy())
      await answer(dialog, true)
      advance(1200)
    }
    await vi.waitFor(() => expect(clearSpy).toHaveBeenCalledTimes(1))
    await vi.waitFor(() => expect(sent().some((e) => e.type === 'gate-open')).toBe(true))
    expect(sent().some((e) => e.type === 'spawn-revenants')).toBe(false)
    expect(counter()).toBeGreaterThan(0)
  })

  it('shows no Revenant and a counter of 0 when nothing is due', async () => {
    render(
      <MemoryRouter initialEntries={['/']}>
        <SessionProvider>
          <OpenLegacyPlay />
          <App />
        </SessionProvider>
      </MemoryRouter>,
    )
    await vi.waitFor(() => expect(gameBridge()).toBeTruthy())
    await vi.waitFor(() => expect(counter()).toBe(0))
    expect(sent().some((e) => e.type === 'spawn-revenants')).toBe(false)
  })
})
