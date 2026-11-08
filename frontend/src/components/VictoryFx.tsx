import '../styles/hud.css'
import '../styles/overlays.css'

import { VICTORY_BATS, VICTORY_EMBERS } from './fxCounts'

function Bat({ left, delay }: { left: number; delay: number }) {
  return (
    <svg
      viewBox="0 0 32 16"
      className="sd-confetti-bat"
      style={{ left: `${left}%`, animationDelay: `${delay}s` }}
      fill="currentColor"
      data-fx="bat"
    >
      <path d="M16 4 L18 1 L19 5 Q24 2 31 6 Q27 6 25 9 Q23 7 21 9 Q19 7 18 11 L16 15 L14 11 Q13 7 11 9 Q9 7 7 9 Q5 6 1 6 Q8 2 13 5 L14 1 Z" />
    </svg>
  )
}

/** Floating embers and bat confetti behind the victory dialog. Decorative only. */
export function VictoryFx() {
  return (
    <div aria-hidden="true" className="sd-fx" data-testid="victory-fx">
      {Array.from({ length: VICTORY_EMBERS }, (_, i) => (
        <span
          key={`e${i}`}
          data-fx="ember"
          className="sd-ember"
          style={{ left: `${4 + i * 8}%`, animationDelay: `${(i % 6) * 0.9}s` }}
        />
      ))}
      {Array.from({ length: VICTORY_BATS }, (_, i) => (
        <Bat key={`b${i}`} left={6 + i * 12} delay={i * 0.8} />
      ))}
    </div>
  )
}
