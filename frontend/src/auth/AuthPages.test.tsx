import { act, cleanup, render, renderHook, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { ApiClient } from '@/api/ApiClient'

const h = vi.hoisted(() => ({ api: null as unknown }))
vi.mock('@/api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/api')>()
  return { ...actual, getApi: () => Promise.resolve(h.api as ApiClient) }
})

import { createMockAdapter } from '@/api/mock/mockAdapter'
import { SessionProvider, useSession } from '@/state/SessionContext'
import LoginPage from './LoginPage'
import RegisterPage from './RegisterPage'
import { useRetryAfter } from './useRetryAfter'

const PW = 'correct-horse-9'

function Where() {
  const { pathname } = useLocation()
  const { user } = useSession()
  return (
    <p data-testid="where">
      {pathname}|{user?.username ?? 'none'}
    </p>
  )
}

function renderAt(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <SessionProvider>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />
          <Route path="/dashboard" element={<p>dashboard page</p>} />
          <Route path="/" element={<p>home</p>} />
        </Routes>
        <Where />
      </SessionProvider>
    </MemoryRouter>,
  )
}

beforeEach(() => {
  h.api = createMockAdapter()
  localStorage.clear()
  sessionStorage.clear()
})
afterEach(() => cleanup())

const username = () => screen.getByLabelText('Username') as HTMLInputElement
const password = () => screen.getByLabelText('Password') as HTMLInputElement

describe('Register screen', () => {
  it('has exactly two fields and a show/hide password control', async () => {
    const user = userEvent.setup()
    const { container } = renderAt('/register')
    expect(container.querySelectorAll('input')).toHaveLength(2)
    expect(password().type).toBe('password')
    await user.click(screen.getByRole('button', { name: 'Show password' }))
    expect(password().type).toBe('text')
    await user.click(screen.getByRole('button', { name: 'Hide password' }))
    expect(password().type).toBe('password')
  })

  it('shows a specific message next to each field and does not call the server', async () => {
    const user = userEvent.setup()
    const spy = vi.spyOn(h.api as ApiClient, 'register')
    renderAt('/register')
    await user.type(username(), 'ab')
    await user.type(password(), 'short')
    await user.click(screen.getByRole('button', { name: 'Create account' }))
    expect(screen.getByText('Use at least 3 characters.')).toBeTruthy()
    expect(screen.getAllByText('Use at least 8 characters.').length).toBeGreaterThan(0)
    expect(username().getAttribute('aria-invalid')).toBe('true')
    expect(spy).not.toHaveBeenCalled()
  })

  it('refuses reserved names and odd characters with their own messages', async () => {
    const user = userEvent.setup()
    renderAt('/register')
    await user.type(username(), 'guest_zed')
    await user.type(password(), PW)
    await user.click(screen.getByRole('button', { name: 'Create account' }))
    expect(screen.getByText(/reserved/)).toBeTruthy()
    await user.clear(username())
    await user.type(username(), 'bad name!')
    await user.click(screen.getByRole('button', { name: 'Create account' }))
    expect(screen.getByText('Use only letters, digits and underscores.')).toBeTruthy()
  })

  it('on success goes to the Dashboard with the new user, and browser storage stays empty', async () => {
    const user = userEvent.setup()
    renderAt('/register')
    await user.type(username(), 'Ghost_Hunter')
    await user.type(password(), PW)
    await user.click(screen.getByRole('button', { name: 'Create account' }))
    expect(await screen.findByText('dashboard page')).toBeTruthy()
    expect(screen.getByTestId('where').textContent).toBe('/dashboard|ghost_hunter')
    expect(localStorage.length).toBe(0)
    expect(sessionStorage.length).toBe(0)
  })

  it('409 puts a friendly message next to the username and in the status area', async () => {
    const user = userEvent.setup()
    renderAt('/register')
    await user.type(username(), 'taken_name')
    await user.type(password(), PW)
    await user.click(screen.getByRole('button', { name: 'Create account' }))
    expect(await screen.findByText('That username is already taken.')).toBeTruthy()
    expect(screen.getByText('That username is already taken. Try another one.')).toBeTruthy()
  })

  it('422 from the server (array detail) shows the field message without the "Value error" prefix', async () => {
    const user = userEvent.setup()
    // Skip the client hints to reach the server rule: "system_x" passes the client check only if not reserved.
    ;(h.api as ApiClient).register = async () => {
      const { ApiError } = await import('@/api/errors')
      throw new ApiError(422, 'x', 'VALIDATION_ERROR', {
        fields: [{ field: 'username', message: "Value error, Usernames starting with 'guest_' are reserved" }],
      })
    }
    renderAt('/register')
    await user.type(username(), 'fine_name')
    await user.type(password(), PW)
    await user.click(screen.getByRole('button', { name: 'Create account' }))
    expect(await screen.findByText("Usernames starting with 'guest_' are reserved.")).toBeTruthy()
  })

  it('5xx shows a friendly server message', async () => {
    const user = userEvent.setup()
    renderAt('/register')
    await user.type(username(), 'servererror')
    await user.type(password(), PW)
    await user.click(screen.getByRole('button', { name: 'Create account' }))
    expect(await screen.findByText(/dungeon server stumbled/)).toBeTruthy()
  })

  it('429 disables submit for the Retry-After seconds', async () => {
    const user = userEvent.setup()
    renderAt('/register')
    await user.type(username(), 'ratelimit')
    await user.type(password(), PW)
    await user.click(screen.getByRole('button', { name: 'Create account' }))
    const wait = await screen.findByRole('button', { name: 'Wait 5s' })
    expect((wait as HTMLButtonElement).disabled).toBe(true)
    expect(screen.getByText(/Try again in 5 seconds/)).toBeTruthy()
  })

  it('links to the Login screen', () => {
    renderAt('/register')
    expect(screen.getByRole('link', { name: 'Log in' }).getAttribute('href')).toBe('/login')
  })
})

