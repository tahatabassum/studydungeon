import { useEffect, useId, useRef, useState } from 'react'
import { Check, X } from 'lucide-react'
import { motion, useReducedMotion } from 'framer-motion'
import { canAnswer, type CombatState } from '../state/combatMachine'
import type { AnswerResult, Question } from '../types/api'
import { SourceLine } from './SourceLine'

/**
 * Mostly presentational. The parent (PlayPage) owns attempt_id generation,
 * the Api_Client call and retry with the SAME attempt_id: on error it simply
 * calls onAnswer again via the re-enabled option buttons.
 * The panel stays mounted for the whole encounter; `combat` drives what it shows.
 */
export interface QuestionPanelProps {
  question: Question
  combat: CombatState | null
  monsterName?: string
  error?: string | null
  result?: AnswerResult | null
  /** Display-only amount of HP the player lost on the last (wrong) answer. */
  damageReceived?: number
  onAnswer(selected: string): void
  onNext(): void
  onRetreat?(): void
  /** False while paused or while an overlay is open: number/Enter keys are ignored. */
  keysEnabled: boolean
}

function isWaiting(c: CombatState | null): boolean {
  return c === 'next' || c === 'monster_defeated' || c === 'player_defeated'
}

function showsResult(c: CombatState | null): boolean {
  return c === 'result' || isWaiting(c)
}

