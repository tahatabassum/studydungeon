import type { AnswerResult } from '../types/api'

export interface SourceLineProps {
  source: AnswerResult['source']
  /** Optional; rendered only when a non-empty string. */
  explanation?: string
}

export function SourceLine({ source, explanation }: SourceLineProps) {
  const hasExplanation = typeof explanation === 'string' && explanation.trim().length > 0
  return (
    <div className="mt-3 rounded-md border border-amber/60 bg-amber/10 px-3 py-2 text-sm text-stone-800">
      <p className="font-semibold">From your notes: page {source.page}</p>
      {hasExplanation && <p className="mt-1">{explanation}</p>}
    </div>
  )
}
