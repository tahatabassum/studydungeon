import type { z } from 'zod'
import type { ApiCapabilities, ApiClient } from './ApiClient'
import { ContractError, formatIssuePath } from './ContractError'
import { ApiError, parseErrorBody } from './errors'
import type { AnswerResult, Dungeon, ProgressInfo } from '../types/api'
import { bestWeaponAmong, weaponNameFromId } from '../weapons/weapons'
import {
  WIRE_ENDPOINTS,
  mapAttempt,
  mapClear,
  mapDemoSession,
  mapDueReviews,
  mapDungeon,
  mapFinish,
  mapProgress,
  mapRun,
  unlockedWeaponIds,
  type WireRun,
} from './wire'

type EndpointKey = keyof typeof WIRE_ENDPOINTS

/** Real mode capabilities: no room Revenants, floors, modes or Daily Haunt yet (D26). */
export const HTTP_CAPABILITIES: ApiCapabilities = Object.freeze({
  roomRevenants: false,
  floors: false,
  modes: false,
  dailyHaunt: false,
})

async function errorParts(res: Response): Promise<{ message: string; code?: string }> {
  try {
    const parsed = parseErrorBody(await res.json())
    const out: { message: string; code?: string } = { message: parsed.message ?? res.statusText }
    if (parsed.code !== undefined) out.code = parsed.code
    return out
  } catch {
    // body is not JSON; fall through
  }
  return { message: res.statusText }
}

/** What the client remembers about a run: the wire does not repeat these values in every response. */
interface RunCtx {
  dungeonId: string
  /** room id -> monster HP left (the attempt response's own monster_hp_remaining is not reliable). */
  monsterHp: Map<string, number>
  score: number
  attempts: Map<string, AnswerResult>
}

