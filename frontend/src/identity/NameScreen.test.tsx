import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const h = vi.hoisted(() => ({ api: null as unknown, createOffline: null as unknown as (...a: unknown[]) => unknown }))
vi.mock('@/api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/api')>()
  return { ...actual, getApi: () => (actual.isApiOverridden() ? actual.getApi() : Promise.resolve(h.api as never)) }
})
vi.mock('@/offline', () => ({ createOfflineAdapter: (...a: unknown[]) => h.createOffline(...a) }))

import { ApiError, isApiOverridden, setApiOverride } from '@/api'
import { SessionProvider } from '@/state/SessionContext'
import type { CreateGuestResponse, NameCheckResult, User } from '@/types/api'
import NameScreen, { NAME_CHECK_DEBOUNCE_MS, PUBLIC_NOTICE } from './NameScreen'
import { checkLocalName } from './nameRules'
import { OFFLINE_OFFER_MS, WAKE_MAX_MS } from './wakeConstants'

const user: User = { id: 'u1', username: '', is_guest: true, handle: 'Hollow Raven#1234' }
const created: CreateGuestResponse = { user, notice_version: '1' }

interface FakeApi {
  createGuest: ReturnType<typeof vi.fn>
  checkGuestName: ReturnType<typeof vi.fn>
  getMe: ReturnType<typeof vi.fn>
  warmUp: ReturnType<typeof vi.fn>
  startDemoSession: ReturnType<typeof vi.fn>
  capabilities?: { guestIdentity?: boolean }
}

function setup(over: Partial<FakeApi> = {}) {
  const api: FakeApi = {
    createGuest: vi.fn(() => new Promise(() => {})),
    checkGuestName: vi.fn((): Promise<NameCheckResult> => Promise.resolve({ ok: true })),
    getMe: vi.fn(() => Promise.resolve(null)),
    warmUp: vi.fn(() => Promise.resolve()),
    startDemoSession: vi.fn(() => new Promise(() => {})),
    ...over,
  }
  h.api = api
  const events = userEvent.setup({ delay: null })
  render(
    <MemoryRouter initialEntries={['/play-as-guest']}>
      <SessionProvider>
        <Routes>
          <Route path="/play-as-guest" element={<NameScreen />} />
          <Route path="/choose" element={<p data-testid="choose">choose</p>} />
          <Route path="/campaign/:id" element={<p data-testid="campaign">campaign</p>} />
        </Routes>
      </SessionProvider>
    </MemoryRouter>,
  )
  return { api, events }
}

const input = () => screen.getByLabelText('Display name') as HTMLInputElement
const accept = () => screen.getByRole('button', { name: 'Accept and continue' }) as HTMLButtonElement
const tick = (ms: number) => act(async () => void (await vi.advanceTimersByTimeAsync(ms)))

function type(value: string) {
  fireEvent.change(input(), { target: { value } })
}

beforeEach(() => {
  vi.useFakeTimers()
  h.createOffline = vi.fn(() => ({ startDemoSession: () => Promise.resolve({}) }))
})
afterEach(() => {
  vi.useRealTimers()
  setApiOverride(null)
  cleanup()
})

