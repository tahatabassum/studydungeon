import type { UploadPhase } from './useUploadFlow'

export const STEP_LABELS = ['Upload', 'Read', 'Check relevance', 'Detect topics', 'Summon floors'] as const
export type StepState = 'pending' | 'active' | 'done' | 'stopped'

/**
 * The five steps for a phase. The server reports only a verdict, so the steps move on its word:
 * while it works, "Read" is the active step; a rejection stops "Check relevance"; a failure stops "Read".
 */
export function stepStates(phase: UploadPhase): StepState[] {
  switch (phase) {
    case 'idle':
    case 'staged':
      return ['pending', 'pending', 'pending', 'pending', 'pending']
    case 'uploading':
      return ['active', 'pending', 'pending', 'pending', 'pending']
    case 'processing':
      return ['done', 'active', 'pending', 'pending', 'pending']
    case 'accepted':
      return ['done', 'done', 'done', 'done', 'pending']
    case 'summoning':
      return ['done', 'done', 'done', 'done', 'active']
    case 'done':
      return ['done', 'done', 'done', 'done', 'done']
    case 'rejected':
      return ['done', 'done', 'stopped', 'pending', 'pending']
    case 'failed':
      return ['done', 'stopped', 'pending', 'pending', 'pending']
    case 'error':
      return ['stopped', 'pending', 'pending', 'pending', 'pending']
  }
}

/** Polite live-region sentence for a phase. Empty when there is nothing new to say. */
export function announcementFor(phase: UploadPhase, extra: { floors?: number; topics?: number; reason?: string | null; error?: string | null }): string {
  switch (phase) {
    case 'idle':
    case 'staged':
      return ''
    case 'uploading':
      return 'Uploading your notes...'
    case 'processing':
      return 'Reading your notes...'
    case 'accepted':
      return `Your notes passed the check. ${extra.topics ?? 0} ${extra.topics === 1 ? 'topic was' : 'topics were'} found.`
    case 'rejected':
      return `Your notes were rejected. ${extra.reason ?? ''}`.trim()
    case 'failed':
      return `Your notes could not be read. ${extra.reason ?? ''}`.trim()
    case 'error':
      return extra.error ?? 'The upload did not go through.'
    case 'summoning':
      return 'Summoning your floors...'
    case 'done':
      return `Your notes became ${extra.floors ?? 0} ${extra.floors === 1 ? 'floor' : 'floors'}.`
  }
}
