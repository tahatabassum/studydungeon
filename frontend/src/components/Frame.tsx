import type { HTMLAttributes, ReactNode } from 'react'

export interface FrameProps extends Omit<HTMLAttributes<HTMLDivElement>, 'title'> {
  title?: ReactNode
}

const corner = 'pointer-events-none absolute h-3 w-3 border-gold'

/** Ornate CSS-only frame: outer deep border, inset inner border, gold corner accents. */
export function Frame({ title, className = '', children, ...rest }: FrameProps) {
  return (
    <div
      className={`relative rounded-lg border-2 border-deep bg-surface-2 p-1 text-ink shadow-[0_0_12px_var(--color-deep)] ${className}`.trim()}
      {...rest}
    >
      <span aria-hidden="true" className={`${corner} left-1 top-1 rounded-tl border-l-2 border-t-2`} />
      <span aria-hidden="true" className={`${corner} right-1 top-1 rounded-tr border-r-2 border-t-2`} />
      <span aria-hidden="true" className={`${corner} bottom-1 left-1 rounded-bl border-b-2 border-l-2`} />
      <span aria-hidden="true" className={`${corner} bottom-1 right-1 rounded-br border-b-2 border-r-2`} />
      <div className="rounded-md border border-deep px-6 py-5">
        {title != null && (
          <div className="mb-3 text-center font-(family-name:--font-display) text-3xl text-gold">
            {title}
          </div>
        )}
        {children}
      </div>
    </div>
  )
}
