import type { ChestReward } from '../types/api'

export interface ChestItemView {
  id: string
  kind: ChestReward['kind']
  label: string
  /** "+25" style text when the reward has an amount; null otherwise. */
  amountText: string | null
}

export interface ChestView {
  items: ChestItemView[]
}

/**
 * The Chest view model (Property 15): exactly the Backend `chest_rewards`, same items in the same order,
 * nothing added, merged or invented. An empty or missing list gives null, so no Chest is shown.
 */
export function chestView(rewards: readonly ChestReward[] | null | undefined): ChestView | null {
  if (!rewards || rewards.length === 0) return null
  return {
    items: rewards.map((r) => ({
      id: r.id,
      kind: r.kind,
      label: r.label,
      amountText: r.amount !== undefined ? `+${r.amount}` : null,
    })),
  }
}
