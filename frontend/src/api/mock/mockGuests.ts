import { ApiError } from '../errors'
import type { CreateGuestRequest, CreateGuestResponse, NameCheckResult, NameReason, User } from '../../types/api'
import type { MockAuth } from './mockAuth'

/**
 * MOCK-ONLY guest identity (frontend-10, D25: memory only). Mirrors backend/app/core/identity.py:
 * the name rules, the lookalike moderation form, the random 4-digit tag and the `p_` + 8 hex public id.
 * The reserved list is a small mock list; the Backend owns the real one.
 */
export const MOCK_NOTICE_VERSION = '2026-11'
const MIN_LEN = 3
const MAX_LEN = 16
const TAG_MIN = 1000
const TAG_MAX = 9999
const TAG_TRIES = 200

/** A small mock reserved list, matched on the normalized form (like the Backend, as a substring). */
export const MOCK_RESERVED_NAMES: readonly string[] = [
  'admin',
  'staff',
  'system',
  'root',
  'official',
  'studydungeon',
  'kiro',
  'ghostrival',
  'guest',
  'anonymous',
  'null',
  'undefined',
  'examwarden',
  'fuck',
  'shit',
]

const LOOKALIKES: Readonly<Record<string, string>> = {
  '0': 'o',
  '1': 'i',
  '3': 'e',
  '4': 'a',
  '5': 's',
  '7': 't',
  '@': 'a',
  $: 's',
}

/** NFKC, lowercase, lookalikes mapped, separators removed (same as the Backend moderation form). */
export function moderationForm(name: string): string {
  let out = name.normalize('NFKC').toLowerCase()
  for (const [from, to] of Object.entries(LOOKALIKES)) out = out.split(from).join(to)
  return out.replace(/[\s_-]+/g, '')
}

const MESSAGES: Readonly<Record<NameReason, string>> = {
  too_short: 'Name must be at least 3 characters.',
  too_long: 'Name must be at most 16 characters.',
  characters: 'Allowed characters: letters, digits, spaces, _ and -.',
  not_allowed: 'That name is not available. Try another.',
}

const fail = (reason: NameReason, message: string = MESSAGES[reason]): NameCheckResult => ({
  ok: false,
  reason,
  message,
})

/** The local name rules. On success `display_name` is the trimmed, NFKC-normalized name. */
export function checkMockName(raw: string): NameCheckResult {
  const name = raw.trim().normalize('NFKC')
  if (name.length < MIN_LEN) return fail('too_short')
  if (name.length > MAX_LEN) return fail('too_long')
  if (!/^[A-Za-z0-9]/.test(name) || !/[A-Za-z0-9]$/.test(name)) {
    return fail('characters', 'Name must start and end with a letter or digit.')
  }
  if (!/^[A-Za-z0-9 _-]+$/.test(name)) return fail('characters')
  if (name.includes('  ')) return fail('characters', 'Consecutive spaces are not allowed.')
  const form = moderationForm(name)
  if (MOCK_RESERVED_NAMES.some((word) => form.includes(word))) return fail('not_allowed')
  return { ok: true, display_name: name }
}

const hex8 = (): string => {
  let out = ''
  for (let i = 0; i < 8; i += 1) out += Math.floor(Math.random() * 16).toString(16)
  return out
}

export const generatePublicId = (): string => `p_${hex8()}`
export const randomTag = (): string => String(TAG_MIN + Math.floor(Math.random() * (TAG_MAX - TAG_MIN + 1)))
export const makeHandle = (name: string, tag: string): string => `${name}#${tag}`

export interface MockGuests {
  checkName(displayName: string): Promise<NameCheckResult>
  create(request: CreateGuestRequest): Promise<CreateGuestResponse>
  /** Releases the handle of a user whose data was deleted. */
  release(user: User): void
}

export function createMockGuests(auth: MockAuth): MockGuests {
  /** Live handles (lowercase name + tag), so the same name never gets the same tag twice. */
  const taken = new Set<string>()
  const key = (name: string, tag: string): string => `${name.toLowerCase()}#${tag}`

  const allocateTag = (name: string): string => {
    for (let i = 0; i < TAG_TRIES; i += 1) {
      const tag = randomTag()
      if (!taken.has(key(name, tag))) return tag
    }
    // Practically unreachable (9000 tags); scan for a free one so creation can still finish.
    for (let n = TAG_MIN; n <= TAG_MAX; n += 1) if (!taken.has(key(name, String(n)))) return String(n)
    throw new ApiError(409, 'That name has no free tags left. Try another.', 'NAME_INVALID', { reason: 'not_allowed' })
  }

  return {
    async checkName(displayName) {
      return checkMockName(displayName)
    },

    async create(request) {
      if (request.accept_public_notice !== true) {
        throw new ApiError(422, 'Please accept the public name notice to continue.', 'NOTICE_NOT_ACCEPTED')
      }
      const checked = checkMockName(request.display_name)
      if (!checked.ok || checked.display_name === undefined) {
        throw new ApiError(422, checked.message ?? MESSAGES.not_allowed, 'NAME_INVALID', {
          ...(checked.reason !== undefined ? { reason: checked.reason } : {}),
        })
      }
      if (await auth.getMe()) throw new ApiError(409, 'You already have a session.', 'SESSION_EXISTS')
      const name = checked.display_name
      const tag = allocateTag(name)
      taken.add(key(name, tag))
      const publicId = generatePublicId()
      const user: User = {
        id: `guest-${publicId.slice(2)}`,
        username: `guest_${hex8()}`,
        is_guest: true,
        public_id: publicId,
        display_name: name,
        tag,
        handle: makeHandle(name, tag),
      }
      auth.adopt(user)
      return { user: { ...user }, notice_version: MOCK_NOTICE_VERSION }
    },

    release(user) {
      if (user.display_name !== undefined && user.tag !== undefined) taken.delete(key(user.display_name, user.tag))
    },
  }
}
