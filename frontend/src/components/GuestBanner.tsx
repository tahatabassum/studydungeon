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
      className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-accent bg-panel px-4 py-2 text-sm text-ink"
    >
      <p role="status">Playing as guest. Progress is temporary. Create an account to save.</p>
      {onCreateAccount ? (
        <Button variant="secondary" onClick={onCreateAccount}>
          Create account
        </Button>
      ) : (
        <a
          href="/login"
          target="_blank"
          rel="noopener noreferrer"
          className="rounded-lg border-2 border-ink-muted px-5 py-2 text-base font-semibold text-ink-muted hover:border-ink hover:text-ink"
        >
          Create account
        </a>
      )}
    </aside>
  )
}
