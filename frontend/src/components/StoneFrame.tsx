import type { HTMLAttributes } from 'react'
import { useReducedMotion } from 'framer-motion'
import '../styles/hud.css'

export interface StoneFrameProps extends HTMLAttributes<HTMLDivElement> {
  tone?: 'default' | 'danger'
  /** Draw cobweb corners (default true). */
  webs?: boolean
}

function Web({ className }: { className: string }) {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" className={`sd-web ${className}`} fill="none" stroke="currentColor" strokeWidth="1">
      <path d="M0 0 L24 0 M0 0 L24 24 M0 0 L0 24 M0 0 L24 10 M0 0 L10 24" />
      <path d="M6 0 Q5 5 0 6 M12 0 Q10 10 0 12 M18 0 Q15 15 0 18" />
    </svg>
  )
}

/** Dark stone frame with orange and purple glow edges and optional cobweb corners. */
export function StoneFrame({
  tone = 'default',
  webs = true,
  className = '',
  children,
  ...rest
}: StoneFrameProps) {
  const reduced = useReducedMotion()
  return (
    <div
      data-reduced={reduced ? 'true' : undefined}
      className={`sd-stone ${tone === 'danger' ? 'sd-stone--danger' : ''} ${className}`.trim()}
      {...rest}
    >
      {webs && <Web className="sd-web--tl" />}
      {webs && <Web className="sd-web--tr" />}
      {children}
    </div>
  )
}
