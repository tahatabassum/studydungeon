import { act, cleanup, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { RunSummary } from '../types/api'

const rm = vi.hoisted(() => ({ reduced: false }))
vi.mock('framer-motion', async (importOriginal) => {
  const actual = await importOriginal<typeof import('framer-motion')>()
  return { ...actual, useReducedMotion: () => rm.reduced }
})

import { Scorecard, scorecardAnnouncement, type ScorecardProps } from './Scorecard'

const summary: RunSummary = {
  score: 2400,
  xp: 190,
  correct: 21,
  total: 24,
  accuracy: 0.875,
  floor_rank: 'A',
  level_up: { from: 2, to: 3 },
  weapon_unlocked: 'hunter_crossbow',
  badges_earned: ['first_blood', 'boss_slayer'],
  leaderboard_rank: 4,
  mastery_by_topic: [
    { topic_id: 't1', title: 'Hardware', mastery: 92 },
    { topic_id: 't2', title: 'Memory', mastery: 64 },
    { topic_id: 't3', title: 'Operating systems', mastery: 38 },
  ],
  weak_concepts: [{ text: 'What does RAM lose without power?', page: 4 }],
  chest_rewards: [{ id: 'c1', kind: 'xp', label: 'Bonus XP', amount: 40 }],
}
const noop = () => {}

function renderCard(props: Partial<ScorecardProps> = {}) {
  return render(<Scorecard summary={summary} onPlayAgain={noop} onExit={noop} progress={{ level: 3, total_xp: 410, xp_to_next: 190 }} {...props} />)
}

afterEach(() => {
  cleanup()
  rm.reduced = false
  vi.useRealTimers()
})

describe('Scorecard', () => {
  it('counts the score up from 0 and ends on the received value', () => {
    vi.useFakeTimers()
    renderCard()
    expect(screen.getByTestId('score-counter').textContent).toBe('0')
    act(() => {
      vi.advanceTimersByTime(600)
    })
    const mid = Number(screen.getByTestId('score-counter').textContent)
    expect(mid).toBeGreaterThan(0)
    expect(mid).toBeLessThan(2400)
    act(() => {
      vi.advanceTimersByTime(1500)
    })
    expect(screen.getByTestId('score-counter').textContent).toBe('2400')
    expect(screen.getByTestId('xp-counter').textContent).toBe('190')
  })

  it('shows final values at once under reduced motion (score, XP and rank)', () => {
    rm.reduced = true
    renderCard()
    expect(screen.getByTestId('score-counter').textContent).toBe('2400')
    expect(screen.getByTestId('xp-counter').textContent).toBe('190')
    expect(screen.getByTestId('rank-counter').textContent).toBe('#4')
    expect(screen.getByRole('dialog').getAttribute('data-reduced')).toBe('true')
  })

  it('slides the leaderboard rank down to the final rank', () => {
    vi.useFakeTimers()
    renderCard()
    const start = Number(screen.getByTestId('rank-counter').textContent?.slice(1))
    expect(start).toBeGreaterThan(4)
    act(() => {
      vi.advanceTimersByTime(4000)
    })
    expect(screen.getByTestId('rank-counter').textContent).toBe('#4')
  })

  it('shows the accuracy ring, floor rank, XP bar, level up, weapon and badges', () => {
    rm.reduced = true
    renderCard()
    expect(screen.getByRole('img', { name: 'Accuracy 88 percent' })).toBeTruthy()
    expect(screen.getByTestId('floor-rank').getAttribute('data-rank')).toBe('A')
    const bar = screen.getByRole('progressbar', { name: 'XP toward the next level' })
    expect(bar.getAttribute('aria-valuenow')).toBe('410')
    expect(bar.getAttribute('aria-valuemax')).toBe('600')
    expect(screen.getByTestId('level-up').textContent).toContain('Level 2 to 3')
    expect(screen.getByTestId('weapon-unlocked').textContent).toContain('Hunter Crossbow')
    const badges = screen.getByTestId('badge-grid')
    expect(within(badges).getAllByRole('listitem')).toHaveLength(2)
    expect(within(badges).getByText('Boss Slayer')).toBeTruthy()
  })

  it('omits the level-up effect, weapon and badges when the run earned none', () => {
    rm.reduced = true
    renderCard({ summary: { ...summary, level_up: null, weapon_unlocked: null, badges_earned: [], floor_rank: undefined } })
    expect(screen.queryByTestId('level-up')).toBeNull()
    expect(screen.queryByTestId('weapon-unlocked')).toBeNull()
    expect(screen.queryByTestId('floor-rank')).toBeNull()
    expect(screen.getByText('No new badges this run.')).toBeTruthy()
  })

  it('labels each topic Weak, Learning or Strong in text, using the shared mastery bands', () => {
    rm.reduced = true
    renderCard()
    const list = screen.getByRole('list', { name: 'Topic mastery' })
    const rows = within(list).getAllByRole('listitem')
    expect(rows.map((r) => r.getAttribute('data-band'))).toEqual(['strong', 'learning', 'weak'])
    expect(within(rows[0]).getByText('Strong 92%')).toBeTruthy()
    expect(within(rows[1]).getByText('Learning 64%')).toBeTruthy()
    expect(within(rows[2]).getByText('Weak 38%')).toBeTruthy()
    // The existing MasteryBar ring is used, with its own accessible name.
    expect(within(rows[2]).getByRole('img', { name: 'Mastery 38 percent, Weak' })).toBeTruthy()
  })

  it('lists weak concepts with the source line, and the chest rewards and slot', () => {
    rm.reduced = true
    renderCard({ chestSlot: <p>Chest goes here</p> })
    expect(screen.getByText('What does RAM lose without power?')).toBeTruthy()
    expect(screen.getByText('From your notes: page 4')).toBeTruthy()
    expect(within(screen.getByRole('list', { name: 'Chest rewards' })).getByText('Bonus XP')).toBeTruthy()
    expect(screen.getByText('Chest goes here')).toBeTruthy()
  })

  it('offers Create account to guests only', () => {
    rm.reduced = true
    const onCreate = vi.fn()
    const { unmount } = renderCard({ isGuest: true, onCreateAccount: onCreate })
    screen.getByRole('button', { name: /Create account/ }).click()
    expect(onCreate).toHaveBeenCalledTimes(1)
    unmount()
    renderCard({ isGuest: false, onCreateAccount: onCreate })
    expect(screen.queryByRole('button', { name: /Create account/ })).toBeNull()
  })

  it('calls the follow-up handlers and keeps Share card disabled with a tooltip', async () => {
    rm.reduced = true
    const user = userEvent.setup()
    const onPlay = vi.fn()
    const onExit = vi.fn()
    const onBoard = vi.fn()
    renderCard({ onPlayAgain: onPlay, onExit, onViewLeaderboard: onBoard, playAgainLabel: 'Replay floor', exitLabel: 'Back to the map' })
    await user.click(screen.getByRole('button', { name: 'Replay floor' }))
    await user.click(screen.getByRole('button', { name: 'Back to the map' }))
    await user.click(screen.getByRole('button', { name: /View leaderboard/ }))
    expect([onPlay, onExit, onBoard].map((f) => f.mock.calls.length)).toEqual([1, 1, 1])
    // Share card is enabled and opens the share dialog (Phase 7).
    const share = screen.getByRole('button', { name: /Share card/ })
    expect(share.getAttribute('aria-disabled')).toBeNull()
    await user.click(share)
    expect(screen.getByTestId('share-dialog')).toBeTruthy()
    expect(screen.getByRole('button', { name: /Copy post text/ })).toBeTruthy()
  })

  it('shows earned badges with the unlock flourish, and static under reduced motion', () => {
    const { unmount } = renderCard()
    const grid = screen.getByTestId('badge-grid')
    expect(grid.getAttribute('data-flourish')).toBe('true')
    expect(within(grid).getAllByRole('listitem')).toHaveLength(2)
    unmount()
    rm.reduced = true
    renderCard()
    expect(screen.getByTestId('badge-grid').getAttribute('data-flourish')).toBeNull()
  })

  it('hides the rank reveal and the leaderboard button when the leaderboard is unavailable', () => {
    rm.reduced = true
    renderCard({ leaderboardEnabled: false, onViewLeaderboard: noop })
    expect(screen.queryByTestId('rank-reveal')).toBeNull()
    expect(screen.queryByRole('button', { name: /View leaderboard/ })).toBeNull()
    expect(screen.getByTestId('scorecard-live').textContent).not.toContain('Leaderboard rank')
  })

  it('announces the results in a polite live region', () => {
    rm.reduced = true
    renderCard()
    const live = screen.getByTestId('scorecard-live')
    expect(live.closest('[aria-live]')?.getAttribute('aria-live')).toBe('polite')
    expect(live.textContent).toBe(scorecardAnnouncement(summary))
    expect(live.textContent).toContain('Dungeon score 2400')
    expect(live.textContent).toContain('Leaderboard rank 4')
    expect(live.textContent).toContain('Level up, level 2 to 3')
  })

  it('shows an error with Retry and keeps the values already received', async () => {
    const user = userEvent.setup()
    const onRetry = vi.fn()
    render(
      <Scorecard
        summary={null}
        error="Your results could not be loaded."
        received={{ score: 1200, xp: 90 }}
        onRetry={onRetry}
        onPlayAgain={noop}
        onExit={noop}
      />,
    )
    expect(screen.getByRole('alert').textContent).toContain('Your results could not be loaded.')
    expect(screen.getByTestId('received-values').textContent).toContain('1200')
    await user.click(screen.getByRole('button', { name: 'Retry' }))
    expect(onRetry).toHaveBeenCalledTimes(1)
    expect(screen.queryByTestId('scorecard')).toBeNull()
  })

  it('shows a loading note while the summary is pending, and focuses Play again on mount', () => {
    render(<Scorecard summary={null} pending onPlayAgain={noop} onExit={noop} />)
    expect(screen.getByText(/Tallying your results/)).toBeTruthy()
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Play again' }))
  })
})
