import { beforeAll, describe, expect, it } from 'vitest'
import type { ApiClient } from '../api/ApiClient'
import { ENDPOINT_SCHEMAS } from '../api/schemas'
import type { AnswerResult, Dungeon, DemoSessionResponse, Run } from '../types/api'

/**
 * Shared contract suite (D17). The same assertions run against the Mock_Adapter (always)
 * and the real Http_Client (only when VITE_API_BASE or VITE_API_BASE_URL is set and mocks are off), so
 * the mock cannot drift from the contract. Every value the client returns is a DOMAIN value (the wire
 * layer has already mapped it) and is checked against the domain zod schema in `src/api/schemas.ts`.
 */
export interface ContractSuiteOptions {
  label: string
  /** Called once; may be async (e.g. build the client). */
  makeClient: () => ApiClient | Promise<ApiClient>
  /**
   * Mock only: returns the correct option for a question id. When absent the suite runs the
   * read-only and single-attempt checks and skips the full play-through (clear and finish).
   */
  correctAnswer?: (questionId: string) => string | undefined
}

function expectSchema<K extends keyof typeof ENDPOINT_SCHEMAS>(key: K, data: unknown): void {
  const r = ENDPOINT_SCHEMAS[key].schema.safeParse(data)
  expect(r.success, r.success ? '' : `${ENDPOINT_SCHEMAS[key].endpoint}: ${r.error.message}`).toBe(true)
}

function expectAnswerInvariants(r: AnswerResult): void {
  expect(r.damage_dealt).toBeGreaterThanOrEqual(0)
  expect(r.monster_hp_remaining).toBeGreaterThanOrEqual(0)
  expect(r.player_hp_remaining).toBeGreaterThanOrEqual(0)
  expect(r.streak).toBeGreaterThanOrEqual(0)
  if (!r.correct) expect(r.damage_dealt).toBe(0)
  if (r.correct) expect(r.streak).toBeGreaterThan(0)
  // Optional in real mode (no xp_delta, source or review_status in the attempt response).
  if (r.xp_delta !== undefined) expect(r.xp_delta).toBeGreaterThanOrEqual(0)
  if (r.source !== undefined) expect(typeof r.source.page).toBe('number')
  if (r.weapon_id !== undefined) expect(r.weapon_id.length).toBeGreaterThan(0)
  if (r.is_critical !== undefined) expect(typeof r.is_critical).toBe('boolean')
  // A critical hit can only follow a correct answer.
  if (r.is_critical === true) expect(r.correct).toBe(true)
}

