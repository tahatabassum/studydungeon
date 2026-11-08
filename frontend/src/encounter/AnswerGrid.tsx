import { Check, X } from 'lucide-react'

export interface AnswerGridProps {
  options: readonly string[]
  /** True/false questions use two wide buttons instead of the 2x2 grid. */
  trueFalse: boolean
  disabled: boolean
  /** Option the player picked for this question, if any. */
  selected: string | null
  /** Outcome to show on the picked option once a result exists. */
  outcome: boolean | null
  onPick(option: string): void
}

/** Large answer buttons with number badges (keys 1 to 4). Names are the option text. */
export function AnswerGrid({ options, trueFalse, disabled, selected, outcome, onPick }: AnswerGridProps) {
  return (
    <ul className="sd-answers" data-layout={trueFalse ? 'wide' : 'grid'}>
      {options.map((opt, i) => {
        const isSelected = selected === opt
        const tone =
          outcome !== null && isSelected ? (outcome ? 'correct' : 'wrong') : isSelected ? 'picked' : undefined
        return (
          <li key={opt}>
            <button
              type="button"
              disabled={disabled}
              aria-pressed={outcome !== null ? isSelected : undefined}
              data-tone={tone}
              onClick={() => onPick(opt)}
              className="sd-answer"
            >
              <span aria-hidden="true" className="sd-answer__badge">
                {i + 1}
              </span>
              <span>{opt}</span>
              {outcome !== null && isSelected && (
                <span aria-hidden="true" className="ml-auto inline-flex items-center gap-1 font-bold">
                  {outcome ? <Check className="size-4" /> : <X className="size-4" />}
                  <span>{outcome ? 'Correct' : 'Incorrect'}</span>
                </span>
              )}
            </button>
          </li>
        )
      })}
    </ul>
  )
}
