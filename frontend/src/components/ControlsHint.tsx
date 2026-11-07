export interface ControlsHintProps {
  className?: string
}

const CONTROLS: ReadonlyArray<{ keys: readonly string[]; label: string }> = [
  { keys: ['WASD', 'Arrows'], label: 'Move' },
  { keys: ['E'], label: 'Engage' },
  { keys: ['1-4'], label: 'Answer' },
  { keys: ['Enter'], label: 'Next' },
  { keys: ['Esc'], label: 'Pause' },
]

export function ControlsHint({ className = '' }: ControlsHintProps) {
  return (
    <ul
      aria-label="Controls"
      className={`m-0 flex list-none items-center gap-x-4 overflow-hidden whitespace-nowrap p-0 text-xs text-ink-muted ${className}`.trim()}
    >
      {CONTROLS.map(({ keys, label }) => (
        <li key={label} className={`flex items-center gap-1 ${label === 'Engage' || label === 'Next' ? 'max-sm:hidden' : '' }`}>
          {keys.map((k, i) => (
            <span key={k} className="flex items-center gap-1">
              {i > 0 && <span aria-hidden="true">/</span>}
              <kbd className="rounded border border-ink-muted bg-deep px-1 font-[family-name:var(--font-label)] text-[0.7rem] text-ink">
                {k}
              </kbd>
            </span>
          ))}
          <span>{label}</span>
        </li>
      ))}
    </ul>
  )
}