describe('NameScreen form', () => {
  it('prefills a spooky name that passes the local rules, and warms the server up once', async () => {
    const { api } = setup()
    await tick(0)
    expect(input().value).not.toBe('')
    expect(checkLocalName(input().value).ok).toBe(true)
    expect(accept().disabled).toBe(false)
    expect(api.warmUp).toHaveBeenCalledTimes(1)
  })

  it('Roll another replaces the name with a different one', async () => {
    vi.useRealTimers() // user-event needs a real clock
    const { events } = setup()
    for (let i = 0; i < 5; i++) {
      const before = input().value
      await events.click(screen.getByRole('button', { name: 'Roll another' }))
      expect(input().value).not.toBe(before)
    }
  })

  it('has no checkbox and the notice sits directly above the primary button', () => {
    setup()
    expect(screen.queryAllByRole('checkbox')).toHaveLength(0)
    expect(document.querySelector('input[type="checkbox"]')).toBeNull()
    const notice = screen.getByText(PUBLIC_NOTICE).parentElement as HTMLElement
    expect(notice.nextElementSibling).toBe(accept())
    expect(PUBLIC_NOTICE).toBe('Your name and points appear on the public leaderboard.')
  })

  it('the button submits once with accept_public_notice true', async () => {
    vi.useRealTimers() // user-event needs a real clock
    const { api, events } = setup()
    type('Hollow Raven')
    await events.click(accept())
    await events.click(screen.getByRole('button', { name: 'Opening the gates...' }))
    expect(api.createGuest).toHaveBeenCalledTimes(1)
    expect(api.createGuest).toHaveBeenCalledWith({ display_name: 'Hollow Raven', accept_public_notice: true })
  })

  it('Enter in the field submits once', async () => {
    vi.useRealTimers() // user-event needs a real clock
    const { api, events } = setup()
    type('Velvet Moth')
    await events.click(input())
    await events.keyboard('{Enter}{Enter}')
    expect(api.createGuest).toHaveBeenCalledTimes(1)
    expect(api.createGuest).toHaveBeenCalledWith({ display_name: 'Velvet Moth', accept_public_notice: true })
  })

  it('a broken local rule shows an alert hint tied to the field and disables the button', () => {
    setup()
    type('ab')
    const alert = screen.getByRole('alert')
    expect(alert.textContent).toBe('Use at least 3 characters.')
    expect(input().getAttribute('aria-describedby')).toContain(alert.id)
    expect(accept().disabled).toBe(true)
  })

  it('checks the name on the server after 500 ms, only when it changed and the local rules pass', async () => {
    const { api } = setup()
    await tick(NAME_CHECK_DEBOUNCE_MS - 1)
    expect(api.checkGuestName).not.toHaveBeenCalled()
    await tick(1)
    expect(api.checkGuestName).toHaveBeenCalledTimes(1)
    type('Pale Lantern')
    await tick(300)
    type('Pale Lantern2')
    await tick(NAME_CHECK_DEBOUNCE_MS)
    expect(api.checkGuestName).toHaveBeenCalledTimes(2)
    expect(api.checkGuestName).toHaveBeenLastCalledWith('Pale Lantern2')
    type('xy') // local rules fail: no check
    await tick(2000)
    expect(api.checkGuestName).toHaveBeenCalledTimes(2)
  })

  it('ok:false from the check shows the reason message and disables the button', async () => {
    const checkGuestName = vi.fn(() => Promise.resolve({ ok: false, reason: 'not_allowed' as const }))
    setup({ checkGuestName })
    await tick(NAME_CHECK_DEBOUNCE_MS)
    expect(screen.getByRole('alert').textContent).toBe('That name is not available. Try another.')
    expect(accept().disabled).toBe(true)
  })

  it('a check error turns live checks off for the page and keeps the button enabled', async () => {
    const checkGuestName = vi.fn(() => Promise.reject(new ApiError(429, 'slow', 'RATE_LIMIT_EXCEEDED')))
    setup({ checkGuestName })
    await tick(NAME_CHECK_DEBOUNCE_MS)
    expect(checkGuestName).toHaveBeenCalledTimes(1)
    type('Gloomy Ghoul')
    await tick(3000)
    expect(checkGuestName).toHaveBeenCalledTimes(1)
    expect(accept().disabled).toBe(false)
  })
})

