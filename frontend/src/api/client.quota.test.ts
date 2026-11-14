import { describe, expect, it, vi } from 'vitest'
import { createHttpClient } from './client'
import { capabilityOf } from './ApiClient'
import { ApiError, friendlyMessage } from './errors'
import { createMockAdapter } from './mock/mockAdapter'
import { parseMockQuotaSwitches } from './mock/mockQuota'

type FetchArgs = [url: string | URL | Request, init?: RequestInit]

const quotaBody = (isGuest: boolean) => ({
  can_upload: true,
  reason: null,
  player: { is_guest: isGuest, used_today: 0, limit_today: 1, stored: 0, stored_limit: 2, resets_at: '2026-11-21T00:00:00Z', internal: 'dropped' },
  global: { available: true },
  ranking: { min_chars: 3000, min_topics: 2 },
})

function respond(body: unknown, status = 200) {
  return vi.fn(async (...args: FetchArgs) => {
    void args
    return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })
  })
}
const make = (f: ReturnType<typeof respond>) => createHttpClient('http://api', f as unknown as typeof fetch)
const file = () => new File(['hello'], 'notes.txt', { type: 'text/plain' })

describe('Http_Client getUploadQuota and guest upload (frontend-10 task 11.2)', () => {
  it('GETs /uploads/quota, maps it, settles uploadQuota and turns guestUpload on for a guest', async () => {
    const f = respond(quotaBody(true))
    const api = make(f)
    expect(capabilityOf(api, 'uploadQuota')).toBe('unproven')
    const q = await api.getUploadQuota()
    expect(String(f.mock.calls[0][0])).toBe('http://api/uploads/quota')
    expect(q.player).toEqual({ is_guest: true, used_today: 0, limit_today: 1, stored: 0, stored_limit: 2, resets_at: '2026-11-21T00:00:00Z' })
    expect(q.ranking).toEqual({ min_chars: 3000, min_topics: 2 })
    expect(capabilityOf(api, 'uploadQuota')).toBe('on')
    expect(capabilityOf(api, 'guestUpload')).toBe('on')
  })

  it('leaves guestUpload alone for a registered player and turns uploadQuota off on 404', async () => {
    const api = make(respond(quotaBody(false)))
    await api.getUploadQuota()
    expect(capabilityOf(api, 'guestUpload')).toBe('unproven')
    const old = make(respond({ detail: 'Not Found' }, 404))
    await expect(old.getUploadQuota()).rejects.toBeInstanceOf(ApiError)
    expect(capabilityOf(old, 'uploadQuota')).toBe('off')
  })

  it('403 GUEST_FORBIDDEN on POST /documents turns guestUpload off', async () => {
    const api = make(respond({ detail: { code: 'GUEST_FORBIDDEN', message: 'no' } }, 403))
    await expect(api.uploadDocument(file(), { acceptAiNotice: true })).rejects.toMatchObject({ status: 403, code: 'GUEST_FORBIDDEN' })
    expect(capabilityOf(api, 'guestUpload')).toBe('off')
  })

  it('sends accept_ai_notice=true only when asked', async () => {
    const f = respond({ id: 'd1', status: 'processing', message: 'ok' }, 202)
    const api = make(f)
    await api.uploadDocument(file(), { acceptAiNotice: true })
    await api.uploadDocument(file())
    expect((f.mock.calls[0][1]!.body as FormData).get('accept_ai_notice')).toBe('true')
    expect((f.mock.calls[1][1]!.body as FormData).get('accept_ai_notice')).toBeNull()
  })

  it('keeps limit and found on the error and words every new code', async () => {
    const api = make(respond({ detail: { code: 'TOO_MANY_PAGES', message: 'x', limit: 30, found: 42 } }, 422))
    await expect(api.uploadDocument(file(), { acceptAiNotice: true })).rejects.toMatchObject({ code: 'TOO_MANY_PAGES', limit: 30, found: 42 })
    for (const code of ['AI_BUSY', 'UPLOADS_PAUSED_TODAY', 'UPLOAD_LIMIT_PLAYER', 'UPLOAD_LIMIT_IP', 'QUOTA_EXCEEDED', 'AI_NOTICE_NOT_ACCEPTED', 'TOO_MANY_PAGES', 'TOO_MANY_SLIDES', 'TOO_MUCH_TEXT']) {
      expect(friendlyMessage(code, 400), code).toBeTruthy()
    }
  })
})

describe('mock upload quota (frontend-10 task 11.3)', () => {
  it('parses the dev switches only in dev', () => {
    expect(parseMockQuotaSwitches('?mockQuota=stored_limit&mockAiBusy=1', {}, true)).toEqual({ forced: 'stored_limit', aiBusy: true })
    expect(parseMockQuotaSwitches('', { quota: 'ai_unavailable', aiBusy: 'true' }, true)).toEqual({ forced: 'ai_unavailable', aiBusy: true })
    expect(parseMockQuotaSwitches('?mockQuota=nonsense', {}, true)).toEqual({})
    expect(parseMockQuotaSwitches('?mockQuota=stored_limit', {}, false)).toEqual({})
  })

  it('a guest gets 1 per day and 2 stored; a forced state and AI_BUSY block', async () => {
    const api = createMockAdapter({ upload: { processingMs: 5 } })
    await api.startDemoSession()
    const q = await api.getUploadQuota()
    expect(q).toMatchObject({ can_upload: true, reason: null, player: { is_guest: true, limit_today: 1, stored_limit: 2 } })
    await api.uploadDocument(file(), { acceptAiNotice: true })
    expect((await api.getUploadQuota()).reason).toBe('player_daily_limit')

    const forced = createMockAdapter({ upload: { quota: { forced: 'global_daily_limit' } } })
    await forced.startDemoSession()
    expect((await forced.getUploadQuota()).reason).toBe('global_daily_limit')
    await expect(forced.uploadDocument(file(), { acceptAiNotice: true })).rejects.toMatchObject({ status: 503, code: 'UPLOADS_PAUSED_TODAY' })

    const busy = createMockAdapter({ upload: { quota: { aiBusy: true } } })
    await busy.startDemoSession()
    await expect(busy.uploadDocument(file(), { acceptAiNotice: true })).rejects.toMatchObject({ status: 503, code: 'AI_BUSY', offer_packs: true })
  })

  it('requires the notice (422) and flags short notes as not counting for the ranking', async () => {
    const api = createMockAdapter({ upload: { processingMs: 5 } })
    await api.register({ username: 'quota_user', password: 'correct-horse-9' })
    await expect(api.uploadDocument(file())).rejects.toMatchObject({ status: 422, code: 'AI_NOTICE_NOT_ACCEPTED' })
    const short = await api.uploadDocument(new File(['a'.repeat(800)], 'short.txt'), { acceptAiNotice: true })
    const long = await api.uploadDocument(new File(['a'.repeat(4000)], 'long.txt'), { acceptAiNotice: true })
    await new Promise((r) => setTimeout(r, 20))
    expect(await api.getDocumentStatus(short.id)).toMatchObject({ counts_for_ranking: false })
    expect((await api.getDocumentStatus(short.id)).ranking_note).toBeTruthy()
    expect(await api.getDocumentStatus(long.id)).toMatchObject({ counts_for_ranking: true })
    const dungeon = await api.generateDungeon(long.id)
    const status = await api.getDocumentStatus(long.id)
    expect(status.dungeon_id).toBe(dungeon.id)
    expect(status.floors?.length).toBe(dungeon.floors?.length)
  })
})
