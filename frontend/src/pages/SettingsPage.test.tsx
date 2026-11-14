import { useEffect, type ReactNode } from 'react'
import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { ApiClient } from '@/api'
import type { User } from '@/types/api'

const h = vi.hoisted(() => ({ api: null as unknown }))
vi.mock('@/api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/api')>()
  return { ...actual, getApi: () => Promise.resolve(h.api as ApiClient) }
})

import { SessionProvider, useSession } from '@/state/SessionContext'
import SettingsPage from './SettingsPage'

function Seed({ user, children }: { user: User; children: ReactNode }) {
  const { setUser } = useSession()
  useEffect(() => setUser(user), [user, setUser])
  return <>{children}</>
}

function renderPage(user: User, deleteAccount = vi.fn().mockResolvedValue(undefined)) {
  h.api = { deleteAccount, logout: vi.fn().mockResolvedValue(undefined) }
  render(
    <MemoryRouter initialEntries={['/settings']}>
      <SessionProvider>
        <Seed user={user}>
          <Routes>
            <Route path="/" element={<p>title screen</p>} />
            <Route path="/settings" element={<SettingsPage />} />
          </Routes>
        </Seed>
      </SessionProvider>
    </MemoryRouter>,
  )
  return { deleteAccount }
}

afterEach(cleanup)

describe('SettingsPage', () => {
  it('shows the handle and never the internal guest username', async () => {
    renderPage({ id: 'u1', username: 'guest_ab12cd34', is_guest: true, display_name: 'Moss', tag: '4821' })
    expect((await screen.findByTestId('settings-handle')).textContent).toContain('Moss#4821')
    expect(document.body.textContent).not.toContain('guest_ab12cd34')
    expect(screen.queryByTestId('settings-username')).toBeNull()
    expect(screen.queryByTestId('settings-logout')).toBeNull()
  })

  it('shows the login name labelled private for a registered user, and a Log out button', async () => {
    renderPage({ id: 'u2', username: 'sam', is_guest: false })
    expect((await screen.findByTestId('settings-username')).textContent).toMatch(/sam.*private/)
    expect(screen.getByTestId('settings-motion').textContent).toMatch(/device setting/)
    await userEvent.click(screen.getByTestId('settings-logout'))
    expect(await screen.findByText('title screen')).toBeTruthy()
  })

  it('opens the delete dialog and deletes after typing DELETE', async () => {
    const { deleteAccount } = renderPage({ id: 'u2', username: 'sam', is_guest: false })
    await userEvent.click(await screen.findByRole('button', { name: 'Delete my account and data' }))
    expect(screen.getByRole('alertdialog')).toBeTruthy()
    await userEvent.type(screen.getByLabelText(/Type DELETE/), 'DELETE')
    await userEvent.click(screen.getByTestId('delete-confirm-button'))
    expect(await screen.findByText('title screen')).toBeTruthy()
    expect(deleteAccount).toHaveBeenCalledTimes(1)
  })
})
