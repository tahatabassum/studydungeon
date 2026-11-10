import { useSyncExternalStore } from 'react'
import type { WeaponId } from '@/types/api'

/**
 * The weapon the player chose in the Armory (frontend-08 task 13.7). UI state only, kept in memory: it is
 * not persisted and holds no progress. `null` means "automatic": the best unlocked weapon is used.
 *
 * It is sent with every attempt as `weapon_id`. In mock mode the adapter honours it when the weapon is
 * unlocked; in real mode the Http_Client sends it as the existing `weapon_name` request field and the
 * backend validates it (WEAPON_LOCKED / UNKNOWN_WEAPON are handled with a friendly message).
 */
let equipped: WeaponId | null = null
const listeners = new Set<() => void>()

export function getEquippedWeapon(): WeaponId | null {
  return equipped
}

export function setEquippedWeapon(id: WeaponId | null): void {
  if (equipped === id) return
  equipped = id
  listeners.forEach((l) => l())
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

/** React hook: the current equipped weapon id (or null for automatic). */
export function useEquippedWeapon(): WeaponId | null {
  return useSyncExternalStore(subscribe, getEquippedWeapon, getEquippedWeapon)
}
