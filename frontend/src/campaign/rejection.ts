import { ApiError, describeError } from '../api'

/**
 * The text for a rejected floor start or retry: the Backend's (or the mock's) own message for a
 * refusal such as "That floor is still locked.", and the friendly generic text for everything else
 * (network errors, an expired session, rate limits, contract mismatches).
 */
export function rejectionMessage(err: unknown, fallback: string): string {
  if (err instanceof ApiError && err.message && err.status >= 400 && err.status < 500 && err.status !== 401 && err.status !== 429) {
    return err.message
  }
  return describeError(err, fallback)
}
