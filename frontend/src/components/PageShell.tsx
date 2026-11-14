import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'
import '../styles/landing.css'
import '../styles/pages.css'
import { useReducedMotion } from '../state/useReducedMotion'

export type PageShellVariant = 'scroll' | 'fit'

export interface PageShellProps {
  title: string
  subtitle?: ReactNode
  /** Back link in the top bar. */
  back?: { to: string; label: string }
  /** Top bar actions (links or buttons), right-aligned. */
  actions?: ReactNode
  /** Accessible name of the actions nav (default Page links). */
  actionsLabel?: string
  children: ReactNode
  /** Wider content column (the leaderboard table, the dashboard grid). */
  wide?: boolean
  /** Fit screens only: centre a narrow form column (login, register, choose, play-as-guest, settings). */
  center?: boolean
  testId?: string
  /**
   * "scroll" (default): the page grows with its content and the window scrolls (Dashboard, Leaderboard).
   * "fit": exactly one dynamic viewport tall, a flex column whose body shrinks; only the body may scroll
   * (a thin themed scrollbar on very small screens), never the page.
   */
  variant?: PageShellVariant
  /** Extra class on the page root (for example sd-live). */
  className?: string
  /** Extra decorative layer inside the atmosphere container (aria-hidden, behind content). */
  decor?: ReactNode
}

/** Shared page chrome: night sky, moon, fog, title block. Decorative layers live in a fixed, clipped container. */
export function PageShell({ title, subtitle, back, actions, children, actionsLabel = 'Page links', wide = false, center = false, testId, variant = 'scroll', className, decor }: PageShellProps) {
  const reduced = useReducedMotion()
  const fit = variant === 'fit'
  return (
    <main
      className={`sd-page sd-sky${fit ? ' sd-page--fit' : ''}${fit && center ? ' sd-fit--center' : ''}${className ? ` ${className}` : ''}`}
      data-variant={fit ? 'fit' : undefined}
      data-reduced={reduced ? 'true' : undefined}
      aria-labelledby="page-title"
      data-testid={testId}
    >
      <div aria-hidden="true" className="sd-page__atmosphere" data-testid={fit ? 'page-atmosphere' : undefined}>
        <div className="sd-moon" />
        <div className="sd-fog sd-fog--a" />
        <div className="sd-page__vignette" />
        {decor}
      </div>
      <div className={`sd-page__inner ${wide ? 'sd-page__inner--wide' : ''}`.trim()}>
        <header className="sd-page__header">
          <div className="sd-page__topbar">
            {back ? (
              <Link to={back.to} className="sd-page__back">
                <ArrowLeft aria-hidden="true" size={16} />
                {back.label}
              </Link>
            ) : (
              <span />
            )}
            {actions && (
              <nav aria-label={actionsLabel} className="sd-page__actions">
                {actions}
              </nav>
            )}
          </div>
          <h1 id="page-title" className="sd-page__title">
            {title}
          </h1>
          {subtitle && <p className="sd-page__sub">{subtitle}</p>}
        </header>
        {fit ? (
          <div className="sd-page__body" data-testid="page-body">
            {children}
          </div>
        ) : (
          children
        )}
      </div>
    </main>
  )
}
