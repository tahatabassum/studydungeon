import { act, cleanup, render, screen } from '@testing-library/react'
import { MemoryRouter, useLocation } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { ApiClient } from '@/api/ApiClient'
import type { DemoSessionResponse } from '@/types/api'

const h = vi.hoisted(() => ({ api: null as unknown }))
vi.mock('@/api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/api')>()
  return { ...actual, getApi: () => (actual.isApiOverridden() ? actual.getApi() : Promise.resolve(h.api as ApiClient)) }
})

import { isApiOverridden, setApiOverride } from '@/api'
import { OfflineLabel } from '@/components/OfflineLabel'
import { SessionProvider, useSession } from '@/state/SessionContext'
import { OFFLINE_OFFER_MS, useStartDemo } from './useStartDemo'

const slowSession: DemoSessionResponse = {
  user: { id: 'srv-guest', username: 'srv-guest', is_guest: true },
  dungeon_id: 'server-dungeon',
  expires_at: '2030-01-01T00:00:00Z',
}

function Harness() {
  const demo = useStartDemo()
  const { pathname } = useLocation()
  const { user } = useSession()
  return (
    <div>
      <button onClick={() => void demo.start()}>start</button>
      <button onClick={() => void demo.chooseOffline()}>offline</button>
      <p data-testid="state">
        {pathname}|{user?.username ?? 'none'}|{demo.pending ? 'pending' : 'idle'}|{demo.offerOffline ? 'offer' : 'quiet'}|{demo.error ?? ''}
      </p>
    </div>
  )
}

function setup() {
  let resolve!: (s: DemoSessionResponse) => void
  let reject!: (e: unknown) => void
  const pendingSession = new Promise<DemoSessionResponse>((res, rej) => {
    resolve = res
    reject = rej
  })
  h.api = { startDemoSession: () => pendingSession, getMe: () => Promise.resolve(null) }
  render(
    <MemoryRouter initialEntries={['/']}>
      <SessionProvider>
        <Harness />
        <OfflineLabel />
      </SessionProvider>
    </MemoryRouter>,
  )
  return { resolve, reject }
}

const state = () => screen.getByTestId('state').textContent

async function press(name: string) {
  await act(async () => {
    screen.getByRole('button', { name }).click()
  })
}

beforeEach(() => vi.useFakeTimers())
afterEach(() => {
  vi.useRealTimers()
  setApiOverride(null)
  cleanup()
})

describe('demo start with the Offline demo choice (Req 14.2, 14.3)', () => {
  it('offers the Offline demo only after 8 seconds, while the request keeps waiting', async () => {
    setup()
    await press('start')
    expect(state()).toBe('/|none|pending|quiet|')
    await act(async () => {
      await vi.advanceTimersByTimeAsync(OFFLINE_OFFER_MS - 1)
    })
    expect(state()).toContain('|quiet|')
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1)
    })
    expect(state()).toBe('/|none|pending|offer|')
    expect(OFFLINE_OFFER_MS).toBe(8000)
  })

  it('a prompt answer opens the campaign map and never offers Offline', async () => {
    const { resolve } = setup()
    await press('start')
    await act(async () => {
      resolve(slowSession)
      await vi.advanceTimersByTimeAsync(0)
    })
    expect(state()).toBe('/campaign/server-dungeon|srv-guest|idle|quiet|')
    await act(async () => {
      await vi.advanceTimersByTimeAsync(20_000)
    })
    expect(state()).toContain('|quiet|')
  })

  it('choosing Offline loads the module on demand, switches the client and shows the label', async () => {
    setup()
    await press('start')
    await act(async () => {
      await vi.advanceTimersByTimeAsync(OFFLINE_OFFER_MS)
    })
    expect(isApiOverridden()).toBe(false)
    expect(screen.queryByTestId('offline-label')).toBeNull()
    await press('offline')
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0)
    })
    await vi.waitFor(() => expect(isApiOverridden()).toBe(true))
    await vi.waitFor(() => expect(state()).toBe('/campaign/demo-dungeon|offline-guest|idle|quiet|'))
    expect(screen.getByTestId('offline-label').textContent).toBe('Offline demo - progress is not saved')
  })

  it('a late server success after Offline was chosen is ignored', async () => {
    const { resolve } = setup()
    await press('start')
    await act(async () => {
      await vi.advanceTimersByTimeAsync(OFFLINE_OFFER_MS)
    })
    await press('offline')
    await vi.waitFor(() => expect(state()).toBe('/campaign/demo-dungeon|offline-guest|idle|quiet|'))
    await act(async () => {
      resolve(slowSession)
      await vi.advanceTimersByTimeAsync(0)
    })
    expect(state()).toBe('/campaign/demo-dungeon|offline-guest|idle|quiet|')
  })

  it('a late server failure after Offline was chosen shows no error', async () => {
    const { reject } = setup()
    await press('start')
    await act(async () => {
      await vi.advanceTimersByTimeAsync(OFFLINE_OFFER_MS)
    })
    await press('offline')
    await vi.waitFor(() => expect(state()).toBe('/campaign/demo-dungeon|offline-guest|idle|quiet|'))
    await act(async () => {
      reject(new Error('late'))
      await vi.advanceTimersByTimeAsync(0)
    })
    expect(state()).toBe('/campaign/demo-dungeon|offline-guest|idle|quiet|')
  })

  it('a failed request shows a friendly error and stops the timer', async () => {
    const { reject } = setup()
    await press('start')
    await act(async () => {
      reject(new Error('down'))
      await vi.advanceTimersByTimeAsync(0)
    })
    expect(state()).toBe('/|none|idle|quiet|Could not start the demo. Please try again.')
    await act(async () => {
      await vi.advanceTimersByTimeAsync(20_000)
    })
    expect(state()).toContain('|quiet|')
  })
})
