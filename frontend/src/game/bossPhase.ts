/**
 * Boss phase, derived ONLY from the monster HP values received from the backend (Req 8.1).
 * Pure TypeScript, no Phaser import.
 */
export type BossPhase = 'normal' | 'enraged' | 'defeated'

/** Fraction of max HP below which the boss is enraged (60 of 120 stays normal; 59 is enraged). */
export const ENRAGE_BELOW = 0.5

export function bossPhase(hp: number, maxHp: number): BossPhase {
  if (!(maxHp > 0)) return 'normal'
  if (hp <= 0) return 'defeated'
  return hp / maxHp < ENRAGE_BELOW ? 'enraged' : 'normal'
}
