import { act, cleanup, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, describe, expect, it, vi } from 'vitest'

const rm = vi.hoisted(() => ({ reduced: false }))
vi.mock('framer-motion', async (importOriginal) => {
  const actual = await importOriginal<typeof import('framer-motion')>()
  return { ...actual, useReducedMotion: () => rm.reduced }
})
vi.mock('phaser', () => ({ default: {} }))

import { setApiOverride } from '@/api'
import type { ApiClient } from '@/api/ApiClient'
import mockAdapter from '@/api/mock/mockAdapter'
import { SessionProvider } from '@/state/SessionContext'
import LandingPage from './LandingPage'

function renderPage() {
  return render(
    <MemoryRouter>
      <SessionProvider>
        <Routes>
          <Route path="/" element={<LandingPage />} />
          <Route path="/play-as-guest" element={<p data-testid="name-screen-stub">Name</p>} />
          <Route path="/login" element={<p data-testid="login-stub">Login</p>} />
        </Routes>
      </SessionProvider>
    </MemoryRouter>,
  )
}

afterEach(() => {
  cleanup()
  setApiOverride(null)
  vi.restoreAllMocks()
  rm.reduced = false
})

describe('LandingPage night sky', () => {
  it('shows the sky, moon, fog, flying bats, title and demo button', () => {
    const { container } = renderPage()
    expect(screen.getByTestId('landing-sky')).toBeTruthy()
    expect(container.querySelector('.sd-moon')).not.toBeNull()
    expect(container.querySelectorAll('.sd-fog').length).toBe(2)
    const bats = container.querySelectorAll('.sd-bat').length
    expect(bats).toBeGreaterThanOrEqual(5)
    expect(bats).toBeLessThanOrEqual(7)
    expect(container.querySelectorAll('.sd-bat--ltr').length).toBeGreaterThan(0)
    expect(container.querySelectorAll('.sd-bat--rtl').length).toBeGreaterThan(0)
    expect(screen.getByRole('heading', { level: 1 }).className).toContain('sd-title-flicker')
    expect(screen.getByRole('button', { name: 'Try the Demo' }).className).toContain('sd-pumpkin-btn')
  })

  it('uses no raster images', () => {
    const { container } = renderPage()
    expect(container.querySelectorAll('img').length).toBe(0)
  })

  it('offers the tutorial as a secondary button and pauses the sky when the tab is hidden', () => {
    const { container } = renderPage()
    expect(screen.getByRole('button', { name: /How to play/ }).className).toContain('sd-ghost-pill')
    const root = container.firstElementChild as HTMLElement
    expect(root.getAttribute('data-tab-hidden')).toBeNull()
    Object.defineProperty(document, 'hidden', { configurable: true, get: () => true })
    act(() => {
      document.dispatchEvent(new Event('visibilitychange'))
    })
    expect(root.getAttribute('data-tab-hidden')).toBe('true')
    Object.defineProperty(document, 'hidden', { configurable: true, get: () => false })
  })

  it('marks the page reduced so the sky is static', () => {
    rm.reduced = true
    const { container } = renderPage()
    expect(container.firstElementChild?.getAttribute('data-reduced')).toBe('true')
  })
})

describe('LandingPage entry', () => {
  it('Try the Demo opens the Name_Screen route and no intro or tutorial dialog appears', async () => {
    const user = userEvent.setup()
    renderPage()
    await user.click(screen.getByRole('button', { name: 'Try the Demo' }))
    expect(screen.getByTestId('name-screen-stub')).toBeTruthy()
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(screen.queryByTestId('intro-story')).toBeNull()
    expect(screen.queryByTestId('tutorial')).toBeNull()
  })

  it('the How to play pill opens the tutorial; Skip closes it in one action', async () => {
    const user = userEvent.setup()
    renderPage()
    await user.click(screen.getByRole('button', { name: /How to play/ }))
    expect(screen.getByTestId('tutorial')).toBeTruthy()
    await user.click(screen.getByRole('button', { name: 'Skip tutorial' }))
    expect(screen.queryByTestId('tutorial')).toBeNull()
  })

  it('Escape closes the tutorial in one action and navigation still works afterwards', async () => {
    const user = userEvent.setup()
    renderPage()
    await user.click(screen.getByRole('button', { name: /How to play/ }))
    await user.keyboard('{Escape}')
    expect(screen.queryByTestId('tutorial')).toBeNull()
    await user.click(screen.getByRole('button', { name: 'Login' }))
    expect(screen.getByTestId('login-stub')).toBeTruthy()
  })

  it('the Offline adapter has no warm-up, so nothing is sent while offline', async () => {
    const { createOfflineAdapter } = await import('@/offline')
    const offline = createOfflineAdapter({ now: () => 0 })
    const fetchSpy = vi.spyOn(globalThis, 'fetch')
    setApiOverride(offline)
    renderPage()
    await act(async () => {
      await Promise.resolve()
    })
    expect('warmUp' in offline).toBe(false)
    expect(fetchSpy).not.toHaveBeenCalled()
  })

  it('calls warmUp once on mount when the client has it', async () => {
    const warmUp = vi.fn(async () => {})
    setApiOverride({ warmUp } as unknown as ApiClient)
    renderPage()
    await waitFor(() => expect(warmUp).toHaveBeenCalledTimes(1))
  })

  it('sends nothing with the mock adapter (no warmUp, no fetch)', async () => {
    expect(mockAdapter.warmUp).toBeUndefined()
    const fetchSpy = vi.spyOn(globalThis, 'fetch')
    setApiOverride(mockAdapter)
    renderPage()
    await act(async () => {
      await Promise.resolve()
    })
    expect(fetchSpy).not.toHaveBeenCalled()
  })
})