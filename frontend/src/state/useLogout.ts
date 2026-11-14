import { useCallback, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { getApi } from '../api'
import { useSession } from './SessionContext'

/** Ends the cookie session on the server, then clears the in-memory session. A failed call still signs out locally. */
export function useLogout(): { loggingOut: boolean; logOut: () => Promise<void> } {
  const navigate = useNavigate()
  const { clearSession } = useSession()
  const [loggingOut, setLoggingOut] = useState(false)
  const logOut = useCallback(async () => {
    if (loggingOut) return
    setLoggingOut(true)
    try {
      const api = await getApi()
      await api.logout()
    } catch {
      // The cookie may already be gone; leaving is still right.
    } finally {
      clearSession()
      navigate('/')
    }
  }, [loggingOut, clearSession, navigate])
  return { loggingOut, logOut }
}
