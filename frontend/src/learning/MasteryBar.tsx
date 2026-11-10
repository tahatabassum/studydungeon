import type { ReactNode } from 'react'
import type { MasteryBand } from '../types/api'
import { MASTERY_BAND_LABEL, clampMastery, masteryBand } from './mastery'

export interface MasteryBarProps {
  /** 0 to 100, as received from the Backend (or the mock). Display only. */
  value: number
  /** Outer diameter of the ring in px. */
  size?: number
  stroke?: number
  /** Show "Weak 40" style text under the ring. */
  showLabel?: boolean
  /** Centre content (an icon or a number). */
  children?: ReactNode
  className?: string
}

const BAND_STROKE: Record<MasteryBand, string> = {
  weak: 'var(--color-blood-red)',
  learning: 'var(--color-ember)',
  strong: 'var(--color-toxic)',
}

/**
 * Mastery ring: an SVG circle with a stroke-dasharray arc. The band is also written as text in the
 * accessible name (and optionally on screen), so it never depends on colour alone.
 */
export function MasteryBar({ value, size = 56, stroke = 5, showLabel = false, children, className = '' }: MasteryBarProps) {
  const v = Math.round(clampMastery(value))
  const band = masteryBand(v)
  const r = (size - stroke) / 2
  const c = 2 * Math.PI * r
  const label = `Mastery ${v} percent, ${MASTERY_BAND_LABEL[band]}`
  return (
    <span className={`sd-mastery inline-flex flex-col items-center ${className}`.trim()} data-band={band}>
      <span className="relative inline-flex items-center justify-center" style={{ width: size, height: size }}>
        <svg role="img" aria-label={label} width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="absolute inset-0">
          <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--color-deep)" strokeWidth={stroke} />
          <circle
            cx={size / 2}
            cy={size / 2}
            r={r}
            fill="none"
            stroke={BAND_STROKE[band]}
            strokeWidth={stroke}
            strokeLinecap="round"
            strokeDasharray={`${(c * v) / 100} ${c}`}
            transform={`rotate(-90 ${size / 2} ${size / 2})`}
            data-testid="mastery-arc"
          />
        </svg>
        {children}
      </span>
      {showLabel && (
        <span className="mt-1 font-(family-name:--font-label) text-xs text-ink">
          {MASTERY_BAND_LABEL[band]} {v}
        </span>
      )}
    </span>
  )
}
