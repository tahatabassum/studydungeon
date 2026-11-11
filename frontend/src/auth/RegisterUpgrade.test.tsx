import { useEffect, type ReactNode } from 'react'
import { cleanup, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { ApiClient } from '@/api/ApiClient'
import { ApiError } from '@/api/errors'

const h = vi.hoisted(() => ({ api: null as unknown }))
vi.mock('@/api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/api')>()
  return { ...actual, getApi: () => Promise.resolve(h.api as ApiClient) }
})

import { createMockAdapter } from '@/api/mock/mockAdapter'
import { SessionProvider, useSession } from '@/state/SessionContext'
import type { User } from '@/types/api'
import RegisterPage from './RegisterPage'

const PW = 'correct-horse-9'
const HEADING = 'Create an account to keep your name and points'

function Where() {
  const { pathname } = useLocation()
  const { user } = useSession()
  return (
    <p data-testid="where">
      {pathname}|{user?.handle ?? 'none'}|{user?.is_guest === false ? 'registered' : 'guest'}
    </p>
  )
}

function Seed({ user, children }: { user: User; children: ReactNode }) {
  const { setUser } = useSession()
  useEffect(() => setUser(user), [user, setUser])
  return <>{children}</>
}

function renderRegister(user: User | null) {
  const page = (
    <>
      <Routes>
        <Route path="/register" element={<RegisterPage />} />
        <Route path="/dashboard" element={<p>dashboard page</p>} />
      </Routes>
      <Where />
    </>
  )
  return render(
    <MemoryRouter initialEntries={['/register?upgrade=1']}>
      <SessionProvider>{user ? <Seed user={user}>{page}</Seed> : page}</SessionProvider>
    </MemoryRouter>,
  )
}

let adapter: ReturnType<typeof createMockAdapter>
let guest: User

beforeEach(async () => {
  adapter = createMockAdapter()
  const created = await adapter.createGuest({ display_name: 'Pale Moth', accept_public_notice: true })
  guest = created.user
  h.api = adapter
})
afterEach(() => cleanup())

async function fill(user: ReturnType<typeof userEvent.setup>, name: string) {
  await user.type(screen.getByLabelText('Username'), name)
  await user.type(screen.getByLabelText('Password'), PW)
}

describe('RegisterPage in upgrade mode', () => {
  it('shows the upgrade heading, calls upgradeGuest (not register), keeps the handle and goes to /dashboard', async () => {
    const upgrade = vi.spyOn(adapter, 'upgradeGuest')
    const register = vi.spyOn(adapter, 'register')
    const user = userEvent.setup()
    renderRegister(guest)
    expect(await screen.findByRole('heading', { name: HEADING })).toBeTruthy()
    await fill(user, 'pale_moth')
    await user.click(screen.getByRole('button', { name: 'Create account' }))
    expect(await screen.findByText('dashboard page')).toBeTruthy()
    expect(upgrade).toHaveBeenCalledTimes(1)
    expect(register).not.toHaveBeenCalled()
    expect(screen.getByTestId('where').textContent).toBe(`/dashboard|${guest.handle}|registered`)
  })

  it('shows a friendly USERNAME_TAKEN message', async () => {
    vi.spyOn(adapter, 'upgradeGuest').mockRejectedValue(new ApiError(409, 'taken', 'USERNAME_TAKEN'))
    const user = userEvent.setup()
    renderRegister(guest)
    await screen.findByRole('heading', { name: HEADING })
    await fill(user, 'taken_name')
    await user.click(screen.getByRole('button', { name: 'Create account' }))
    expect(await screen.findByText('That username is taken. Try another.')).toBeTruthy()
  })

  it('shows a friendly NOT_A_GUEST message', async () => {
    vi.spyOn(adapter, 'upgradeGuest').mockRejectedValue(new ApiError(403, 'no', 'NOT_A_GUEST'))
    const user = userEvent.setup()
    renderRegister(guest)
    await screen.findByRole('heading', { name: HEADING })
    await fill(user, 'some_name')
    await user.click(screen.getByRole('button', { name: 'Create account' }))
    expect(await screen.findByText('This account is already registered.')).toBeTruthy()
  })

  it('falls back to the normal register flow when the upgrade endpoint is missing', async () => {
    const off = { ...adapter, capabilities: { accountUpgrade: true as boolean } }
    off.upgradeGuest = async () => {
      off.capabilities.accountUpgrade = false
      throw new ApiError(404, 'missing')
    }
    h.api = off
    const user = userEvent.setup()
    renderRegister(guest)
    await screen.findByRole('heading', { name: HEADING })
    await fill(user, 'some_name')
    await user.click(screen.getByRole('button', { name: 'Create account' }))
    expect(await screen.findByText(/You can still create a new account below/)).toBeTruthy()
    await waitFor(() => expect(screen.getByRole('heading', { name: 'Join the haunt' })).toBeTruthy())
  })
})

describe('RegisterPage in normal mode', () => {
  it('uses register for a visitor without a session', async () => {
    adapter = createMockAdapter() // no guest cookie, so getMe answers null
    h.api = adapter
    const upgrade = vi.spyOn(adapter, 'upgradeGuest')
    const register = vi.spyOn(adapter, 'register')
    const user = userEvent.setup()
    renderRegister(null)
    expect(await screen.findByRole('heading', { name: 'Join the haunt' })).toBeTruthy()
    await fill(user, 'fresh_name')
    await user.click(screen.getByRole('button', { name: 'Create account' }))
    expect(await screen.findByText('dashboard page')).toBeTruthy()
    expect(register).toHaveBeenCalledTimes(1)
    expect(upgrade).not.toHaveBeenCalled()
  })

  it('keeps the normal heading for a registered user and for a guest when accountUpgrade is off', async () => {
    const registered: User = { id: 'r1', username: 'alice', is_guest: false }
    const { unmount } = renderRegister(registered)
    expect(await screen.findByRole('heading', { name: 'Join the haunt' })).toBeTruthy()
    unmount()
    h.api = { ...adapter, capabilities: { accountUpgrade: false } }
    renderRegister(guest)
    await new Promise((r) => setTimeout(r, 30))
    expect(screen.getByRole('heading', { name: 'Join the haunt' })).toBeTruthy()
    expect(screen.queryByRole('heading', { name: HEADING })).toBeNull()
  })
})
