import { useEffect, useState } from 'react'
import { getApi } from '../api'
import { capabilityOf } from '../api/ApiClient'

/**
 * True once the active client is known and `accountUpgrade` is not off (D11). It starts false, so the screens
 * show the plain register call to action until the client has been resolved. An unreadable client counts as off.
 */
export function useUpgradeAvailable(): boolean {
  const [available, setAvailable] = useState(false)
  useEffect(() => {
    let cancelled = false
    void getApi()
      .then((api) => {
        if (!cancelled) setAvailable(capabilityOf(api, 'accountUpgrade') !== 'off')
      })
      .catch(() => {
        if (!cancelled) setAvailable(false)
      })
    return () => {
      cancelled = true
    }
  }, [])
  return available
}
