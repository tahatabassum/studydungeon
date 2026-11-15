import { useState } from 'react'
import { scrollAnnouncement } from '@/learning/MemoryScroll'
import type { CombatState } from '@/state/combatMachine'
import type { AnswerResult } from '@/types/api'

/** Text for the one polite live region of the play screen. Every number is shown as the backend sent it. */
export interface PlayAnnouncementInput {
  combat: CombatState | null
  result: AnswerResult | null
  /** Display-only HP lost on the last answer (see `damageReceived`). */
  damageReceived?: number
  isRevenant?: boolean
  lowHealth?: boolean
  /** "Room cleared! +N XP" text while the room-cleared banner shows. */
  roomCleared?: string | null
  hallRest?: boolean
  /** Message from `useLevelAnnouncement`. */
  level?: string
  /** Shell message (for example a rejected fullscreen request). */
  shell?: string
}

function resultVisible(c: CombatState | null): boolean {
  return c === 'result' || c === 'next' || c === 'monster_defeated' || c === 'player_defeated'
}

/** Words for one answer result; empty when no result is on screen. */
export function resultAnnouncement(input: Pick<PlayAnnouncementInput, 'combat' | 'result' | 'damageReceived' | 'isRevenant' | 'lowHealth'>): string {
  const { combat, result } = input
  if (!result || !resultVisible(combat)) return ''
  if (result.correct) {
    return input.isRevenant ? 'Correct. Memory laid to rest.' : `Correct. You dealt ${result.damage_dealt} damage.`
  }
  const parts = [`Incorrect. You took ${input.damageReceived ?? 0} damage.`]
  if (input.lowHealth) parts.push('Low health.')
  // The Memory scroll opens once the hit animation settles (the waiting states).
  if (combat !== 'result') parts.push(scrollAnnouncement(result))
  return parts.join(' ')
}

export function composeAnnouncement(input: PlayAnnouncementInput): string {
  return [resultAnnouncement(input), input.roomCleared ?? '', input.hallRest ? 'This hall is at rest. The gate opens.' : '', input.level ?? '', input.shell ?? '']
    .filter((p) => p !== '')
    .join(' ')
}

/**
 * Sends the composed text to exactly one polite region: the dialog's own region while the encounter
 * dialog is open (a modal dialog may hide regions outside it), otherwise the AppShell region.
 */
export function routeAnnouncement(text: string, dialogOpen: boolean): { dialog: string; shell: string } {
  return dialogOpen ? { dialog: text, shell: '' } : { dialog: '', shell: text }
}

/** "Level N" message when the level (as returned by the server) rises; empty otherwise. */
export function levelMessage(prev: number | undefined, next: number | undefined): string {
  return prev !== undefined && next !== undefined && next > prev ? `Level up. You are now level ${next}.` : ''
}

/**
 * Remembers the last level change so the live region keeps it while it is on screen.
 * `expire` (true once the next question is up) clears it so it is never read twice.
 */
export function useLevelAnnouncement(level: number | undefined, expire: boolean): string {
  const [seen, setSeen] = useState(level)
  const [message, setMessage] = useState('')
  if (level !== seen) {
    setSeen(level)
    const m = levelMessage(seen, level)
    if (m) setMessage(m)
  } else if (expire && message) {
    setMessage('')
  }
  return message
}
