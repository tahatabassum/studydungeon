import { useEffect, useRef, useState } from 'react'
import { RotateCcw, ScrollText } from 'lucide-react'
import { sfx } from '../audio/sfx'
import { SourceLine } from '../components/SourceLine'
import type { AnswerResult } from '../types/api'
import { RequeueNotice } from './RequeueNotice'
import '../styles/learning.css'

export interface MemoryScrollProps {
  /** The wrong answer's result. Every field shown is read from it; absent fields are left out. */
  result: AnswerResult
  /** Instant when true: no unrolling. */
  reduced: boolean
  /** Presents the same question again. Omit when a retry is not possible (for example the player has fallen). */
  onRetry?(): void
  onContinue(): void
  /** Further questions until the missed one returns, when the Backend scheduled a return. */
  returnsIn?: number | null
}

/** The words a screen reader hears when the scroll opens. Built only from what the response carries. */
export function scrollAnnouncement(result: Pick<AnswerResult, 'correct_answer' | 'explanation'>): string {
  const parts = ['Memory scroll.']
  if (result.correct_answer) parts.push(`The correct answer is ${result.correct_answer}.`)
  if (result.explanation?.trim()) parts.push(result.explanation.trim())
  return parts.join(' ')
}

/**
 * Memory scroll: a parchment that unrolls under a wrong answer with what the notes say. It shows the
 * correct answer (when the Backend revealed it), the explanation, the quote and the page, then offers a
 * quick retry or to continue. Focus moves to Retry (or Continue when a retry is not possible).
 */
export function MemoryScroll({ result, reduced, onRetry, onContinue, returnsIn = null }: MemoryScrollProps) {
  const retryRef = useRef<HTMLButtonElement>(null)
  const continueRef = useRef<HTMLButtonElement>(null)
  const [announced, setAnnounced] = useState('')

  useEffect(() => {
    ;(retryRef.current ?? continueRef.current)?.focus()
    sfx.play('scroll')
  }, [])
  // Filled after mount so the polite live region reads it as a change.
  useEffect(() => {
    const id = setTimeout(() => setAnnounced(scrollAnnouncement(result)), 0)
    return () => clearTimeout(id)
  }, [result])

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
        <div aria-live="polite" className="sr-only" data-testid="scroll-live">
          {announced}
        </div>
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
        {returnsIn !== null && <RequeueNotice remaining={returnsIn} className="sd-scroll__whisper" />}
        <div className="sd-scroll__actions">
          {onRetry && (
            <button ref={retryRef} type="button" className="sd-speech__btn sd-speech__btn--primary" onClick={onRetry}>
              <RotateCcw aria-hidden="true" size={15} />
              Quick retry
            </button>
          )}
          <button ref={continueRef} type="button" className={onRetry ? 'sd-speech__btn' : 'sd-speech__btn sd-speech__btn--primary'} onClick={onContinue}>
            Continue
          </button>
        </div>
      </div>
      <span aria-hidden="true" className="sd-scroll__rod sd-scroll__rod--bottom" />
    </section>
  )
}
