import fc from 'fast-check'
import { describe, expect, it } from 'vitest'
import { createHttpClient } from './client'
import { ContractError } from './ContractError'
import { ENDPOINT_SCHEMAS } from './schemas'

const str = fc.string({ minLength: 1, maxLength: 12 })
const num = fc.integer({ min: 0, max: 100000 })
const badgeId = fc.constantFrom(
  'perfect_room',
  'no_damage',
  'streak_5',
  'boss_slayer',
  'first_blood',
  'memory_keeper',
  'speed_reader',
  'dungeon_master',
)
const weaponId = fc.constantFrom('rusty_dagger', 'arcane_staff', 'hunter_crossbow', 'spectral_hammer', 'flame_sigil')

/** Optional keys are present or absent. */
const opt = <T>(a: fc.Arbitrary<T>) => fc.option(a, { nil: undefined })
const strip = <T extends Record<string, unknown>>(o: T): T =>
  Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined)) as T

const monster = fc.record({ id: str, name: str, max_hp: num, question_ids: fc.array(str, { maxLength: 4 }), kind: str })

/** Hand-written arbitraries that satisfy each schema, one per endpoint. */
const VALID = {
  startDemoSession: fc.record({
    user: fc.record({ id: str, username: str, is_guest: fc.boolean() }),
    dungeon_id: str,
    expires_at: str,
  }),
  getDungeon: fc.record({
    id: str,
    name: str,
    rooms: fc.array(fc.record({ id: str, label: str, order: num, is_boss: fc.boolean(), monster }), { maxLength: 3 }),
    questions: fc.array(
      fc.record({ id: str, type: fc.constantFrom('mcq', 'true_false'), prompt: str, options: fc.array(str, { maxLength: 4 }) }),
      { maxLength: 3 },
    ),
  }),
  startRun: fc.record({ id: str, dungeon_id: str, player_hp: num, monster_hp: num, current_room_id: str }),
  submitAttempt: fc
    .record({
      correct: fc.boolean(),
      damage_dealt: num,
      monster_hp_remaining: num,
      player_hp_remaining: num,
      score_delta: num,
      xp_delta: num,
      streak: num,
      source: fc.record({ page: num, chunk_id: str }),
      review_status: fc.constantFrom('due', 'not_due'),
      explanation: opt(str),
      weapon_id: opt(str),
      is_critical: opt(fc.boolean()),
    })
    .map(strip),
  clearRoom: fc.record({ xp_delta: num }),
  finishRun: fc
    .record({
      score: num,
      xp: num,
      correct: num,
      total: num,
      accuracy: fc.double({ min: 0, max: 1, noNaN: true }).map((n) => n + 0), // n + 0 turns -0 into 0 (JSON drops the sign)
      badges_earned: opt(fc.array(badgeId, { maxLength: 3 })),
      leaderboard_rank: opt(num),
      weapon_unlocked: opt(fc.oneof(fc.constant(null), weaponId)),
      level_up: opt(fc.oneof(fc.constant(null), fc.record({ from: num, to: num }))),
      topic_mastery: opt(fc.array(fc.record({ room_id: str, label: str, percent: num }), { maxLength: 3 })),
      weak_concepts: opt(fc.array(fc.record({ text: str, page: num }), { maxLength: 3 })),
    })
    .map(strip),
  getProgress: fc
    .record({
      level: num,
      total_xp: num,
      xp_to_next: num,
      badges: opt(fc.array(badgeId, { maxLength: 3 })),
      weapons: opt(fc.array(fc.record({ id: weaponId, unlock_level: num }), { maxLength: 3 })),
      recent_runs: opt(
        fc.array(fc.record({ id: str, dungeon_name: str, score: num, accuracy: num, finished_at: str }), { maxLength: 2 }),
      ),
      due_review_count: opt(num),
    })
    .map(strip),
} as const

type Key = keyof typeof VALID
const KEYS = Object.keys(VALID) as Key[]

/** Required top-level keys per endpoint that the mutation test can remove or retype. */
const REQUIRED: Record<Key, string[]> = {
  startDemoSession: ['user', 'dungeon_id', 'expires_at'],
  getDungeon: ['id', 'name', 'rooms', 'questions'],
  startRun: ['id', 'dungeon_id', 'player_hp', 'monster_hp', 'current_room_id'],
  submitAttempt: ['correct', 'damage_dealt', 'monster_hp_remaining', 'player_hp_remaining', 'score_delta', 'xp_delta', 'streak', 'source', 'review_status'],
  clearRoom: ['xp_delta'],
  finishRun: ['score', 'xp', 'correct', 'total', 'accuracy'],
  getProgress: ['level', 'total_xp', 'xp_to_next'],
}

const json = (body: unknown) => async () =>
  new Response(JSON.stringify(body), { status: 200, headers: { 'Content-Type': 'application/json' } })

/** Calls the matching Http_Client method with a fake fetch returning `body`. */
function call(key: Key, body: unknown): Promise<unknown> {
  const api = createHttpClient('', json(body) as unknown as typeof fetch)
  switch (key) {
    case 'startDemoSession':
      return api.startDemoSession()
    case 'getDungeon':
      return api.getDungeon('d')
    case 'startRun':
      return api.startRun('d')
    case 'submitAttempt':
      return api.submitAttempt('r', { question_id: 'q', selected_answer: 'a', attempt_id: 'x' })
    case 'clearRoom':
      return api.clearRoom('r', 'room')
    case 'finishRun':
      return api.finishRun('r')
    case 'getProgress':
      return api.getProgress()
  }
}

describe('response schemas', () => {
  // Feature: frontend-07-premium-ux-leaderboard, Property 22: Schema validation round trip and loud failure
  // **Validates: Requirements 17.3, 17.4, 17.7**
  it.each(KEYS)('Property 22: %s round trips and fails loudly with the endpoint and path', async (key) => {
    const arb = VALID[key] as fc.Arbitrary<Record<string, unknown>>
    await fc.assert(
      fc.asyncProperty(arb, fc.nat(), fc.boolean(), async (value, pick, remove) => {
        // Round trip: a valid value parses to an equal value through the Http_Client.
        expect(ENDPOINT_SCHEMAS[key].schema.parse(value)).toEqual(value)
        expect(await call(key, value)).toEqual(value)

        // One required field removed or retyped must throw a ContractError naming endpoint and path.
        const field = REQUIRED[key][pick % REQUIRED[key].length]
        const mutated: Record<string, unknown> = { ...value }
        if (remove) delete mutated[field]
        else mutated[field] = { not: 'valid' }
        const err = await call(key, mutated).catch((e: unknown) => e)
        expect(err).toBeInstanceOf(ContractError)
        const ce = err as ContractError
        expect(ce.message).toContain(ENDPOINT_SCHEMAS[key].endpoint)
        expect(ce.path.startsWith(field)).toBe(true)
      }),
      { numRuns: 100 },
    )
  })
})
