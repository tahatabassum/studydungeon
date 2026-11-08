export type ProgressTone = 'health' | 'danger' | 'magic' | 'gold'

const TONE_CLASS: Record<ProgressTone, string> = {
  health: 'bg-health',
  danger: 'bg-danger',
  magic: 'bg-magic',
  gold: 'bg-gold',
}

export interface ProgressBarProps {
  value: number
  max: number
  label: string
  /** Tailwind classes for the fill color and glow. Overrides `tone`. */
  fillClassName?: string
  /** Themed fill color; used when `fillClassName` is not provided. */
  tone?: ProgressTone
}

export function ProgressBar({ value, max, label, fillClassName, tone = 'health' }: ProgressBarProps) {
  const safeMax = Math.max(1, max)
  const clamped = Math.min(Math.max(value, 0), safeMax)
  const pct = (clamped / safeMax) * 100
  return (
    <div
      role="progressbar"
      aria-label={label}
      aria-valuenow={clamped}
      aria-valuemin={0}
      aria-valuemax={safeMax}
      className="h-3 w-full overflow-hidden rounded-sm border border-deep bg-bg p-px shadow-[inset_0_1px_2px_rgba(0,0,0,0.6)]"
    >
      <div
        className={`h-full rounded-[1px] motion-safe:transition-[width] motion-safe:duration-300 ${fillClassName ?? TONE_CLASS[tone]}`}
        style={{ width: `${pct}%` }}
      />
    </div>
  )
}
