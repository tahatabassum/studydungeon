import { useCallback, useRef, useState } from 'react'
import type { KeyboardEvent } from 'react'
import { useReducedMotion } from 'framer-motion'
import { Footprints, Ghost, Sword, User } from 'lucide-react'
import '../styles/tutorial.css'
import { sfx } from '../audio/sfx'
import { Button } from '../components/Button'
import { OverlayFrame } from '../components/OverlayFrame'
import { MemoryScroll } from '../learning/MemoryScroll'
import { hasSeenIntro, markIntroSeen } from '../lore/intro'
import { IntroStory } from '../lore/IntroStory'
import {
  CORRIDOR_LENGTH,
  MOVE_KEYS,
  TUTORIAL_QUESTION,
  TUTORIAL_SCROLL_RESULT,
  TUTORIAL_STEPS,
} from './steps'
import { markTutorialSeen } from './tutorialFlag'

export interface TutorialFlowProps {
  /** Called once when the whole first run is finished or skipped. The flags are already stored. */
  onDone(reason: 'finished' | 'skipped'): void
  /** Show the intro cards first. Defaults to "the intro has not been seen yet". */
  includeIntro?: boolean
}

type Stage = 'intro' | number

/** Moves needed to stand next to the monster. */
const MOVES_TO_REACH = CORRIDOR_LENGTH - 2

/**
 * The merged first-run flow (D14): the intro cards, then five short interactive steps (move, engage,
 * answer, memory scroll, Daily Haunt) on a scripted practice encounter. Nothing here calls the API, starts
 * a run or changes progress. Skip is available on every step (button or Esc) and counts the whole first run
 * as seen. Keyboard: arrows or WASD, E or Enter, Tab and Space on the buttons. A polite live region reads
 * each instruction and the practice feedback. Under reduced motion nothing moves or fades.
 */
