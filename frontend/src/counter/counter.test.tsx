import { act, cleanup, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { resetClientCaches } from '../state/resetClientCaches'
import { setApiOverride } from '../api'
import type { ApiClient } from '../api/ApiClient'
import { mockPlayerStats } from '../api/mock/mockStats'
import { readFlags } from '../config/flags'
import { fetchPlayerCount } from './cache'
import { PlayerCounterLine } from './PlayerCounterLine'

const rm = vi.hoisted(() => ({ reduced: true }))
vi.mock('framer-motion', async (importOriginal) => {
  const actual = await importOriginal<typeof import('framer-motion')>()
  return { ...actual, useReducedMotion: () => rm.reduced }
})

function fakeApi(impl: () => Promise<unknown>, caps?: Record<string, unknown>): ApiClient {
  return { getPlayerStats: vi.fn(impl), capabilities: caps } as unknown as ApiClient
}

beforeEach(() => {
  resetClientCaches()
  rm.reduced = true
})
afterEach(() => {
  cleanup()
  setApiOverride(null)
  resetClientCaches()
})

describe('fetchPlayerCount', () => {
  it('caches a success, shares one in-flight request and honours cache_seconds', async () => {
    let now = 0
    const api = fakeApi(async () => ({ players: 42, cache_seconds: 10 }))
    const [a, b] = await Promise.all([fetchPlayerCount(api, () => now), fetchPlayerCount(api, () => now)])
    expect([a, b]).toEqual([42, 42])
    expect(api.getPlayerStats).toHaveBeenCalledTimes(1)
    now = 9_999
    await fetchPlayerCount(api, () => now)
    expect(api.getPlayerStats).toHaveBeenCalledTimes(1)
    now = 10_000
    await fetchPlayerCount(api, () => now)
    expect(api.getPlayerStats).toHaveBeenCalledTimes(2)
  })
  it('does not cache a failure and defaults to 300 s', async () => {
    let fail = true
    let now = 0
    const api = fakeApi(async () => {
      if (fail) throw new Error('x')
      return { players: 5 }
    })
    expect(await fetchPlayerCount(api, () => now)).toBeNull()
    fail = false
    expect(await fetchPlayerCount(api, () => now)).toBe(5)
    now = 299_999
    await fetchPlayerCount(api, () => now)
    expect(api.getPlayerStats).toHaveBeenCalledTimes(2)
  })
  it('makes no call when the capability is off', async () => {
    const api = fakeApi(async () => ({ players: 5 }), { playerCounter: false })
    expect(await fetchPlayerCount(api)).toBeNull()
    expect(api.getPlayerStats).not.toHaveBeenCalled()
  })
})

describe('mock stats', () => {
  it('returns 0 by default and the configured count', () => {
    expect(mockPlayerStats().players).toBe(readFlags({}).mockPlayerCount)
    expect(readFlags({}).mockPlayerCount).toBe(0)
    expect(readFlags({ VITE_MOCK_PLAYER_COUNT: '128' }).mockPlayerCount).toBe(128)
    expect(mockPlayerStats(128).players).toBe(128)
  })
})

describe('PlayerCounterLine', () => {
  const show = async (players: number) => {
    setApiOverride(fakeApi(async () => ({ players })))
    render(<PlayerCounterLine />)
  }
  it('renders nothing for 0 and when the request fails', async () => {
    await show(0)
    await act(async () => undefined)
    expect(screen.queryByTestId('player-counter')).toBeNull()
    cleanup()
    resetClientCaches()
    setApiOverride(fakeApi(async () => Promise.reject(new Error('x'))))
    render(<PlayerCounterLine />)
    await act(async () => undefined)
    expect(screen.queryByTestId('player-counter')).toBeNull()
  })
  it('shows the first-explorers line without a number for 1 to 9', async () => {
    await show(7)
    expect(await screen.findByText('Be among the first explorers', { selector: '.sr-only' })).toBeTruthy()
    expect(screen.getByTestId('player-counter-visual').textContent).toBe('Be among the first explorers')
  })
  it('shows the exact number at once under reduced motion; the animated span is aria-hidden', async () => {
    await show(1280)
    const sr = await screen.findByText('1,280 explorers have braved the dungeon', { selector: '.sr-only' })
    expect(sr).toBeTruthy()
    const visual = screen.getByTestId('player-counter-visual')
    expect(visual.getAttribute('aria-hidden')).toBe('true')
    expect(visual.textContent).toBe('1,280 explorers have braved the dungeon')
  })
  it('counts up to the exact number without reduced motion', async () => {
    rm.reduced = false
    await show(500)
    await waitFor(() => expect(screen.getByTestId('player-counter-visual').textContent).toBe('500 explorers have braved the dungeon'), { timeout: 2000 })
  })
})
