import type { ApiClient } from './ApiClient'
import { ApiError } from './errors'

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

  async function request<T>(method: 'GET' | 'POST', path: string, body?: unknown): Promise<T> {
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
    try {
      return (await res.json()) as T
    } catch {
      throw new ApiError(res.status, 'Invalid response')
    }
  }

  const enc = encodeURIComponent

  return {
    startDemoSession: () => request('POST', '/demo/session'),
    getDungeon: (id) => request('GET', `/dungeons/${enc(id)}`),
    startRun: (dungeonId) => request('POST', '/runs', { dungeon_id: dungeonId }),
    submitAttempt: (runId, req) =>
      request('POST', `/runs/${enc(runId)}/attempts`, {
        question_id: req.question_id,
        selected_answer: req.selected_answer,
        attempt_id: req.attempt_id,
      }),
    clearRoom: (runId, roomId) =>
      request('POST', `/runs/${enc(runId)}/rooms/${enc(roomId)}/clear`),
  }
}
