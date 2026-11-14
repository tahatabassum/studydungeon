import type { ReactNode } from 'react'
import { Button } from '../components/Button'
import { useUpgradeAvailable } from './useUpgradeAvailable'

export const UPGRADE_OFFER_TEXT = 'Create an account to keep your name and points'
export const UPGRADE_HREF = '/register?upgrade=1'

export interface UpgradeOfferProps {
  /** The offer is shown only while the current user is a Guest. */
  isGuest: boolean
  /** Renders a button that calls this. Without it, a link to `/register?upgrade=1` is rendered. */
  onActivate?: () => void
  /** Link mode only: open in a new tab (used inside a run so it is never abandoned). */
  newTab?: boolean
  /** `cta` is the big Dashboard button, `secondary` the outlined Button. */
  look?: 'cta' | 'secondary'
  className?: string
  icon?: ReactNode
  /** Shown while the capability is unknown or off (the old register call to action). Never an upgrade offer. */
  fallback?: ReactNode
}

/** D11: "Create an account to keep your name and points". Hidden for registered users and when upgrade is off. */
export function UpgradeOffer({ isGuest, onActivate, newTab = false, look = 'secondary', className = '', icon, fallback = null }: UpgradeOfferProps) {
  const available = useUpgradeAvailable()
  if (!isGuest) return null
  if (!available) return <>{fallback}</>

  if (!onActivate) {
    return (
      <a
        href={UPGRADE_HREF}
        {...(newTab ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
        data-testid="upgrade-offer"
        className={className}
      >
        {icon}
        {UPGRADE_OFFER_TEXT}
      </a>
    )
  }
  if (look === 'cta') {
    return (
      <button type="button" className={`sd-cta ${className}`} onClick={onActivate} data-testid="upgrade-offer">
        {icon}
        {UPGRADE_OFFER_TEXT}
      </button>
    )
  }
  return (
    <Button variant="secondary" onClick={onActivate} className={className} data-testid="upgrade-offer">
      {icon}
      {UPGRADE_OFFER_TEXT}
    </Button>
  )
}
