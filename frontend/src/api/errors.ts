/** One entry of a FastAPI 422 `detail` array: the field it names and the message. */
export interface FieldIssue {
  field: string
  message: string
}

/** Extra facts an error response can carry. */
export interface ApiErrorExtra {
  /** Raw `Retry-After` header (seconds or an HTTP date), kept as sent. */
  retryAfter?: string
  /** 422 array detail, one entry per invalid field (C24). */
  fields?: FieldIssue[]
}

export class ApiError extends Error {
  retryAfter?: string
  fields?: FieldIssue[]

  constructor(
    public status: number,
    message: string,
    /** The backend's machine code from `{detail:{code,message}}`, when it sent one. */
    public code?: string,
    extra?: ApiErrorExtra,
  ) {
    super(message)
    this.name = 'ApiError'
    if (extra?.retryAfter !== undefined) this.retryAfter = extra.retryAfter
    if (extra?.fields !== undefined) this.fields = extra.fields
  }
}

export interface ParsedErrorBody {
  message?: string
  code?: string
  fields?: FieldIssue[]
}

/**
 * Reads an error body. Handles the three real shapes:
 * `{detail: "text"}`, `{detail: {code, message, errors?}}` and the FastAPI 422 array
 * `{detail: [{loc, msg, type}]}`. Anything else gives an empty result.
 */
export function parseErrorBody(body: unknown): ParsedErrorBody {
  if (!body || typeof body !== 'object') return {}
  const { detail, message } = body as { detail?: unknown; message?: unknown }
  if (typeof detail === 'string' && detail) return { message: detail }
  if (Array.isArray(detail)) {
    const first = detail[0] as { msg?: unknown; loc?: unknown } | undefined
    const msg = first && typeof first.msg === 'string' ? first.msg : 'Invalid request'
    const fields: FieldIssue[] = []
    for (const item of detail as Array<{ msg?: unknown; loc?: unknown }>) {
      if (!item || typeof item.msg !== 'string' || !Array.isArray(item.loc)) continue
      const last = item.loc[item.loc.length - 1]
      if (typeof last === 'string') fields.push({ field: last, message: item.msg })
    }
    return { message: msg, code: 'VALIDATION_ERROR', ...(fields.length > 0 ? { fields } : {}) }
  }
  if (detail && typeof detail === 'object') {
    const d = detail as { code?: unknown; message?: unknown }
    const out: ParsedErrorBody = {}
    if (typeof d.message === 'string' && d.message) out.message = d.message
    if (typeof d.code === 'string' && d.code) out.code = d.code
    return out
  }
  if (typeof message === 'string' && message) return { message }
  return {}
}

/** Player-facing text per backend code (C16, C18, C28). */
const FRIENDLY: Readonly<Record<string, string>> = {
  BOSS_NOT_CLEARED: 'The boss is still standing. Defeat it before finishing the run.',
  MONSTER_ALIVE: 'That monster is still alive. Keep answering to defeat it.',
  RUN_FINISHED: 'This run is already over. Start a new run to keep playing.',
  OUT_OF_ORDER_ROOM: 'Defeat the earlier room first, then come back.',
  ROOM_ALREADY_CLEARED: 'That room is already cleared.',
  UNKNOWN_WEAPON: 'That weapon is not recognized. The Rusty Dagger will be used.',
  WEAPON_LOCKED: 'That weapon is still locked. The Rusty Dagger will be used.',
  QUESTION_NOT_FOUND: 'That question could not be found. Reload the dungeon and try again.',
  RUN_NOT_FOUND: 'This run could not be found. Start a new run.',
  ROOM_NOT_FOUND: 'That room could not be found.',
  DUNGEON_NOT_FOUND: 'That dungeon could not be found.',
  GUEST_FORBIDDEN: 'Guests can only play the public demo dungeon. Sign up to use your own notes.',
  FILE_TOO_LARGE: 'That file is larger than 15 MB. Try a smaller file.',
  UNSUPPORTED_FILE_TYPE: 'That file type is not supported. Use PDF, DOCX, PPTX, TXT, PNG or JPEG.',
  QUOTA_EXCEEDED: 'You already have 5 documents. Delete an older one before uploading another.',
  DOCUMENT_NOT_FOUND: 'That document could not be found.',
  NOT_RETRYABLE: 'Only failed or rejected documents can be retried.',
  NO_CHUNKS_AVAILABLE: 'There is no readable text in that document yet.',
  GENERATION_FAILED: 'The floors could not be summoned. Try again in a moment.',
  VALIDATION_ERROR: 'The request was not accepted. Please check your input and try again.',
}

/** A friendly message for an ApiError, or undefined when there is nothing better than the caller's fallback. */
export function friendlyMessage(code: string | undefined, status: number): string | undefined {
  if (code !== undefined && FRIENDLY[code] !== undefined) return FRIENDLY[code]
  if (status === 401) return 'Your guest session expired. Start the demo again to keep playing.'
  if (status === 429) return 'Too many requests. Wait a moment and try again.'
  return undefined
}
