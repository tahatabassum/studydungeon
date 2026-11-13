import { useId } from 'react'

/**
 * Draft text from docs/handoff/B-to-A.md section 7 (to check against provider terms).
 * It makes NO promise about retention or training: it only says what is sent and where.
 */
export const AI_NOTICE_TEXT =
  'Your notes are sent to third-party AI providers (Google Gemini, with OpenRouter models as a fallback) to generate questions. Free tiers may keep or use content under their own terms. Do not upload personal or confidential information.'
export const AI_NOTICE_LABEL = 'I understand and want to continue'

export interface AiNoticeProps {
  accepted: boolean
  onChange(accepted: boolean): void
  disabled?: boolean
}

/** The AI notice with its checkbox. The drop zone stays disabled until the box is ticked. */
export function AiNotice({ accepted, onChange, disabled = false }: AiNoticeProps) {
  const id = useId()
  return (
    <section className="sd-card sd-up__notice" aria-labelledby={`${id}-h`} data-testid="ai-notice">
      <h2 id={`${id}-h`} className="sd-card__h sd-up__notice-h">
        Before you upload
      </h2>
      <p className="sd-card__text sd-up__notice-text" id={`${id}-t`}>
        {AI_NOTICE_TEXT}
      </p>
      <label className="sd-up__notice-check">
        <input
          type="checkbox"
          checked={accepted}
          disabled={disabled}
          onChange={(e) => onChange(e.target.checked)}
          aria-describedby={`${id}-t`}
          data-testid="ai-notice-check"
        />
        <span>{AI_NOTICE_LABEL}</span>
      </label>
    </section>
  )
}
