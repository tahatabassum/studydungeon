/**
 * Session restore after a reload: the SessionContext asks getMe, and a player who already has a session is sent
 * from the Name_Screen to /choose without creating another guest (Req 2.x, 5.x; D12).
 * **Validates: Requirements 2.19, 3.2**
 */
import { cleanup, render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { setApiOverride } from '@/api'
import type { ApiClient } from '@/api/ApiClient'
import { SessionProvider, useSession } from '@/state/SessionContext'
import type { User } from '@/types/api'
import NameScreen from './NameScreen'

const user: User = { id: 'u1', username: '', is_guest: true, handle: 'Hollow Raven#1234' }

/** Mounts the Name_Screen only after the restore settled, like a visit that comes after the reload. */
function AfterRestore() {
  const { restoring, user: who } = useSession()
  if (restoring) return <p data-testid="restoring">restoring</p>
  return (
    <>
      <p data-testid="who">{who?.handle ?? 'nobody'}</p>
      <NameScreen />
    </>
  )
}

function renderApp() {
  render(
    <MemoryRouter initialEntries={['/play-as-guest']}>
      <SessionProvider>
        <Routes>
          <Route path="/play-as-guest" element={<AfterRestore />} />
          <Route path="/choose" element={<p data-testid="choose">choose</p>} />
        </Routes>
      </SessionProvider>
    </MemoryRouter>,
  )
}

afterEach(() => {
  cleanup()
  setApiOverride(null)
})

describe('session restore through SessionContext', () => {
  it('restores the guest with getMe and the Name_Screen goes to /choose without createGuest', async () => {
    const createGuest = vi.fn()
    const getMe = vi.fn(() => Promise.resolve({ user, expires_at: null }))
    setApiOverride({ getMe, createGuest, warmUp: vi.fn() } as unknown as ApiClient)
    renderApp()
    expect(await screen.findByTestId('choose')).toBeTruthy()
    expect(getMe).toHaveBeenCalled()
    expect(createGuest).not.toHaveBeenCalled()
  })

  it('with no session the Name_Screen stays and getMe answered null', async () => {
    const getMe = vi.fn(() => Promise.resolve(null))
    setApiOverride({ getMe, createGuest: vi.fn(), checkGuestName: vi.fn(), warmUp: vi.fn() } as unknown as ApiClient)
    renderApp()
    expect((await screen.findByTestId('who')).textContent).toBe('nobody')
    expect(screen.queryByTestId('choose')).toBeNull()
  })
})