describe('NameScreen submit outcomes', () => {
  it('success goes to /choose', async () => {
    setup({ createGuest: vi.fn(() => Promise.resolve(created)) })
    fireEvent.click(accept())
    await tick(0)
    expect(screen.getByTestId('choose')).toBeTruthy()
  })

  it('NAME_INVALID keeps the entered value and shows the reason message', async () => {
    setup({ createGuest: vi.fn(() => Promise.reject(new ApiError(422, 'bad', 'NAME_INVALID', { reason: 'too_long' }))) })
    type('Hollow Raven')
    fireEvent.click(accept())
    await tick(0)
    expect(screen.getByTestId('create-error').textContent).toBe('Names can have at most 16 characters.')
    expect(input().value).toBe('Hollow Raven')
  })

  it('429 shows the wait time', async () => {
    setup({ createGuest: vi.fn(() => Promise.reject(new ApiError(429, 'slow', undefined, { retryAfter: '45' }))) })
    fireEvent.click(accept())
    await tick(0)
    expect(screen.getByTestId('create-error').textContent).toContain('45 seconds')
  })

  it('503 shows the message and an offline button that does nothing until clicked', async () => {
    setup({ createGuest: vi.fn(() => Promise.reject(new ApiError(503, 'paused', 'GUEST_CREATION_PAUSED'))) })
    fireEvent.click(accept())
    await tick(0)
    expect(screen.getByTestId('create-error').textContent).toContain('The dungeon is full for this hour')
    await tick(WAKE_MAX_MS)
    expect(h.createOffline).not.toHaveBeenCalled()
    expect(isApiOverridden()).toBe(false)
    expect(screen.getByRole('button', { name: 'Play offline demo' })).toBeTruthy()
  })

  it('409 SESSION_EXISTS recovers through getMe and goes to /choose', async () => {
    let conflict = false
    setup({
      createGuest: vi.fn(() => {
        conflict = true
        return Promise.reject(new ApiError(409, 'exists', 'SESSION_EXISTS'))
      }),
      // The mount checks see no session; the recovery after the 409 finds one.
      getMe: vi.fn(() => Promise.resolve(conflict ? { user, expires_at: null } : null)),
    })
    await tick(0)
    fireEvent.click(accept())
    await tick(0)
    expect(screen.getByTestId('choose')).toBeTruthy()
  })

  it('redirects to /choose without the form when a session already exists', async () => {
    setup({ getMe: vi.fn(() => Promise.resolve({ user, expires_at: null })) })
    await tick(0)
    expect(screen.getByTestId('choose')).toBeTruthy()
    expect(screen.queryByLabelText('Display name')).toBeNull()
  })
})

describe('NameScreen waking flow', () => {
  it('shows the two choices at 8 s; Keep waiting runs to 60 s, then Retry and the offline choice; offline never starts alone', async () => {
    const { api } = setup()
    fireEvent.click(accept())
    await tick(OFFLINE_OFFER_MS - 1)
    expect(screen.queryByTestId('waking-up')).toBeNull()
    await tick(1)
    expect(screen.getByTestId('waking-up')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Keep waiting' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Play offline demo' })).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Keep waiting' }))
    await tick(WAKE_MAX_MS - OFFLINE_OFFER_MS)
    expect(screen.getByTestId('waking-timeout').textContent).toContain(
      'The dungeon is taking a long time to wake. You can try again or play the offline demo.',
    )
    expect(screen.getByRole('button', { name: 'Retry' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Play offline demo' })).toBeTruthy()
    expect(h.createOffline).not.toHaveBeenCalled()
    expect(isApiOverridden()).toBe(false)
    fireEvent.click(screen.getByRole('button', { name: 'Retry' }))
    await tick(0)
    expect(api.createGuest).toHaveBeenCalledTimes(2)
  })

  it('a success while the choices are shown continues to /choose', async () => {
    let resolve!: (v: CreateGuestResponse) => void
    setup({ createGuest: vi.fn(() => new Promise<CreateGuestResponse>((r) => (resolve = r))) })
    fireEvent.click(accept())
    await tick(OFFLINE_OFFER_MS)
    expect(screen.getByRole('button', { name: 'Keep waiting' })).toBeTruthy()
    await act(async () => {
      resolve(created)
      await vi.advanceTimersByTimeAsync(0)
    })
    expect(screen.getByTestId('choose')).toBeTruthy()
    expect(h.createOffline).not.toHaveBeenCalled()
  })

  it('Play offline demo loads the offline adapter only on the click', async () => {
    h.createOffline = vi.fn(() => ({ startDemoSession: () => Promise.resolve({ user, dungeon_id: 'demo-dungeon', expires_at: 'x' }) }))
    setup()
    fireEvent.click(accept())
    await tick(OFFLINE_OFFER_MS)
    expect(h.createOffline).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole('button', { name: 'Play offline demo' }))
    await tick(50)
    expect(h.createOffline).toHaveBeenCalledTimes(1)
    expect(screen.getByTestId('campaign')).toBeTruthy()
  })

  it('guestIdentity off: names are not available, and the button starts the legacy demo session', async () => {
    const { api } = setup({ capabilities: { guestIdentity: false } })
    await tick(0)
    fireEvent.click(screen.getByRole('button', { name: 'Start the demo' }))
    await tick(0)
    expect(api.createGuest).not.toHaveBeenCalled()
    expect(api.startDemoSession).toHaveBeenCalledTimes(1)
  })
})
