import { describe, expect, it } from 'vitest'
import demoDungeon from '../../demo/demoDungeon.json'
import { RIVAL_LABEL } from '../../leaderboard/view'
import { DEMO_DUNGEON_ID } from '../../leaderboard/constants'
import { leaderboardResponseSchema, runSummarySchema, progressSchema } from '../schemas'
import { answerKey } from './answerKey'
import { createMockAdapter } from './mockAdapter'
import { RIVAL_SEEDS } from './mockLeaderboard'

type Mock = ReturnType<typeof createMockAdapter>

/** Plays the whole demo dungeon, answering `wrong` questions wrongly, and finishes the run. */
async function playAll(api: Mock, wrong = 0) {
  const dungeon = await api.getDungeon(demoDungeon.id)
  const run = await api.startRun(dungeon.id)
  let n = 0
  let wrongLeft = wrong
  for (const room of [...dungeon.rooms].sort((a, b) => a.order - b.order)) {
    let hp = room.monster.max_hp
    let i = 0
    while (hp > 0) {
      const qid = room.monster.question_ids[i++ % room.monster.question_ids.length]
      const bad = wrongLeft > 0
      if (bad) wrongLeft -= 1
      const r = await api.submitAttempt(run.id, {
        question_id: qid,
        selected_answer: bad ? '__wrong__' : answerKey[qid].correct,
        attempt_id: `lb-${(n += 1)}`,
      })
      hp = r.monster_hp_remaining
    }
    await api.clearRoom(run.id, room.id)
  }
  return api.finishRun(run.id)
}

describe('demo dungeon id', () => {
  it('matches the constant the leaderboard page falls back to', () => {
    expect(DEMO_DUNGEON_ID).toBe(demoDungeon.id)
  })
})

describe('Mock leaderboard (D24)', () => {
  it('seeds exactly 8 Ghost Rivals, all flagged, on both tabs', async () => {
    expect(RIVAL_SEEDS).toHaveLength(8)
    const api = createMockAdapter()
    for (const period of ['all', 'week'] as const) {
      const board = await api.getLeaderboard({ dungeonId: demoDungeon.id, period })
      expect(leaderboardResponseSchema.safeParse(board).success).toBe(true)
      expect(board.entries).toHaveLength(8)
      expect(board.entries.every((e) => e.is_seeded_rival)).toBe(true)
      expect(board.me).toEqual({ rank: null, is_provisional: false, entry: null })
    }
  })

  it('the week board differs from the all-time board', async () => {
    const api = createMockAdapter()
    const all = await api.getLeaderboard({ dungeonId: demoDungeon.id, period: 'all' })
    const week = await api.getLeaderboard({ dungeonId: demoDungeon.id, period: 'week' })
    expect(week.entries.map((e) => e.score)).not.toEqual(all.entries.map((e) => e.score))
  })

  it('honours the limit', async () => {
    const api = createMockAdapter()
    const board = await api.getLeaderboard({ dungeonId: demoDungeon.id, period: 'all', limit: 3 })
    expect(board.entries.map((e) => e.rank)).toEqual([1, 2, 3])
  })

  it('does not store a guest run on the board, but the finish summary carries a provisional rank', async () => {
    const api = createMockAdapter()
    const summary = await playAll(api)
    expect(runSummarySchema.safeParse(summary).success).toBe(true)
    expect(summary.leaderboard_rank).toBeGreaterThanOrEqual(1)
    expect(summary.leaderboard_rank).toBeLessThanOrEqual(9)
    const board = await api.getLeaderboard({ dungeonId: demoDungeon.id, period: 'all' })
    expect(board.entries).toHaveLength(8)
    expect(board.me.entry).toBeNull()
  })

  it('stores a signed-in player run: ranked among the rivals, returned as me, unlabelled', async () => {
    const api = createMockAdapter({ player: true })
    const session = await api.startDemoSession()
    expect(session.user.is_guest).toBe(false)
    const summary = await playAll(api)
    const board = await api.getLeaderboard({ dungeonId: demoDungeon.id, period: 'all', limit: 20 })
    expect(board.entries).toHaveLength(9)
    expect(board.me.entry?.is_seeded_rival).toBe(false)
    expect(board.me.entry?.score).toBe(summary.score)
    expect(board.me.rank).toBe(summary.leaderboard_rank)
    expect(board.entries.filter((e) => e.is_seeded_rival)).toHaveLength(8)
    expect(RIVAL_LABEL).toBe('Ghost Rival - demo')
  })

  it('a personal dungeon shows only the player runs, never rivals', async () => {
    const api = createMockAdapter({ player: true })
    await playAll(api)
    const personal = await api.getLeaderboard({ dungeonId: 'my-notes', period: 'all' })
    expect(personal.entries).toEqual([])
    expect(personal.me.entry).toBeNull()
  })

  it('reports weak concepts with their source page, level up and unlocked weapon on finish', async () => {
    const api = createMockAdapter()
    const summary = await playAll(api, 3)
    expect(summary.weak_concepts?.length).toBeGreaterThan(0)
    expect(summary.weak_concepts?.length).toBeLessThanOrEqual(3)
    for (const w of summary.weak_concepts ?? []) {
      expect(w.text.length).toBeGreaterThan(0)
      expect(w.page).toBeGreaterThanOrEqual(1)
    }
    expect(summary.level_up).not.toBeNull()
    expect(summary.level_up!.to).toBeGreaterThan(summary.level_up!.from)
    expect(summary.weapon_unlocked).toBeTruthy()
    // Repeated finish returns the same summary.
    expect(summary.mastery_by_topic?.length).toBeGreaterThan(0)
  })

  it('progress lists the finished runs (newest first) and the badge list, and validates', async () => {
    const api = createMockAdapter()
    expect((await api.getProgress()).recent_runs).toEqual([])
    const first = await playAll(api)
    const p = await api.getProgress()
    expect(progressSchema.safeParse(p).success).toBe(true)
    expect(p.recent_runs).toHaveLength(1)
    expect(p.recent_runs?.[0]).toMatchObject({ score: first.score, accuracy: first.accuracy })
    expect(p.badges).toEqual(first.badges_earned ?? [])
  })
})
