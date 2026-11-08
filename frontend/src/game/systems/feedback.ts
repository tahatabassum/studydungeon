/** Pure description of the answer feedback visuals (no Phaser). Display only. */
export interface FeedbackPlan {
  kind: 'wisp' | 'curse'
  /** Wisps in the green ghost burst (correct answers). */
  wisps: number
  /** Peak alpha of the curse tint (wrong answers). */
  tintAlpha: number
  /** Time the tint stays at its peak before fading. 0 means it fades at once. */
  holdMs: number
  fadeMs: number
  /** True when the tint is a single quick flash; false for the static fading tint. */
  flash: boolean
  /** Wisps drift and fade (false: they stay still briefly). */
  animated: boolean
}

export const WISP_COUNT = 6
export const WISP_COUNT_REDUCED = 3

export function feedbackPlan(correct: boolean, reduced: boolean): FeedbackPlan {
  if (correct) {
    return {
      kind: 'wisp',
      wisps: reduced ? WISP_COUNT_REDUCED : WISP_COUNT,
      tintAlpha: 0,
      holdMs: 0,
      fadeMs: 0,
      flash: false,
      animated: !reduced,
    }
  }
  return reduced
    ? { kind: 'curse', wisps: 0, tintAlpha: 0.14, holdMs: 250, fadeMs: 500, flash: false, animated: false }
    : { kind: 'curse', wisps: 0, tintAlpha: 0.3, holdMs: 0, fadeMs: 350, flash: true, animated: true }
}