export function TutorialFlow({ onDone, includeIntro }: TutorialFlowProps) {
  const reduced = !!useReducedMotion()
  const [stage, setStage] = useState<Stage>(() => ((includeIntro ?? !hasSeenIntro()) ? 'intro' : 0))
  const [moves, setMoves] = useState(0)
  const [picked, setPicked] = useState<string | null>(null)
  const [status, setStatus] = useState('')
  const stageRef = useRef<Stage>(stage)

  const finish = useCallback(
    (reason: 'finished' | 'skipped') => {
      markTutorialSeen()
      onDone(reason)
    },
    [onDone],
  )

  const go = useCallback((from: Stage, to: Stage) => {
    // Idempotent: a key and a button click for the same step cannot advance twice.
    if (stageRef.current !== from) return
    stageRef.current = to
    setStage(to)
    setStatus('')
  }, [])

  if (stage === 'intro') {
    return (
      <IntroStory
        onDone={(reason) => {
          markIntroSeen()
          // Skipping the intro skips the whole first run; finishing it continues with the practice steps.
          if (reason === 'skipped') finish('skipped')
          else go('intro', 0)
        }}
      />
    )
  }

  const step = TUTORIAL_STEPS[stage]
  const last = stage === TUTORIAL_STEPS.length - 1
  const adjacent = moves >= MOVES_TO_REACH
  const heroCell = Math.min(moves, CORRIDOR_LENGTH - 2)

  const walk = () => {
    if (stageRef.current !== 0) return
    const next = moves + 1
    setMoves(next)
    sfx.play('footstep')
    if (next >= MOVES_TO_REACH) {
      setStatus('You reached the monster.')
      go(0, 1)
    } else {
      setStatus(`Moved. ${MOVES_TO_REACH - next} more to go.`)
    }
  }
  const engage = () => {
    if (stageRef.current !== 1) return
    sfx.play('growl')
    go(1, 2)
  }
  const answer = (option: string) => {
    if (stageRef.current !== 2 || picked !== null) return
    const right = option === TUTORIAL_QUESTION.correct
    setPicked(option)
    sfx.play(right ? 'correct' : 'miss')
    setStatus(right ? 'Hit! That was right.' : 'Not quite. The memory scroll will show the answer.')
  }

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.ctrlKey || e.metaKey || e.altKey) return
    if (stage === 0 && MOVE_KEYS.has(e.key)) {
      e.preventDefault()
      walk()
    } else if (stage === 1 && (e.key === 'e' || e.key === 'E')) {
      e.preventDefault()
      engage()
    } else if (stage === 2) {
      const n = Number(e.key)
      if (Number.isInteger(n) && n >= 1 && n <= TUTORIAL_QUESTION.options.length) {
        e.preventDefault()
        answer(TUTORIAL_QUESTION.options[n - 1])
      }
    }
  }

  const primaryFocus = stage === 2 ? 'button[data-option]' : stage === 3 ? 'button' : 'button[data-primary]'

  return (
    <OverlayFrame
      key={step.id}
      title={step.title}
      titleId="tutorial-title"
      describedBy="tutorial-text"
      initialFocus={primaryFocus}
      onEscape={() => finish('skipped')}
      widthClass="max-w-xl"
      zClass="z-70"
    >
      {/* Keys pressed inside the dialog (arrows, WASD, E) drive the practice; buttons stay the keyboard-safe fallback. */}
      <div
        className="sd-tutorial"
        data-testid="tutorial"
        data-step={step.id}
        data-reduced={reduced ? 'true' : undefined}
        onKeyDown={onKeyDown}
      >
        <p className="sd-tutorial__count" data-testid="tutorial-count">{`Step ${stage + 1} of ${TUTORIAL_STEPS.length}`}</p>
        <p id="tutorial-text" className="sd-tutorial__text">
          {step.text}
        </p>

        {(stage === 0 || stage === 1) && (
          <div
            className="sd-tutorial__corridor"
            aria-hidden="true"
            data-testid="tutorial-corridor"
            data-hero={heroCell}
          >
            {Array.from({ length: CORRIDOR_LENGTH }, (_, i) => (
              <span key={i} className="sd-tutorial__cell" data-cell={i}>
                {i === heroCell && <User className="sd-tutorial__hero" size={22} />}
                {i === CORRIDOR_LENGTH - 1 && <Ghost className="sd-tutorial__monster" size={26} />}
              </span>
            ))}
          </div>
        )}

        {stage === 0 && (
          <Button data-primary onClick={walk}>
            <Footprints aria-hidden="true" size={16} />
            Walk forward
          </Button>
        )}
        {stage === 1 && (
          <Button data-primary onClick={engage} disabled={!adjacent}>
            <Sword aria-hidden="true" size={16} />
            Engage (E)
          </Button>
        )}

        {stage === 2 && (
          <div className="sd-tutorial__quiz" role="group" aria-labelledby="tutorial-q">
            <p id="tutorial-q" className="sd-tutorial__question">
              {TUTORIAL_QUESTION.prompt}
            </p>
            <div className="sd-tutorial__options">
              {TUTORIAL_QUESTION.options.map((o, i) => (
                <button
                  key={o}
                  type="button"
                  data-option
                  disabled={picked !== null}
                  aria-pressed={picked === o}
                  className="sd-tutorial__option"
                  onClick={() => answer(o)}
                >
                  <span className="sd-tutorial__num" aria-hidden="true">{i + 1}</span>
                  {o}
                </button>
              ))}
            </div>
            {picked !== null && (
              <Button data-primary onClick={() => go(2, 3)}>
                Next
              </Button>
            )}
          </div>
        )}

        {stage === 3 && (
          <MemoryScroll result={TUTORIAL_SCROLL_RESULT} reduced={reduced} onContinue={() => go(3, 4)} returnsIn={null} />
        )}

        {stage === 4 && (
          <p className="sd-tutorial__note" data-testid="tutorial-haunt-note">
            The Daily Haunt button is on your dashboard and on the campaign map. It only shows memories that are due.
          </p>
        )}

        <p className="sd-tutorial__live" role="status" aria-live="polite" data-testid="tutorial-live">
          {status}
        </p>

        <div className="sd-tutorial__actions font-(family-name:--font-label)">
          <Button variant="secondary" onClick={() => finish('skipped')} data-tutorial-skip>
            Skip tutorial
          </Button>
          {last && (
            <Button data-primary onClick={() => finish('finished')}>
              Start playing
            </Button>
          )}
        </div>
      </div>
    </OverlayFrame>
  )
}
