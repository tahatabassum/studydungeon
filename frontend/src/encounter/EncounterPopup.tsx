import { useEffect, useId, useRef, useState } from 'react'
import { Check, X } from 'lucide-react'
import { PortraitCanvas } from '@/art/portraits/PortraitCanvas'
import type { Pose } from '@/art/portraits/types'
import { hashString } from '@/art/room/rng'
import { SourceLine } from '@/components/SourceLine'
import { canAnswer, type CombatState } from '@/state/combatMachine'
import { useReducedMotion } from '@/state/useReducedMotion'
import type { AnswerResult, Question } from '@/types/api'
import { AnswerGrid } from './AnswerGrid'
import { entrySide } from './entrySide'
import { keyToOption } from './keys'
import { linesFor, pickLine } from './lines'
import { poseFor } from './pose'
import { SpeechPanel } from './SpeechPanel'
import { Typewriter } from './Typewriter'

/** Slide-out time; the pop-up stays mounted this long after the encounter ends. */
export const EXIT_MS = 300

/**
 * The parent (PlayPage) owns attempt_id generation, the Api_Client call and retry with the SAME
 * attempt_id: on error it simply calls onAnswer again via the re-enabled option buttons.
 * Every number shown comes from `result` or from `damageReceived`; nothing is computed here.
 */
export interface EncounterPopupProps {
  /** The current question, or null once the encounter is over (the pop-up then slides out). */
  question: Question | null
  combat: CombatState | null
  monsterName?: string
  monsterKind: string
  isBoss: boolean
  /** Room order (1-based); decides the side the character enters from. */
  roomOrder: number
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

/** Mounts the pop-up while a question is active and keeps it for the slide-out afterwards. */
export function EncounterPopup(props: EncounterPopupProps) {
  const reduced = useReducedMotion()
  const { question } = props
  const [held, setHeld] = useState<Question | null>(question)
  if (question !== null && question !== held) setHeld(question)

  useEffect(() => {
    if (question !== null || held === null) return
    const id = setTimeout(() => setHeld(null), reduced ? 0 : EXIT_MS)
    return () => clearTimeout(id)
  }, [question, held, reduced])

  const shown = question ?? (reduced ? null : held)
  if (!shown) return null
  return <EncounterBody {...props} question={shown} closing={question === null} reduced={reduced} />
}

interface BodyProps extends Omit<EncounterPopupProps, 'question'> {
  question: Question
  closing: boolean
  reduced: boolean
}

function EncounterBody({
  question,
  closing,
  reduced,
  combat,
  monsterName,
  monsterKind,
  isBoss,
  roomOrder,
  error,
  result,
  damageReceived,
  onAnswer,
  onNext,
  onRetreat,
  keysEnabled,
}: BodyProps) {
  const headingId = useId()
  const panelRef = useRef<HTMLDivElement>(null)
  const nextRef = useRef<HTMLDivElement>(null)
  const submittingRef = useRef(false)
  const side = entrySide(roomOrder, isBoss)
  // Keyed by question id so a stale selection never leaks into the next question.
  const [selection, setSelection] = useState<{ qid: string; opt: string } | null>(null)
  const selected = selection && selection.qid === question.id ? selection.opt : null
  // The taunt opens the encounter (first question only); the question types out after it.
  const [introId] = useState(question.id)
  const [tauntDone, setTauntDone] = useState(false)
  const [typedId, setTypedId] = useState<string | null>(null)

  const trueFalse = question.type === 'true_false'
  const options = trueFalse ? question.options.slice(0, 2) : question.options.slice(0, 4)
  const answerable = canAnswer(combat) && !closing
  const waiting = isWaiting(combat)
  const shownResult = showsResult(combat) ? (result ?? null) : null

  const lines = linesFor(monsterKind)
  const seed = hashString(question.id) + (shownResult?.streak ?? 0)
  const taunt = pickLine(lines.taunts, hashString(introId))
  const showIntro = question.id === introId
  const questionTyping = !showIntro || tauntDone
  const talking = (showIntro && !tauntDone) || typedId !== question.id

  const computedPose = poseFor(combat, shownResult ? shownResult.correct : null, talking)
  const [lastPose, setLastPose] = useState<Pose>('idle')
  if (computedPose !== null && computedPose !== lastPose) setLastPose(computedPose)
  const pose = computedPose ?? lastPose

  // Reaction after a correct answer, a taunt after a wrong one.
  const speakerLine = shownResult
    ? pickLine(shownResult.correct ? lines.reactions : lines.taunts, seed)
    : null

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
  const latest = useRef({ submit, options, keysEnabled, answerable, waiting, onNext, closing })
  useEffect(() => {
    latest.current = { submit, options, keysEnabled, answerable, waiting, onNext, closing }
  })

  // Focus moves into the speech panel (the container, not option 1) for each new question.
  useEffect(() => {
    if (!answerable) return
    panelRef.current?.focus()
  }, [question.id, answerable])

  // Move focus to Next when a result is waiting.
  useEffect(() => {
    if (waiting && !closing) nextRef.current?.querySelector('button')?.focus()
  }, [waiting, closing, question.id])

  // Return focus to the game when the pop-up goes away.
  useEffect(
    () => () => {
      document.querySelector<HTMLElement>('[role="application"]')?.focus()
    },
    [],
  )

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.repeat) return
      const cur = latest.current
      if (!cur.keysEnabled || cur.closing) return
      if (e.key === 'Enter') {
        if (!cur.waiting) return
        // A focused button handles Enter natively via click; avoid a double trigger.
        if (e.target instanceof HTMLElement && e.target.closest('button')) return
        e.preventDefault()
        cur.onNext()
        return
      }
      const opt = keyToOption(e.key, cur.options)
      if (opt !== null && cur.answerable) {
        e.preventDefault()
        cur.submit(opt)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  // Focus trap: Tab cycles inside the panel and focus cannot leave it while the pop-up owns the keys.
  useEffect(() => {
    const panel = panelRef.current
    if (!panel || !keysEnabled || closing) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Tab') return
      const items = Array.from(panel.querySelectorAll<HTMLElement>('button:not([disabled])'))
      if (items.length === 0) {
        e.preventDefault()
        panel.focus()
        return
      }
      const first = items[0]
      const last = items[items.length - 1]
      const active = document.activeElement
      if (!panel.contains(active) || (e.shiftKey && (active === first || active === panel))) {
        e.preventDefault()
        ;(e.shiftKey ? last : first).focus()
      } else if (!e.shiftKey && active === last) {
        e.preventDefault()
        first.focus()
      }
    }
    const onFocusIn = (e: FocusEvent) => {
      if (e.target instanceof Node && !panel.contains(e.target)) panel.focus()
    }
    window.addEventListener('keydown', onKey)
    document.addEventListener('focusin', onFocusIn)
    return () => {
      window.removeEventListener('keydown', onKey)
      document.removeEventListener('focusin', onFocusIn)
    }
  }, [keysEnabled, closing])

