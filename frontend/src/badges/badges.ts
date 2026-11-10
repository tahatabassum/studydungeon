import { Crown, Flame, Ghost, ShieldCheck, Skull, Sparkles, Swords, Timer, type LucideIcon } from 'lucide-react'
import type { BadgeId } from '../types/api'

/**
 * Badge catalog (D26): ids, labels, rule text and line icons. The rules that award badges come in a later
 * phase (the backend decides in real mode); this file only describes how a badge looks.
 */
export interface BadgeInfo {
  id: BadgeId
  label: string
  /** How the badge is earned, in words (shown for locked badges too). */
  hint: string
  icon: LucideIcon
}

export const BADGES: readonly BadgeInfo[] = Object.freeze([
  { id: 'first_blood', label: 'First Blood', hint: 'Answer a question correctly', icon: Swords },
  { id: 'streak_5', label: 'On Fire', hint: 'Reach a streak of 5', icon: Flame },
  { id: 'perfect_room', label: 'Flawless Room', hint: 'Clear a room without a wrong answer', icon: Sparkles },
  { id: 'no_damage', label: 'Untouched', hint: 'Finish a run without taking damage', icon: ShieldCheck },
  { id: 'boss_slayer', label: 'Boss Slayer', hint: 'Defeat a boss', icon: Skull },
  { id: 'memory_keeper', label: 'Memory Keeper', hint: 'Lay 3 haunted memories to rest', icon: Ghost },
  { id: 'speed_reader', label: 'Speed Reader', hint: 'Answer quickly after reading', icon: Timer },
  { id: 'dungeon_master', label: 'Dungeon Master', hint: 'Clear every floor and the final boss, finishing without damage', icon: Crown },
] as const)

const BY_ID: ReadonlyMap<string, BadgeInfo> = new Map(BADGES.map((b) => [b.id, b]))

/** Info for a badge id; undefined for an id this build does not know. */
export function badgeInfo(id: string): BadgeInfo | undefined {
  return BY_ID.get(id)
}
