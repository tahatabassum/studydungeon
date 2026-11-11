import type { z } from 'zod'
import type { ApiCapabilities, ApiClient, CapabilityKey } from './ApiClient'
import { ContractError, formatIssuePath } from './ContractError'
import { ApiError, parseErrorBody, type ApiErrorExtra } from './errors'
import type { AnswerResult, DueReview, Dungeon, ProgressInfo } from '../types/api'
import { bestWeaponAmong, weaponNameFromId } from '../weapons/weapons'
import {
  WIRE_ENDPOINTS,
  mapAttempt,
  mapClear,
  mapDemoSession,
  mapDocumentStatus,
  mapDocumentTopics,
  mapCreateGuest,
  mapDocumentUpload,
  mapDueReviews,
  mapDueSummary,
  mapDungeon,
  mapDungeonList,
  mapFinish,
  mapBoard,
  mapPacks,
  mapPlayerStats,
  mapUploadQuota,
  mapMe,
  mapNameCheck,
  mapProgress,
  mapRun,
  mapUser,
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
  leaderboard: false,
  guestIdentity: true,
  accountUpgrade: true,
  accountDelete: true,
  packs: 'unproven',
  liveBoard: 'unproven',
  playerCounter: 'unproven',
  uploadQuota: 'unproven',
  guestUpload: 'unproven',
})

