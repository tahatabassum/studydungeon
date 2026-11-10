import { act, cleanup, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { OFFLINE_LABEL, OfflineLabel } from '@/components/OfflineLabel'
import { setApiOverride } from '@/api'
import { GuestBanner } from '@/components/GuestBanner'
import { TIP_INTERVAL_MS, WAKING_TIPS, WAKING_TITLE, WakingUp } from './WakingUp'

beforeEach(() => vi.useFakeTimers())
afterEach(() => {
  vi.useRealTimers()
  setApiOverride(null)
  cleanup()
})

describe('WakingUp', () => {
  it('says "Waking up the dungeon..." and rotates the spooky tips', () => {
    render(<WakingUp offerOffline={false} onOffline={() => {}} />)
    expect(WAKING_TITLE).toBe('Waking up the dungeon...')
    expect(screen.getByRole('heading', { name: 'Waking up the dungeon...' })).toBeTruthy()
    expect(screen.getByTestId('waking-tip').textContent).toBe(WAKING_TIPS[0])
    act(() => {
      vi.advanceTimersByTime(TIP_INTERVAL_MS)
    })
    expect(screen.getByTestId('waking-tip').textContent).toBe(WAKING_TIPS[1])
    act(() => {
      vi.advanceTimersByTime(TIP_INTERVAL_MS * WAKING_TIPS.length)
    })
    expect(screen.getByTestId('waking-tip').textContent).toBe(WAKING_TIPS[1])
    expect(WAKING_TIPS.length).toBeGreaterThanOrEqual(5)
  })

  it('shows no Offline choice until offered, then a button that calls the handler', () => {
    const onOffline = vi.fn()
    const { rerender } = render(<WakingUp offerOffline={false} onOffline={onOffline} />)
    expect(screen.queryByRole('button', { name: 'Play the offline demo' })).toBeNull()
    rerender(<WakingUp offerOffline onOffline={onOffline} />)
    screen.getByRole('button', { name: 'Play the offline demo' }).click()
    expect(onOffline).toHaveBeenCalledTimes(1)
  })
})

describe('Offline label and guest banner', () => {
  it('shows "Offline demo - progress is not saved" only while the override is installed', () => {
    render(<OfflineLabel />)
    expect(screen.queryByTestId('offline-label')).toBeNull()
    act(() => setApiOverride({} as never))
    expect(screen.getByTestId('offline-label').textContent).toBe(OFFLINE_LABEL)
    expect(OFFLINE_LABEL).toBe('Offline demo - progress is not saved')
    act(() => setApiOverride(null))
    expect(screen.queryByTestId('offline-label')).toBeNull()
  })

  it('keeps the guest banner text exact and sends Create account to /register', () => {
    render(<GuestBanner isGuest />)
    expect(screen.getByText('Playing as guest. Progress is temporary. Create an account to save.')).toBeTruthy()
    expect(screen.getByRole('link', { name: 'Create account' }).getAttribute('href')).toBe('/register')
  })
})
