import { describe, expect, it, vi } from 'vitest'
import { createHttpClient, HTTP_CAPABILITIES } from './client'
import { ApiError } from './errors'

describe('Http_Client leaderboard (real mode, D26)', () => {
  it('declares the leaderboard unsupported and never calls the network for it', async () => {
    const fetchSpy = vi.fn()
    const api = createHttpClient('http://backend.test', fetchSpy as unknown as typeof fetch)
    expect(api.capabilities?.leaderboard).toBe(false)
    expect(HTTP_CAPABILITIES.leaderboard).toBe(false)
    await expect(api.getLeaderboard({ dungeonId: 'd', period: 'all' })).rejects.toBeInstanceOf(ApiError)
    await expect(api.getLeaderboard({ dungeonId: 'd', period: 'week' })).rejects.toMatchObject({ status: 501, code: 'UNSUPPORTED' })
    expect(fetchSpy).not.toHaveBeenCalled()
  })
})
