import { z } from 'zod'
import type {
  CreateGuestResponse,
  DemoSessionResponse,
  DungeonSummary,
  NameCheckResult,
  User,
} from '../../types/api'

/** Auth bodies (C22). Register returns a bare user (201), login a bare user (200). */
export const wireUserSchema = z.object({
  id: z.string().min(1),
  /** Null for a named Guest on newer Backends (frontend-10). */
  username: z.string().nullish(),
  is_guest: z.boolean(),
  created_at: z.string().optional(),
  expires_at: z.string().nullish(),
  public_id: z.string().nullish(),
  display_name: z.string().nullish(),
  tag: z.string().nullish(),
  handle: z.string().nullish(),
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
  const user: User = { id: w.id, username: w.username ?? '', is_guest: w.is_guest }
  if (w.public_id != null) user.public_id = w.public_id
  if (w.display_name != null) user.display_name = w.display_name
  if (w.tag != null) user.tag = w.tag
  if (w.handle != null) user.handle = w.handle
  return user
}

export function mapDemoSession(w: z.output<typeof wireDemoSessionSchema>): DemoSessionResponse {
  return { user: mapUser(w.user), dungeon_id: w.dungeon_id, expires_at: w.expires_at }
}

/** `GET /auth/me`: the user plus the session expiry when it has one. */
export function mapMe(w: WireUser): { user: User; expires_at: string | null } {
  return { user: mapUser(w), expires_at: w.expires_at ?? null }
}

/** POST /guests/name-check. */
export const wireNameCheckSchema = z.object({
  ok: z.boolean(),
  display_name: z.string().nullish(),
  reason: z.enum(['too_short', 'too_long', 'characters', 'not_allowed']).nullish(),
  message: z.string().nullish(),
})

export function mapNameCheck(w: z.output<typeof wireNameCheckSchema>): NameCheckResult {
  const out: NameCheckResult = { ok: w.ok }
  if (w.display_name != null) out.display_name = w.display_name
  if (w.reason != null) out.reason = w.reason
  if (w.message != null) out.message = w.message
  return out
}

/** POST /guests (201): the named guest and the notice version they accepted. */
export const wireCreateGuestSchema = z.object({
  user: wireUserSchema,
  notice_version: z.string(),
})

export function mapCreateGuest(w: z.output<typeof wireCreateGuestSchema>): CreateGuestResponse {
  return { user: mapUser(w.user), notice_version: w.notice_version }
}

/** POST /auth/upgrade returns a bare user, like register. */
export const wireUpgradeSchema = wireUserSchema

/** DELETE /auth/me returns {success, message}. */
export const wireDeleteAccountSchema = z.object({
  success: z.boolean(),
  message: z.string().optional(),
})

/** GET /dungeons: the dungeons the session can see. */
export const wireDungeonListSchema = z.array(
  z.object({
    id: z.string().min(1),
    title: z.string(),
    is_public_demo: z.boolean(),
    created_at: z.string(),
    rooms_count: z.number().int().nonnegative(),
  }),
)

export function mapDungeonList(w: z.output<typeof wireDungeonListSchema>): DungeonSummary[] {
  return w.map((d) => ({
    id: d.id,
    title: d.title,
    is_public_demo: d.is_public_demo,
    created_at: d.created_at,
    rooms_count: d.rooms_count,
  }))
}