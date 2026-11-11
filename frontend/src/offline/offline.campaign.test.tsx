/**
 * The Offline_Adapter serves the campaign map: 2 Floors plus the Final_Boss (frontend-08 D13), the floors
 * surface (`floors`, scoped `startRun`, `floor_rank`, `mastery_by_topic`) and 8 Ghost Rivals.
 * **Validates: Requirements 14.5, 14.6, 1.2**
 */
import { act, cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { setApiOverride, type ApiClient } from '@/api'
import { OFFLINE_OFFER_MS } from '@/identity/wakeConstants'
import { createOfflineAdapter, OFFLINE_RIVALS } from '@/offline'
import bundle from './demoDungeon.json'

const h = vi.hoisted(() => ({ api: null as unknown }))

vi.mock('phaser', () => ({ default: {} }))
vi.mock('@/api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/api')>()
  return { ...actual, getApi: () => (actual.isApiOverridden() ? actual.getApi() : Promise.resolve(h.api as ApiClient)) }
})
vi.mock('@/game/GameCanvas', () => ({ GameCanvas: () => <div role="application" aria-label="Dungeon game" tabIndex={0} /> }))

import App from '@/App'
import { SessionProvider } from '@/state/SessionContext'

const correct = (qid: string): string => {
  const q = bundle.questions.find((x) => x.id === qid)!
  return q.options[(bundle.answers as Record<string, { correct_option: number }>)[qid].correct_option]
}

beforeEach(() => {
  h.api = createOfflineAdapter({ now: () => 0 })
})
afterEach(() => {
  cleanup()
  setApiOverride(null)
  vi.useRealTimers()
})

describe('Offline demo on the campaign map', () => {
  it('Try the Demo opens a map with 2 floors and a locked Final_Boss', async () => {
    // The server is slow (createGuest never answers): the offline demo starts only by the player's click at 8 s.
    vi.useFakeTimers({ shouldAdvanceTime: true })
    const base = createOfflineAdapter({ now: () => 0 })
    h.api = {
      ...base,
      capabilities: { ...base.capabilities, guestIdentity: true },
      createGuest: () => new Promise<never>(() => {}),
    } as ApiClient
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
    render(
      <MemoryRouter initialEntries={['/']}>
        <SessionProvider>
          <App />
        </SessionProvider>
      </MemoryRouter>,
    )
    await user.click(screen.getByRole('button', { name: /try the demo/i }))
    await user.click(await screen.findByRole('button', { name: 'Accept and continue' }))
    expect(screen.queryByRole('button', { name: 'Play offline demo' })).toBeNull()
    await act(async () => {
      vi.advanceTimersByTime(OFFLINE_OFFER_MS)
    })
    await user.click(await screen.findByRole('button', { name: 'Play offline demo' }))
    await screen.findByRole('heading', { level: 1, name: 'Your notes became 2 floors' })
    expect(screen.getByTestId('offline-label')).toBeTruthy()
    expect(screen.getByTestId('floor-node-1').getAttribute('data-status')).toBe('ready')
    expect(screen.getByTestId('floor-node-2').getAttribute('data-status')).toBe('locked')
    expect(screen.queryByTestId('floor-node-3')).toBeNull()
    expect(screen.getByTestId('final-boss-node').getAttribute('data-status')).toBe('locked')
  })
})

