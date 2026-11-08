import { useEffect, useState } from 'react'

export const COUNT_UP_STEPS = 12
const STEP_MS = 60

/** Value shown at a given step (pure). Reaches `target` exactly at the last step. */
export function countUpValue(target: number, step: number, steps = COUNT_UP_STEPS): number {
  if (step >= steps) return target
  return Math.round((target * Math.max(0, step)) / steps)
}

/** Counts from 0 to `target` in discrete steps. Jumps to the final value when `reduced`. */
export function useCountUp(target: number, reduced: boolean): number {
  const [step, setStep] = useState(0)
  useEffect(() => {
    if (reduced) return
    const id = setInterval(() => {
      setStep((s) => {
        if (s + 1 >= COUNT_UP_STEPS) clearInterval(id)
        return Math.min(COUNT_UP_STEPS, s + 1)
      })
    }, STEP_MS)
    return () => clearInterval(id)
  }, [reduced])
  return reduced ? target : countUpValue(target, step)
}
