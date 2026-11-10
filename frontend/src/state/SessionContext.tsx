import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import { getApi } from '../api'
import type { DemoSessionResponse, User } from '../types/api'

/** In-memory only session. Nothing is persisted to localStorage or sessionStorage (the cookie is httpOnly). */
export interface SessionContextValue {
  user: User | null
  dungeonId: string | null
  expiresAt: string | null
  /** True until the first `getMe` check on load has settled. */
  restoring: boolean
  setSession: (session: DemoSessionResponse) => void
  /** A signed-in user (register or login): no dungeon is attached. */
  setUser: (user: User, expiresAt?: string | null) => void
  clearSession: () => void
}

interface SessionData {
  user: User | null
  dungeonId: string | null
  expiresAt: string | null
}

const EMPTY: SessionData = { user: null, dungeonId: null, expiresAt: null }

const SessionContext = createContext<SessionContextValue | null>(null)

export function SessionProvider({ children }: { children: ReactNode }) {
  const [data, setData] = useState<SessionData>(EMPTY)
  const [restoring, setRestoring] = useState(true)

  const setSession = useCallback((s: DemoSessionResponse) => {
    setData({ user: s.user, dungeonId: s.dungeon_id, expiresAt: s.expires_at })
  }, [])
  const setUser = useCallback((user: User, expiresAt: string | null = null) => {
    setData({ user, dungeonId: null, expiresAt })
  }, [])
  const clearSession = useCallback(() => setData(EMPTY), [])

  // On load, ask the server who the cookie belongs to. A session set meanwhile (a demo start) wins.
  useEffect(() => {
    let cancelled = false
    void (async () => {
      try {
        const api = await getApi()
        const me = typeof api.getMe === 'function' ? await api.getMe() : null
        if (cancelled || !me) return
        setData((current) =>
          current.user ? current : { user: me.user, dungeonId: null, expiresAt: me.expires_at },
        )
      } catch {
        // Offline, asleep or unsupported: stay signed out.
      } finally {
        if (!cancelled) setRestoring(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  const value = useMemo(
    () => ({ ...data, restoring, setSession, setUser, clearSession }),
    [data, restoring, setSession, setUser, clearSession],
  )

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>
}

export function useSession(): SessionContextValue {
  const ctx = useContext(SessionContext)
  if (!ctx) throw new Error('useSession must be used within a SessionProvider')
  return ctx
}
