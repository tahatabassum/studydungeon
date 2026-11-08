import fc from 'fast-check'
import { describe, expect, it } from 'vitest'
import { createHttpClient } from '../client'
import { ContractError } from '../ContractError'
import { ENDPOINT_SCHEMAS } from '../schemas'
import { mapAttempt, mapClear, mapDungeon, mapFinish, mapProgress, mapRun, wireAttemptSchema, wireClearSchema, wireDungeonSchema, wireFinishSchema, wireProgressSchema, wireRunSchema } from './index'

// Feature: frontend-08-campaign-learning-loop, Property 1: Wire mapping produces valid domain values and fails loudly
// **Validates: Requirements 1.2, 1.3, 1.4**

const id = fc.string({ minLength: 1, maxLength: 8 })
const text = fc.string({ maxLength: 12 })
const hp = fc.integer({ min: 1, max: 400 })
const count = fc.integer({ min: 0, max: 100000 })
const weaponName = fc.constantFrom('Rusty Dagger', 'Arcane Staff', 'Hunter Crossbow', 'Spectral Hammer', 'Flame Sigil', 'Mystery Blade')

const wireQuestion = fc.record({
  id,
  prompt: text,
  options: fc.array(text, { minLength: 2, maxLength: 4 }),
  difficulty: fc.constantFrom('easy', 'medium', 'hard'),
})

/** A dungeon with unique room ids, distinct room numbers and one boss (the last room). */
const wireDungeonArb = fc
  .tuple(id, text, fc.array(fc.record({ topic_name: text, monster_name: text, monster_type: text, monster_hp: hp, questions: fc.array(wireQuestion, { maxLength: 3 }) }), { minLength: 1, maxLength: 5 }))
  .map(([dungeonId, title, rooms]) => ({
    id: dungeonId,
    title,
    is_public_demo: true,
    created_at: '2026-11-08T10:00:00Z',
    rooms: rooms.map((r, i) => ({
      ...r,
      id: `room-${i}`,
      room_number: i + 1,
      is_boss: i === rooms.length - 1,
      // Question ids stay unique across rooms.
      questions: r.questions.map((q, j) => ({ ...q, id: `q-${i}-${j}` })),
    })),
  }))

const wireRunArb = fc
  .tuple(id, id, count, count, count, fc.array(fc.record({ max: hp, hurt: fc.boolean() }), { minLength: 1, maxLength: 5 }))
  .map(([runId, dungeonId, hpNow, score, streak, rooms]) => ({
    id: runId,
    dungeon_id: dungeonId,
    current_hp: hpNow % 101,
    current_score: score,
    current_streak: streak,
    xp_earned: 0,
    status: 'active',
    rooms: rooms.map((r, i) => ({
      room_id: `room-${i}`,
      room_number: i + 1,
      topic_name: 'topic',
      monster_name: 'monster',
      monster_max_hp: r.max,
      monster_current_hp: r.hurt ? 0 : r.max,
      is_cleared: r.hurt,
      is_boss: i === rooms.length - 1,
    })),
  }))

const wireAttemptArb = fc.record({
  is_correct: fc.boolean(),
  damage_dealt: count,
  damage_taken: count,
  is_critical: fc.boolean(),
  current_hp: count,
  current_score: count,
  current_streak: count,
  monster_hp_remaining: count,
  explanation: fc.option(text, { nil: null }),
  evidence_quote: fc.option(text, { nil: null }),
})

const wireFinishArb = fc.record({
  score: count,
  xp_earned: count,
  correct_count: count,
  total_attempts: count,
  accuracy: fc.double({ min: 0, max: 1, noNaN: true }),
  mastery_band: fc.constantFrom('Weak', 'Learning', 'Strong'),
})

const wireProgressArb = fc.record({
  level: fc.integer({ min: 1, max: 50 }),
  total_xp: count,
  unlocked_weapons: fc.array(weaponName, { maxLength: 5 }),
})

const json = (body: unknown) => async () =>
  new Response(JSON.stringify(body), { status: 200, headers: { 'Content-Type': 'application/json' } })

