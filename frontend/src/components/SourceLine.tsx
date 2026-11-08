import { BookOpen } from 'lucide-react'
import type { AnswerResult } from '../types/api'

export interface SourceLineProps {
  source: AnswerResult['source']
  /** Optional; rendered only when a non-empty string. */
  explanation?: string
  /** Layout override (replaces the default margin/padding). */
  className?: string
}

/** Parchment footnote: where in the player's notes the answer comes from. */
export function SourceLine({ source, explanation, className }: SourceLineProps) {
  const hasExplanation = typeof explanation === 'string' && explanation.trim().length > 0
  return (
    <div
      className={`flex items-start gap-2 rounded-md border-t-2 border-dashed border-deep/50 bg-deep/10 text-sm leading-snug text-bg ${className ?? 'mt-3 px-3 py-2'}`}
    >
      <BookOpen aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-deep" />
      <div>
        <p className="font-semibold italic">From your notes: page {source.page}</p>
        {hasExplanation && <p className="mt-1">{explanation}</p>}
      </div>
    </div>
  )
}