export function QuestionPanel({
  question,
  combat,
  monsterName,
  error,
  result,
  damageReceived,
  onAnswer,
  onNext,
  onRetreat,
  keysEnabled,
}: QuestionPanelProps) {
  const headingId = useId()
  const reduceMotion = useReducedMotion()
  const panelRef = useRef<HTMLDivElement>(null)
  const nextRef = useRef<HTMLButtonElement>(null)
  const submittingRef = useRef(false)
  // Keyed by question id so a stale selection never leaks into the next question.
  const [selection, setSelection] = useState<{ qid: string; opt: string } | null>(null)
  const selected = selection && selection.qid === question.id ? selection.opt : null

  const options = question.type === 'true_false' ? question.options.slice(0, 2) : question.options.slice(0, 4)
  const answerable = canAnswer(combat)
  const waiting = isWaiting(combat)
  const shownResult = showsResult(combat) ? (result ?? null) : null

  // Release the double-submit guard when the combat state or question changes (incl. retry after error).
  useEffect(() => {
    submittingRef.current = false
  }, [combat, error, question.id])

  const submit = (opt: string) => {
    if (!answerable || submittingRef.current) return
    submittingRef.current = true
    setSelection({ qid: question.id, opt })
    onAnswer(opt)
  }

  // Latest-props refs so the single window listener never goes stale.
  const latest = useRef({ submit, options, keysEnabled, answerable, waiting, onNext })
  useEffect(() => {
    latest.current = { submit, options, keysEnabled, answerable, waiting, onNext }
  })

  // Focus the first enabled option for each new question (and when answering becomes possible again).
  useEffect(() => {
    if (!answerable) return
    const first = panelRef.current?.querySelector<HTMLButtonElement>('ul button:not(:disabled)')
    ;(first ?? panelRef.current)?.focus()
  }, [question.id, answerable])

  // Move focus to Next when a result is waiting.
  useEffect(() => {
    if (waiting) nextRef.current?.focus()
  }, [waiting, question.id])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.repeat) return
      const cur = latest.current
      if (!cur.keysEnabled) return
      if (e.key === 'Enter') {
        if (!cur.waiting) return
        // A focused button handles Enter natively via click; avoid a double trigger.
        if (e.target instanceof HTMLElement && e.target.closest('button')) return
        e.preventDefault()
        cur.onNext()
        return
      }
      const n = Number(e.key)
      if (Number.isInteger(n) && n >= 1 && n <= cur.options.length && cur.answerable) {
        e.preventDefault()
        cur.submit(cur.options[n - 1])
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  return (
    <div
      ref={panelRef}
      role="dialog"
      aria-modal="true"
      aria-labelledby={headingId}
      tabIndex={-1}
      className="w-full max-w-xl rounded-xl border-4 border-double border-accent bg-ink p-6 text-bg shadow-[0_0_32px_color-mix(in_srgb,var(--color-accent)_45%,transparent)]"
    >
      <motion.div
        key={question.id}
        initial={reduceMotion ? false : { opacity: 0, y: 16, scale: 0.97 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: reduceMotion ? 0 : 0.2 }}
      >
        {monsterName && (
          <p className="mb-1 text-xs font-semibold uppercase tracking-widest text-deep">
            {monsterName} blocks your way
          </p>
        )}
        <h2 id={headingId} className="font-[family-name:var(--font-label)] text-xl font-bold">
          {question.prompt}
        </h2>

        <ul className="mt-4 flex flex-col gap-2">
          {options.map((opt, i) => {
            const isSelected = selected === opt
            const tone =
              shownResult && isSelected
                ? shownResult.correct
                  ? 'border-health bg-health/30'
                  : 'border-danger bg-danger/20'
                : 'border-deep/40 bg-bg/5 hover:enabled:border-magic'
            return (
              <li key={opt}>
                <button
                  type="button"
                  disabled={!answerable}
                  aria-pressed={shownResult ? isSelected : undefined}
                  onClick={() => submit(opt)}
                  className={`flex w-full items-center gap-3 rounded-lg border-2 px-3 py-2 text-left disabled:cursor-not-allowed disabled:opacity-80 ${tone}`}
                >
                  <span
                    aria-hidden="true"
                    className="flex h-7 w-7 shrink-0 items-center justify-center rounded bg-deep text-sm font-bold text-ink"
                  >
                    {i + 1}
                  </span>
                  <span>{opt}</span>
                  {shownResult && isSelected && (
                    <span className="ml-auto inline-flex items-center gap-1 font-bold">
                      {shownResult.correct ? (
                        <Check aria-hidden="true" className="size-4" />
                      ) : (
                        <X aria-hidden="true" className="size-4" />
                      )}
                      <span>{shownResult.correct ? 'Correct' : 'Incorrect'}</span>
                    </span>
                  )}
                </button>
              </li>
            )
          })}
        </ul>

        {combat === 'submitting' && (
          <p role="status" className="mt-3 text-sm text-deep">
            Resolving your answer…
          </p>
        )}
        {error && (
          <p role="alert" className="mt-3 text-sm font-semibold text-danger">
            {error}
          </p>
        )}

        {combat === 'question' && onRetreat && (
          <div className="mt-4 flex justify-start">
            <button
              type="button"
              onClick={onRetreat}
              className="rounded-lg border-2 border-deep/60 px-4 py-1 text-sm font-semibold text-deep hover:border-magic"
            >
              Retreat from battle
            </button>
          </div>
        )}

        {shownResult && (
          <div className="mt-4">
            <p
              role="status"
              className={`inline-flex items-center gap-2 text-lg font-bold ${shownResult.correct ? 'text-[color-mix(in_srgb,var(--color-health),var(--color-bg)_70%)]' : 'text-danger'}`}
            >
              {shownResult.correct ? (
                <Check aria-hidden="true" className="size-5" />
              ) : (
                <X aria-hidden="true" className="size-5" />
              )}
              <span>{shownResult.correct ? 'Correct!' : 'Incorrect'}</span>
            </p>
            <p className="mt-1 text-sm font-semibold">
              {shownResult.correct
                ? `You dealt ${shownResult.damage_dealt} damage`
                : `You took ${damageReceived ?? 0} damage`}
            </p>
            <SourceLine source={shownResult.source} explanation={shownResult.explanation} />
            {waiting && (
              <div className="mt-4 flex justify-end">
                <button
                  type="button"
                  ref={nextRef}
                  onClick={onNext}
                  className="rounded-lg bg-deep px-6 py-2 font-semibold text-ink hover:brightness-125"
                >
                  Next
                </button>
              </div>
            )}
          </div>
        )}
      </motion.div>
    </div>
  )
}
