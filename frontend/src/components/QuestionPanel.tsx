import { useEffect, useId, useRef, useState } from 'react'
import { motion, useReducedMotion } from 'framer-motion'
import type { AnswerResult, Question } from '../types/api'
import { SourceLine } from './SourceLine'

/**
 * Purely presentational. The parent (PlayPage) owns attempt_id generation,
 * the Api_Client call and retry with the SAME attempt_id: on error it simply
 * calls onAnswer again via the re-enabled option buttons.
 */
export interface QuestionPanelProps {
  question: Question
  monsterName?: string
  pending: boolean
  error?: string | null
  result?: AnswerResult | null
  onAnswer(selected: string): void
  onContinue?(): void
  returnFocusTo?: HTMLElement | null
}

export function QuestionPanel({
  question,
  monsterName,
  pending,
  error,
  result,
  onAnswer,
  onContinue,
  returnFocusTo,
}: QuestionPanelProps) {
  const headingId = useId()
  const reduceMotion = useReducedMotion()
  const panelRef = useRef<HTMLDivElement>(null)
  const continueRef = useRef<HTMLButtonElement>(null)
  const submittingRef = useRef(false)
  const [selected, setSelected] = useState<string | null>(null)

  const options = question.type === 'true_false' ? question.options.slice(0, 2) : question.options.slice(0, 4)
  const locked = pending || !!result

  // Release the double-submit guard once a pending request settles.
  useEffect(() => {
    if (!pending) submittingRef.current = false
  }, [pending, error, result])

  const submit = (opt: string) => {
    if (locked || submittingRef.current) return
    submittingRef.current = true
    setSelected(opt)
    onAnswer(opt)
  }
  const submitRef = useRef(submit)
  useEffect(() => {
    submitRef.current = submit
  })

  // Move focus in on mount; restore on unmount.
  useEffect(() => {
    const first = panelRef.current?.querySelector<HTMLButtonElement>('button:not(:disabled)')
    ;(first ?? panelRef.current)?.focus()
    return () => {
      returnFocusTo?.focus()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (result) continueRef.current?.focus()
  }, [result])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.repeat) return
      const n = Number(e.key)
      if (Number.isInteger(n) && n >= 1 && n <= options.length) {
        e.preventDefault()
        submitRef.current(options[n - 1])
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [question.id])

  return (
    <motion.div
      ref={panelRef}
      role="dialog"
      aria-modal="true"
      aria-labelledby={headingId}
      tabIndex={-1}
      initial={reduceMotion ? false : { opacity: 0, y: 16, scale: 0.97 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: reduceMotion ? 0 : 0.2 }}
      className="w-full max-w-xl rounded-xl border-4 border-double border-amber bg-parchment p-6 text-stone-900 shadow-[0_0_32px_rgba(233,162,59,0.45)]"
    >
      {monsterName && (
        <p className="mb-1 text-xs font-semibold uppercase tracking-widest text-purple">
          {monsterName} blocks your way
        </p>
      )}
      <h2 id={headingId} className="text-xl font-bold">
        {question.prompt}
      </h2>

      <ul className="mt-4 flex flex-col gap-2">
        {options.map((opt, i) => {
          const isSelected = selected === opt
          const tone =
            result && isSelected
              ? result.correct
                ? 'border-mint bg-mint/30'
                : 'border-blood bg-blood/20'
              : 'border-stone-400 bg-white/60 hover:enabled:border-purple'
          return (
            <li key={opt}>
              <button
                type="button"
                disabled={locked}
                aria-pressed={result ? isSelected : undefined}
                onClick={() => submit(opt)}
                className={`flex w-full items-center gap-3 rounded-lg border-2 px-3 py-2 text-left disabled:cursor-not-allowed disabled:opacity-80 ${tone}`}
              >
                <span
                  aria-hidden="true"
                  className="flex h-7 w-7 shrink-0 items-center justify-center rounded bg-purple text-sm font-bold text-parchment"
                >
                  {i + 1}
                </span>
                <span>{opt}</span>
              </button>
            </li>
          )
        })}
      </ul>

      {pending && (
        <p role="status" className="mt-3 text-sm text-stone-700">
          Resolving your answer…
        </p>
      )}
      {error && (
        <p role="alert" className="mt-3 text-sm font-semibold text-blood">
          {error}
        </p>
      )}

      {result && (
        <div className="mt-4">
          <p
            role="status"
            className={`text-lg font-bold ${result.correct ? 'text-emerald-700' : 'text-blood'}`}
          >
            {result.correct ? 'Correct! Your strike lands' : 'Wrong! The monster strikes back'}
          </p>
          <SourceLine source={result.source} explanation={result.explanation} />
          <div className="mt-4 flex justify-end">
            <button
              type="button"
              ref={continueRef}
              onClick={onContinue}
              className="rounded-lg bg-purple px-6 py-2 font-semibold text-parchment hover:brightness-125"
            >
              Continue
            </button>
          </div>
        </div>
      )}
    </motion.div>
  )
}
