import { act, cleanup, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, describe, expect, it, vi } from 'vitest'

const rm = vi.hoisted(() => ({ reduced: false }))
vi.mock('framer-motion', async (importOriginal) => {
  const actual = await importOriginal<typeof import('framer-motion')>()
  return { ...actual, useReducedMotion: () => rm.reduced }
})
vi.mock('phaser', () => ({ default: {} }))

import { SessionProvider } from '@/state/SessionContext'
import LandingPage from './LandingPage'

function renderPage() {
  return render(
    <MemoryRouter>
      <SessionProvider>
        <LandingPage />
      </SessionProvider>
    </MemoryRouter>,
  )
}

afterEach(() => {
  cleanup()
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
