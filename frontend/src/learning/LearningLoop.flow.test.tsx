/**
 * The learning loop with the Mock_Adapter (Phaser mocked at the GameCanvas/bridge boundary): a missed question
 * opens the Memory scroll, whispers that it returns, comes back after the gap the mock reported as a
 * "Second chance" and shows the retry rule exactly as received. Quick retry asks the same question at once.
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

  it('a miss opens the Memory scroll with Retry focused and a polite announcement, and it waits for the player', async () => {
    const dialog = await openFloorEncounter()
    const first = promptOf(dialog)
    await answer(dialog, false)

    const scroll = await within(dialog).findByTestId('memory-scroll')
    const missed = results()[0]
    expect(missed.correct_answer).toBeTruthy()
    expect(within(scroll).getByTestId('scroll-answer').textContent).toContain(missed.correct_answer!)
    expect(within(scroll).getByText(/From your notes: page/)).toBeTruthy()
    // Focus moves to Retry; the live region announces the answer after mount.
    expect(document.activeElement).toBe(within(scroll).getByRole('button', { name: /Quick retry/ }))
    await vi.waitFor(() =>
      expect(within(scroll).getByTestId('scroll-live').textContent).toContain(`The correct answer is ${missed.correct_answer}`),
    )
    expect(within(scroll).getByTestId('scroll-live').getAttribute('aria-live')).toBe('polite')
    // The old read delay does not take the scroll away.
    advance(10_000)
    expect(promptOf(dialog)).toBe(first)
    expect(within(dialog).getByTestId('memory-scroll')).toBeTruthy()
  })

  it('whispers that the question returns, then asks it again as a Second chance after the Backend gap', async () => {
    const dialog = await openFloorEncounter()
    const first = promptOf(dialog)
    await answer(dialog, false)
    const gap = results()[0].requeue_after
    expect(gap).toBe(3)
    expect(within(dialog).getByTestId('requeue-notice').textContent).toContain('The question returns...')

    await user.click(within(dialog).getByRole('button', { name: 'Continue' }))
    // Three further questions, answered correctly, then the missed one is back.
    for (let i = 0; i < gap!; i += 1) {
      await vi.waitFor(() => expect(promptOf(dialog)).not.toBe(first))
      expect(within(dialog).queryByTestId('second-chance-tag')).toBeNull()
      expect(within(dialog).getByTestId('requeue-notice').textContent).toContain(i === gap! - 1 ? 'next one' : 'more')
      await answer(dialog, true)
      advance(1200)
    }
    await vi.waitFor(() => expect(promptOf(dialog)).toBe(first))
    expect(within(dialog).getByTestId('second-chance-tag').textContent).toBe('Second chance')
    expect(within(dialog).queryByTestId('requeue-notice')).toBeNull()

    // The retry rule is worded from the response: Retry: half damage (retry_multiplier 0.5).
    await answer(dialog, true)
    const retry = results()[results().length - 1]
    expect(retry).toMatchObject({ is_retry: true, retry_multiplier: 0.5 })
    expect(within(dialog).getByTestId('retry-note').textContent).toBe('Retry: half damage')
    expect(within(dialog).getByText(`You dealt ${retry.damage_dealt} damage`)).toBeTruthy()
  })

  it('Quick retry asks the same question again right away, and the keyboard reaches both buttons', async () => {
    const dialog = await openFloorEncounter()
    const first = promptOf(dialog)
    await answer(dialog, false)
    const scroll = await within(dialog).findByTestId('memory-scroll')
    const retryBtn = within(scroll).getByRole('button', { name: /Quick retry/ })
    const continueBtn = within(scroll).getByRole('button', { name: 'Continue' })
    expect(document.activeElement).toBe(retryBtn)
    await user.tab()
    expect(document.activeElement).toBe(continueBtn)
    await user.tab({ shift: true })
    expect(document.activeElement).toBe(retryBtn)

    await user.keyboard('{Enter}')
    await vi.waitFor(() => expect(within(dialog).queryByTestId('memory-scroll')).toBeNull())
    expect(promptOf(dialog)).toBe(first)
    expect(within(dialog).getByTestId('second-chance-tag')).toBeTruthy()
    // The earlier pick is cleared and the options are answerable again.
    for (const b of within(dialog).getAllByRole('button').filter((b) => b.className.includes('sd-answer'))) {
      expect((b as HTMLButtonElement).disabled).toBe(false)
    }
    await answer(dialog, true)
    expect(results()[1]).toMatchObject({ correct: true, is_retry: true })
    // It was retried now, so it does not return later.
    expect(within(dialog).queryByTestId('requeue-notice')).toBeNull()
  })
})
