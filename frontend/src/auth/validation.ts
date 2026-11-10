/**
 * Client hints for the auth forms (C23). They mirror the Backend rules so a player sees the problem
 * next to the field; the Backend stays the validator. Pure and framework free.
 */
export const USERNAME_MIN = 3
export const USERNAME_MAX = 32
export const PASSWORD_MIN = 8
export const PASSWORD_MAX = 128

export type UsernameIssue = 'required' | 'too_short' | 'too_long' | 'characters' | 'reserved'
export type PasswordIssue = 'required' | 'too_short' | 'too_long'

/** What the Backend does with a username before it checks it: NFKC, trimmed, lowercase. */
export function normalizeUsername(raw: string): string {
  return raw.normalize('NFKC').trim().toLowerCase()
}

/** Message key for the first rule the username breaks, or null when it is acceptable for registration. */
export function validateUsername(raw: string): UsernameIssue | null {
  const name = normalizeUsername(raw)
  if (name.length === 0) return 'required'
  if (name.length < USERNAME_MIN) return 'too_short'
  if (name.length > USERNAME_MAX) return 'too_long'
  if (!/^[a-z0-9_]+$/.test(name)) return 'characters'
  if (name.startsWith('guest_') || name.startsWith('system')) return 'reserved'
  return null
}

/** Register: 8 to 128 characters (no composition rule, the Backend has none). */
export function validateRegisterPassword(password: string): PasswordIssue | null {
  if (password.length === 0) return 'required'
  if (password.length < PASSWORD_MIN) return 'too_short'
  if (password.length > PASSWORD_MAX) return 'too_long'
  return null
}

/** Login only needs something to send, so older accounts keep working. */
export function validateLoginPassword(password: string): PasswordIssue | null {
  return password.length === 0 ? 'required' : null
}

export function validateLoginUsername(raw: string): UsernameIssue | null {
  return normalizeUsername(raw).length === 0 ? 'required' : null
}

export const USERNAME_MESSAGES: Readonly<Record<UsernameIssue, string>> = {
  required: 'Enter a username.',
  too_short: `Use at least ${USERNAME_MIN} characters.`,
  too_long: `Use at most ${USERNAME_MAX} characters.`,
  characters: 'Use only letters, digits and underscores.',
  reserved: 'Names starting with guest_ or system are reserved. Pick another.',
}

export const PASSWORD_MESSAGES: Readonly<Record<PasswordIssue, string>> = {
  required: 'Enter a password.',
  too_short: `Use at least ${PASSWORD_MIN} characters.`,
  too_long: `Use at most ${PASSWORD_MAX} characters.`,
}

export interface FieldErrors {
  username?: string
  password?: string
}

/** Field messages for the register form (empty object when everything is fine). */
export function registerErrors(username: string, password: string): FieldErrors {
  const u = validateUsername(username)
  const p = validateRegisterPassword(password)
  return {
    ...(u ? { username: USERNAME_MESSAGES[u] } : {}),
    ...(p ? { password: PASSWORD_MESSAGES[p] } : {}),
  }
}

/** Field messages for the login form: both fields only need a value. */
export function loginErrors(username: string, password: string): FieldErrors {
  const u = validateLoginUsername(username)
  const p = validateLoginPassword(password)
  return {
    ...(u ? { username: USERNAME_MESSAGES[u] } : {}),
    ...(p ? { password: PASSWORD_MESSAGES[p] } : {}),
  }
}
