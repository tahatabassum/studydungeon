import '../styles/haunt.css'
import { nextDueText } from './nextDue'

export interface HauntCelebrationProps {
  nextDueAt: string | null
  nowMs: number
  dailyStreak: number
}

/** Three candle flames, code-drawn. Decorative. */
function Candles() {
  return (
    <svg aria-hidden="true" viewBox="0 0 48 48" className="sd-celebrate__art">
      {[10, 24, 38].map((x, i) => (
        <g key={x}>
          <rect x={x - 3} y={26 + (i === 1 ? -4 : 0)} width="6" height={16 + (i === 1 ? 4 : 0)} rx="1" fill="var(--color-bone)" />
          <ellipse
            className="sd-celebrate__flame"
            cx={x}
            cy={20 + (i === 1 ? -4 : 0)}
            rx="3.4"
            ry="6"
            fill="var(--color-ghost)"
            style={{ transformBox: 'fill-box' }}
          />
        </g>
      ))}
    </svg>
  )
}

/**
 * Shown when nothing is due: every memory is at rest. The time of the next one is the Backend's
 * `next_due_at`, worded as a plain duration.
 */
export function HauntCelebration({ nextDueAt, nowMs, dailyStreak }: HauntCelebrationProps) {
  return (
    <div className="sd-celebrate" data-testid="haunt-rest">
      <Candles />
      <div>
        <p className="sd-celebrate__title">All your memories are at rest</p>
        <p className="sd-celebrate__text" data-testid="haunt-next-due">
          {nextDueText(nextDueAt, nowMs)}
        </p>
        {dailyStreak > 0 && (
          <p className="sd-celebrate__text">{`Daily streak: ${dailyStreak} ${dailyStreak === 1 ? 'day' : 'days'}`}</p>
        )}
      </div>
    </div>
  )
}
