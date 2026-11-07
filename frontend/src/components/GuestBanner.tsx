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
      className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-amber bg-panel px-4 py-2 text-sm text-parchment"
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
          className="rounded-lg border-2 border-muted px-5 py-2 text-base font-semibold text-muted hover:border-parchment hover:text-parchment"
        >
          Create account
        </a>
      )}
    </aside>
  )
}