export function defineContractSuite(opts: ContractSuiteOptions): void {
  describe(`contract: ${opts.label}`, () => {
    let api: ApiClient
    let session: DemoSessionResponse
    let dungeon: Dungeon
    let run: Run

    beforeAll(async () => {
      api = await opts.makeClient()
    })

    it('POST /demo/session returns a guest and a dungeon id', async () => {
      session = await api.startDemoSession()
      expectSchema('startDemoSession', session)
      expect(session.user.is_guest).toBe(true)
      expect(session.dungeon_id.length).toBeGreaterThan(0)
    })

    it('GET /dungeons/{id} returns ordered rooms, one boss, and questions for every monster', async () => {
      dungeon = await api.getDungeon(session.dungeon_id)
      expectSchema('getDungeon', dungeon)
      expect(dungeon.rooms.length).toBeGreaterThan(0)
      expect(dungeon.rooms.filter((r) => r.is_boss)).toHaveLength(1)
      const ids = new Set(dungeon.questions.map((q) => q.id))
      for (const room of dungeon.rooms) {
        expect(room.monster.question_ids.length).toBeGreaterThan(0)
        for (const qid of room.monster.question_ids) expect(ids.has(qid)).toBe(true)
      }
      for (const q of dungeon.questions) expect(q.options.length).toBeGreaterThanOrEqual(2)
    })

    it('monster HP comes from the data: positive whole numbers, and the boss is the toughest', async () => {
      const normal = dungeon.rooms.filter((r) => !r.is_boss)
      const boss = dungeon.rooms.find((r) => r.is_boss)!
      for (const r of dungeon.rooms) {
        expect(Number.isInteger(r.monster.max_hp)).toBe(true)
        expect(r.monster.max_hp).toBeGreaterThan(0)
      }
      for (const r of normal) expect(boss.monster.max_hp).toBeGreaterThan(r.monster.max_hp)
    })

    it('POST /runs starts in the first room with full player HP', async () => {
      run = await api.startRun(dungeon.id)
      expectSchema('startRun', run)
      const first = [...dungeon.rooms].sort((a, b) => a.order - b.order)[0]
      expect(run.current_room_id).toBe(first.id)
      expect(run.player_hp).toBeGreaterThan(0)
      expect(run.monster_hp).toBe(first.monster.max_hp)
    })

    it('GET /runs/{id} rehydrates the same run (room, player HP, monster HP)', async () => {
      const again = await api.getRun(run.id)
      expectSchema('getRun', again)
      expect(again).toMatchObject({
        id: run.id,
        dungeon_id: run.dungeon_id,
        current_room_id: run.current_room_id,
        player_hp: run.player_hp,
        monster_hp: run.monster_hp,
      })
    })

    it('POST /runs/{id}/attempts is idempotent per attempt_id and never reveals the answer in the request', async () => {
      const first = [...dungeon.rooms].sort((a, b) => a.order - b.order)[0]
      const q = dungeon.questions.find((x) => x.id === first.monster.question_ids[0])!
      const req = { question_id: q.id, selected_answer: q.options[0], attempt_id: `contract-${Date.now()}-a` }
      const a = await api.submitAttempt(run.id, req)
      expectSchema('submitAttempt', a)
      expectAnswerInvariants(a)
      expect(a.monster_hp_remaining).toBeLessThanOrEqual(first.monster.max_hp)
      const b = await api.submitAttempt(run.id, req)
      expect(b).toEqual(a)
    })

    it('GET /progress returns a positive level and total XP; xp_to_next is positive when present', async () => {
      const p = await api.getProgress()
      expectSchema('getProgress', p)
      expect(p.level).toBeGreaterThanOrEqual(1)
      if (p.xp_to_next !== undefined) expect(p.xp_to_next).toBeGreaterThan(0)
      expect(p.total_xp).toBeGreaterThanOrEqual(0)
      // When the weapon list is present, every entry has a positive unlock level.
      for (const w of p.weapons ?? []) expect(w.unlock_level).toBeGreaterThanOrEqual(1)
      // The dagger is always unlocked.
      if (p.unlocked_weapons !== undefined) expect(p.unlocked_weapons).toContain('rusty_dagger')
    })

    it('GET /reviews/due returns questions without answers; room_id is a known room or empty (another dungeon)', async () => {
      const reviews = await api.getDueReviews(dungeon.id)
      expectSchema('getDueReviews', reviews)
      const roomIds = new Set(dungeon.rooms.map((r) => r.id))
      const ids = new Set(reviews.map((r) => r.id))
      expect(ids.size).toBe(reviews.length)
      for (const r of reviews) {
        expect(r.room_id === '' || roomIds.has(r.room_id)).toBe(true)
        expect(r.question.options.length).toBeGreaterThanOrEqual(2)
        // The question never carries the answer.
        expect(Object.keys(r.question).sort()).toEqual(['id', 'options', 'prompt', 'type'])
      }
      // The progress count agrees with the list when the backend sends it.
      const p = await api.getProgress()
      if (p.due_review_count !== undefined) expect(p.due_review_count).toBe(reviews.length)
    })

    const answer = opts.correctAnswer
    it.skipIf(!answer)('plays through every room: clear after defeat, boss last, finish returns a summary', async () => {
      const fresh = await api.startRun(dungeon.id)
      const rooms = [...dungeon.rooms].sort((a, b) => a.order - b.order)
      let n = 0
      for (const room of rooms) {
        let hp = room.monster.max_hp
        let guard = 0
        while (hp > 0 && guard++ < 40) {
          const qid = room.monster.question_ids[guard % room.monster.question_ids.length]
          const res = await api.submitAttempt(fresh.id, {
            question_id: qid,
            selected_answer: answer!(qid) ?? '',
            attempt_id: `contract-${Date.now()}-${n++}`,
          })
          expectSchema('submitAttempt', res)
          expectAnswerInvariants(res)
          expect(res.monster_hp_remaining).toBeLessThanOrEqual(hp)
          hp = res.monster_hp_remaining
        }
        expect(hp).toBe(0)
        const cleared = await api.clearRoom(fresh.id, room.id)
        expectSchema('clearRoom', cleared)
        expect(cleared.xp_delta).toBeGreaterThan(0)
      }
      const summary = await api.finishRun(fresh.id)
      expectSchema('finishRun', summary)
      expect(summary.total).toBeGreaterThanOrEqual(summary.correct)
      expect(summary.accuracy).toBeGreaterThanOrEqual(0)
      expect(summary.accuracy).toBeLessThanOrEqual(1)
    })
  })
}
