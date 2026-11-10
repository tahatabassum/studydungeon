/**
 * Reduced motion: the Exam timer never pulses and the Haunt finale is static. Without the preference the
 * timer pulses in its last minute.
 * **Validates: Requirements 7.3, 8.4, 14.5**
 */
import { act, cleanup, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ExamTimer } from './ExamTimer'
import { HauntFinale } from './HauntFinale'

function setReduced(reduced: boolean) {
  window.matchMedia = ((query: string) => ({
    matches: reduced && query.includes('prefers-reduced-motion'),
    media: query,
    addEventListener: () => undefined,
    removeEventListener: () => undefined,
    addListener: () => undefined,
    removeListener: () => undefined,
    onchange: null,
    dispatchEvent: () => false,
  })) as unknown as typeof window.matchMedia
}

describe('motion preferences', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })
  afterEach(() => {
    cleanup()
    vi.useRealTimers()
  })

  it('the exam timer pulses in its last minute only when motion is allowed', () => {
    setReduced(false)
    const { unmount } = render(<ExamTimer minutes={1} onExpire={() => undefined} />)
    expect(screen.getByTestId('exam-timer').getAttribute('data-low')).toBe('true')
    unmount()
    setReduced(true)
    render(<ExamTimer minutes={1} onExpire={() => undefined} />)
    expect(screen.getByTestId('exam-timer').getAttribute('data-low')).toBeNull()
  })

  it('the exam timer calls onExpire once at zero', () => {
    setReduced(false)
    const onExpire = vi.fn()
    render(<ExamTimer minutes={1} onExpire={onExpire} />)
    act(() => void vi.advanceTimersByTime(59_000))
    expect(onExpire).not.toHaveBeenCalled()
    act(() => void vi.advanceTimersByTime(5_000))
    expect(onExpire).toHaveBeenCalledTimes(1)
    act(() => void vi.advanceTimersByTime(10_000))
    expect(onExpire).toHaveBeenCalledTimes(1)
  })

  it('the finale is static under reduced motion and says the right things', () => {
    setReduced(true)
    render(<HauntFinale laidToRest={1} dailyStreak={3} dueLeft={0} onDashboard={() => undefined} onMap={() => undefined} />)
    expect(screen.getByTestId('haunt-finale').getAttribute('data-reduced')).toBe('true')
    expect(screen.getByTestId('haunt-finale-count').textContent).toBe('1 memory laid to rest')
    expect(screen.getByTestId('haunt-finale-streak').textContent).toBe('Daily streak: 3 days')
  })

  it('leaves the streak out when the Backend could not be asked', () => {
    setReduced(false)
    render(<HauntFinale laidToRest={5} dailyStreak={null} dueLeft={null} onDashboard={() => undefined} onMap={() => undefined} />)
    expect(screen.queryByTestId('haunt-finale-streak')).toBeNull()
    expect(screen.getByTestId('haunt-finale').getAttribute('data-reduced')).toBeNull()
  })
})
