import '../styles/hud.css'
import '../styles/overlays.css'

import { DEFEAT_CANDLES } from './fxCounts'

/** A row of candles whose flames go out one by one. Decorative only. */
export function DefeatCandles() {
  return (
    <div aria-hidden="true" data-testid="defeat-candles" className="sd-dcandles">
      {Array.from({ length: DEFEAT_CANDLES }, (_, i) => (
        <span key={i} className="sd-dcandle">
          <span className="sd-dcandle__body" />
          <span className="sd-dcandle__fire" style={{ animationDelay: `${i * 0.6}s` }}>
            <span className="sd-flame" />
          </span>
        </span>
      ))}
    </div>
  )
}
