import { BookOpen } from 'lucide-react'
import type { AnswerResult } from '../types/api'

export interface SourceLineProps {
  /** Absent in real mode: the line then shows the evidence quote instead of a page. */
  source?: AnswerResult['source']
  /** Optional; rendered only when a non-empty string. */
  explanation?: string
  /** Real mode: the quote from the player's notes that grounds the answer. */
  evidenceQuote?: string
  /** Layout override (replaces the default margin/padding). */
  className?: string
}

/** Parchment footnote: where in the player's notes the answer comes from. */
export function SourceLine({ source, explanation, evidenceQuote, className }: SourceLineProps) {
  const hasExplanation = typeof explanation === 'string' && explanation.trim().length > 0
  const hasQuote = typeof evidenceQuote === 'string' && evidenceQuote.trim().length > 0
  // Nothing to cite: show nothing rather than an empty box.
  if (!source && !hasQuote && !hasExplanation) return null
  return (
    <div
      className={`flex items-start gap-2 rounded-md border-t-2 border-dashed border-deep/50 bg-deep/10 text-sm leading-snug text-bg ${className ?? 'mt-3 px-3 py-2'}`}
    >
      <BookOpen aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-deep" />
      <div>
        {source ? (
          <p className="font-semibold italic">From your notes: page {source.page}</p>
        ) : hasQuote ? (
          <p className="font-semibold italic">{`From your notes: "${evidenceQuote?.trim() ?? ''}"`}</p>
        ) : null}
        {hasExplanation && <p className="mt-1">{explanation}</p>}
      </div>
    </div>
  )
}
