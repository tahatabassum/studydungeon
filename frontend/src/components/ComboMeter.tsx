import { useReducedMotion } from 'framer-motion'
import '../styles/chest.css'
import { COMBO_TIER_NAMES, comboTier } from '../learning/combo'

export interface ComboMeterProps {
  /** The Backend `combo`, or the streak when `combo` is absent. Display only. */
  value: number
}

/**
 * HUD Combo meter (Req 11.1, 11.2). Shows nothing below streak 3, then Combo, Hot, Blazing and Legendary at
 * 3, 5, 8 and 12. Tiers escalate by border, glow, pip count and name, so colour is not the only cue. Tiers
 * 3 and 4 breathe slowly; there is no motion under Reduced_Motion. The polite status text changes only when
 * the tier changes, so a screen reader is not interrupted on every answer.
 */
export function ComboMeter({ value }: ComboMeterProps) {
  const reduced = !!useReducedMotion()
  const tier = comboTier(value)
  if (tier === 0) return null
  const name = COMBO_TIER_NAMES[tier]
  return (
    <div
      className="sd-combo"
      data-tier={tier}
      data-reduced={reduced ? 'true' : undefined}
      data-testid="combo-meter"
      role="group"
      aria-label={`Combo ${name}, streak ${value}`}
    >
      <span aria-hidden="true" className="sd-combo__pips">
        {Array.from({ length: tier }, (_, i) => (
          <i key={i} />
        ))}
      </span>
      <span aria-hidden="true" className="sd-combo__name">
        {name}
      </span>
      <span aria-hidden="true" className="sd-combo__count">{`x${value}`}</span>
      <span role="status" className="sr-only">{`${name} combo`}</span>
    </div>
  )
}
