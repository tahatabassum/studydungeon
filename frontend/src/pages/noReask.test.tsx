/**
 * Play_Session: a question answered wrongly is not presented again in the same Run, even after the monster's
 * pool wraps (the demo monster has 4 questions and 80 HP, so a miss forces a recycled question). The Memory
 * scroll offers no Quick retry and says the question was saved to Memories.
 * Mock_Adapter, Phaser mocked at the GameCanvas/bridge boundary.
 * **Validates: Requirements 1.1, 1.3, 1.4, 5.1**
 */
import { useEffect } from 'react'
import { act, cleanup, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { ApiClient } from '@/api'
import { createMockAdapter } from '@/api/mock/mockAdapter'
import { answerKey } from '@/api/mock/answerKey'
import type { GameBridge, ToGameEvent } from '@/game/events'
import demoDungeon from '@/demo/demoDungeon.json'
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

import App from '@/App'
import { OpenLegacyPlay } from '@/pages/OpenLegacyPlay'
import { SessionProvider } from '@/state/SessionContext'

const dungeon = demoDungeon as unknown as Dungeon
const sent = (): ToGameEvent[] => h.events as ToGameEvent[]
const gameBridge = (): GameBridge => h.bridge as GameBridge
const results = (): AnswerResult[] => sent().flatMap((e) => (e.type === 'apply-result' ? [e.result as AnswerResult] : []))
const promptOf = (dialog: HTMLElement) => within(dialog).getByRole('heading').querySelector('.sr-only')?.textContent ?? ''
const questionOf = (dialog: HTMLElement) => dungeon.questions.find((x) => x.prompt === promptOf(dialog))!

let user: ReturnType<typeof userEvent.setup>

describe('no re-ask after a wrong answer', () => {
  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
    h.api = createMockAdapter()
    h.bridge = null
    h.events = []
  })
  afterEach(() => {
    cleanup()
    vi.restoreAllMocks()
    vi.useRealTimers()
  })

  it('never presents the missed question again, even after the monster pool wraps', async () => {
    render(
      <MemoryRouter initialEntries={['/']}>
        <SessionProvider>
          <OpenLegacyPlay />
          <App />
        </SessionProvider>
      </MemoryRouter>,
    )
    await vi.waitFor(() => expect(sent().some((e) => e.type === 'load-dungeon')).toBe(true))
    await screen.findByRole('progressbar', { name: 'Player health' })
    act(() => {
      gameBridge().emit({ type: 'encounter-started', monsterId: 'monster-1' })
    })
    const dialog = await screen.findByRole('dialog')

    // Miss the first question.
    const missed = questionOf(dialog)
    const wrongPick = missed.options.find((o) => o !== answerKey[missed.id].correct)!
    await user.click(within(dialog).getByRole('button', { name: new RegExp(`${wrongPick}$`) }))
    await vi.waitFor(() => expect(results()).toHaveLength(1))
    expect(results()[0].correct).toBe(false)
    act(() => {
      gameBridge().emit({ type: 'result-animation-done' })
    })
    const scroll = await within(dialog).findByTestId('memory-scroll')
    expect(within(scroll).getByTestId('scroll-saved').textContent).toBe(
      'Saved to Memories. You will meet it again in the Daily Haunt.',
    )
    expect(screen.queryByRole('button', { name: /Quick retry/ })).toBeNull()
    await user.click(within(scroll).getByRole('button', { name: 'Continue' }))

    // Answer everything else correctly until the monster falls; the 4-question pool must wrap to finish it.
    const asked: string[] = []
    for (let i = 0; i < 8; i += 1) {
      await vi.waitFor(() => expect(within(dialog).queryByTestId('memory-scroll')).toBeNull())
      // Recycling rotates, so each question differs from the one just answered.
      const prev = asked.length > 0 ? asked[asked.length - 1] : missed.id
      await vi.waitFor(() => expect(questionOf(dialog)?.id).not.toBe(prev))
      const q = questionOf(dialog)
      expect(q.id).not.toBe(missed.id)
      asked.push(q.id)
      const before = results().length
      await user.click(within(dialog).getByRole('button', { name: new RegExp(`${answerKey[q.id].correct}$`) }))
      await vi.waitFor(() => expect(results()).toHaveLength(before + 1))
      act(() => {
        gameBridge().emit({ type: 'result-animation-done' })
      })
      if (results()[results().length - 1].monster_hp_remaining <= 0) break
      await user.click(await within(dialog).findByRole('button', { name: 'Next' }))
    }

    expect(results()[results().length - 1].monster_hp_remaining).toBe(0)
    expect(asked).not.toContain(missed.id)
    // The pool wrapped: some correctly answered question was asked again instead of the missed one.
    expect(new Set(asked).size).toBeLessThan(asked.length)
  })
})
