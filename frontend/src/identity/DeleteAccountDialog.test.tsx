import { useEffect } from 'react'
import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { ApiClient } from '@/api'
import { ApiError } from '@/api/errors'
import { recordFinishedRun, getFinishedRuns, clearFinishedRuns } from '@/leaderboard/sessionRuns'

const h = vi.hoisted(() => ({ api: null as unknown }))
vi.mock('@/api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/api')>()
  return { ...actual, getApi: () => Promise.resolve(h.api as ApiClient) }
})

import { SessionProvider, useSession } from '@/state/SessionContext'
import { DeleteAccountDialog } from './DeleteAccountDialog'

function Probe() {
  const { user, setUser } = useSession()
  useEffect(() => {
    setUser({ id: 'u1', username: 'sam', is_guest: false })
  }, [setUser])
  return <p data-testid="who">{user ? 'in' : 'out'}</p>
}

function setup(deleteAccount: () => Promise<void>) {
  h.api = { deleteAccount }
  const onClose = vi.fn()
  render(
    <MemoryRouter initialEntries={['/settings']}>
      <SessionProvider>
        <Probe />
        <Routes>
          <Route path="/" element={<p>title screen</p>} />
          <Route path="/settings" element={<DeleteAccountDialog onClose={onClose} />} />
        </Routes>
      </SessionProvider>
    </MemoryRouter>,
  )
  return { onClose }
}

const confirmBtn = () => screen.getByTestId('delete-confirm-button') as HTMLButtonElement

beforeEach(() => {
  clearFinishedRuns()
  recordFinishedRun({ id: 'r1', dungeonId: 'd', score: 10, accuracy: 1, bestStreak: 1 } as never)
})
afterEach(() => {
  cleanup()
  clearFinishedRuns()
})

describe('DeleteAccountDialog', () => {
  it('lists what is removed and keeps confirm disabled until exactly DELETE is typed', async () => {
    setup(vi.fn().mockResolvedValue(undefined))
    expect(screen.getByTestId('delete-removes').textContent).toMatch(/Leaderboard points.*review schedule.*uploaded notes/s)
    expect(confirmBtn().disabled).toBe(true)
    const input = screen.getByLabelText(/Type DELETE/)
    for (const wrong of ['delete', 'DELETE ', 'DELET']) {
      await userEvent.clear(input)
      await userEvent.type(input, wrong)
      expect(confirmBtn().disabled).toBe(true)
    }
    await userEvent.clear(input)
    await userEvent.type(input, 'DELETE')
    expect(confirmBtn().disabled).toBe(false)
  })

  it('on success calls deleteAccount once, clears the session and caches and lands on /', async () => {
    const del = vi.fn().mockResolvedValue(undefined)
    setup(del)
    await userEvent.type(screen.getByLabelText(/Type DELETE/), 'DELETE')
    await userEvent.click(confirmBtn())
    expect(await screen.findByText('title screen')).toBeTruthy()
    expect(del).toHaveBeenCalledTimes(1)
    expect(screen.getByTestId('who').textContent).toBe('out')
    expect(getFinishedRuns()).toHaveLength(0)
  })

  it.each([
    [403, 'SYSTEM_USER_PROTECTED', /protected/],
    [422, 'CONFIRMATION_REQUIRED', /Type DELETE/],
  ])('%i %s shows the message and keeps the session', async (status, code, text) => {
    setup(vi.fn().mockRejectedValue(new ApiError(status, 'x', code)))
    await userEvent.type(screen.getByLabelText(/Type DELETE/), 'DELETE')
    await userEvent.click(confirmBtn())
    expect((await screen.findByTestId('delete-error')).textContent).toMatch(text)
    expect(screen.getByTestId('who').textContent).toBe('in')
    expect(getFinishedRuns()).toHaveLength(1)
  })

  it('a network error shows a friendly message and keeps the session', async () => {
    setup(vi.fn().mockRejectedValue(new ApiError(0, 'Failed to fetch')))
    await userEvent.type(screen.getByLabelText(/Type DELETE/), 'DELETE')
    await userEvent.click(confirmBtn())
    expect((await screen.findByTestId('delete-error')).textContent).toMatch(/Nothing was removed/)
    expect(screen.getByTestId('who').textContent).toBe('in')
  })

  it('401 is treated as signed out and opens /', async () => {
    setup(vi.fn().mockRejectedValue(new ApiError(401, 'no', 'UNAUTHORIZED')))
    await userEvent.type(screen.getByLabelText(/Type DELETE/), 'DELETE')
    await userEvent.click(confirmBtn())
    expect(await screen.findByText('title screen')).toBeTruthy()
    expect(screen.getByTestId('who').textContent).toBe('out')
  })

  it('Escape closes the dialog', async () => {
    const { onClose } = setup(vi.fn())
    await userEvent.keyboard('{Escape}')
    expect(onClose).toHaveBeenCalledTimes(1)
  })
})
