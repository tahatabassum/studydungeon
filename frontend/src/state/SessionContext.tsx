import { createContext, useCallback, useContext, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import type { DemoSessionResponse, User } from '../types/api'

/** In-memory only session. Nothing is persisted to localStorage or sessionStorage. */
export interface SessionContextValue {
  user: User | null
  dungeonId: string | null
  expiresAt: string | null
  setSession: (session: DemoSessionResponse) => void
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

  const setSession = useCallback((s: DemoSessionResponse) => {
    setData({ user: s.user, dungeonId: s.dungeon_id, expiresAt: s.expires_at })
  }, [])
  const clearSession = useCallback(() => setData(EMPTY), [])

  const value = useMemo(
    () => ({ ...data, setSession, clearSession }),
    [data, setSession, clearSession],
  )

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>
}

export function useSession(): SessionContextValue {
  const ctx = useContext(SessionContext)
  if (!ctx) throw new Error('useSession must be used within a SessionProvider')
  return ctx
}