async function errorParts(res: Response): Promise<{ message: string; code?: string; extra: ApiErrorExtra }> {
  const extra: ApiErrorExtra = {}
  const retryAfter = res.headers?.get?.('Retry-After')
  if (retryAfter) extra.retryAfter = retryAfter
  try {
    const parsed = parseErrorBody(await res.json())
    const out: { message: string; code?: string; extra: ApiErrorExtra } = { message: parsed.message ?? res.statusText, extra }
    if (parsed.code !== undefined) out.code = parsed.code
    if (parsed.fields !== undefined) extra.fields = parsed.fields
    if (parsed.reason !== undefined) extra.reason = parsed.reason
    if (parsed.retry_after_seconds !== undefined) extra.retry_after_seconds = parsed.retry_after_seconds
    if (parsed.limit !== undefined) extra.limit = parsed.limit
    if (parsed.found !== undefined) extra.found = parsed.found
    if (parsed.offer_packs !== undefined) extra.offer_packs = parsed.offer_packs
    return out
  } catch {
    // body is not JSON; fall through
  }
  return { message: res.statusText, extra }
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
  /** D26: starts as HTTP_CAPABILITIES (all off) and turns a flag on only when the backend proves it. */
  let caps: ApiCapabilities = HTTP_CAPABILITIES

  /**
   * D2: runs a call that depends on one capability. 404, 405 or 501 turn it off; success settles an
   * 'unproven' flag to true; any other error leaves it unchanged. Errors always propagate.
   */
  async function withCapability<T>(key: CapabilityKey, call: () => Promise<T>): Promise<T> {
    try {
      const result = await call()
      if (caps[key] === 'unproven') caps = Object.freeze({ ...caps, [key]: true })
      return result
    } catch (err) {
      if (err instanceof ApiError && (err.status === 404 || err.status === 405 || err.status === 501) && caps[key] !== false) {
        caps = Object.freeze({ ...caps, [key]: false })
      }
      throw err
    }
  }

  let warmed = false

  async function dueList(): Promise<DueReview[]> {
    return mapDueReviews(await request('getDueReviews', 'GET', '/reviews/due'), (q) => roomOfQuestion.get(q))
  }

  async function request<K extends EndpointKey>(
    key: K,
    method: 'GET' | 'POST' | 'DELETE',
    path: string,
    body?: unknown,
  ): Promise<z.output<(typeof WIRE_ENDPOINTS)[K]['schema']>> {
    const { endpoint, schema } = WIRE_ENDPOINTS[key]
    let res: Response
    try {
      // A FormData body is multipart: the browser sets the Content-Type with its boundary.
      const multipart = typeof FormData !== 'undefined' && body instanceof FormData
      res = await fetchImpl(`${base}${path}`, {
        method,
        credentials: 'include',
        headers: multipart ? { Accept: 'application/json' } : { Accept: 'application/json', 'Content-Type': 'application/json' },
        ...(body !== undefined ? { body: multipart ? (body as FormData) : JSON.stringify(body) } : {}),
      })
    } catch {
      throw new ApiError(0, 'Network error')
    }
    if (!res.ok) {
      const { message, code, extra } = await errorParts(res)
      throw new ApiError(res.status, message, code, extra)
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
    const wireDungeon = await request('getDungeon', 'GET', `/dungeons/${enc(id)}`)
    // D26: floors exist only when the backend sent them (the legacy single Floor is built by the mapper).
    if (wireDungeon.floors && wireDungeon.floors.length > 0 && !caps.floors) caps = Object.freeze({ ...caps, floors: true })
    const dungeon = mapDungeon(wireDungeon)
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
    get capabilities() {
      return caps
    },

    startDemoSession: async () => mapDemoSession(await request('startDemoSession', 'POST', '/demo/session')),

    // Auth (C22): bare bodies, the session is the httpOnly cookie. Nothing is kept in JS storage.
    register: async (credentials) => mapUser(await request('register', 'POST', '/auth/register', credentials)),

    login: async (credentials) => mapUser(await request('login', 'POST', '/auth/login', credentials)),

    logout: async () => {
      await request('logout', 'POST', '/auth/logout')
    },

    getMe: async () => {
      try {
        return mapMe(await request('getMe', 'GET', '/auth/me'))
      } catch (err) {
        // No session cookie (or an expired one) is the normal "signed out" answer, not a failure.
        if (err instanceof ApiError && err.status === 401) return null
        throw err
      }
    },

    getDungeon: (id) => loadDungeon(id),

    startRun: async (request_) => {
      // D18: floor_id and mode are not sent until the backend supports them.
      const dungeonId = typeof request_ === 'string' ? request_ : request_.dungeon_id
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
    getDueReviews: (async (dungeonId?: string) => {
      const items = await dueList()
      // Thin adapter: with a dungeon id the old bare-array shape, without one the new shape.
      return dungeonId === undefined ? mapDueSummary(items) : items
    }) as ApiClient['getDueReviews'],

    // Today's backend has no per-floor status: report the floors of the dungeon as mapped.
    getGenerationStatus: async (dungeonId) => {
      const d = await loadDungeon(dungeonId)
      return { dungeon_id: d.id, floors: (d.floors ?? []).map((f) => ({ id: f.id, status: f.status })) }
    },

    retryFloor: async () => {
      throw new ApiError(501, 'Retrying a floor is not supported yet.', 'UNSUPPORTED')
    },

    // Documents (C29): the real upload pipeline.
    uploadDocument: async (file, options) => {
      const form = new FormData()
      form.append('file', file, file.name)
      if (options?.acceptAiNotice) form.append('accept_ai_notice', 'true')
      try {
        return mapDocumentUpload(await request('uploadDocument', 'POST', '/documents', form))
      } catch (err) {
        // Today's Backend: guests get 403 GUEST_FORBIDDEN. That turns guest upload off for this page session.
        if (err instanceof ApiError && err.status === 403 && err.code === 'GUEST_FORBIDDEN' && caps.guestUpload !== false) {
          caps = Object.freeze({ ...caps, guestUpload: false })
        }
        throw err
      }
    },

    getDocumentStatus: async (id) => mapDocumentStatus(await request('getDocumentStatus', 'GET', `/documents/${enc(id)}/status`)),

    getDocumentTopics: async (id) => mapDocumentTopics(await request('getDocumentTopics', 'GET', `/documents/${enc(id)}/topics`)),

    generateDungeon: async (id) => {
      const dungeon = mapDungeon(await request('generateDungeon', 'POST', `/documents/${enc(id)}/generate-dungeon`))
      dungeonsSeen.add(dungeon.id)
      return dungeon
    },

    retryDocument: async (id) => mapDocumentUpload(await request('retryDocument', 'POST', `/documents/${enc(id)}/retry`)),

    // The backend has no leaderboard endpoint yet (capabilities.leaderboard is false); the UI never calls this.
    getLeaderboard: async () => {
      throw new ApiError(501, 'The leaderboard is not available yet.', 'UNSUPPORTED')
    },
    checkGuestName: (displayName) =>
      withCapability('guestIdentity', async () =>
        mapNameCheck(await request('checkGuestName', 'POST', '/guests/name-check', { display_name: displayName })),
      ),

    createGuest: (req) =>
      withCapability('guestIdentity', async () =>
        mapCreateGuest(
          await request('createGuest', 'POST', '/guests', { display_name: req.display_name, accept_public_notice: true }),
        ),
      ),

    upgradeGuest: (credentials) =>
      withCapability('accountUpgrade', async () => mapUser(await request('upgradeGuest', 'POST', '/auth/upgrade', credentials))),

    deleteAccount: () =>
      withCapability('accountDelete', async () => {
        await request('deleteAccount', 'DELETE', '/auth/me', { confirm: 'DELETE' })
      }),

    listDungeons: async () => mapDungeonList(await request('listDungeons', 'GET', '/dungeons')),

    // PROPOSED (frontend-10): unproven -> on on 2xx, off on 404, 405 or 501.
    getPacks: () => withCapability('packs', async () => mapPacks(await request('getPacks', 'GET', '/packs'))),

    // PROPOSED (frontend-10): the live board. A 429 keeps Retry-After on the ApiError for the poll scheduler.
    getBoard: (query) =>
      withCapability('liveBoard', async () =>
        mapBoard(await request('getBoard', 'GET', `/leaderboard?board=${enc(query.board)}&period=${enc(query.period)}`)),
      ),

    // PROPOSED (frontend-10): the player counter.
    getPlayerStats: () => withCapability('playerCounter', async () => mapPlayerStats(await request('getPlayerStats', 'GET', '/stats/players'))),

    // PROPOSED (frontend-10): the upload quota. A 2xx for a guest proves that guests may upload.
    getUploadQuota: () =>
      withCapability('uploadQuota', async () => {
        const quota = mapUploadQuota(await request('getUploadQuota', 'GET', '/uploads/quota'))
        if (quota.player.is_guest && caps.guestUpload !== true) caps = Object.freeze({ ...caps, guestUpload: true })
        return quota
      }),

    // A cold-server wake-up ping: once per client, no cookies, never throws.
    warmUp: async () => {
      if (warmed) return
      warmed = true
      try {
        await fetchImpl(`${base}/health`, { method: 'GET', credentials: 'omit' })
      } catch {
        // best effort
      }
    },
  }
}