describe('Offline floors from demo_dungeon.sample.json (D13)', () => {
  it('Floor 1 = CPU and Storage, Floor 2 = Networking, Final_Boss = The Exam Warden with 220 HP', async () => {
    const api = createOfflineAdapter({ now: () => 0 })
    const d = await api.getDungeon((await api.startDemoSession()).dungeon_id)
    expect(d.floors!.map((f) => [f.index, f.topics.map((t) => t.title)])).toEqual([
      [1, ['Central Processing Unit (CPU)', 'Primary & Secondary Storage']],
      [2, ['Computer Networking & Protocols']],
    ])
    expect(d.final_boss).toMatchObject({ name: 'The Exam Warden', hp: 220, unlocked: false })
    expect(d.rooms.filter((r) => r.is_boss).map((r) => r.monster.name)).toEqual(['The Exam Warden'])
    expect(d.questions.map((q) => q.prompt)).toContain('What does the Domain Name System (DNS) do on the Internet?')
    // The public dungeon never carries an answer.
    expect(JSON.stringify(d)).not.toContain('correct_option')
  })

  it('a floor run is scoped, ranks the floor, reports mastery per topic and unlocks the next floor', async () => {
    const api = createOfflineAdapter({ now: () => 0 })
    const d = await api.getDungeon((await api.startDemoSession()).dungeon_id)
    await expect(api.startRun({ dungeon_id: d.id, floor_id: 'floor-2', mode: 'floor' })).rejects.toMatchObject({ status: 409, code: 'FLOOR_LOCKED' })
    await expect(api.startRun({ dungeon_id: d.id, floor_id: null, mode: 'exam' })).rejects.toMatchObject({ status: 422 })

    const run = await api.startRun({ dungeon_id: d.id, floor_id: 'floor-1', mode: 'floor' })
    expect(run).toMatchObject({ mode: 'floor', current_room_id: 'room-cpu' })
    let n = 0
    for (const roomId of d.floors![0].room_ids) {
      const room = d.rooms.find((r) => r.id === roomId)!
      let hp = room.monster.max_hp
      while (hp > 0) {
        const qid = room.monster.question_ids[n % room.monster.question_ids.length]
        hp = (await api.submitAttempt(run.id, { question_id: qid, selected_answer: correct(qid), attempt_id: `f-${n++}` })).monster_hp_remaining
      }
      await api.clearRoom(run.id, roomId)
    }
    const summary = await api.finishRun(run.id)
    expect(summary.floor_rank).toBe('S')
    expect(summary.mastery_by_topic?.map((m) => m.title)).toEqual(['Central Processing Unit (CPU)', 'Primary & Secondary Storage'])
    expect(summary.mastery_by_topic?.every((m) => m.mastery > 50)).toBe(true)
    const after = await api.getDungeon(d.id)
    expect(after.floors!.map((f) => [f.status, f.rank])).toEqual([['cleared', 'S'], ['ready', null]])
    // A question from another floor is out of scope for a floor run.
    await expect(api.submitAttempt(run.id, { question_id: 'off-net-1', selected_answer: correct('off-net-1'), attempt_id: 'x' })).rejects.toMatchObject({ status: 409 })
  })

  it('a wrong answer reveals the right one and asks for the question again (requeue)', async () => {
    const api = createOfflineAdapter({ now: () => 0 })
    const d = await api.getDungeon((await api.startDemoSession()).dungeon_id)
    const run = await api.startRun({ dungeon_id: d.id, floor_id: 'floor-1', mode: 'floor' })
    const bad = await api.submitAttempt(run.id, { question_id: 'off-cpu-1', selected_answer: 'Control Unit', attempt_id: 'w1' })
    expect(bad).toMatchObject({ correct: false, damage_dealt: 0, correct_answer: 'Arithmetic Logic Unit (ALU)' })
    expect(bad.requeue_after).not.toBeNull()
    const retry = await api.submitAttempt(run.id, { question_id: 'off-cpu-1', selected_answer: correct('off-cpu-1'), attempt_id: 'w2' })
    expect(retry).toMatchObject({ correct: true, is_retry: true, retry_multiplier: 0.5, damage_dealt: 10 })
  })

  it('bundles 8 Ghost Rivals, all flagged as seeded, on a ranked board', async () => {
    expect(OFFLINE_RIVALS).toHaveLength(8)
    const api = createOfflineAdapter({ now: () => 0 })
    const board = await api.getLeaderboard({ dungeonId: 'demo-dungeon', period: 'all', limit: 20 })
    expect(board.entries).toHaveLength(8)
    expect(board.entries.every((e) => e.is_seeded_rival)).toBe(true)
    expect(board.entries.map((e) => e.rank)).toEqual([1, 2, 3, 4, 5, 6, 7, 8])
    expect(board.me).toEqual({ rank: null, is_provisional: false, entry: null })
  })
})
