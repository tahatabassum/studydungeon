import { Button } from './Button'

export interface GuestBannerProps {
  isGuest: boolean
  onCreateAccount?: () => void
}

export function GuestBanner({ isGuest, onCreateAccount }: GuestBannerProps) {
  if (!isGuest) return null
  return (
    <aside
      aria-label="Guest notice"
      className="flex flex-wrap items-center justify-between gap-x-2 rounded-md border border-deep bg-surface-2/80 px-2 py-0.5 text-xs leading-tight text-ink-muted"
    >
      <p role="status" className="min-w-0 truncate">Playing as guest. Progress is temporary. Create an account to save.</p>
      {onCreateAccount ? (
        <Button variant="secondary" onClick={onCreateAccount} className="border-gold! px-3! py-0.5! text-xs! text-gold!">
          Create account
        </Button>
      ) : (
        <a
          href="/login"
          target="_blank"
          rel="noopener noreferrer"
          className="shrink-0 rounded-md border border-gold px-2 text-xs font-semibold leading-tight text-gold hover:border-accent hover:text-accent"
        >
          Create account
        </a>
      )}
    </aside>
  )
}
