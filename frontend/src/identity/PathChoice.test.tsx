import { useEffect, type ReactNode } from 'react'
import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { ApiClient } from '@/api'
import { ApiError } from '@/api/errors'
import { createMockAdapter } from '@/api/mock/mockAdapter'
import type { Dungeon, DungeonSummary } from '@/types/api'

const h = vi.hoisted(() => ({ api: null as unknown, createOffline: null as unknown as (...a: unknown[]) => unknown }))
vi.mock('@/api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/api')>()
  return { ...actual, getApi: () => (actual.isApiOverridden() ? actual.getApi() : Promise.resolve(h.api as ApiClient)) }
})
vi.mock('@/offline', () => ({ createOfflineAdapter: (...a: unknown[]) => h.createOffline(...a) }))

import { setApiOverride } from '@/api'
import { SessionProvider, useSession } from '@/state/SessionContext'
import PathChoicePage, { PathChoice } from './PathChoice'
import { NoPreloadedError, resolvePreloadedDungeon } from './resolvePreloaded'

const guest = { id: 'u1', username: '', is_guest: true, handle: 'Hollow Raven#1234' }
const demoSummary: DungeonSummary = { id: 'demo-dungeon', title: 'Demo', is_public_demo: true, created_at: '2026-01-01T00:00:00Z', rooms_count: 4 }

function Seed({ children }: { children: ReactNode }) {
  const { setUser } = useSession()
  useEffect(() => {
    setUser(guest)
  }, [setUser])
  return <>{children}</>
}
function Where() {
  return <p data-testid="where">{useLocation().pathname}</p>
}

function renderChoose(opts: { session?: boolean; compact?: boolean } = {}) {
  const session = opts.session ?? true
  const page = (
    <>
      <Where />
      <Routes>
        <Route path="/choose" element={opts.compact ? <PathChoice variant="compact" /> : <PathChoicePage />} />
        <Route path="*" element={<p>elsewhere</p>} />
      </Routes>
    </>
  )
  return render(
    <MemoryRouter initialEntries={['/choose']}>
      <SessionProvider>{session ? <Seed>{page}</Seed> : page}</SessionProvider>
    </MemoryRouter>,
  )
}

const where = () => screen.getByTestId('where').textContent
const preloaded = () => screen.getByRole('button', { name: /Play preloaded dungeons \(try the game\)/ })

/** The mock with a session-less-safe GET /dungeons and optional overrides. */
function fake(over: Record<string, unknown> = {}) {
  const adapter = createMockAdapter()
  const api = {
    ...adapter,
    listDungeons: vi.fn(() => Promise.resolve([demoSummary])),
    startDemoSession: vi.fn(adapter.startDemoSession),
    getMe: vi.fn(() => Promise.resolve(null)),
    ...over,
  }
  h.api = api
  return api as unknown as ApiClient & { listDungeons: ReturnType<typeof vi.fn>; startDemoSession: ReturnType<typeof vi.fn> }
}

async function clearedDungeon(): Promise<Dungeon> {
  const d = await createMockAdapter().getDungeon('demo-dungeon')
  return { ...d, floors: (d.floors ?? []).map((f, i) => (i === 0 ? { ...f, status: 'cleared' as const } : f)) }
}

beforeEach(() => {
  h.createOffline = vi.fn(() => ({ startDemoSession: () => Promise.resolve({ user: guest, dungeon_id: 'demo-dungeon', expires_at: '2099-01-01T00:00:00Z' }) }))
})
afterEach(() => {
  setApiOverride(null)
  cleanup()
  vi.restoreAllMocks()
})

