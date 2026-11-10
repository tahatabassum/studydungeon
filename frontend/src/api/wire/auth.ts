import { z } from 'zod'
import type { DemoSessionResponse, User } from '../../types/api'

/** Auth bodies (C22). Register returns a bare user (201), login a bare user (200). */
export const wireUserSchema = z.object({
  id: z.string().min(1),
  username: z.string(),
  is_guest: z.boolean(),
  created_at: z.string().optional(),
  expires_at: z.string().nullish(),
})

export type WireUser = z.output<typeof wireUserSchema>

export const wireDemoSessionSchema = z.object({
  user: wireUserSchema,
  dungeon_id: z.string().min(1),
  expires_at: z.string(),
})

/** `POST /auth/logout` returns `{ success: true }` with status 200. */
export const wireLogoutSchema = z.object({ success: z.boolean() })

export function mapUser(w: WireUser): User {
  return { id: w.id, username: w.username, is_guest: w.is_guest }
}

export function mapDemoSession(w: z.output<typeof wireDemoSessionSchema>): DemoSessionResponse {
  return { user: mapUser(w.user), dungeon_id: w.dungeon_id, expires_at: w.expires_at }
}

/** `GET /auth/me`: the user plus the session expiry when it has one. */
export function mapMe(w: WireUser): { user: User; expires_at: string | null } {
  return { user: mapUser(w), expires_at: w.expires_at ?? null }
}
