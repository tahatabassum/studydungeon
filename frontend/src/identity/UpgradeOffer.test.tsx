import { cleanup, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { ApiClient } from '@/api/ApiClient'

const h = vi.hoisted(() => ({ api: null as unknown }))
vi.mock('@/api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/api')>()
  return { ...actual, getApi: () => Promise.resolve(h.api as ApiClient) }
})

import { createMockAdapter } from '@/api/mock/mockAdapter'
import { GuestBanner } from '@/components/GuestBanner'
import { UpgradeOffer, UPGRADE_OFFER_TEXT } from './UpgradeOffer'

const withCapability = (accountUpgrade: boolean | 'unproven') => ({ ...createMockAdapter(), capabilities: { accountUpgrade } })

beforeEach(() => {
  h.api = createMockAdapter()
})
afterEach(() => cleanup())

describe('UpgradeOffer', () => {
  it('is visible for a guest when accountUpgrade is on', async () => {
    render(<UpgradeOffer isGuest />)
    const link = await screen.findByRole('link', { name: UPGRADE_OFFER_TEXT })
    expect(link.getAttribute('href')).toBe('/register?upgrade=1')
  })

  it('is visible when accountUpgrade is unproven', async () => {
    h.api = withCapability('unproven')
    render(<UpgradeOffer isGuest />)
    expect(await screen.findByTestId('upgrade-offer')).toBeTruthy()
  })

  it('is hidden when accountUpgrade is off and shows the fallback instead', async () => {
    h.api = withCapability(false)
    render(<UpgradeOffer isGuest fallback={<span>plain</span>} />)
    await screen.findByText('plain')
    await new Promise((r) => setTimeout(r, 20))
    expect(screen.queryByTestId('upgrade-offer')).toBeNull()
    expect(screen.queryByText(UPGRADE_OFFER_TEXT)).toBeNull()
  })

  it('is hidden for a registered user', async () => {
    render(<UpgradeOffer isGuest={false} fallback={<span>plain</span>} />)
    await new Promise((r) => setTimeout(r, 20))
    expect(screen.queryByTestId('upgrade-offer')).toBeNull()
    expect(screen.queryByText('plain')).toBeNull()
  })

  it('GuestBanner shows the offer for a guest and the plain link when the capability is off', async () => {
    const { unmount } = render(<GuestBanner isGuest handle="Pale Moth#1234" />)
    expect(await screen.findByRole('link', { name: UPGRADE_OFFER_TEXT })).toBeTruthy()
    unmount()
    h.api = withCapability(false)
    render(<GuestBanner isGuest handle="Pale Moth#1234" />)
    await waitFor(() => expect(screen.getByRole('link', { name: 'Create account' })).toBeTruthy())
    expect(screen.queryByText(UPGRADE_OFFER_TEXT)).toBeNull()
  })
})