describe('Login screen', () => {
  it('only needs non-empty fields (no length rule), and says what is missing', async () => {
    const user = userEvent.setup()
    const spy = vi.spyOn(h.api as ApiClient, 'login')
    renderAt('/login')
    await user.click(screen.getByRole('button', { name: 'Log in' }))
    expect(screen.getByText('Enter a username.')).toBeTruthy()
    expect(spy).not.toHaveBeenCalled()
    await user.type(username(), 'x')
    await user.click(screen.getByRole('button', { name: 'Log in' }))
    expect(screen.getByText('Enter a password.')).toBeTruthy()
    expect(spy).not.toHaveBeenCalled()
  })

  it('401 shows a friendly message', async () => {
    const user = userEvent.setup()
    renderAt('/login')
    await user.type(username(), 'nobody')
    await user.type(password(), 'x')
    await user.click(screen.getByRole('button', { name: 'Log in' }))
    expect(await screen.findByText('That username or password is not right.')).toBeTruthy()
  })

  it('a registered user can log in with a short old password; storage stays empty after login', async () => {
    const user = userEvent.setup()
    const api = createMockAdapter()
    await api.register({ username: 'oldtimer', password: PW })
    h.api = api
    renderAt('/login')
    await user.type(username(), 'OldTimer')
    await user.type(password(), PW)
    await user.click(screen.getByRole('button', { name: 'Log in' }))
    expect(await screen.findByText('dashboard page')).toBeTruthy()
    expect(screen.getByTestId('where').textContent).toBe('/dashboard|oldtimer')
    expect(localStorage.length).toBe(0)
    expect(sessionStorage.length).toBe(0)
  })

  it('links to the Register screen', () => {
    renderAt('/login')
    expect(screen.getByRole('link', { name: 'Create one' }).getAttribute('href')).toBe('/register')
  })
})

describe('SessionContext getMe on load', () => {
  it('restores the signed-in user from the cookie session', async () => {
    const api = createMockAdapter()
    await api.register({ username: 'returning', password: PW })
    h.api = api
    renderAt('/login')
    await waitFor(() => expect(screen.getByTestId('where').textContent).toBe('/login|returning'))
  })

  it('stays signed out when there is no session or the call fails', async () => {
    h.api = { getMe: () => Promise.reject(new Error('asleep')) }
    renderAt('/login')
    await new Promise((r) => setTimeout(r, 20))
    expect(screen.getByTestId('where').textContent).toBe('/login|none')
  })
})

describe('useRetryAfter', () => {
  it('counts down once per second to zero', () => {
    vi.useFakeTimers()
    try {
      const { result } = renderHook(() => useRetryAfter())
      act(() => result.current.start(3))
      expect(result.current.remaining).toBe(3)
      act(() => {
        vi.advanceTimersByTime(1000)
      })
      expect(result.current.remaining).toBe(2)
      act(() => {
        vi.advanceTimersByTime(5000)
      })
      expect(result.current.remaining).toBe(0)
    } finally {
      vi.useRealTimers()
    }
  })
})
