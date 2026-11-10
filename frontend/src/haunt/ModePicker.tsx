import { useId, useState } from 'react'
import { OverlayFrame } from '../components/OverlayFrame'
import type { Floor } from '../types/api'
import '../styles/haunt.css'
import { EXAM_MINUTES, MODE_INFO, modePath, replayableFloors, type ExamMinutes } from './modes'

export interface ModePickerProps {
  dungeonId: string
  floors: readonly Floor[]
  /** Where to go: the route of the run to start. */
  onStart(path: string): void
  onClose(): void
}

type Step = 'menu' | 'exam' | 'replay'

/**
 * Weak Topics, Exam and Replay Floor. Weak Topics starts at once. Exam asks for a timer first (off by
 * default, then 10, 20 or 30 minutes). Replay lists only cleared floors.
 */
export function ModePicker({ dungeonId, floors, onStart, onClose }: ModePickerProps) {
  const [step, setStep] = useState<Step>('menu')
  // 0 means no timer: the default.
  const [minutes, setMinutes] = useState<0 | ExamMinutes>(0)
  const groupId = useId()
  const cleared = replayableFloors(floors)

  const title = step === 'menu' ? 'Practice modes' : MODE_INFO[step === 'exam' ? 'exam' : 'replay_floor'].label

  return (
    <OverlayFrame title={title} titleId="mode-picker-title" initialFocus="button" onEscape={onClose} widthClass="max-w-lg">
      {step === 'menu' && (
        <div className="sd-modes" data-testid="mode-picker">
          <button type="button" className="sd-modes__opt" data-testid="mode-weak" onClick={() => onStart(modePath(dungeonId, 'weak_topics'))}>
            <span className="sd-modes__name">{MODE_INFO.weak_topics.label}</span>
            <span className="sd-modes__blurb">{MODE_INFO.weak_topics.blurb}</span>
          </button>
          <button type="button" className="sd-modes__opt" data-testid="mode-exam" onClick={() => setStep('exam')}>
            <span className="sd-modes__name">{MODE_INFO.exam.label}</span>
            <span className="sd-modes__blurb">{MODE_INFO.exam.blurb}</span>
          </button>
          <button type="button" className="sd-modes__opt" data-testid="mode-replay" onClick={() => setStep('replay')}>
            <span className="sd-modes__name">{MODE_INFO.replay_floor.label}</span>
            <span className="sd-modes__blurb">{MODE_INFO.replay_floor.blurb}</span>
          </button>
          <div className="sd-modes__actions">
            <button type="button" className="sd-ghost-btn" onClick={onClose}>
              Close
            </button>
          </div>
        </div>
      )}

      {step === 'exam' && (
        <div className="sd-modes" data-testid="exam-options">
          <fieldset className="sd-modes__group">
            <legend>Timer</legend>
            <label className="sd-modes__radio">
              <input type="radio" name={groupId} checked={minutes === 0} onChange={() => setMinutes(0)} />
              No timer
            </label>
            {EXAM_MINUTES.map((m) => (
              <label key={m} className="sd-modes__radio">
                <input type="radio" name={groupId} checked={minutes === m} onChange={() => setMinutes(m)} />
                {`${m} minutes`}
              </label>
            ))}
          </fieldset>
          <p className="sd-modes__blurb">With a timer on, the exam ends when it reaches zero and you see your results.</p>
          <div className="sd-modes__actions">
            <button type="button" className="sd-ghost-btn" onClick={() => setStep('menu')}>
              Back
            </button>
            <button
              type="button"
              className="sd-cta"
              data-testid="exam-start"
              onClick={() => onStart(modePath(dungeonId, 'exam', { minutes: minutes === 0 ? null : minutes }))}
            >
              Start the exam
            </button>
          </div>
        </div>
      )}

      {step === 'replay' && (
        <div className="sd-modes" data-testid="replay-options">
          {cleared.length === 0 ? (
            <p className="sd-modes__blurb">No cleared floors yet. Clear a floor first, then you can replay it here.</p>
          ) : (
            cleared.map((f) => (
              <button
                key={f.id}
                type="button"
                className="sd-modes__opt"
                data-testid={`replay-${f.id}`}
                onClick={() => onStart(modePath(dungeonId, 'replay_floor', { floorId: f.id }))}
              >
                <span className="sd-modes__name">{`Floor ${f.index}, ${f.title}`}</span>
              </button>
            ))
          )}
          <div className="sd-modes__actions">
            <button type="button" className="sd-ghost-btn" onClick={() => setStep('menu')}>
              Back
            </button>
          </div>
        </div>
      )}
    </OverlayFrame>
  )
}
