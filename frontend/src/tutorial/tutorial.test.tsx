import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const rm = vi.hoisted(() => ({ reduced: false, start: vi.fn() }))
vi.mock('framer-motion', async (importOriginal) => {
  const actual = await importOriginal<typeof import('framer-motion')>()
  return { ...actual, useReducedMotion: () => rm.reduced }
})
vi.mock('phaser', () => ({ default: {} }))
vi.mock('../state/useStartDemo', () => ({
  useStartDemo: () => ({ start: rm.start, pending: false, error: null, offerOffline: false, chooseOffline: vi.fn() }),
}))

import LandingPage from '../pages/LandingPage'
import { SessionProvider } from '../state/SessionContext'
import { INTRO_FLAG_KEY, TUTORIAL_FLAG_KEY } from '../lore/intro'
import { TUTORIAL_STEPS } from './steps'
import { TutorialFlow } from './TutorialFlow'
import { hasSeenTutorial, markTutorialSeen, needsFirstRun } from './tutorialFlag'

beforeEach(() => {
  localStorage.removeItem(INTRO_FLAG_KEY)
  localStorage.removeItem(TUTORIAL_FLAG_KEY)
  rm.start.mockClear()
})
afterEach(() => {
  cleanup()
  rm.reduced = false
})

describe('tutorial flag', () => {
  it('writes both keys and nothing else', () => {
    expect(needsFirstRun()).toBe(true)
    markTutorialSeen()
    expect(localStorage.getItem('sd.tutorialSeen')).toBe('1')
    expect(localStorage.getItem('sd.introSeen')).toBe('1')
    expect(hasSeenTutorial()).toBe(true)
    expect(needsFirstRun()).toBe(false)
  })
})

