import { describe, expect, it, vi } from 'vitest'
import { createHttpClient } from './client'
import { ApiError } from './errors'
import { ContractError } from './ContractError'
import { mapDocumentStatus, mapDocumentTopics, wireDocumentStatusSchema, wireDocumentTopicsSchema } from './wire'
import { wireDungeon } from './wire/wire.fixtures'

type FetchArgs = [url: string | URL | Request, init?: RequestInit]

function routedFetch(routes: Record<string, { status?: number; body: unknown }>) {
  return vi.fn(async (...args: FetchArgs) => {
    const [url, init] = args
    const path = new URL(String(url), 'http://x').pathname
    const hit = routes[`${init?.method ?? 'GET'} ${path}`]
    if (!hit) return new Response(JSON.stringify({ detail: 'no route' }), { status: 404 })
    return new Response(JSON.stringify(hit.body), { status: hit.status ?? 200, headers: { 'Content-Type': 'application/json' } })
  })
}

const client = (f: ReturnType<typeof routedFetch>) => createHttpClient('', f as unknown as typeof fetch)

describe('Http_Client document endpoints (C29)', () => {
  it('POST /documents sends multipart form data without a JSON content type', async () => {
    const f = routedFetch({ 'POST /documents': { status: 202, body: { id: 'd1', status: 'processing', message: 'Document accepted for processing.' } } })
    const sent = await client(f).uploadDocument(new File(['hello'], 'notes.txt', { type: 'text/plain' }))
    expect(sent).toEqual({ id: 'd1', status: 'processing', message: 'Document accepted for processing.' })
    const init = f.mock.calls[0][1]!
    expect(init.body).toBeInstanceOf(FormData)
    expect((init.body as FormData).get('file')).toBeInstanceOf(File)
    expect(Object.keys(init.headers as Record<string, string>)).not.toContain('Content-Type')
    expect(init.credentials).toBe('include')
  })

  it('maps status values, a null reason and the chunk count', async () => {
    const f = routedFetch({
      'GET /documents/d1/status': {
        body: { id: 'd1', status: 'rejected', relevance_score: 0.2, readability_score: null, rejection_reason: 'Not study material.', chunks_count: 0 },
      },
    })
    expect(await client(f).getDocumentStatus('d1')).toEqual({
      id: 'd1',
      status: 'rejected',
      rejection_reason: 'Not study material.',
      chunks_count: 0,
      relevance_score: 0.2,
      readability_score: null,
    })
  })

  it('treats a missing chunks_count as 0 and rejects an unknown status with a ContractError', async () => {
    expect(mapDocumentStatus(wireDocumentStatusSchema.parse({ id: 'd', status: 'processing' })).chunks_count).toBe(0)
    const f = routedFetch({ 'GET /documents/d1/status': { body: { id: 'd1', status: 'weird' } } })
    await expect(client(f).getDocumentStatus('d1')).rejects.toBeInstanceOf(ContractError)
  })

  it('lists topics in document order with an empty description for null', async () => {
    const wire = [
      { id: 't2', name: 'Second', description: null, order_index: 1 },
      { id: 't1', name: 'First', description: 'Intro', order_index: 0 },
    ]
    expect(mapDocumentTopics(wireDocumentTopicsSchema.parse(wire)).map((t) => [t.id, t.description])).toEqual([
      ['t1', 'Intro'],
      ['t2', ''],
    ])
    const f = routedFetch({ 'GET /documents/d1/topics': { body: wire } })
    expect((await client(f).getDocumentTopics('d1')).map((t) => t.id)).toEqual(['t1', 't2'])
  })

  it('POST generate-dungeon (201) returns a mapped dungeon with its legacy floor', async () => {
    const f = routedFetch({ 'POST /documents/d1/generate-dungeon': { status: 201, body: wireDungeon } })
    const d = await client(f).generateDungeon('d1')
    expect(d.id).toBe(wireDungeon.id)
    expect(d.floors).toHaveLength(1)
  })

  it('POST retry re-queues the document', async () => {
    const f = routedFetch({ 'POST /documents/d1/retry': { body: { id: 'd1', status: 'processing', message: 'Document re-queued for processing.' } } })
    expect((await client(f).retryDocument('d1')).status).toBe('processing')
  })

  it('carries the backend error code of a refused upload', async () => {
    const f = routedFetch({
      'POST /documents': { status: 403, body: { detail: { code: 'GUEST_FORBIDDEN', message: 'Guests cannot upload.' } } },
    })
    const err = await client(f)
      .uploadDocument(new File(['x'], 'a.txt'))
      .catch((e: unknown) => e)
    expect(err).toBeInstanceOf(ApiError)
    expect(err).toMatchObject({ status: 403, code: 'GUEST_FORBIDDEN' })
  })
})
