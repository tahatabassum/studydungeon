import { ApiError, type FieldIssue } from '../api/errors'
import { parseRetryAfter } from './retryAfter'
import type { FieldErrors } from './validation'

export type AuthMode = 'login' | 'register'

/** What the form shows after a failed call. */
export interface AuthErrorView {
  /** A friendly sentence for the form status area. */
  message: string
  /** Messages to show next to a field (422 and 409). */
  fields: FieldErrors
  /** Seconds to keep submit disabled (429 only). */
  retryAfter?: number
}

export const NETWORK_MESSAGE = 'Cannot reach the dungeon server. Check your connection and try again.'
export const SERVER_MESSAGE = 'The dungeon server stumbled. Wait a moment and try again.'
export const FALLBACK_MESSAGE = 'Something went wrong. Please try again.'

/** Friendly text for one HTTP status (401, 409, 422, 429, 5xx). Other statuses get the fallback. */
export function messageForStatus(status: number, mode: AuthMode = 'login', retryAfter = 10): string {
  if (status === 0) return NETWORK_MESSAGE
  if (status === 401) return 'That username or password is not right.'
  if (status === 409) return 'That username is already taken. Try another one.'
  if (status === 422) {
    return mode === 'register'
      ? 'Some details need a fix. Check the fields below.'
      : 'Enter your username and password.'
  }
  if (status === 429) return `Too many attempts. Try again in ${retryAfter} seconds.`
  if (status >= 500) return SERVER_MESSAGE
  return FALLBACK_MESSAGE
}

/** FastAPI prefixes validator messages with "Value error, "; the player does not need that. */
function tidy(message: string): string {
  const text = message.replace(/^value error,\s*/i, '').trim()
  if (text === '') return 'This value is not accepted.'
  return text.charAt(0).toUpperCase() + text.slice(1).replace(/([^.!?])$/, '$1.')
}

/** Maps the FastAPI 422 array form (`detail: [{loc, msg}]`, parsed into `fields`) onto the two inputs. */
export function fieldErrorsFrom(issues: readonly FieldIssue[] | undefined): FieldErrors {
  const out: FieldErrors = {}
  for (const issue of issues ?? []) {
    if (issue.field === 'username' && out.username === undefined) out.username = tidy(issue.message)
    if (issue.field === 'password' && out.password === undefined) out.password = tidy(issue.message)
  }
  return out
}

/** Turns anything a failed register or login can throw into a view the form can render. */
export function mapAuthError(err: unknown, mode: AuthMode = 'login', nowMs: number = Date.now()): AuthErrorView {
  if (!(err instanceof ApiError)) return { message: FALLBACK_MESSAGE, fields: {} }
  if (err.status === 429) {
    const seconds = parseRetryAfter(err.retryAfter, nowMs)
    return { message: messageForStatus(429, mode, seconds), fields: {}, retryAfter: seconds }
  }
  if (err.status === 409) {
    return { message: messageForStatus(409, mode), fields: { username: 'That username is already taken.' } }
  }
  if (err.status === 422) {
    return { message: messageForStatus(422, mode), fields: fieldErrorsFrom(err.fields) }
  }
  return { message: messageForStatus(err.status, mode), fields: {} }
}
