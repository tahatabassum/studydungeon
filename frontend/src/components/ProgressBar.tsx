export interface ProgressBarProps {
  value: number
  max: number
  label: string
  /** Tailwind classes for the fill color and glow. */
  fillClassName: string
}

export function ProgressBar({ value, max, label, fillClassName }: ProgressBarProps) {
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
      className="h-3 w-full overflow-hidden rounded-full bg-bg"
    >
      <div
        className={`h-full rounded-full motion-safe:transition-[width] motion-safe:duration-300 ${fillClassName}`}
        style={{ width: `${pct}%` }}
      />
    </div>
  )
}