describe('PathChoice page', () => {
  it('shows both cards, highlights and focuses the preloaded one, and Enter activates it', async () => {
    const api = fake()
    const user = userEvent.setup()
    renderChoose()
    const card = preloaded()
    expect(screen.getByRole('button', { name: /Upload my notes \(play from your own material\)/ })).toBeTruthy()
    expect(card.className).toContain('sd-choice__card--default')
    expect(card.textContent).toContain('Recommended')
    expect(document.activeElement).toBe(card)
    await user.keyboard('{Enter}')
    await vi.waitFor(() => expect(where()).toBe('/campaign/demo-dungeon/play/floor-1'))
    expect(api.listDungeons).toHaveBeenCalledTimes(1)
  })

  it('the upload card opens /upload', async () => {
    fake()
    const user = userEvent.setup()
    renderChoose()
    await user.click(screen.getByRole('button', { name: /Upload my notes/ }))
    expect(where()).toBe('/upload')
  })

  it('a first-time player opens the first floor run directly', async () => {
    fake()
    const user = userEvent.setup()
    renderChoose()
    await user.click(preloaded())
    await vi.waitFor(() => expect(where()).toBe('/campaign/demo-dungeon/play/floor-1'))
  })

  it('a first-time player of a legacy single-floor backend opens the legacy floor run', async () => {
    const d = await createMockAdapter().getDungeon('demo-dungeon')
    const { floors, ...legacy } = d
    void floors
    fake({ getDungeon: vi.fn(() => Promise.resolve(legacy as Dungeon)) })
    const user = userEvent.setup()
    renderChoose()
    await user.click(preloaded())
    await vi.waitFor(() => expect(where()).toBe('/campaign/demo-dungeon/play/floor-legacy'))
  })

  it('a returning player opens the floor map', async () => {
    const cleared = await clearedDungeon()
    fake({ getDungeon: vi.fn(() => Promise.resolve(cleared)) })
    const user = userEvent.setup()
    renderChoose()
    await user.click(preloaded())
    await vi.waitFor(() => expect(where()).toBe('/campaign/demo-dungeon'))
  })

  it('unknown progress (getDungeon fails) opens the floor map and writes nothing to storage', async () => {
    fake({ getDungeon: vi.fn(() => Promise.reject(new ApiError(500, 'boom'))) })
    const setItem = vi.spyOn(Storage.prototype, 'setItem')
    const user = userEvent.setup()
    renderChoose()
    await user.click(preloaded())
    await vi.waitFor(() => expect(where()).toBe('/campaign/demo-dungeon'))
    expect(setItem).not.toHaveBeenCalled()
  })

  it('shows Retry and the offline offer when nothing resolves, and starts offline only on the click', async () => {
    const api = fake({ listDungeons: vi.fn(() => Promise.resolve([])) })
    const user = userEvent.setup()
    renderChoose()
    await user.click(preloaded())
    const err = await screen.findByTestId('choice-error')
    expect(err.getAttribute('role')).toBe('alert')
    expect(api.startDemoSession).not.toHaveBeenCalled() // a session exists
    expect(h.createOffline).not.toHaveBeenCalled()
    expect(screen.getByRole('button', { name: 'Retry' })).toBeTruthy()
    await user.click(screen.getByRole('button', { name: 'Play offline demo' }))
    await vi.waitFor(() => expect(h.createOffline).toHaveBeenCalledTimes(1))
  })

  it('Retry resolves again after a failure', async () => {
    const list = vi.fn().mockRejectedValueOnce(new ApiError(500, 'x')).mockResolvedValue([demoSummary])
    fake({ listDungeons: list })
    const user = userEvent.setup()
    renderChoose()
    await user.click(preloaded())
    await user.click(await screen.findByRole('button', { name: 'Retry' }))
    await vi.waitFor(() => expect(where()).toBe('/campaign/demo-dungeon/play/floor-1'))
  })

  it('without a session it uses POST /demo/session and stores that session', async () => {
    const api = fake({ listDungeons: vi.fn(() => Promise.reject(new ApiError(401, 'no session'))) })
    const user = userEvent.setup()
    renderChoose({ session: false })
    await user.click(preloaded())
    await vi.waitFor(() => expect(where()).toBe('/campaign/demo-dungeon/play/floor-1'))
    expect(api.startDemoSession).toHaveBeenCalledTimes(1)
  })
})

describe('PathChoice compact', () => {
  it('renders both cards without stealing focus', () => {
    fake()
    renderChoose({ compact: true })
    expect(screen.getByTestId('path-choice').getAttribute('data-variant')).toBe('compact')
    expect(document.activeElement).not.toBe(preloaded())
  })
})

describe('resolvePreloadedDungeon', () => {
  it('picks the public demo from listDungeons and never calls POST /demo/session while a session exists', async () => {
    const api = fake()
    const res = await resolvePreloadedDungeon(api, { hasSession: true })
    expect(res.dungeonId).toBe('demo-dungeon')
    expect(res.session).toBeUndefined()
    expect(api.startDemoSession).not.toHaveBeenCalled()
  })

  it('never calls POST /demo/session when a session exists, even if nothing resolves', async () => {
    const api = fake({ listDungeons: vi.fn(() => Promise.reject(new ApiError(500, 'x'))) })
    await expect(resolvePreloadedDungeon(api, { hasSession: true })).rejects.toBeInstanceOf(NoPreloadedError)
    expect(api.startDemoSession).not.toHaveBeenCalled()
  })

  it('calls POST /demo/session only after listDungeons found nothing and there is no session', async () => {
    const api = fake({ listDungeons: vi.fn(() => Promise.resolve([])) })
    const res = await resolvePreloadedDungeon(api, { hasSession: false })
    expect(api.listDungeons).toHaveBeenCalledTimes(1)
    expect(api.startDemoSession).toHaveBeenCalledTimes(1)
    expect(res.session?.dungeon_id).toBe('demo-dungeon')
  })

  it('fails with NoPreloadedError when the demo session fails too', async () => {
    const api = fake({ listDungeons: vi.fn(() => Promise.resolve([])), startDemoSession: vi.fn(() => Promise.reject(new ApiError(503, 'x'))) })
    await expect(resolvePreloadedDungeon(api, { hasSession: false })).rejects.toBeInstanceOf(NoPreloadedError)
  })
})
