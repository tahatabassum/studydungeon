import fc from 'fast-check'
import { describe, expect, it } from 'vitest'
import { createHttpClient } from '../client'
import { ContractError } from '../ContractError'
import { boardResponseSchema, packsResponseSchema, uploadQuotaSchema, userSchema } from '../schemas'

// Feature: frontend-10-live-players, Property 9: Wire mapping of the new shapes is valid, private-free and loud
// **Validates: Requirements 3.6, 11.7, 18.5**

const word = fc.string({ minLength: 1, maxLength: 8 })
const nat = fc.integer({ min: 0, max: 100000 })
const rank = fc.integer({ min: 1, max: 1000 })
const status = fc.constantFrom('locked', 'available', 'in_progress', 'completed')
const reason = fc.constantFrom('player_daily_limit', 'ip_daily_limit', 'stored_limit', 'global_daily_limit', 'ai_unavailable')

/** Keys a Backend might add that must never reach the mapped values. */
const leaks = { username: 'secret-login', id: 'internal-1', is_seeded_rival: true, secret_note: 'x' }

const userBody = fc.record({ id: word, is_guest: fc.boolean(), handle: fc.option(word, { nil: undefined }), public_id: fc.option(word, { nil: undefined }) })
const packsBody = fc.record({
  packs: fc.array(
    fc.record({
      id: word, order: rank, title: word, description: word, dungeon_id: word, floors_total: nat, floors_cleared: nat,
      final_boss_cleared: fc.boolean(), status, points_earned: nat,
    }),
    { maxLength: 4 },
  ),
  next_pack_id: fc.option(word, { nil: null }),
  all_completed: fc.boolean(),
})
const boardEntry = fc.record({ rank, public_id: word, handle: word, is_guest: fc.boolean(), level: nat, points: nat, rooms_cleared: nat })
const boardBody = fc.record({
  board: fc.constantFrom('preloaded', 'own_notes', 'overall'),
  period: fc.constantFrom('all', 'week'),
  updated_at: fc.constant('2026-11-20T12:00:00Z'),
  next_refresh_at: fc.constant('2026-11-20T13:00:00Z'),
  entries: fc.array(boardEntry, { maxLength: 5 }),
  me: fc.constant(null),
})
const statsBody = fc.record({ players: nat })
const quotaBody = fc.record({
  can_upload: fc.boolean(),
  reason: fc.option(reason, { nil: null }),
  player: fc.record({ is_guest: fc.boolean(), used_today: nat, limit_today: nat, stored: nat, stored_limit: nat }),
})

function clientFor(body: unknown) {
  const f = (async () => new Response(JSON.stringify(body), { status: 200, headers: { 'Content-Type': 'application/json' } })) as unknown as typeof fetch
  return createHttpClient('http://api', f)
}

type Case = { name: string; endpoint: string; arb: fc.Arbitrary<Record<string, unknown>>; required: string; run: (body: unknown) => Promise<unknown> }
const cases: Case[] = [
  { name: 'user', endpoint: 'GET /auth/me', arb: userBody, required: 'id', run: (b) => clientFor(b).getMe() },
  { name: 'packs', endpoint: 'GET /packs', arb: packsBody, required: 'packs', run: (b) => clientFor(b).getPacks() },
  { name: 'board', endpoint: 'GET /leaderboard', arb: boardBody, required: 'entries', run: (b) => clientFor(b).getBoard({ board: 'overall', period: 'all' }) },
  { name: 'stats', endpoint: 'GET /stats/players', arb: statsBody, required: 'players', run: (b) => clientFor(b).getPlayerStats() },
  { name: 'quota', endpoint: 'GET /uploads/quota', arb: quotaBody, required: 'player', run: (b) => clientFor(b).getUploadQuota() },
]

describe('Property 9: Wire mapping of the new shapes is valid, private-free and loud', () => {
  for (const c of cases) {
    it(`${c.name}: a valid body maps to a valid domain value`, async () => {
      await fc.assert(
        fc.asyncProperty(c.arb, async (body) => {
          const out = await c.run(body)
          if (c.name === 'user') expect(userSchema.safeParse((out as { user: unknown }).user).success).toBe(true)
          if (c.name === 'packs') expect(packsResponseSchema.safeParse(out).success).toBe(true)
          if (c.name === 'board') expect(boardResponseSchema.safeParse(out).success).toBe(true)
          if (c.name === 'quota') expect(uploadQuotaSchema.safeParse(out).success).toBe(true)
          if (c.name === 'stats') expect((out as { players: number }).players).toBe((body as { players: number }).players)
        }),
        { numRuns: 100 },
      )
    })

    it(`${c.name}: a missing or mistyped required field is a ContractError for ${c.endpoint}`, async () => {
      await fc.assert(
        fc.asyncProperty(c.arb, fc.constantFrom('remove', 'mistype'), async (body, how) => {
          const broken: Record<string, unknown> = { ...body }
          if (how === 'remove') delete broken[c.required]
          else broken[c.required] = { not: 'the right type' }
          const err = await c.run(broken).then(
            () => null,
            (e: unknown) => e,
          )
          expect(err).toBeInstanceOf(ContractError)
          expect((err as ContractError).endpoint).toBe(c.endpoint)
        }),
        { numRuns: 100 },
      )
    })
  }

  it('board entries and public user fields never carry username, id, is_seeded_rival or unknown keys', async () => {
    await fc.assert(
      fc.asyncProperty(boardBody, userBody, async (board, user) => {
        const b = await clientFor({ ...board, entries: (board.entries as Record<string, unknown>[]).map((e) => ({ ...e, ...leaks })) }).getBoard({
          board: 'overall',
          period: 'all',
        })
        for (const e of b.entries) {
          for (const key of Object.keys(leaks)) expect(Object.keys(e)).not.toContain(key)
        }
        const me = await clientFor({ ...user, secret_note: 'x', password_hash: 'y' }).getMe()
        expect(Object.keys(me!.user)).not.toContain('secret_note')
        expect(Object.keys(me!.user)).not.toContain('password_hash')
      }),
      { numRuns: 100 },
    )
  })
})
