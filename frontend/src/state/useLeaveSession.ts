import { useCallback, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { getApi } from '../api'
import { useSession } from './SessionContext'

/** Leaves the session from any screen: ends the server session when a user exists (guest or not), always clears local state and returns to the title screen. */
export function useLeaveSession(): { leaving: boolean; leave: () => Promise<void> } {
  const navigate = useNavigate()
  const { user, clearSession } = useSession()
  const [leaving, setLeaving] = useState(false)
  const leave = useCallback(async () => {
    if (leaving) return
    setLeaving(true)
    try {
      if (user) {
        const api = await getApi()
        await api.logout()
      }
    } catch {
      // Already gone server-side; still leave locally.
    } finally {
      clearSession()
      navigate('/', { replace: true })
    }
  }, [leaving, user, clearSession, navigate])
  return { leaving, leave }
}
