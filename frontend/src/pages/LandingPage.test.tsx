import { cleanup, render, screen } from '@testing-library/react'
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
  it('shows the sky, moon, fog, three bats, title and demo button', () => {
    const { container } = renderPage()
    expect(screen.getByTestId('landing-sky')).toBeTruthy()
    expect(container.querySelector('.sd-moon')).not.toBeNull()
    expect(container.querySelectorAll('.sd-fog').length).toBe(2)
    expect(container.querySelectorAll('.sd-bat').length).toBe(3)
    expect(screen.getByRole('heading', { level: 1 }).className).toContain('sd-title-flicker')
    expect(screen.getByRole('button', { name: 'Try the Demo' }).className).toContain('sd-pumpkin-btn')
  })

  it('uses no raster images', () => {
    const { container } = renderPage()
    expect(container.querySelectorAll('img').length).toBe(0)
  })

  it('marks the page reduced so the sky is static', () => {
    rm.reduced = true
    const { container } = renderPage()
    expect(container.firstElementChild?.getAttribute('data-reduced')).toBe('true')
  })
})
