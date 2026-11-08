import type { z } from 'zod'
import type { ApiClient } from './ApiClient'
import { ContractError, formatIssuePath } from './ContractError'
import { ApiError } from './errors'
import { ENDPOINT_SCHEMAS } from './schemas'

type EndpointKey = keyof typeof ENDPOINT_SCHEMAS

async function errorMessage(res: Response): Promise<string> {
  try {
    const body: unknown = await res.json()
    if (body && typeof body === 'object') {
      const { detail, message } = body as { detail?: unknown; message?: unknown }
      if (typeof detail === 'string' && detail) return detail
      if (typeof message === 'string' && message) return message
    }
  } catch {
    // body is not JSON; fall through
  }
  return res.statusText
}

export function createHttpClient(baseUrl: string, fetchImpl: typeof fetch = fetch): ApiClient {
  const base = baseUrl.replace(/\/+$/, '')

  async function request<K extends EndpointKey>(
    key: K,
    method: 'GET' | 'POST',
    path: string,
    body?: unknown,
  ): Promise<z.output<(typeof ENDPOINT_SCHEMAS)[K]['schema']>> {
    const { endpoint, schema } = ENDPOINT_SCHEMAS[key]
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
    if (!res.ok) throw new ApiError(res.status, await errorMessage(res))
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
    return parsed.data as z.output<(typeof ENDPOINT_SCHEMAS)[K]['schema']>
  }

  const enc = encodeURIComponent

  return {
    startDemoSession: () => request('startDemoSession', 'POST', '/demo/session'),
    getDungeon: (id) => request('getDungeon', 'GET', `/dungeons/${enc(id)}`),
    startRun: (dungeonId) => request('startRun', 'POST', '/runs', { dungeon_id: dungeonId }),
    submitAttempt: (runId, req) =>
      request('submitAttempt', 'POST', `/runs/${enc(runId)}/attempts`, {
        question_id: req.question_id,
        selected_answer: req.selected_answer,
        attempt_id: req.attempt_id,
      }),
    clearRoom: (runId, roomId) =>
      request('clearRoom', 'POST', `/runs/${enc(runId)}/rooms/${enc(roomId)}/clear`),
    finishRun: (runId) => request('finishRun', 'POST', `/runs/${enc(runId)}/finish`),
    getProgress: () => request('getProgress', 'GET', '/progress'),
    getDueReviews: (dungeonId) => request('getDueReviews', 'GET', `/reviews/due?dungeon_id=${enc(dungeonId)}`),
  }
}
