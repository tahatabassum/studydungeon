import { z } from 'zod'
import type { DocumentStatus, DocumentTopic, DocumentUpload } from '../../types/api'

/** Document endpoints (frontend-08 C29). Statuses: processing, accepted, rejected, failed. */
export const wireDocumentStatusValue = z.enum(['processing', 'accepted', 'rejected', 'failed'])

/** `POST /documents` (202) and `POST /documents/{id}/retry`. */
export const wireDocumentUploadSchema = z.object({
  id: z.string().min(1),
  status: wireDocumentStatusValue,
  message: z.string().optional(),
})

/** `GET /documents/{id}/status`. */
export const wireDocumentStatusSchema = z.object({
  id: z.string().min(1),
  status: wireDocumentStatusValue,
  relevance_score: z.number().nullish(),
  readability_score: z.number().nullish(),
  rejection_reason: z.string().nullish(),
  chunks_count: z.number().int().nonnegative().optional(),
  // frontend-10 (PROPOSED)
  counts_for_ranking: z.boolean().optional(),
  ranking_note: z.string().nullish(),
  dungeon_id: z.string().nullish(),
  floors: z.array(z.object({ id: z.string().min(1), status: z.enum(['locked', 'ready', 'generating', 'failed', 'cleared']) })).optional(),
})

/** `GET /documents/{id}/topics`: a bare array. */
export const wireDocumentTopicsSchema = z.array(
  z.object({
    id: z.string().min(1),
    name: z.string(),
    description: z.string().nullish(),
    order_index: z.number().int(),
  }),
)

export function mapDocumentUpload(w: z.output<typeof wireDocumentUploadSchema>): DocumentUpload {
  return { id: w.id, status: w.status, message: w.message ?? '' }
}

export function mapDocumentStatus(w: z.output<typeof wireDocumentStatusSchema>): DocumentStatus {
  return {
    id: w.id,
    status: w.status,
    rejection_reason: w.rejection_reason ?? null,
    chunks_count: w.chunks_count ?? 0,
    relevance_score: w.relevance_score ?? null,
    readability_score: w.readability_score ?? null,
    ...(w.counts_for_ranking !== undefined ? { counts_for_ranking: w.counts_for_ranking } : {}),
    ...(w.ranking_note ? { ranking_note: w.ranking_note } : {}),
    ...(w.dungeon_id ? { dungeon_id: w.dungeon_id } : {}),
    ...(w.floors ? { floors: w.floors.map((f) => ({ id: f.id, status: f.status })) } : {}),
  }
}

/** Topics in document order. */
export function mapDocumentTopics(w: z.output<typeof wireDocumentTopicsSchema>): DocumentTopic[] {
  return [...w]
    .sort((a, b) => a.order_index - b.order_index)
    .map((t) => ({ id: t.id, name: t.name, description: t.description ?? '', order_index: t.order_index }))
}
