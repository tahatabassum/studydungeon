import type { Pose } from '@/art/portraits/types'
import type { CombatState } from '@/state/combatMachine'

/**
 * Portrait pose from the combat state and the backend's verdict only.
 * Returns null when no encounter state applies (the popup then keeps its last pose).
 */
export function poseFor(combat: CombatState | null, correct: boolean | null, typing: boolean): Pose | null {
  switch (combat) {
    case 'starting':
    case 'question':
      return typing ? 'talking' : 'idle'
    case 'submitting':
      return 'idle'
    case 'result':
    case 'next':
      return correct === null ? 'idle' : correct ? 'hurt' : 'taunt'
    case 'monster_defeated':
      return 'defeated'
    case 'player_defeated':
      return 'taunt'
    default:
      return null
  }
}