export function createHttpClient(baseUrl: string, fetchImpl: typeof fetch = fetch): ApiClient {
  const base = baseUrl.replace(/\/+$/, '')
  const enc = encodeURIComponent

  const roomOfQuestion = new Map<string, string>()
  const dungeonsSeen = new Set<string>()
  const runs = new Map<string, RunCtx>()
  /** Weapon ids the backend reported as unlocked in GET /progress (the dagger until then). */
  let unlockedWeapons: string[] = ['rusty_dagger']

  async function request<K extends EndpointKey>(
    key: K,
    method: 'GET' | 'POST',
    path: string,
    body?: unknown,
  ): Promise<z.output<(typeof WIRE_ENDPOINTS)[K]['schema']>> {
    const { endpoint, schema } = WIRE_ENDPOINTS[key]
    let res: Response
    try {
      res = await fetchImpl(`${base}${path}`, {
        method,
        credentials: 'include',
        headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
        ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
      })
    } catch {
      throw new ApiError(0, 'Network error')
    }
    if (!res.ok) {
      const { message, code } = await errorParts(res)
      throw new ApiError(res.status, message, code)
    }
    let data: unknown
    try {
      data = await res.json()
    } catch {
      throw new ApiError(res.status, 'Invalid response')
    }
    const parsed = (schema as z.ZodType).safeParse(data)
    if (!parsed.success) {
      const issue = parsed.error.issues[0]
      throw new ContractError(endpoint, formatIssuePath(issue?.path ?? []), issue?.message ?? 'Invalid input')
    }
    return parsed.data as z.output<(typeof WIRE_ENDPOINTS)[K]['schema']>
  }

  function rememberRun(wire: WireRun, previous?: RunCtx): RunCtx {
    const ctx: RunCtx = {
      dungeonId: wire.dungeon_id,
      monsterHp: new Map(wire.rooms.map((r) => [r.room_id, r.monster_current_hp])),
      score: wire.current_score,
      attempts: previous?.attempts ?? new Map(),
    }
    runs.set(wire.id, ctx)
    return ctx
  }

  async function loadDungeon(id: string): Promise<Dungeon> {
    const dungeon = mapDungeon(await request('getDungeon', 'GET', `/dungeons/${enc(id)}`))
    dungeonsSeen.add(dungeon.id)
    for (const room of dungeon.rooms) for (const qid of room.monster.question_ids) roomOfQuestion.set(qid, room.id)
    return dungeon
  }

  async function ensureRun(runId: string): Promise<RunCtx> {
    const known = runs.get(runId)
    if (known) return known
    return rememberRun(await request('getRun', 'GET', `/runs/${enc(runId)}`))
  }

  async function roomFor(ctx: RunCtx, questionId: string): Promise<string | undefined> {
    if (!roomOfQuestion.has(questionId) && !dungeonsSeen.has(ctx.dungeonId)) await loadDungeon(ctx.dungeonId)
    return roomOfQuestion.get(questionId)
  }

  async function postAttempt(runId: string, body: Record<string, unknown>) {
    return request('submitAttempt', 'POST', `/runs/${enc(runId)}/attempts`, body)
  }

  async function loadProgress(): Promise<ProgressInfo> {
    const wire = await request('getProgress', 'GET', '/progress')
    unlockedWeapons = unlockedWeaponIds(wire)
    return mapProgress(wire)
  }

  return {
    capabilities: HTTP_CAPABILITIES,

    startDemoSession: async () => mapDemoSession(await request('startDemoSession', 'POST', '/demo/session')),

    getDungeon: (id) => loadDungeon(id),

    startRun: async (dungeonId) => {
      const wire = await request('startRun', 'POST', '/runs', { dungeon_id: dungeonId })
      rememberRun(wire)
      return mapRun(wire)
    },

    getRun: async (runId) => {
      const wire = await request('getRun', 'GET', `/runs/${enc(runId)}`)
      rememberRun(wire, runs.get(runId))
      return mapRun(wire)
    },

    submitAttempt: async (runId, req) => {
      const ctx = await ensureRun(runId)
      const cached = ctx.attempts.get(req.attempt_id)
      if (cached) return structuredClone(cached)

      const roomId = await roomFor(ctx, req.question_id)
      // The strike uses the best weapon the backend says is unlocked; the backend still validates it.
      let weapon = req.weapon_id ?? bestWeaponAmong(unlockedWeapons).id
      const body = (weaponId: string): Record<string, unknown> => ({
        question_id: req.question_id,
        selected_answer: req.selected_answer,
        attempt_id: req.attempt_id,
        weapon_name: weaponNameFromId(weaponId),
      })
      let wire
      try {
        wire = await postAttempt(runId, body(weapon))
      } catch (err) {
        const lockedWeapon =
          err instanceof ApiError && (err.code === 'WEAPON_LOCKED' || err.code === 'UNKNOWN_WEAPON')
        if (!lockedWeapon || weapon === 'rusty_dagger') throw err
        // Our cached list was stale: fall back to the starter weapon and forget the list.
        unlockedWeapons = ['rusty_dagger']
        weapon = 'rusty_dagger'
        wire = await postAttempt(runId, body(weapon))
      }

      const before = roomId !== undefined ? ctx.monsterHp.get(roomId) : undefined
      const after = before !== undefined ? Math.max(0, before - wire.damage_dealt) : wire.monster_hp_remaining
      if (roomId !== undefined) ctx.monsterHp.set(roomId, after)
      const scoreDelta = Math.max(0, wire.current_score - ctx.score)
      ctx.score = wire.current_score

      const result = mapAttempt(wire, { monsterHpRemaining: after, scoreDelta, weaponId: weapon })
      ctx.attempts.set(req.attempt_id, result)
      return structuredClone(result)
    },

    clearRoom: async (runId, roomId) =>
      mapClear(await request('clearRoom', 'POST', `/runs/${enc(runId)}/rooms/${enc(roomId)}/clear`)),

    finishRun: async (runId) => mapFinish(await request('finishRun', 'POST', `/runs/${enc(runId)}/finish`)),

    getProgress: () => loadProgress(),

    // The backend list is global (no dungeon filter): room_id is resolved against the loaded dungeon.
    getDueReviews: async () => mapDueReviews(await request('getDueReviews', 'GET', '/reviews/due'), (q) => roomOfQuestion.get(q)),
  }
}
