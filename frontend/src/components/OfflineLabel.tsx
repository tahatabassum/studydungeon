import { useSyncExternalStore } from 'react'
import { isApiOverridden, subscribeApiOverride } from '../api'
import '../styles/waking.css'

export const OFFLINE_LABEL = 'Offline demo - progress is not saved'

/** True while the Offline demo's client replaces the normal Api_Client. */
export function useOfflineMode(): boolean {
  return useSyncExternalStore(subscribeApiOverride, isApiOverridden, () => false)
}

/** The visible shell label while the Offline_Adapter is active (Req 14.4). Renders nothing otherwise. */
export function OfflineLabel() {
  const offline = useOfflineMode()
  if (!offline) return null
  return (
    <p role="status" className="sd-offline-label" data-testid="offline-label">
      {OFFLINE_LABEL}
    </p>
  )
}
