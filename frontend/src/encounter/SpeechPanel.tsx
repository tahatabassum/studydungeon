import type { ReactNode, Ref } from 'react'
import '../styles/spellbook.css'
import '../styles/encounter.css'

export interface SpeechPanelProps {
  /** Id of the element that names the dialog (the question heading). */
  labelledBy: string
  ref?: Ref<HTMLDivElement>
  children: ReactNode
}

/**
 * Parchment speech panel: the encounter's modal dialog. It takes focus as a container (not an option),
 * and a candle drawn in CSS flickers in the corner (static under Reduced_Motion).
 */
export function SpeechPanel({ labelledBy, ref, children }: SpeechPanelProps) {
  return (
    <div
      ref={ref}
      role="dialog"
      aria-modal="true"
      aria-labelledby={labelledBy}
      tabIndex={-1}
      className="sd-speech sd-parchment"
    >
      <span aria-hidden="true" data-testid="spellbook-candle" className="sd-candle">
        <span className="sd-candle__body" />
        <span className="sd-flame" />
      </span>
      <div className="sd-speech__scroll">{children}</div>
    </div>
  )
}