describe('TutorialFlow', () => {
  it('has the five steps in order', () => {
    expect(TUTORIAL_STEPS.map((s) => s.id)).toEqual(['move', 'engage', 'answer', 'scroll', 'haunt'])
  })

  it('plays the whole flow by keyboard: intro, move, engage, answer, scroll, Daily Haunt', async () => {
    const user = userEvent.setup()
    const onDone = vi.fn()
    render(<TutorialFlow onDone={onDone} includeIntro />)
    expect(screen.getByTestId('intro-story')).toBeTruthy()
    // Four intro cards: Enter on the focused Next button.
    for (let i = 0; i < 4; i++) await user.keyboard('{Enter}')
    expect(localStorage.getItem('sd.introSeen')).toBe('1')
    expect(screen.getByTestId('tutorial').getAttribute('data-step')).toBe('move')
    expect(screen.getByTestId('tutorial-count').textContent).toBe('Step 1 of 5')
    // Move with arrows and WASD (three moves reach the monster).
    await user.keyboard('{ArrowRight}')
    expect(screen.getByTestId('tutorial-live').textContent).toContain('more to go')
    await user.keyboard('d')
    await user.keyboard('{ArrowRight}')
    expect(screen.getByTestId('tutorial').getAttribute('data-step')).toBe('engage')
    // Engage with E.
    await user.keyboard('e')
    expect(screen.getByTestId('tutorial').getAttribute('data-step')).toBe('answer')
    // Answer with a number key (a wrong answer), then the memory scroll.
    await user.keyboard('2')
    expect(screen.getByTestId('tutorial-live').textContent).toMatch(/Not quite/)
    await user.click(screen.getByRole('button', { name: 'Next' }))
    expect(screen.getByTestId('memory-scroll')).toBeTruthy()
    await user.click(screen.getByRole('button', { name: 'Continue' }))
    expect(screen.getByTestId('tutorial-haunt-note')).toBeTruthy()
    expect(onDone).not.toHaveBeenCalled()
    await user.click(screen.getByRole('button', { name: 'Start playing' }))
    expect(onDone).toHaveBeenCalledWith('finished')
    expect(hasSeenTutorial()).toBe(true)
  })

  it('can be skipped on every step with the button or Escape', async () => {
    const user = userEvent.setup()
    for (let skipAt = 0; skipAt < TUTORIAL_STEPS.length; skipAt++) {
      localStorage.removeItem(TUTORIAL_FLAG_KEY)
      const onDone = vi.fn()
      const { unmount } = render(<TutorialFlow onDone={onDone} includeIntro={false} />)
      for (let i = 0; i < skipAt; i++) {
        const id = screen.getByTestId('tutorial').getAttribute('data-step')
        if (id === 'move') await user.keyboard('{ArrowRight}{ArrowRight}{ArrowRight}')
        else if (id === 'engage') await user.keyboard('e')
        else if (id === 'answer') {
          await user.keyboard('1')
          await user.click(screen.getByRole('button', { name: 'Next' }))
        } else if (id === 'scroll') await user.click(screen.getByRole('button', { name: 'Continue' }))
      }
      expect(screen.getByTestId('tutorial').getAttribute('data-step')).toBe(TUTORIAL_STEPS[skipAt].id)
      if (skipAt % 2 === 0) await user.click(screen.getByRole('button', { name: 'Skip tutorial' }))
      else await user.keyboard('{Escape}')
      expect(onDone).toHaveBeenCalledWith('skipped')
      expect(hasSeenTutorial()).toBe(true)
      unmount()
    }
  })

  it('skipping the intro skips the whole first run', async () => {
    const user = userEvent.setup()
    const onDone = vi.fn()
    render(<TutorialFlow onDone={onDone} includeIntro />)
    await user.click(screen.getByRole('button', { name: /Skip intro/ }))
    expect(onDone).toHaveBeenCalledWith('skipped')
    expect(needsFirstRun()).toBe(false)
  })

  it('reads instructions in a labelled dialog with a polite live region and is static under reduced motion', () => {
    rm.reduced = true
    render(<TutorialFlow onDone={() => {}} includeIntro={false} />)
    expect(screen.getByRole('dialog', { name: 'Move' })).toBeTruthy()
    expect(screen.getByRole('status').getAttribute('aria-live')).toBe('polite')
    expect(screen.getByTestId('tutorial').getAttribute('data-reduced')).toBe('true')
  })
})

describe('first run on the landing page', () => {
  function renderLanding() {
    return render(
      <MemoryRouter>
        <SessionProvider>
          <Routes>
            <Route path="/" element={<LandingPage />} />
            <Route path="/play-as-guest" element={<p data-testid="name-screen-stub">Name</p>} />
          </Routes>
        </SessionProvider>
      </MemoryRouter>,
    )
  }

  it('never opens the intro or tutorial on its own: Try the Demo goes straight to the Name_Screen', async () => {
    const user = userEvent.setup()
    renderLanding()
    expect(screen.queryByTestId('tutorial')).toBeNull()
    await user.click(screen.getByRole('button', { name: 'Try the Demo' }))
    expect(screen.queryByTestId('intro-story')).toBeNull()
    expect(screen.queryByTestId('tutorial')).toBeNull()
    expect(rm.start).not.toHaveBeenCalled()
    expect(screen.getByTestId('name-screen-stub')).toBeTruthy()
    expect(localStorage.getItem(INTRO_FLAG_KEY)).toBeNull()
    expect(localStorage.getItem(TUTORIAL_FLAG_KEY)).toBeNull()
  })
  it('replays the tutorial on request without starting a run', async () => {
    const user = userEvent.setup()
    markTutorialSeen()
    renderLanding()
    await user.click(screen.getByRole('button', { name: /How to play/ }))
    expect(screen.getByTestId('tutorial')).toBeTruthy()
    await user.click(screen.getByRole('button', { name: 'Skip tutorial' }))
    expect(screen.queryByTestId('tutorial')).toBeNull()
    expect(rm.start).not.toHaveBeenCalled()
  })
})