describe('Property 1: wire mapping produces valid domain values and fails loudly', () => {
  it('dungeon: mapped value passes the domain schema, HP and ids come from the data', () => {
    fc.assert(
      fc.property(wireDungeonArb, (wire) => {
        const d = mapDungeon(wireDungeonSchema.parse(wire))
        expect(ENDPOINT_SCHEMAS.getDungeon.schema.safeParse(d).success).toBe(true)
        expect(d.rooms.map((r) => r.monster.max_hp)).toEqual(wire.rooms.map((r) => r.monster_hp))
        expect(d.rooms.filter((r) => r.is_boss)).toHaveLength(1)
        const qids = new Set(d.questions.map((q) => q.id))
        for (const r of d.rooms) for (const q of r.monster.question_ids) expect(qids.has(q)).toBe(true)
      }),
      { numRuns: 100 },
    )
  })

  it('run, attempt, clear, finish and progress: mapped values pass their domain schemas', () => {
    fc.assert(
      fc.property(wireRunArb, wireAttemptArb, wireFinishArb, wireProgressArb, count, (run, attempt, finish, progress, xp) => {
        const r = mapRun(wireRunSchema.parse(run))
        expect(ENDPOINT_SCHEMAS.startRun.schema.safeParse(r).success).toBe(true)
        expect(run.rooms.map((x) => x.room_id)).toContain(r.current_room_id)

        const a = mapAttempt(wireAttemptSchema.parse(attempt), { monsterHpRemaining: 0, scoreDelta: 0, weaponId: 'rusty_dagger' })
        expect(ENDPOINT_SCHEMAS.submitAttempt.schema.safeParse(a).success).toBe(true)
        expect(a.correct).toBe(attempt.is_correct)
        expect(a.player_hp_remaining).toBe(attempt.current_hp)

        const c = mapClear(wireClearSchema.parse({ xp_delta: xp }))
        expect(ENDPOINT_SCHEMAS.clearRoom.schema.safeParse(c).success).toBe(true)

        const f = mapFinish(wireFinishSchema.parse(finish))
        expect(ENDPOINT_SCHEMAS.finishRun.schema.safeParse(f).success).toBe(true)
        expect(f.xp).toBe(finish.xp_earned)

        const p = mapProgress(wireProgressSchema.parse(progress))
        expect(ENDPOINT_SCHEMAS.getProgress.schema.safeParse(p).success).toBe(true)
        expect(p.unlocked_weapons).toContain('rusty_dagger')
      }),
      { numRuns: 100 },
    )
  })

  it('removing or retyping a required field makes the client throw a ContractError naming endpoint and path', async () => {
    const cases = [
      { call: (api: ReturnType<typeof createHttpClient>) => api.getDungeon('d'), arb: wireDungeonArb, endpoint: 'GET /dungeons/{id}', fields: ['id', 'title', 'rooms'] },
      { call: (api: ReturnType<typeof createHttpClient>) => api.startRun('d'), arb: wireRunArb, endpoint: 'POST /runs', fields: ['id', 'dungeon_id', 'current_hp', 'rooms'] },
      { call: (api: ReturnType<typeof createHttpClient>) => api.finishRun('r'), arb: wireFinishArb, endpoint: 'POST /runs/{id}/finish', fields: ['score', 'xp_earned', 'correct_count', 'accuracy'] },
      { call: (api: ReturnType<typeof createHttpClient>) => api.getProgress(), arb: wireProgressArb, endpoint: 'GET /progress', fields: ['level', 'total_xp', 'unlocked_weapons'] },
    ] as const
    for (const c of cases) {
      await fc.assert(
        fc.asyncProperty(c.arb as fc.Arbitrary<Record<string, unknown>>, fc.nat(), fc.boolean(), async (value, pick, remove) => {
          // Valid: the client resolves to a domain value (no throw).
          await c.call(createHttpClient('', json(value) as unknown as typeof fetch))
          // Mutated: it fails loudly.
          const field = c.fields[pick % c.fields.length]
          const mutated: Record<string, unknown> = { ...value }
          if (remove) delete mutated[field]
          else mutated[field] = { not: 'valid' }
          const err = await c.call(createHttpClient('', json(mutated) as unknown as typeof fetch)).catch((e: unknown) => e)
          expect(err).toBeInstanceOf(ContractError)
          expect((err as ContractError).endpoint).toBe(c.endpoint)
          expect((err as ContractError).path.startsWith(field)).toBe(true)
        }),
        { numRuns: 50 },
      )
    }
  })

  it('out-of-range values fail loudly too (negative HP, accuracy above 1, no rooms)', () => {
    expect(wireAttemptSchema.safeParse({ is_correct: true, damage_dealt: -1, damage_taken: 0, is_critical: false, current_hp: 0, current_score: 0, current_streak: 0, monster_hp_remaining: 0 }).success).toBe(false)
    expect(wireFinishSchema.safeParse({ score: 0, xp_earned: 0, correct_count: 0, total_attempts: 0, accuracy: 1.5, mastery_band: 'Weak' }).success).toBe(false)
    expect(wireDungeonSchema.safeParse({ id: 'd', title: 't', rooms: [] }).success).toBe(false)
    expect(wireRunSchema.safeParse({ id: 'r', dungeon_id: 'd', current_hp: 1, current_score: 0, current_streak: 0, xp_earned: 0, status: 'active', rooms: [] }).success).toBe(false)
  })
})
