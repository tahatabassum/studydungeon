import type { NameReason } from '../types/api'

/** Rules a client can check without the Backend (D8). Reserved and profane words are server-only. */
export type LocalNameReason = Exclude<NameReason, 'not_allowed'>

export type LocalNameCheck =
  | { ok: true; name: string }
  | { ok: false; reason: LocalNameReason; message: string }

export const NAME_MIN = 3
export const NAME_MAX = 16

const ALLOWED = /^[A-Za-z0-9 _-]+$/
const EDGE = /^[A-Za-z0-9]$/

function fail(reason: LocalNameReason, message: string): LocalNameCheck {
  return { ok: false, reason, message }
}

/**
 * Mirrors validate_display_name in backend/app/core/identity.py, minus the moderation lists.
 * Returns the FIRST broken rule. Pure.
 */
export function checkLocalName(raw: string): LocalNameCheck {
  const name = (raw ?? '').trim().normalize('NFKC')
  if (name.length < NAME_MIN) return fail('too_short', `Use at least ${NAME_MIN} characters.`)
  if (name.length > NAME_MAX) return fail('too_long', `Use at most ${NAME_MAX} characters.`)
  if (!EDGE.test(name[0]) || !EDGE.test(name[name.length - 1])) {
    return fail('characters', 'Start and end with a letter or a digit.')
  }
  if (!ALLOWED.test(name)) {
    return fail('characters', 'Use letters, digits, spaces, _ and - only.')
  }
  if (name.includes('  ')) return fail('characters', 'Use only one space between words.')
  return { ok: true, name }
}
