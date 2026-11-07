/**
 * Integration smoke test for the play flow (Mock_Adapter + Demo_Rules, Phaser mocked
 * at the GameCanvas/bridge boundary).
 * **Validates: Requirements 15.6, 3.3, 3.4, 9.1, 10.6**
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

async function startAndEncounter() {
  const user = userEvent.setup()
  render(
    <MemoryRouter initialEntries={['/']}>
      <SessionProvider>
        <App />
      </SessionProvider>
    </MemoryRouter>,
  )
  await user.click(screen.getByRole('button', { name: /try the demo/i }))

  const playerBar = await screen.findByRole('progressbar', { name: 'Player health' })
  expect(playerBar.getAttribute('aria-valuenow')).toBe('100')
  expect(screen.getByRole('progressbar', { name: 'Monster health' }).getAttribute('aria-valuenow')).toBe('60')
  expect(await screen.findByText('100 / 100')).toBeTruthy()
  expect(screen.getByText('XP 0')).toBeTruthy()

  await vi.waitFor(() => expect(sent().some((e) => e.type === 'load-dungeon')).toBe(true))
  await vi.waitFor(() => expect(gameBridge()).toBeTruthy())

  act(() => {
    gameBridge().emit({ type: 'encounter-started', monsterId: 'monster-1' })
  })
  const dialog = await screen.findByRole('dialog')
  return { user, dialog }
}

// The first encounter always shows q1 (first unanswered question of the monster).
const Q1_PROMPT = 'Which component executes program instructions?'

describe('play flow smoke test', () => {
  beforeEach(() => {
    h.api = createMockAdapter()
    h.bridge = null
    h.events = []
  })
  afterEach(() => {
    cleanup()
  })

  it('correct answer: sends apply-result and updates HUD', async () => {
    const { user, dialog } = await startAndEncounter()
    expect(within(dialog).getByRole('heading').textContent).toBe(Q1_PROMPT)
    const correct = answerKey.q1.correct

    await user.click(within(dialog).getByRole('button', { name: new RegExp(`${correct}$`) }))

    await vi.waitFor(() => expect(sent().some((e) => e.type === 'apply-result')).toBe(true))
    const applied = sent().find((e) => e.type === 'apply-result') as { result: AnswerResult }
    expect(applied.result.correct).toBe(true)
    expect(applied.result.damage_dealt).toBe(20)

    act(() => {
      gameBridge().emit({ type: 'result-animation-done' })
    })
    await user.click(await screen.findByRole('button', { name: 'Continue' }))

    await vi.waitFor(() =>
      expect(screen.getByRole('progressbar', { name: 'Monster health' }).getAttribute('aria-valuenow')).toBe('40'),
    )
    expect(screen.getByText('XP 10')).toBeTruthy()
  })

  it('clears room 1, opens the gate, enters room 2 and asks room 2 questions', async () => {
    const dungeon = demoDungeon as unknown as Dungeon
    const rooms = [...dungeon.rooms].sort((a, b) => a.order - b.order)
    const [room1, room2] = rooms
    const user = userEvent.setup()
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
    const load = sent().find((e) => e.type === 'load-dungeon') as Extract<ToGameEvent, { type: 'load-dungeon' }>
    expect(load.rooms).toHaveLength(5)

    // Defeat room 1's monster with correct answers (60 HP, 20 damage each).
    for (let i = 0; i < 3; i++) {
      act(() => {
        gameBridge().emit({ type: 'encounter-started', monsterId: room1.monster.id })
      })
      const dialog = await screen.findByRole('dialog')
      const prompt = within(dialog).getByRole('heading').textContent
      const q = dungeon.questions.find((x) => x.prompt === prompt)!
      expect(room1.monster.question_ids).toContain(q.id)
      await user.click(within(dialog).getByRole('button', { name: new RegExp(`${answerKey[q.id].correct}$`) }))
      await vi.waitFor(() => expect(sent().filter((e) => e.type === 'apply-result')).toHaveLength(i + 1))
      act(() => {
        gameBridge().emit({ type: 'result-animation-done' })
      })
      await user.click(await screen.findByRole('button', { name: 'Continue' }))
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

    act(() => {
      gameBridge().emit({ type: 'encounter-started', monsterId: room2.monster.id })
    })
    const dialog2 = await screen.findByRole('dialog')
    const prompt2 = within(dialog2).getByRole('heading').textContent
    const q2 = dungeon.questions.find((x) => x.prompt === prompt2)
    expect(q2).toBeTruthy()
    expect(room2.monster.question_ids).toContain(q2!.id)
  })

  it('wrong answer: player loses 10 HP, no XP, source line shown', async () => {
    const { user, dialog } = await startAndEncounter()

    await user.click(within(dialog).getByRole('button', { name: /Monitor$/ }))

    await vi.waitFor(() => expect(sent().some((e) => e.type === 'apply-result')).toBe(true))
    const applied = sent().find((e) => e.type === 'apply-result') as { result: AnswerResult }
    expect(applied.result.correct).toBe(false)

    act(() => {
      gameBridge().emit({ type: 'result-animation-done' })
    })
    expect(await screen.findByText(/From your notes: page/)).toBeTruthy()
    await user.click(await screen.findByRole('button', { name: 'Continue' }))

    await vi.waitFor(() =>
      expect(screen.getByRole('progressbar', { name: 'Player health' }).getAttribute('aria-valuenow')).toBe('90'),
    )
    expect(screen.getByText('XP 0')).toBeTruthy()
  })
})
