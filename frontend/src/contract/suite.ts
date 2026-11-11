import { beforeAll, describe, expect, it, type TestContext } from 'vitest'
import { capabilityOf, type ApiClient, type CapabilityKey } from '../api/ApiClient'
import { ApiError } from '../api/errors'
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
  /** Set to false for a client that has no accounts (the Offline_Adapter). Default true. */
  auth?: boolean
  /**
   * Mock only: also run the document pipeline cases (C29). The client must finish processing quickly
   * (a few tens of ms); the real backend needs real files and an AI provider, so it is left out.
   */
  uploads?: boolean
  /**
   * Gives a client with its own cookie jar / session, so each identity case starts without a session
   * (`POST /guests` answers 409 when a cookie exists). Without it the identity cases are skipped.
   * In real mode these cases create and delete accounts: run them against a DISPOSABLE backend only.
   */
  makeFreshClient?: () => ApiClient | Promise<ApiClient>
}

/**
 * Runs `call` and skips the case when the endpoint answers 404, 405 or 501 (an older Backend), or when
 * the client turned the capability 'off' after the call. Keeps the real suite green against old backends.
 */
export async function provedOrSkip<T>(ctx: TestContext, api: ApiClient, key: CapabilityKey, call: () => Promise<T>): Promise<T> {
  let value: T
  try {
    value = await call()
  } catch (err) {
    if (err instanceof ApiError && [404, 405, 501].includes(err.status)) ctx.skip(`${key} is not available on this backend`)
    throw err
  }
  if (capabilityOf(api, key) === 'off') ctx.skip(`${key} is off`)
  return value
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

function textFile(name: string, bytes = 800): File {
  return new File(['a'.repeat(bytes)], name, { type: 'text/plain' })
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

    it('GET /dungeons/{id} carries floors: unique ids, contiguous indexes, known rooms (a legacy backend gets one floor)', async () => {
      const floors = dungeon.floors ?? []
      expect(floors.length).toBeGreaterThan(0)
      expect(new Set(floors.map((f) => f.id)).size).toBe(floors.length)
      expect(floors.map((f) => f.index)).toEqual(floors.map((_, i) => i + 1))
      const roomIds = new Set(dungeon.rooms.map((r) => r.id))
      for (const f of floors) {
        expect(f.room_ids.length).toBeGreaterThan(0)
        for (const id of f.room_ids) expect(roomIds.has(id)).toBe(true)
        expect(f.boss.hp).toBeGreaterThan(0)
      }
      if (api.capabilities?.floors === false || dungeon.floors?.[0]?.id === 'floor-legacy') {
        expect(floors).toHaveLength(1)
        expect(floors[0].title).toBe('The Crypt')
      }
    })

    it('GET /dungeons/{id} generation status lists every floor with a known status', async () => {
      const status = await api.getGenerationStatus(dungeon.id)
      expectSchema('getGenerationStatus', status)
      expect(status.floors.map((f) => f.id)).toEqual((dungeon.floors ?? []).map((f) => f.id))
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

    it('POST /runs with a mode starts a floor run when modes are supported, else the plain dungeon run', async () => {
      const floor = dungeon.floors![0]
      const scoped = await api.startRun({ dungeon_id: dungeon.id, floor_id: floor.id, mode: 'floor' })
      expectSchema('startRun', scoped)
      expect(scoped.dungeon_id).toBe(dungeon.id)
      if (api.capabilities?.modes !== false) {
        expect(scoped.mode).toBe('floor')
        expect(scoped.current_room_id).toBe(floor.room_ids[0])
      } else {
        // Today's backend ignores floor and mode (D18): the whole dungeon starts at its first room.
        expect(scoped.mode).toBeUndefined()
      }
    })

    it('GET /reviews/due without an argument returns the new shape; due_count never exceeds the items listed plus the cap', async () => {
      const summary = await api.getDueReviews()
      expectSchema('getDueSummary', summary)
      expect(summary.items.length).toBeLessThanOrEqual(summary.due_count)
      expect(summary.daily_streak).toBeGreaterThanOrEqual(0)
      const ids = new Set(summary.items.map((i) => i.id))
      expect(ids.size).toBe(summary.items.length)
      for (const i of summary.items) expect(Object.keys(i.question).sort()).toEqual(['id', 'options', 'prompt', 'type'])
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

    it('GET /leaderboard returns a ranked board with a me block, or is declared unsupported', async () => {
      if (api.capabilities?.leaderboard === false) {
        await expect(api.getLeaderboard({ dungeonId: dungeon.id, period: 'all' })).rejects.toMatchObject({ status: 501 })
        return
      }
      for (const period of ['all', 'week'] as const) {
        const board = await api.getLeaderboard({ dungeonId: dungeon.id, period, limit: 20 })
        expectSchema('getLeaderboard', board)
        expect(board.entries.length).toBeLessThanOrEqual(20)
        // Ranks are 1..n in comparator order: score never rises down the list.
        board.entries.forEach((e, i) => expect(e.rank).toBe(i + 1))
        for (let i = 1; i < board.entries.length; i += 1) {
          expect(board.entries[i].score).toBeLessThanOrEqual(board.entries[i - 1].score)
        }
        expect(new Set(board.entries.map((e) => e.id)).size).toBe(board.entries.length)
        // me.rank and me.entry are both null or both set.
        expect(board.me.rank === null).toBe(board.me.entry === null)
      }
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
      // frontend-08 additions are optional; when present they are well formed.
      for (const m of summary.mastery_by_topic ?? []) {
        expect(m.mastery).toBeGreaterThanOrEqual(0)
        expect(m.mastery).toBeLessThanOrEqual(100)
      }
      if (summary.floor_rank !== undefined) expect(['S', 'A', 'B', 'C']).toContain(summary.floor_rank)
      for (const c of summary.chest_rewards ?? []) expect(c.label.length).toBeGreaterThan(0)
      // frontend-07 Phase 5 additions are optional; when present they are well formed.
      if (summary.leaderboard_rank !== undefined) expect(summary.leaderboard_rank).toBeGreaterThanOrEqual(1)
      if (summary.level_up) expect(summary.level_up.to).toBeGreaterThan(summary.level_up.from)
      for (const w of summary.weak_concepts ?? []) expect(w.text.length).toBeGreaterThan(0)
    })

    // Identity cases (frontend-10, Phase 1). Each one uses a fresh client so no session is shared.
    describe.skipIf(opts.auth === false || !opts.makeFreshClient)('identity (frontend-10)', () => {
      const HANDLE = /^[A-Za-z0-9 _-]{3,16}#\d{4,5}$/
      const fresh = async () => opts.makeFreshClient!()
      const stamp = Date.now().toString(36).slice(-6)

      it('name check accepts a valid name and refuses bad ones with the right reason', async (ctx) => {
        const c = await fresh()
        const ok = await provedOrSkip(ctx, c, 'guestIdentity', () => c.checkGuestName('Raven'))
        expect(ok.ok).toBe(true)
        const cases: Array<[string, string]> = [
          ['ab', 'too_short'],
          ['a'.repeat(17), 'too_long'],
          ['Adm1n', 'not_allowed'],
          ['ghost rival', 'not_allowed'],
        ]
        for (const [name, reason] of cases) {
          const r = await c.checkGuestName(name)
          expect(r.ok, name).toBe(false)
          expect(r.reason, name).toBe(reason)
        }
      })

      it('createGuest returns a handle and getMe returns the same handle and public_id', async (ctx) => {
        const c = await fresh()
        const created = await provedOrSkip(ctx, c, 'guestIdentity', () => c.createGuest({ display_name: `Raven${stamp}`.slice(0, 16), accept_public_notice: true }))
        expect(created.user.is_guest).toBe(true)
        expect(created.user.handle).toMatch(HANDLE)
        expect(created.user.public_id).toBeTruthy()
        const me = await c.getMe()
        expect(me?.user.is_guest).toBe(true)
        expect(me?.user.handle).toBe(created.user.handle)
        expect(me?.user.public_id).toBe(created.user.public_id)
      })

      it('two guests with one name get different tags', async (ctx) => {
        const a = await fresh()
        const first = await provedOrSkip(ctx, a, 'guestIdentity', () => a.createGuest({ display_name: 'Twin', accept_public_notice: true }))
        // Separate clients can only draw the same random tag by chance (1 in 9000), so allow two redraws.
        let second = first
        for (let i = 0; i < 3 && second.user.handle === first.user.handle; i += 1) {
          const b = await fresh()
          second = await b.createGuest({ display_name: 'Twin', accept_public_notice: true })
        }
        expect(second.user.display_name).toBe(first.user.display_name)
        expect(second.user.handle).not.toBe(first.user.handle)
        expect(second.user.tag).not.toBe(first.user.tag)
      })

      it('upgrade keeps id, public_id and handle; a second upgrade answers NOT_A_GUEST', async (ctx) => {
        const c = await fresh()
        const created = await provedOrSkip(ctx, c, 'guestIdentity', () => c.createGuest({ display_name: 'Upgrader', accept_public_notice: true }))
        const username = `up_${stamp}${Math.random().toString(36).slice(2, 6)}`
        const credentials = { username, password: 'correct-horse-9' }
        const upgraded = await provedOrSkip(ctx, c, 'accountUpgrade', () => c.upgradeGuest(credentials))
        expect(upgraded.is_guest).toBe(false)
        expect(upgraded.id).toBe(created.user.id)
        expect(upgraded.public_id).toBe(created.user.public_id)
        expect(upgraded.handle).toBe(created.user.handle)
        await expect(c.upgradeGuest({ username: `${username}x`, password: 'correct-horse-9' })).rejects.toMatchObject({
          code: 'NOT_A_GUEST',
        })
      })

      it('delete account then getMe answers null', async (ctx) => {
        const c = await fresh()
        await provedOrSkip(ctx, c, 'guestIdentity', () => c.createGuest({ display_name: 'Leaver', accept_public_notice: true }))
        await provedOrSkip(ctx, c, 'accountDelete', () => c.deleteAccount())
        expect(await c.getMe()).toBeNull()
      })

      it('listDungeons includes a public demo dungeon for a named guest', async (ctx) => {
        const c = await fresh()
        await provedOrSkip(ctx, c, 'guestIdentity', () => c.createGuest({ display_name: 'Lister', accept_public_notice: true }))
        const list = await c.listDungeons()
        expect(list.some((d) => d.is_public_demo)).toBe(true)
      })

      it('creating a guest while a session exists is 409 SESSION_EXISTS', async (ctx) => {
        const c = await fresh()
        await provedOrSkip(ctx, c, 'guestIdentity', () => c.createGuest({ display_name: 'Early', accept_public_notice: true }))
        await expect(c.createGuest({ display_name: 'Again', accept_public_notice: true })).rejects.toMatchObject({
          status: 409,
          code: 'SESSION_EXISTS',
        })
      })
    })

    // Packs and points (frontend-10, Phase 2). A fresh client keeps the pack state apart from the other cases.
    describe.skipIf(opts.auth === false || !opts.makeFreshClient)('packs and points (frontend-10)', () => {
      const withSession = async () => {
        const c = await opts.makeFreshClient!()
        await c.startDemoSession()
        return c
      }
      it('GET /packs returns ordered packs with the contract fields and a valid next pack', async (ctx) => {
        const c = await withSession()
        const res = await provedOrSkip(ctx, c, 'packs', () => c.getPacks())
        expectSchema('getPacks', res)
        expect(res.packs.length).toBeGreaterThan(0)
        expect(res.packs.map((p) => p.order)).toEqual([...res.packs.map((p) => p.order)].sort((a, b) => a - b))
        for (const p of res.packs) {
          expect(p.floors_cleared).toBeLessThanOrEqual(p.floors_total)
          expect(p.points_earned).toBeGreaterThanOrEqual(0)
        }
        if (res.next_pack_id) expect(res.packs.some((p) => p.id === res.next_pack_id)).toBe(true)
      })
      it('starting a run on a locked pack is 403 PACK_LOCKED', async (ctx) => {
        const c = await withSession()
        const res = await provedOrSkip(ctx, c, 'packs', () => c.getPacks())
        const locked = res.packs.find((p) => p.status === 'locked')
        if (!locked) return ctx.skip('no locked pack on this backend')
        await expect(c.startRun(locked.dungeon_id)).rejects.toMatchObject({ status: 403, code: 'PACK_LOCKED' })
      })
      it('clearing the final boss of the open pack reports pack_progress and points', async (ctx) => {
        const answer = opts.correctAnswer
        if (!answer) return ctx.skip('needs the answer key (mock only)')
        const c = await withSession()
        const res = await provedOrSkip(ctx, c, 'packs', () => c.getPacks())
        const open = res.packs.find((p) => p.status === 'available' || p.status === 'in_progress')
        if (!open) return ctx.skip('no open pack')
        const d = await c.getDungeon(open.dungeon_id)
        const boss = d.rooms.find((r) => r.is_boss)!
        const r = await c.startRun(d.id)
        for (let i = 0; i < boss.monster.question_ids.length * 2; i += 1) {
          const qid = boss.monster.question_ids[i % boss.monster.question_ids.length]
          const hit = await c.submitAttempt(r.id, { attempt_id: `pk-${i}`, question_id: qid, selected_answer: answer(qid) ?? 'x' })
          if (hit.monster_hp_remaining <= 0) break
        }
        const cleared = await c.clearRoom(r.id, boss.id)
        if (cleared.points_awarded !== undefined) expect(cleared.points_awarded).toBeGreaterThanOrEqual(0)
        const summary = await c.finishRun(r.id)
        expectSchema('finishRun', summary)
        expect(summary.pack_progress).toMatchObject({ pack_id: open.id, status: 'completed' })
        expect(summary.points_earned).toBeGreaterThanOrEqual(0)
        const after = await c.getPacks()
        expect(after.packs.find((p) => p.id === open.id)?.status).toBe('completed')
      })
    })
    // Live board (frontend-10, Phase 3).
    describe.skipIf(opts.auth === false || !opts.makeFreshClient)('live board (frontend-10)', () => {
      it('GET /leaderboard has at most 20 entries with increasing ranks from 1, and no private keys', async (ctx) => {
        const c = await opts.makeFreshClient!()
        const res = await provedOrSkip(ctx, c, 'liveBoard', () => c.getBoard({ board: 'overall', period: 'all' }))
        expectSchema('getBoard', res)
        expect(res.entries.length).toBeLessThanOrEqual(20)
        res.entries.forEach((e, i) => expect(e.rank).toBe(i + 1))
        const text = JSON.stringify(res.entries)
        expect(text).not.toMatch(/"(username|user_id|id)":/)
        expect(res.me).toBeNull()
      })
      it('GET /leaderboard with a session returns a me block', async (ctx) => {
        const c = await opts.makeFreshClient!()
        await c.startDemoSession()
        const res = await provedOrSkip(ctx, c, 'liveBoard', () => c.getBoard({ board: 'overall', period: 'week' }))
        expectSchema('getBoard', res)
        if (res.me) expect(res.me.top20.points_needed).toBeGreaterThanOrEqual(0)
      })
    })
    // Auth cases come last: logging out ends the guest session the cases above use.
    describe.skipIf(opts.auth === false)('auth (C22 to C24)', () => {
      const stamp = Date.now().toString(36)
      const username = `Contract_${stamp}`
      const password = 'correct-horse-9'

      it('POST /auth/register returns a bare non-guest user with a lowercase username', async () => {
        const user = await api.register({ username, password })
        expectSchema('register', user)
        expect(user.is_guest).toBe(false)
        expect(user.username).toBe(username.toLowerCase())
      })

      it('POST /auth/register with a taken username is 409', async () => {
        await expect(api.register({ username, password })).rejects.toMatchObject({ status: 409 })
      })

      it('POST /auth/register with a short password or short username is 422 with a message', async () => {
        const weak = api.register({ username: `weak_${stamp}`, password: 'short' })
        await expect(weak).rejects.toMatchObject({ status: 422 })
        await expect(api.register({ username: 'ab', password })).rejects.toMatchObject({ status: 422 })
      })

      it('POST /auth/login rejects a wrong password with 401 and accepts the right one', async () => {
        await expect(api.login({ username, password: 'not-the-password' })).rejects.toMatchObject({ status: 401 })
        const user = await api.login({ username: username.toUpperCase(), password })
        expectSchema('login', user)
        expect(user.username).toBe(username.toLowerCase())
      })

      it('GET /auth/me returns the user with expires_at, and null after POST /auth/logout', async () => {
        const me = await api.getMe()
        expect(me).not.toBeNull()
        expectSchema('getMe', me)
        expect(me!.user.username).toBe(username.toLowerCase())
        await api.logout()
        expect(await api.getMe()).toBeNull()
      })
    })

    // Document cases register their own user, after the auth cases ended the previous session.
    describe.skipIf(!opts.uploads)('documents (C29)', () => {
      const name = `docs_${Date.now().toString(36)}`

      async function settled(id: string) {
        for (let i = 0; i < 100; i += 1) {
          const s = await api.getDocumentStatus(id)
          if (s.status !== 'processing') return s
          await sleep(10)
        }
        throw new Error('document stayed in processing')
      }

      it('POST /documents as a guest is 403 GUEST_FORBIDDEN', async () => {
        await api.startDemoSession()
        await expect(api.uploadDocument(textFile('notes.txt'))).rejects.toMatchObject({ status: 403, code: 'GUEST_FORBIDDEN' })
      })

      it('upload, status, topics and generate-dungeon follow the real shapes', async () => {
        await api.register({ username: name, password: 'correct-horse-9' })
        const sent = await api.uploadDocument(textFile('Cell biology.txt'))
        expectSchema('uploadDocument', sent)
        expect(sent.status).toBe('processing')

        expect((await api.getDocumentStatus(sent.id)).status).toBe('processing')
        const done = await settled(sent.id)
        expectSchema('getDocumentStatus', done)
        expect(done.status).toBe('accepted')
        expect(done.chunks_count).toBeGreaterThan(0)
        expect(done.rejection_reason).toBeNull()

        const topics = await api.getDocumentTopics(sent.id)
        expectSchema('getDocumentTopics', topics)
        expect(topics.length).toBeGreaterThan(0)
        expect(topics.map((t) => t.order_index)).toEqual([...topics.map((t) => t.order_index)].sort((a, b) => a - b))

        const dungeon = await api.generateDungeon(sent.id)
        expectSchema('generateDungeon', dungeon)
        expect(dungeon.floors!.length).toBeGreaterThan(0)
        const again = await api.getDungeon(dungeon.id)
        expect(again.floors!.map((f) => f.id)).toEqual(dungeon.floors!.map((f) => f.id))
        const status = await api.getGenerationStatus(dungeon.id)
        expect(status.floors.map((f) => f.id)).toEqual(dungeon.floors!.map((f) => f.id))
      })

      it('a document that fails the relevance check is rejected with a reason and can be retried', async () => {
        const sent = await api.uploadDocument(textFile('lunch receipt.txt'))
        const verdict = await settled(sent.id)
        expect(verdict.status).toBe('rejected')
        expect((verdict.rejection_reason ?? '').length).toBeGreaterThan(0)
        expect(verdict.chunks_count).toBe(0)
        expect(await api.getDocumentTopics(sent.id)).toEqual([])
        await expect(api.generateDungeon(sent.id)).rejects.toMatchObject({ status: 400, code: 'NO_CHUNKS_AVAILABLE' })
        const retried = await api.retryDocument(sent.id)
        expectSchema('retryDocument', retried)
        expect(retried.status).toBe('processing')
      })

      it('retry on an accepted document is 400 NOT_RETRYABLE; an unknown document is 404', async () => {
        const sent = await api.uploadDocument(textFile('Chemistry.txt'))
        await settled(sent.id)
        await expect(api.retryDocument(sent.id)).rejects.toMatchObject({ status: 400, code: 'NOT_RETRYABLE' })
        await expect(api.getDocumentStatus('missing')).rejects.toMatchObject({ status: 404, code: 'DOCUMENT_NOT_FOUND' })
      })

      it('an oversize file is 413 FILE_TOO_LARGE and an unsupported type is 415 UNSUPPORTED_FILE_TYPE', async () => {
        const big = textFile('big.pdf', 10)
        Object.defineProperty(big, 'size', { value: 16 * 1024 * 1024 })
        await expect(api.uploadDocument(big)).rejects.toMatchObject({ status: 413, code: 'FILE_TOO_LARGE' })
        await expect(api.uploadDocument(textFile('virus.exe'))).rejects.toMatchObject({ status: 415, code: 'UNSUPPORTED_FILE_TYPE' })
      })

      it('the sixth stored document is 400 QUOTA_EXCEEDED', async () => {
        let last: unknown = null
        for (let i = 0; i < 6 && last === null; i += 1) {
          try {
            await api.uploadDocument(textFile(`extra ${i}.txt`))
          } catch (err) {
            last = err
          }
        }
        expect(last).toMatchObject({ status: 400, code: 'QUOTA_EXCEEDED' })
      })
    })
  })
}
