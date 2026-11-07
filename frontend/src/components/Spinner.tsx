export interface SpinnerProps {
  /** Visually hidden text announced to assistive technology. */
  label?: string
  className?: string
}

export function Spinner({ label = 'Loading', className = '' }: SpinnerProps) {
  return (
    <span role="status" aria-live="polite" className="inline-flex items-center">
      <span
        aria-hidden="true"
        className={`inline-block size-5 rounded-full border-2 border-current border-t-transparent motion-safe:animate-spin motion-reduce:animate-none ${className}`}
      />
      <span className="sr-only">{label}</span>
    </span>
  )
}