  // When the keys return (resume after pause), bring focus back into the panel.
  useEffect(() => {
    if (keysEnabled && !closing && panelRef.current && !panelRef.current.contains(document.activeElement)) {
      panelRef.current.focus()
    }
  }, [keysEnabled, closing])

  return (
    <div
      className="sd-encounter"
      data-side={side}
      data-closing={closing ? 'true' : undefined}
      data-reduced={reduced ? 'true' : undefined}
      data-testid="encounter-popup"
      aria-hidden={closing ? true : undefined}
    >
      <div aria-hidden="true" className="sd-encounter__scrim" />
      <div className="sd-stage">
      <div className="sd-encounter__slide">
        <PortraitCanvas kind={monsterKind} pose={pose} />
      </div>
      <SpeechPanel ref={panelRef} labelledBy={headingId}>
        {monsterName && <p className="sd-speech__name">{monsterName} blocks your way</p>}
        {speakerLine !== null ? (
          <p className="sd-speech__line">{speakerLine}</p>
        ) : (
          showIntro && (
            <p className="sd-speech__line">
              <Typewriter text={taunt} reduced={reduced} onDone={() => setTauntDone(true)} />
            </p>
          )
        )}
        <h2 id={headingId} className="sd-speech__prompt">
          <Typewriter
            text={question.prompt}
            reduced={reduced}
            enabled={questionTyping || shownResult !== null}
            onDone={() => setTypedId(question.id)}
          />
        </h2>

        <AnswerGrid
          options={options}
          trueFalse={trueFalse}
          disabled={!answerable}
          selected={selected}
          outcome={shownResult ? shownResult.correct : null}
          onPick={submit}
        />

        {combat === 'submitting' && (
          <p role="status" className="mt-2 text-sm text-deep">
            Resolving your answer…
          </p>
        )}
        {error && (
          <p role="alert" className="mt-2 text-sm font-semibold text-[color-mix(in_srgb,var(--color-danger),var(--color-bg)_45%)]">
            {error}
          </p>
        )}

        {combat === 'question' && onRetreat && !closing && (
          <div className="mt-3 flex justify-start">
            <button type="button" onClick={onRetreat} className="sd-speech__btn">
              Retreat from battle
            </button>
          </div>
        )}

        {shownResult && (
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <div className="flex flex-wrap items-center gap-2">
              <p
                role="status"
                className={`inline-flex items-center gap-2 rounded-md border-2 px-2 py-0.5 text-base font-bold ${shownResult.correct ? 'border-health bg-health/20 text-[color-mix(in_srgb,var(--color-health),var(--color-bg)_70%)]' : 'border-danger bg-danger/10 text-[color-mix(in_srgb,var(--color-danger),var(--color-bg)_45%)]'}`}
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
                <button type="button" onClick={onNext} className="sd-speech__btn sd-speech__btn--primary">
                  Next
                </button>
              </div>
            )}
          </div>
        )}
      </SpeechPanel>
      </div>
    </div>
  )
}
