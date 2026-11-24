import { cleanup, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { Hero, type HeroProps } from './Hero'

vi.mock('../state/useReducedMotion', () => ({ useReducedMotion: vi.fn(() => false) }))
import { useReducedMotion } from '../state/useReducedMotion'

const base: HeroProps = {
  isGuest: false,
  displayName: 'Mina',
  progress: { level: 3, total_xp: 140, xp_to_next: 60 },
  progressStatus: 'ready',
  dungeonId: 'd1',
  dungeon: { status: 'ready', next: null },
  onPlayDemo: () => {},
  demoPending: false,
  onCreateAccount: () => {},
}

function setup(over: Partial<HeroProps> = {}) {
  return render(
    <MemoryRouter>
      <Hero {...base} {...over} />
    </MemoryRouter>,
  )
}

describe('Hero', () => {
  afterEach(cleanup)
  it('shows name, level and numeric XP for a player', () => {
    setup()
    expect(screen.getByText('Mina')).toBeTruthy()
    expect(screen.getAllByText(/Level 3/).length).toBeGreaterThan(0)
    expect(screen.getByText('140 / 200 XP')).toBeTruthy()
    expect(document.querySelectorAll('.sd-hero__cta')).toHaveLength(1)
  })

  it('guest sees demo and create-account actions', () => {
    setup({ isGuest: true, displayName: 'guest_x', progress: null })
    expect(screen.getByRole('button', { name: /Play the Demo/ })).toBeTruthy()
    expect(screen.getByRole('button', { name: /Create account/ })).toBeTruthy()
    expect(document.querySelectorAll('.sd-hero__cta')).toHaveLength(1)
  })

  it('renders a busy skeleton while the next room loads', () => {
    setup({ dungeon: { status: 'loading', next: null } })
    const el = screen.getByLabelText('Loading your next room')
    expect(el.getAttribute('aria-busy')).toBe('true')
  })

  it('marks decoration aria-hidden and reflects reduced motion', () => {
    vi.mocked(useReducedMotion).mockReturnValue(true)
    setup()
    const decor = screen.getByTestId('hero-decor')
    expect(decor.getAttribute('aria-hidden')).toBe('true')
    expect(decor.getAttribute('data-reduced')).toBe('true')
    expect(screen.getByTestId('dashboard-hero').getAttribute('data-reduced')).toBe('true')
    vi.mocked(useReducedMotion).mockReturnValue(false)
  })
})

