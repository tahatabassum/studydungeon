/** Friendly texts for the name screen and guest errors. Plain strings, pure. */

export const GENERIC_GUEST_ERROR = 'Something went wrong. Please try again.'

export function reasonMessage(reason: string | null | undefined): string {
  switch (reason) {
    case 'too_short':
      return 'Names need at least 3 characters.'
    case 'too_long':
      return 'Names can have at most 16 characters.'
    case 'characters':
      return 'Use letters, digits, spaces, _ and - only. Start and end with a letter or digit.'
    case 'not_allowed':
      return 'That name is not available. Try another.'
    default:
      return 'That name will not work. Try another.'
  }
}

export interface GuestErrorExtras {
  retry_after_seconds?: number | null
  reason?: string | null
}

export function describeGuestError(code: string | null | undefined, extras: GuestErrorExtras = {}): string {
  switch (code) {
    case 'NAME_INVALID':
      return reasonMessage(extras.reason)
    case 'NOTICE_NOT_ACCEPTED':
      return 'Please accept the public leaderboard notice to continue.'
    case 'SESSION_EXISTS':
      return 'You already have a session on this device.'
    case 'GUEST_CREATION_PAUSED':
      return 'New guests are paused for a moment. Please try again later.'
    case 'RATE_LIMIT_EXCEEDED': {
      const s = extras.retry_after_seconds
      if (typeof s === 'number' && Number.isFinite(s) && s > 0) {
        const secs = Math.ceil(s)
        return `Too many tries. Please wait ${secs} ${secs === 1 ? 'second' : 'seconds'} and try again.`
      }
      return 'Too many tries. Please wait a moment and try again.'
    }
    case 'NOT_A_GUEST':
      return 'This account is already registered.'
    case 'USERNAME_TAKEN':
      return 'That username is taken. Try another.'
    case 'CONFIRMATION_REQUIRED':
      return 'Type DELETE to confirm.'
    case 'SYSTEM_USER_PROTECTED':
      return 'This account cannot be deleted.'
    default:
      return GENERIC_GUEST_ERROR
  }
}
