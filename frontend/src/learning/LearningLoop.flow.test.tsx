/**
 * The learning loop with the Mock_Adapter (Phaser mocked at the GameCanvas/bridge boundary): a missed question
 * opens the Memory scroll with the saved-to-Memories line and is not asked again in the same run; there is no
 * Quick retry.
 * **Validates: Requirements 9.1, 9.2, 9.3, 9.4, 9.6, 14.4, 14.5**
 */
import { useEffect } from 'react'
import { act, cleanup, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { ApiClient } from '@/api'
import { createMockAdapter } from '@/api/mock/mockAdapter'
import { answerKey } from '@/api/mock/answerKey'
import demoDungeon from '@/demo/demoDungeon.json'
import type { GameBridge, ToGameEvent } from '@/game/events'
import type { AnswerResult, Dungeon } from '@/types/api'

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

import { openDemoMap } from '@/test/enterDemo'

const dungeon = demoDungeon as unknown as Dungeon
const sent = (): ToGameEvent[] => h.events as ToGameEvent[]
const gameBridge = (): GameBridge => h.bridge as GameBridge
const results = (): AnswerResult[] =>
  sent().flatMap((e) => (e.type === 'apply-result' ? [e.result as AnswerResult] : []))
const advance = (ms: number) =>
  act(() => {
    vi.advanceTimersByTime(ms)
  })
const promptOf = (dialog: HTMLElement) =>
  within(dialog).getByRole('heading').querySelector('.sr-only')?.textContent ?? ''

let adapter: ApiClient
let user: ReturnType<typeof userEvent.setup>

async function openFloorEncounter(): Promise<HTMLElement> {
  await openDemoMap(user)

  await user.click(screen.getByRole('button', { name: 'Continue' }))
  advance(500)
  await vi.waitFor(() => expect(sent().some((e) => e.type === 'load-dungeon')).toBe(true))
  act(() => {
    gameBridge().emit({ type: 'encounter-started', monsterId: 'monster-1' })
  })
  return screen.findByRole('dialog')
}

/** Picks an answer for the question on screen and settles the hit animation. */
async function answer(dialog: HTMLElement, correct: boolean): Promise<void> {
  const q = dungeon.questions.find((x) => x.prompt === promptOf(dialog))!
  const key = answerKey[q.id].correct
  const pick = correct ? key : q.options.find((o) => o !== key)!
  const before = results().length
  await user.click(within(dialog).getByRole('button', { name: new RegExp(`${pick}$`) }))
  await vi.waitFor(() => expect(results()).toHaveLength(before + 1))
  act(() => {
    gameBridge().emit({ type: 'result-animation-done' })
  })
}

describe('learning loop flow', () => {
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

  it('a miss opens the Memory scroll with Continue focused, the saved line and a polite announcement, and it waits for the player', async () => {
    const dialog = await openFloorEncounter()
    const first = promptOf(dialog)
    await answer(dialog, false)

    const scroll = await within(dialog).findByTestId('memory-scroll')
    const missed = results()[0]
    expect(missed.correct_answer).toBeTruthy()
    expect(missed.requeue_after).toBeUndefined()
    expect(within(scroll).getByTestId('scroll-answer').textContent).toContain(missed.correct_answer!)
    expect(within(scroll).getByText(/From your notes: page/)).toBeTruthy()
    expect(within(scroll).getByTestId('scroll-saved').textContent).toBe('Saved to Memories. You will meet it again in the Daily Haunt.')
    // Focus moves to Continue; there is no retry control.
    expect(within(scroll).queryByRole('button', { name: /retry/i })).toBeNull()
    expect(document.activeElement).toBe(within(scroll).getByRole('button', { name: 'Continue' }))
    await vi.waitFor(() =>
      expect(within(dialog).getByTestId('encounter-live').textContent).toContain(`The correct answer is ${missed.correct_answer}`),
    )
    expect(within(dialog).getByTestId('encounter-live').getAttribute('aria-live')).toBe('polite')
    // The shell region stays silent while the dialog is open: only one polite region carries text.
    expect(screen.getByTestId('shell-live').textContent).toBe('')
    const speaking = [...document.querySelectorAll('[aria-live="polite"], [role="status"]')].filter((el) => (el.textContent ?? '').trim() !== '')
    expect(speaking).toHaveLength(1)
    // The old read delay does not take the scroll away.
    advance(10_000)
    expect(promptOf(dialog)).toBe(first)
    expect(within(dialog).getByTestId('memory-scroll')).toBeTruthy()
  })

  it('never asks a missed question again in the same run, and shows no returning whisper or Second chance tag', async () => {
    const dialog = await openFloorEncounter()
    const first = promptOf(dialog)
    await answer(dialog, false)
    await user.click(within(dialog).getByRole('button', { name: 'Continue' }))

    const asked = [first]
    for (let i = 0; i < 5; i += 1) {
      try {
        await vi.waitFor(() => expect(promptOf(dialog)).not.toBe(asked[asked.length - 1]))
      } catch {
        break // the monster fell or only the missed question was left: nothing else was asked
      }
      const now = promptOf(dialog)
      asked.push(now)
      expect(now).not.toBe(first)
      expect(within(dialog).queryByTestId('second-chance-tag')).toBeNull()
      expect(within(dialog).queryByTestId('requeue-notice')).toBeNull()
      await answer(dialog, true)
      advance(1200)
    }
    expect(asked.length).toBeGreaterThan(1)
    expect(asked.slice(1)).not.toContain(first)
    expect(results().slice(1).every((r) => r.is_retry !== true)).toBe(true)
  })

  it('offers no Quick retry: Continue is the only scroll button and moves on to another question', async () => {
    const dialog = await openFloorEncounter()
    const first = promptOf(dialog)
    await answer(dialog, false)
    const scroll = await within(dialog).findByTestId('memory-scroll')
    expect(within(scroll).getAllByRole('button')).toHaveLength(1)
    expect(screen.queryByRole('button', { name: /Quick retry/ })).toBeNull()
    expect(document.activeElement).toBe(within(scroll).getByRole('button', { name: 'Continue' }))

    await user.keyboard('{Enter}')
    await vi.waitFor(() => expect(within(dialog).queryByTestId('memory-scroll')).toBeNull())
    await vi.waitFor(() => expect(promptOf(dialog)).not.toBe(first))
    expect(within(dialog).queryByTestId('second-chance-tag')).toBeNull()
    for (const b of within(dialog).getAllByRole('button').filter((b) => b.className.includes('sd-answer'))) {
      expect((b as HTMLButtonElement).disabled).toBe(false)
    }
  })
})
