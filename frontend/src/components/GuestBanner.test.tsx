import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { GuestBanner } from './GuestBanner'

const rm = vi.hoisted(() => ({ reduced: false }))
vi.mock('@/state/useReducedMotion', () => ({ useReducedMotion: () => rm.reduced }))

const TEXT = 'Playing as guest. Progress is temporary. Create an account to save.'
const advance = (ms: number) =>
  act(() => {
    vi.advanceTimersByTime(ms)
  })

describe('GuestBanner', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    rm.reduced = false
  })
  afterEach(() => {
    cleanup()
    vi.useRealTimers()
  })

  it('renders nothing for non-guests', () => {
    render(<GuestBanner isGuest={false} autoHideMs={6000} />)
    expect(screen.queryByText(TEXT)).toBeNull()
  })

  it('names the player by handle when one is given', () => {
    render(<GuestBanner isGuest handle="Pale Moth#1234" />)
    expect(screen.getByRole('status').textContent).toBe('Playing as Pale Moth#1234. Progress is temporary. Create an account to save.')
  })

  it('stays permanently without autoHideMs and has no dismiss button', () => {
    render(<GuestBanner isGuest />)
    advance(60_000)
    expect(screen.getByText(TEXT)).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Dismiss' })).toBeNull()
  })

  it('is visible at the start and gone after 6 s (after the fade)', () => {
    const onDone = vi.fn()
    render(<GuestBanner isGuest autoHideMs={6000} onDone={onDone} />)
    expect(screen.getByText(TEXT)).toBeTruthy()
    expect(screen.getByRole('status').textContent).toBe(TEXT)
    advance(5900)
    expect(screen.getByText(TEXT)).toBeTruthy()
    advance(100)
    advance(300)
    expect(screen.queryByText(TEXT)).toBeNull()
    expect(onDone).toHaveBeenCalledTimes(1)
  })

  it('removes instantly under reduced motion', () => {
    rm.reduced = true
    render(<GuestBanner isGuest autoHideMs={6000} />)
    advance(6000)
    expect(screen.queryByText(TEXT)).toBeNull()
  })

  it('hover pauses the timer and leaving restarts a 2 s timer', () => {
    render(<GuestBanner isGuest autoHideMs={6000} />)
    const banner = screen.getByLabelText('Guest notice')
    advance(3000)
    fireEvent.mouseEnter(banner)
    advance(30_000)
    expect(screen.getByText(TEXT)).toBeTruthy()
    fireEvent.mouseLeave(banner)
    advance(1900)
    expect(screen.getByText(TEXT)).toBeTruthy()
    advance(100)
    advance(300)
    expect(screen.queryByText(TEXT)).toBeNull()
  })

  it('focus pauses the timer, blur out of the banner resumes it', () => {
    render(<GuestBanner isGuest autoHideMs={6000} />)
    const link = screen.getByRole('link', { name: 'Create account' })
    fireEvent.focus(link)
    advance(30_000)
    expect(screen.getByText(TEXT)).toBeTruthy()
    fireEvent.blur(link)
    advance(2000)
    advance(300)
    expect(screen.queryByText(TEXT)).toBeNull()
  })

  it('Dismiss hides it immediately', () => {
    const onDone = vi.fn()
    render(<GuestBanner isGuest autoHideMs={6000} onDone={onDone} />)
    fireEvent.click(screen.getByRole('button', { name: 'Dismiss' }))
    expect(screen.queryByText(TEXT)).toBeNull()
    expect(onDone).toHaveBeenCalledTimes(1)
  })

  it('clears its timer on unmount', () => {
    const onDone = vi.fn()
    const { unmount } = render(<GuestBanner isGuest autoHideMs={6000} onDone={onDone} />)
    unmount()
    advance(10_000)
    expect(onDone).not.toHaveBeenCalled()
    expect(vi.getTimerCount()).toBe(0)
  })
})
