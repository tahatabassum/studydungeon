import { describe, expect, it } from 'vitest'
import { ApiError } from '../api/errors'
import { AI_NOTICE_TEXT } from './AiNotice'
import { describeLimitError, describeUploadError, formatWait } from './limitErrors'
import { MAX_DOCX_CHARS, MAX_PDF_PAGES, MAX_SLIDES, MIN_TEXT_CHARS, rulesText } from './limits'
import { quotaView } from './quotaView'

/** Raw source text of the non-test files in src/upload, by file name. */
const raw = import.meta.glob('./*.{ts,tsx}', { query: '?raw', import: 'default', eager: true }) as Record<string, string>
const sources = (ext: RegExp): [string, string][] => Object.entries(raw).filter(([f]) => ext.test(f) && !/\.test\./.test(f))

describe('upload limits module', () => {
  it('has the agreed numbers and builds the rules text from them', () => {
    expect([MAX_PDF_PAGES, MAX_SLIDES, MAX_DOCX_CHARS, MIN_TEXT_CHARS]).toEqual([30, 30, 60_000, 500])
    expect(rulesText()).toBe(
      'Accepted formats: PDF, DOCX, PPTX, TXT, PNG, JPEG. Up to 15 MB. PDF up to 30 pages, PPTX up to 30 slides, DOCX up to 60,000 characters, at least 500 characters of text.',
    )
    expect(rulesText({ maxMb: 1, maxPdfPages: 2, maxSlides: 3, maxDocxChars: 4000, minTextChars: 5 })).toContain('PDF up to 2 pages, PPTX up to 3 slides, DOCX up to 4,000 characters, at least 5 characters')
  })

  it('marks the DOCX limit as unconfirmed and keeps the server TODO', () => {
    const src = raw['./limits.ts']
    expect(src).toMatch(/UNCONFIRMED/)
    expect(src).toMatch(/TODO: read these limits from the server/)
  })

  it('has no literal limit numbers in src/upload/*.tsx', () => {
    for (const [file, text] of sources(/\.tsx$/)) {
      expect(text, file).not.toMatch(/\b(15|30|60[,_]?000|500|3[,_]?000)\b/)
    }
  })

  it('makes no retention or training promise in the upload copy', () => {
    const banned = /\b(we (do not|don't|never|will not)|not be (used|kept|stored)|never (used|kept|stored|trained)|deleted after|erased|no training|not (used )?for training)\b/i
    expect(AI_NOTICE_TEXT).not.toMatch(banned)
    for (const [file, text] of sources(/\.tsx?$/)) {
      expect(text, file).not.toMatch(banned)
    }
  })
})

describe('limit and upload errors', () => {
  it('states both numbers', () => {
    expect(describeLimitError('TOO_MANY_PAGES', { limit: 30, found: 42 })).toBe('This PDF has 42 pages; the limit is 30.')
    expect(describeLimitError('TOO_MANY_SLIDES', { limit: 30, found: 31 })).toBe('This presentation has 31 slides; the limit is 30.')
    expect(describeLimitError('TOO_MUCH_TEXT', { limit: 60000, found: 70000 })).toBe('This document has 70,000 characters; the limit is 60,000.')
    expect(describeLimitError('TOO_MANY_PAGES')).toBe('This PDF has too many pages; the limit is 30.')
  })

  it('adds the wait from Retry-After to a limit error', () => {
    const err = new ApiError(429, 'x', 'UPLOAD_LIMIT_PLAYER', { retryAfter: '7200', retry_after_seconds: 7200 })
    expect(describeUploadError(err, 'fallback')).toMatch(/Try again in about 2 hours\.$/)
    expect(formatWait(30)).toBe('less than a minute')
    expect(describeUploadError(new ApiError(503, 'x', 'AI_BUSY'), 'f')).toMatch(/summoning circle is busy/)
    expect(describeUploadError(new ApiError(422, 'x', 'AI_NOTICE_NOT_ACCEPTED'), 'f')).toMatch(/notice/)
  })

  it('shows the stored limit and the guest account offer in the quota view', () => {
    const v = quotaView({
      can_upload: false,
      reason: 'stored_limit',
      player: { is_guest: true, used_today: 0, limit_today: 1, stored: 2, stored_limit: 2 },
    })
    expect(v.line).toMatch(/2 of 2 documents/)
    expect(v.offerAccount).toBe(true)
  })
})
