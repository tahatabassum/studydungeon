import { useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { getApi } from '@/api'
import { useSession } from '@/state/SessionContext'

/**
 * Test support: starts a demo session and opens the legacy whole-dungeon route `/play`.
 * The landing page now leads to the campaign map, so tests of the play experience itself enter here.
 */
export function OpenLegacyPlay() {
  const navigate = useNavigate()
  const { setSession } = useSession()
  const started = useRef(false)
  useEffect(() => {
    if (started.current) return
    started.current = true
    void getApi()
      .then((api) => api.startDemoSession())
      .then((session) => {
        setSession(session)
        navigate('/play')
      })
  }, [navigate, setSession])
  return null
}
