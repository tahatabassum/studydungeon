import type { CSSProperties } from 'react'
import { AlertTriangle, Check, Circle, Loader } from 'lucide-react'
import { STEP_LABELS, type StepState } from './steps'

const STATE_TEXT: Record<StepState, string> = {
  pending: 'waiting',
  active: 'in progress',
  done: 'done',
  stopped: 'stopped',
}

/** The five wizard steps in one slim row. State is icon plus (screen reader) text, never colour alone. */
export function StepList({ states }: { states: readonly StepState[] }) {
  const progress = states.filter((s) => s === 'done').length + (states.includes('active') ? 0.5 : 0)
  const style = { '--sd-up-progress': `${(progress / STEP_LABELS.length) * 100}%` } as CSSProperties
  return (
    <ol className="sd-up__steps" aria-label="Upload steps" data-testid="upload-steps" style={style}>
      {STEP_LABELS.map((label, i) => {
        const state = states[i]
        const Icon = state === 'done' ? Check : state === 'stopped' ? AlertTriangle : state === 'active' ? Loader : Circle
        return (
          <li key={label} className="sd-up__step" data-state={state} aria-current={state === 'active' ? 'step' : undefined}>
            <span className="sd-up__step-mark" aria-hidden="true">
              <Icon size={14} strokeWidth={2.5} />
            </span>
            <span className="sd-up__step-label">{label}</span>
            <span className="sd-up__step-state sr-only">{STATE_TEXT[state]}</span>
          </li>
        )
      })}
    </ol>
  )
}
