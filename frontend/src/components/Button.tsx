import type { ButtonHTMLAttributes } from 'react'
import { Spinner } from './Spinner'

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary'
  loading?: boolean
}

const base =
  'inline-flex items-center justify-center gap-2 rounded-lg font-semibold transition-colors ' +
  'focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-amber ' +
  'disabled:cursor-not-allowed disabled:opacity-50'

const variants = {
  primary:
    'bg-purple text-parchment px-8 py-4 text-xl shadow-[0_0_24px_var(--color-purple)] ' +
    'hover:enabled:brightness-125 disabled:shadow-none',
  secondary:
    'border-2 border-muted bg-transparent text-muted px-5 py-2 text-base ' +
    'hover:enabled:border-parchment hover:enabled:text-parchment',
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
