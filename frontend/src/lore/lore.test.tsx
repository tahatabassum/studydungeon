import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { PORTRAIT_KINDS } from '../art/portraits/types'
import { linesFor } from '../encounter/lines'

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
import { hasSeenIntro, INTRO_CARDS, INTRO_FLAG_KEY, markIntroSeen, TUTORIAL_FLAG_KEY } from './intro'
import { IntroStory } from './IntroStory'

beforeEach(() => {
  localStorage.removeItem(INTRO_FLAG_KEY)
  rm.start.mockClear()
})
afterEach(() => {
  cleanup()
  rm.reduced = false
})

describe('intro story', () => {
  it('has 3 to 5 short cards, original and non-gory, with a code-drawn scene each', () => {
    expect(INTRO_CARDS.length).toBeGreaterThanOrEqual(3)
    expect(INTRO_CARDS.length).toBeLessThanOrEqual(5)
    const all = INTRO_CARDS.map((c) => `${c.title} ${c.text}`).join(' ').toLowerCase()
    expect(all).toContain('exam warden')
    expect(all).toContain('haunted')
    expect(all).not.toMatch(/blood|gore|corpse|kill/)
    expect(INTRO_FLAG_KEY).toBe('sd.introSeen')
    expect(TUTORIAL_FLAG_KEY).toBe('sd.tutorialSeen')
  })

  it('steps through the cards by keyboard and finishes', async () => {
    const user = userEvent.setup()
    const onDone = vi.fn()
    render(<IntroStory onDone={onDone} />)
    expect(screen.getByTestId('intro-count').textContent).toBe(`Card 1 of ${INTRO_CARDS.length}`)
    expect(screen.getByRole('dialog')).toBeTruthy()
    for (let i = 1; i < INTRO_CARDS.length; i++) {
      await user.keyboard('{Enter}')
      expect(screen.getByTestId('intro-count').textContent).toBe(`Card ${i + 1} of ${INTRO_CARDS.length}`)
    }
    await user.keyboard('{Enter}')
    expect(onDone).toHaveBeenCalledWith('finished')
  })

  it('can be skipped with the button or Escape', async () => {
    const user = userEvent.setup()
    const onDone = vi.fn()
    render(<IntroStory onDone={onDone} />)
    await user.click(screen.getByRole('button', { name: /Skip intro/ }))
    expect(onDone).toHaveBeenLastCalledWith('skipped')
    await user.keyboard('{Escape}')
    expect(onDone).toHaveBeenCalledTimes(2)
  })

  it('reads each card in a polite live region and marks reduced motion', () => {
    rm.reduced = true
    render(<IntroStory onDone={() => {}} />)
    expect(screen.getByRole('status').textContent).toBe(INTRO_CARDS[0].text)
    expect(screen.getByTestId('intro-story').getAttribute('data-reduced')).toBe('true')
  })

  it('remembers the flag in sd.introSeen', () => {
    expect(hasSeenIntro()).toBe(false)
    markIntroSeen()
    expect(localStorage.getItem('sd.introSeen')).toBe('1')
    expect(hasSeenIntro()).toBe(true)
  })

  it('is shown once: the first Try the Demo opens it, skipping stores the flag, the next click goes straight in', async () => {
    const user = userEvent.setup()
    render(
      <MemoryRouter>
        <SessionProvider>
          <LandingPage />
        </SessionProvider>
      </MemoryRouter>,
    )
    await user.click(screen.getByRole('button', { name: 'Try the Demo' }))
    expect(screen.getByTestId('intro-story')).toBeTruthy()
    expect(rm.start).not.toHaveBeenCalled()
    await user.click(screen.getByRole('button', { name: /Skip intro/ }))
    expect(localStorage.getItem('sd.introSeen')).toBe('1')
    expect(rm.start).toHaveBeenCalledTimes(1)
    expect(screen.queryByTestId('intro-story')).toBeNull()
    await user.click(screen.getByRole('button', { name: 'Try the Demo' }))
    expect(screen.queryByTestId('intro-story')).toBeNull()
    expect(rm.start).toHaveBeenCalledTimes(2)
  })
})

describe('taunt lines', () => {
  it.each([...PORTRAIT_KINDS])('%s has at least 3 taunts and 3 reactions', (kind) => {
    const l = linesFor(kind)
    expect(l.taunts.length).toBeGreaterThanOrEqual(3)
    expect(l.reactions.length).toBeGreaterThanOrEqual(3)
    expect(l.taunts.every((t) => t.trim().length > 0)).toBe(true)
  })
})
