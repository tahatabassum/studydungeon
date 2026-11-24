import type { ReactNode } from 'react'
import type { LucideIcon } from 'lucide-react'
import { Link } from 'react-router-dom'
import '../styles/empty-state.css'

export interface EmptyStateAction {
  label: string
  /** Renders a button when given. */
  onClick?: () => void
  /** Renders a router link when given (and no onClick). */
  to?: string
}

export interface EmptyStateProps {
  /** Decorative icon, rendered aria-hidden. */
  icon: LucideIcon
  title: string
  /** Descriptive text, always rendered. May contain inline links. */
  message: ReactNode
  action?: EmptyStateAction
  testId?: string
  className?: string
}

/** Centered, muted placeholder for empty, error or idle panels. Safe inside or outside a card. */
export function EmptyState({ icon: Icon, title, message, action, testId, className = '' }: EmptyStateProps) {
  return (
    <div className={`sd-empty ${className}`.trim()} data-testid={testId}>
      <span className="sd-empty__icon" aria-hidden="true">
        <Icon size={28} />
      </span>
      <p className="sd-empty__title">{title}</p>
      <p className="sd-empty__text">{message}</p>
      {action &&
        (action.onClick ? (
          <button type="button" className="sd-ghost-btn" onClick={action.onClick}>
            {action.label}
          </button>
        ) : action.to ? (
          <Link to={action.to} className="sd-ghost-btn">
            {action.label}
          </Link>
        ) : null)}
    </div>
  )
}
