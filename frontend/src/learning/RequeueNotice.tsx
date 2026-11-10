import { Ghost } from 'lucide-react'
import '../styles/learning.css'

export interface RequeueNoticeProps {
  /** Further questions before the missed one returns, as counted down from the Backend's `requeue_after`. */
  remaining: number
  className?: string
}

/** A ghostly whisper: the question you missed is not finished with you. */
export function RequeueNotice({ remaining, className = '' }: RequeueNoticeProps) {
  const detail =
    remaining <= 0
      ? 'It is the next one.'
      : `After ${remaining} more ${remaining === 1 ? 'question' : 'questions'}.`
  return (
    <p className={`sd-whisper ${className}`.trim()} data-testid="requeue-notice">
      <Ghost aria-hidden="true" className="sd-whisper__icon" size={16} />
      <span className="sd-whisper__main">The question returns...</span>
      <span className="sd-whisper__detail">{detail}</span>
    </p>
  )
}
