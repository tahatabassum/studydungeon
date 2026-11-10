import type { FloorStatus } from '../../types/api'

/**
 * MOCK-ONLY floor generation over time (D19). Floors are summoned one at a time: Floor n (0-based)
 * starts generating at `n * stepMs` and is ready one `stepMs` later, unless it is forced to fail.
 * Status moves forward only: generating, then ready or failed.
 */
export const GENERATION_STEP_MS = 4000

export type GenerationPhase = 'queued' | 'generating' | 'ready' | 'failed'

export interface GenerationPlan {
  stepMs?: number
  /** 0-based index of a floor that fails instead of becoming ready (dev switch). */
  failIndex?: number | null
}

/** The phase of floor `index` after `elapsedMs`. A negative elapsed time counts as zero. */
export function phaseAt(index: number, elapsedMs: number, plan: GenerationPlan = {}): GenerationPhase {
  const step = plan.stepMs ?? GENERATION_STEP_MS
  const t = Math.max(0, elapsedMs)
  const start = index * step
  if (t < start) return 'queued'
  if (t < start + step) return 'generating'
  return plan.failIndex === index ? 'failed' : 'ready'
}

/** Maps a phase to a Floor status. `queued` floors are shown as locked until their turn. */
export function statusOfPhase(phase: GenerationPhase): FloorStatus {
  if (phase === 'queued') return 'locked'
  return phase
}

export interface GenerationSim {
  statuses(elapsedMs: number): FloorStatus[]
  /** Restarts a failed floor: it generates again for one step, then becomes ready. Returns false when not failed. */
  retry(index: number, elapsedMs: number): boolean
}

/** A stateful wrapper over `phaseAt` for the mock adapter and the dev route. */
export function createGenerationSim(count: number, plan: GenerationPlan = {}): GenerationSim {
  const step = plan.stepMs ?? GENERATION_STEP_MS
  const retriedAt = new Map<number, number>()
  const failIndex = plan.failIndex ?? null
  return {
    statuses(elapsedMs) {
      return Array.from({ length: count }, (_, i) => {
        const at = retriedAt.get(i)
        if (at !== undefined) {
          return elapsedMs - at < step ? 'generating' : 'ready'
        }
        return statusOfPhase(phaseAt(i, elapsedMs, { stepMs: step, failIndex }))
      })
    },
    retry(index, elapsedMs) {
      const current = this.statuses(elapsedMs)[index]
      if (current !== 'failed') return false
      retriedAt.set(index, elapsedMs)
      return true
    },
  }
}
