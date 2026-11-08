import { useEffect, useId, useRef, useState } from 'react'
import { Check, X } from 'lucide-react'
import { motion, useReducedMotion } from 'framer-motion'
import { canAnswer, type CombatState } from '../state/combatMachine'
import type { AnswerResult, Question } from '../types/api'
import { Button } from './Button'
import { SourceLine } from './SourceLine'
import '../styles/hud.css'
import '../styles/spellbook.css'

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
  const nextRef = useRef<HTMLDivElement>(null)
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
    panelRef.current?.focus()
  }, [question.id, answerable])

  // Move focus to Next when a result is waiting.
  useEffect(() => {
    if (waiting) nextRef.current?.querySelector('button')?.focus()
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
      data-reduced={reduceMotion ? 'true' : undefined}
      className="sd-stone relative w-full max-w-3xl outline-none focus:outline-none rounded-xl border-4 p-1"
    >
      <span aria-hidden="true" className="pointer-events-none absolute left-1 top-1 h-4 w-4 rounded-tl border-l-4 border-t-4 border-gold" />
      <span aria-hidden="true" className="pointer-events-none absolute right-1 top-1 h-4 w-4 rounded-tr border-r-4 border-t-4 border-gold" />
      <span aria-hidden="true" className="pointer-events-none absolute bottom-1 left-1 h-4 w-4 rounded-bl border-b-4 border-l-4 border-gold" />
      <span aria-hidden="true" className="pointer-events-none absolute bottom-1 right-1 h-4 w-4 rounded-br border-b-4 border-r-4 border-gold" />
      <motion.div
        key={question.id}
        initial={reduceMotion ? false : { opacity: 0, y: 16, scale: 0.97 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: reduceMotion ? 0 : 0.2 }}
        className="sd-parchment rounded-lg border border-deep/60 p-3 text-bg sm:p-4"
      >
        <span aria-hidden="true" data-testid="spellbook-candle" className="sd-candle">
          <span className="sd-candle__body" />
          <span className="sd-flame" />
        </span>
        {monsterName && (
          <p className="mb-1 border-b border-deep/30 pb-0.5 pr-5 font-[family-name:var(--font-display)] text-sm text-deep">
            {monsterName} blocks your way
          </p>
        )}
        <h2 id={headingId} className="pr-5 font-[family-name:var(--font-body)] text-base font-semibold leading-snug sm:text-lg">
          {question.prompt}
        </h2>

        <ul className="mt-2 grid grid-cols-1 gap-1.5 @[420px]:grid-cols-2">
          {options.map((opt, i) => {
            const isSelected = selected === opt
            const tone =
              shownResult && isSelected
                ? shownResult.correct
                  ? 'border-health bg-health/30'
                  : 'border-danger bg-danger/20'
                : isSelected
                  ? 'border-magic bg-magic/20'
                  : 'border-deep/40 bg-bg/5 hover:enabled:border-magic hover:enabled:bg-magic/15'
            return (
              <li key={opt}>
                <button
                  type="button"
                  disabled={!answerable}
                  aria-pressed={shownResult ? isSelected : undefined}
                  onClick={() => submit(opt)}
                  className={`sd-ink-option flex h-full w-full items-center gap-2 rounded-lg border-2 px-2 py-1.5 text-left text-base leading-snug transition-colors focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:cursor-not-allowed disabled:opacity-80 ${tone}`}
                >
                  <span
                    aria-hidden="true"
                    className="flex h-6 w-6 shrink-0 items-center justify-center rounded bg-deep text-sm font-bold text-ink"
                  >
                    {i + 1}
                  </span>
                  <span>{opt}</span>
                  {shownResult && isSelected && (
                    <span aria-hidden="true" className="ml-auto inline-flex items-center gap-1 font-bold">
                      {shownResult.correct ? <Check className="size-4" /> : <X className="size-4" />}
                      <span>{shownResult.correct ? 'Correct' : 'Incorrect'}</span>
                    </span>
                  )}
                </button>
              </li>
            )
          })}
        </ul>

        {combat === 'submitting' && (
          <p role="status" className="mt-2 text-sm text-deep">
            Resolving your answer…
          </p>
        )}
        {error && (
          <p role="alert" className="mt-2 text-sm font-semibold text-danger">
            {error}
          </p>
        )}

        {combat === 'question' && onRetreat && (
          <div className="mt-2 flex justify-start">
            <Button
              variant="secondary"
              onClick={onRetreat}
              className="px-3! py-0.5! text-sm! text-deep!"
            >
              Retreat from battle
            </Button>
          </div>
        )}

        {shownResult && (
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <div className="flex flex-wrap items-center gap-2">
              <p
                role="status"
                className={`inline-flex items-center gap-2 rounded-md border-2 px-2 py-0.5 text-base font-bold ${shownResult.correct ? 'border-health bg-health/20 text-[color-mix(in_srgb,var(--color-health),var(--color-bg)_70%)]' : 'border-danger bg-danger/10 text-danger'}`}
              >
                {shownResult.correct ? (
                  <Check aria-hidden="true" className="size-5" />
                ) : (
                  <X aria-hidden="true" className="size-5" />
                )}
                <span>{shownResult.correct ? 'Correct!' : 'Incorrect'}</span>
              </p>
              <p className="rounded-full border border-deep/50 bg-deep/10 px-2 text-sm font-semibold text-bg">
                {shownResult.correct
                  ? `You dealt ${shownResult.damage_dealt} damage`
                  : `You took ${damageReceived ?? 0} damage`}
              </p>
            </div>
            <SourceLine
              source={shownResult.source}
              explanation={shownResult.explanation}
              className="min-w-0 flex-1 basis-48 px-2 py-1"
            />
            {waiting && (
              <div ref={nextRef} className="ml-auto flex justify-end">
                <Button onClick={onNext} className="px-5! py-1! text-base!">
                  Next
                </Button>
              </div>
            )}
          </div>
        )}
      </motion.div>
    </div>
  )
}
