import type { ReactNode } from 'react'
import { playPath } from '../campaign/CampaignPage'
import type { DashboardDungeon } from './useDashboardDungeon'

/** The one Primary_CTA the Dashboard Hero shows. */
export type HeroCta =
  | { kind: 'continue'; to: string; label: string }
  | { kind: 'daily-haunt'; slot: ReactNode }
  | { kind: 'play-demo'; label: string; onClick: () => void; pending: boolean }
  | { kind: 'loading' }

export interface ChooseHeroCtaInput {
  isGuest: boolean
  demoPending: boolean
  dungeonId: string | null
  /** Only `status` and `next` are read. */
  dungeon: Pick<DashboardDungeon, 'status' | 'next'>
  dailyHauntSlot?: ReactNode
  onPlayDemo: () => void
}

/**
 * Derives exactly one CTA. Order:
 * 1. Guest: Play the Demo.
 * 2. Player whose dungeon is still loading: loading skeleton.
 * 3. Player with a next playable floor: Continue (floor play route, or the map when the target is unknown).
 * 4. Player with a Daily Haunt slot: the slot.
 * 5. Otherwise (no dungeon, or nothing playable): Play the Demo, which always exists.
 */
export function chooseHeroCta(input: ChooseHeroCtaInput): HeroCta {
  const { isGuest, demoPending, dungeonId, dungeon, dailyHauntSlot, onPlayDemo } = input
  const demo: HeroCta = { kind: 'play-demo', label: 'Play the Demo', onClick: onPlayDemo, pending: demoPending }
  if (isGuest) return demo
  if (dungeonId && dungeon.status === 'loading') return { kind: 'loading' }
  if (dungeonId && dungeon.next) {
    const { next } = dungeon
    const id = next.type === 'floor' ? next.floor.id : next.boss.id
    return { kind: 'continue', to: playPath(dungeonId, id), label: 'Continue the Dungeon' }
  }
  if (dailyHauntSlot !== undefined && dailyHauntSlot !== null && dailyHauntSlot !== false) {
    return { kind: 'daily-haunt', slot: dailyHauntSlot }
  }
  return demo
}
