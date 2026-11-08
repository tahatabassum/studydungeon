import type { ButtonHTMLAttributes } from 'react'
import { Spinner } from './Spinner'

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary'
  loading?: boolean
}

const base =
  'inline-flex items-center justify-center gap-2 rounded-lg font-semibold transition-colors ' +
  'focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-accent ' +
  'disabled:cursor-not-allowed disabled:opacity-50'

const variants = {
  primary:
    // accent (#ff9f1c) on bg (#100b18) = ~9.4:1 (WCAG AA 4.5:1 met)
    'border-2 border-accent bg-accent text-bg px-8 py-4 text-xl ' +
    'hover:enabled:brightness-110',
  secondary:
    // ink on panel/bg >= 11:1
    'border-2 border-magic bg-transparent text-ink px-5 py-2 text-base ' +
    'hover:enabled:border-accent hover:enabled:bg-deep',
} as const

export function Button({
  variant = 'primary',
  loading = false,
  type = 'button',
  disabled,
  className = '',
  children,
  ...rest
}: ButtonProps) {
  return (
    <button
      type={type}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={`${base} ${variants[variant]} ${className}`}
      {...rest}
    >
      {loading && <Spinner label="Loading" />}
      {children}
    </button>
  )
}
