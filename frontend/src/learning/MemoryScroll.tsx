import { useEffect, useRef } from 'react'
import { ScrollText } from 'lucide-react'
import { sfx } from '../audio/sfx'
import { useOfflineMode } from '../components/OfflineLabel'
import { SourceLine } from '../components/SourceLine'
import type { AnswerResult } from '../types/api'
import '../styles/learning.css'

export interface MemoryScrollProps {
  /** The wrong answer's result. Every field shown is read from it; absent fields are left out. */
  result: AnswerResult
  /** Instant when true: no unrolling. */
  reduced: boolean
  onContinue(): void
}

/** Said under every wrong answer: the missed question goes to the review queue. */
export const SAVED_TO_MEMORIES = 'Saved to Memories. You will meet it again in the Daily Haunt.'

/** The offline demo has no review queue, so it cannot promise Memories. */
export const SAVED_FOR_REVIEW_OFFLINE = 'Saved for review. Sign in online to keep it in Memories.'

/** The words a screen reader hears when the scroll opens (sent to the play screen's single live region). Built only from what the response carries. */
export function scrollAnnouncement(result: Pick<AnswerResult, 'correct_answer' | 'explanation'>): string {
  const parts = ['Memory scroll.']
  if (result.correct_answer) parts.push(`The correct answer is ${result.correct_answer}.`)
  if (result.explanation?.trim()) parts.push(result.explanation.trim())
  return parts.join(' ')
}

/**
 * Memory scroll: a parchment that unrolls under a wrong answer with what the notes say. It shows the
 * correct answer (when the Backend revealed it), the explanation, the quote and the page, then says the
 * question was saved to Memories. The missed question is not asked again at once. Focus moves to Continue.
 */
export function MemoryScroll({ result, reduced, onContinue }: MemoryScrollProps) {
  const continueRef = useRef<HTMLButtonElement>(null)
  const offline = useOfflineMode()

  useEffect(() => {
    continueRef.current?.focus()
    sfx.play('scroll')
  }, [])

  const quote = result.evidence_quote?.trim()
  // SourceLine shows the page when there is one and the quote otherwise; with a page, the quote gets its own line.
  const quoteApart = Boolean(result.source && quote)

  return (
    <section
      className="sd-scroll"
      data-testid="memory-scroll"
      data-reduced={reduced ? 'true' : undefined}
      aria-label="Memory scroll"
    >
      <span aria-hidden="true" className="sd-scroll__rod sd-scroll__rod--top" />
      <div className="sd-scroll__paper">
        <p className="sd-scroll__title">
          <ScrollText aria-hidden="true" size={16} />
          Memory scroll
        </p>
        {result.correct_answer && (
          <p className="sd-scroll__answer" data-testid="scroll-answer">
            <span className="sd-scroll__label">The answer</span>
            <span>{result.correct_answer}</span>
          </p>
        )}
        <SourceLine
          source={result.source}
          explanation={result.explanation}
          evidenceQuote={result.evidence_quote}
          className="sd-scroll__source px-2 py-1"
        />
        {quoteApart && (
          <blockquote className="sd-scroll__quote" data-testid="scroll-quote">
            {`"${quote}"`}
          </blockquote>
        )}
        <p className="sd-scroll__saved" data-testid="scroll-saved">{offline ? SAVED_FOR_REVIEW_OFFLINE : SAVED_TO_MEMORIES}</p>
        <div className="sd-scroll__actions">
          <button ref={continueRef} type="button" className="sd-speech__btn sd-speech__btn--primary" onClick={onContinue}>
            Continue
          </button>
        </div>
      </div>
      <span aria-hidden="true" className="sd-scroll__rod sd-scroll__rod--bottom" />
    </section>
  )
}
