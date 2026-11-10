import { ApiError } from '../errors'
import type {
  AuthMe,
  Dungeon,
  DocumentStatus,
  DocumentStatusValue,
  DocumentTopic,
  DocumentUpload,
  FinalBoss,
  Floor,
  GenerationStatus,
  Question,
  Room,
} from '../../types/api'
import { createGenerationSim, GENERATION_STEP_MS, type GenerationSim } from './mockGeneration'
import { syntheticPool } from './pool'

/**
 * MOCK-ONLY document pipeline (frontend-08 C29). It follows the real endpoints and error codes:
 * POST /documents (202), GET /documents/{id}/status, GET /documents/{id}/topics,
 * POST /documents/{id}/generate-dungeon (201) and POST /documents/{id}/retry.
 *
 * Demo triggers (by file name or size):
 *  - a name with "meme", "receipt" or "invoice": rejected with a reason
 *  - a .txt file under 500 bytes: rejected, too little text
 *  - a name with "broken": the status becomes failed (Retry works)
 *  - bigger than 15 MB: 413 FILE_TOO_LARGE; other types than PDF, DOCX, PPTX, TXT, PNG, JPEG: 415
 *  - a 6th stored document: 400 QUOTA_EXCEEDED; a guest: 403 GUEST_FORBIDDEN; no session: 401
 */
export const MOCK_MAX_BYTES = 15 * 1024 * 1024
export const MOCK_QUOTA = 5
export const MOCK_MIN_TXT_BYTES = 500
/** How long a document stays `processing` before the verdict. */
export const MOCK_PROCESSING_MS = 3000
const EXTENSIONS = ['pdf', 'docx', 'pptx', 'txt', 'png', 'jpg', 'jpeg'] as const
const TOPIC_WORDS = ['Foundations', 'Key terms', 'How it works', 'Worked examples', 'Common mistakes']

interface DocRecord {
  id: string
  name: string
  startedAt: number
  /** Where processing ends up. */
  verdict: 'accepted' | 'rejected' | 'failed'
  reason: string | null
  topics: DocumentTopic[]
  dungeonId: string | null
}

interface GeneratedDungeon {
  id: string
  name: string
  startedAt: number
  sim: GenerationSim
  base: Omit<Dungeon, 'floors'> & { floors: Floor[]; final_boss: FinalBoss }
}

export interface MockUploadOptions {
  now: () => number
  /** The current session (null when signed out). */
  session: () => Promise<AuthMe | null>
  processingMs?: number
  stepMs?: number
}

const hash = (s: string): number => {
  let h = 0
  for (let i = 0; i < s.length; i += 1) h = (h * 31 + s.charCodeAt(i)) >>> 0
  return h
}

function extensionOf(name: string): string {
  const dot = name.lastIndexOf('.')
  return dot < 0 ? '' : name.slice(dot + 1).toLowerCase()
}

/** The title shown for topics and the dungeon: the file name without its extension. */
function titleOf(name: string): string {
  const dot = name.lastIndexOf('.')
  const base = (dot > 0 ? name.slice(0, dot) : name).replace(/[_-]+/g, ' ').trim()
  return base || 'Your notes'
}

export interface MockUpload {
  uploadDocument(file: File): Promise<DocumentUpload>
  getDocumentStatus(id: string): Promise<DocumentStatus>
  getDocumentTopics(id: string): Promise<DocumentTopic[]>
  generateDungeon(id: string): Promise<Dungeon>
  retryDocument(id: string): Promise<DocumentUpload>
  /** The generated dungeon with its floors as of now, or undefined when `id` is not one of ours. */
  dungeon(id: string): Dungeon | undefined
  generationStatus(id: string): GenerationStatus | undefined
  /** True when `floorId` belongs to a generated dungeon; retries it if it failed. */
  retryFloor(floorId: string): boolean | undefined
}

export function createMockUpload(options: MockUploadOptions): MockUpload {
  const { now, session } = options
  const processingMs = options.processingMs ?? MOCK_PROCESSING_MS
  const stepMs = options.stepMs ?? GENERATION_STEP_MS
  const docs = new Map<string, DocRecord>()
  const dungeons = new Map<string, GeneratedDungeon>()
  let counter = 0

  const requireRegistered = async (): Promise<void> => {
    const me = await session()
    if (!me) throw new ApiError(401, 'Not authenticated', 'UNAUTHORIZED')
    if (me.user.is_guest) {
      throw new ApiError(403, 'Guests can only play the public demo dungeon. Sign up to use your own notes.', 'GUEST_FORBIDDEN')
    }
  }
  const find = (id: string): DocRecord => {
    const doc = docs.get(id)
    if (!doc) throw new ApiError(404, 'Document not found or does not belong to user.', 'DOCUMENT_NOT_FOUND')
    return doc
  }
  const statusOf = (doc: DocRecord): DocumentStatusValue =>
    now() - doc.startedAt < processingMs ? 'processing' : doc.verdict

  function classify(file: File): Pick<DocRecord, 'verdict' | 'reason'> {
    const lower = file.name.toLowerCase()
    if (/(meme|receipt|invoice)/.test(lower)) {
      return {
        verdict: 'rejected',
        reason: 'This does not look like study material. It reads like a meme, receipt or invoice, so no dungeon can be built from it.',
      }
    }
    if (extensionOf(file.name) === 'txt' && file.size < MOCK_MIN_TXT_BYTES) {
      return { verdict: 'rejected', reason: 'The document has too little text. At least 500 characters are needed to build questions.' }
    }
    if (lower.includes('broken')) {
      return { verdict: 'failed', reason: 'Extraction error: the file could not be read.' }
    }
    return { verdict: 'accepted', reason: null }
  }

  function topicsFor(id: string, name: string): DocumentTopic[] {
    const title = titleOf(name)
    const count = 3 + (hash(name) % 3)
    return Array.from({ length: count }, (_, i) => ({
      id: `${id}-topic-${i + 1}`,
      name: `${title}: ${TOPIC_WORDS[i % TOPIC_WORDS.length]}`,
      description: `Section ${i + 1} of ${title}.`,
      order_index: i,
    }))
  }

  function build(doc: DocRecord): GeneratedDungeon {
    const id = `gen-${doc.id}`
    const rooms: Room[] = []
    const questions: Question[] = []
    const floors: Floor[] = []
    let order = 0
    const addRoom = (rid: string, label: string, monster: string, hp: number, isBoss: boolean, floorId?: string): Room => {
      const pool = syntheticPool(rid, label)
      questions.push(...pool)
      order += 1
      const room: Room = {
        id: rid,
        label,
        order,
        is_boss: isBoss,
        ...(floorId ? { floor_id: floorId } : {}),
        monster: { id: `monster-${rid}`, name: monster, max_hp: hp, question_ids: pool.map((q) => q.id), kind: 'unknown' },
      }
      rooms.push(room)
      return room
    }
    // Two topics per floor; the last room of a floor holds its boss.
    for (let i = 0; i < doc.topics.length; i += 2) {
      const n = floors.length + 1
      const floorId = `${id}-floor-${n}`
      const group = doc.topics.slice(i, i + 2)
      const own = group.map((t, k) =>
        addRoom(`${id}-r${i + k + 1}`, t.name, k === group.length - 1 ? `Warden ${n}` : `Guardian ${n}`, k === group.length - 1 ? 90 : 80, false, floorId),
      )
      const boss = own[own.length - 1]
      floors.push({
        id: floorId,
        index: n,
        title: `Floor ${n}`,
        status: 'locked',
        topics: own.map((r) => ({ id: r.id, title: r.label, mastery: 0 })),
        boss: { id: boss.monster.id, name: boss.monster.name, hp: boss.monster.max_hp, kind: 'unknown' },
        rank: null,
        room_ids: own.map((r) => r.id),
      })
    }
    const finalRoom = addRoom(`${id}-final`, 'Final Exam', 'The Exam Warden', 220, true)
    const final_boss: FinalBoss = { id: finalRoom.monster.id, name: finalRoom.monster.name, hp: finalRoom.monster.max_hp, unlocked: false }
    return {
      id,
      name: `${titleOf(doc.name)} Dungeon`,
      startedAt: now(),
      sim: createGenerationSim(floors.length, { stepMs }),
      base: { id, name: `${titleOf(doc.name)} Dungeon`, rooms, questions, floors, final_boss },
    }
  }

  function view(g: GeneratedDungeon): Dungeon {
    const statuses = g.sim.statuses(now() - g.startedAt)
    const floors = g.base.floors.map((f, i) => ({ ...f, status: statuses[i] }))
    return structuredClone({
      ...g.base,
      floors,
      final_boss: { ...g.base.final_boss, unlocked: floors.every((f) => f.status === 'cleared') },
    })
  }

  return {
    async uploadDocument(file) {
      await requireRegistered()
      if (docs.size >= MOCK_QUOTA) {
        throw new ApiError(400, 'Maximum active document quota of 5 reached. Please delete an older document first.', 'QUOTA_EXCEEDED')
      }
      if (file.size > MOCK_MAX_BYTES) {
        throw new ApiError(413, 'File exceeds maximum allowed size of 15MB.', 'FILE_TOO_LARGE')
      }
      if (!(EXTENSIONS as readonly string[]).includes(extensionOf(file.name))) {
        throw new ApiError(415, 'Unsupported file type. Use PDF, DOCX, PPTX, TXT, PNG or JPEG.', 'UNSUPPORTED_FILE_TYPE')
      }
      counter += 1
      const id = `doc-${counter}`
      const { verdict, reason } = classify(file)
      docs.set(id, {
        id,
        name: file.name,
        startedAt: now(),
        verdict,
        reason,
        topics: verdict === 'accepted' ? topicsFor(id, file.name) : [],
        dungeonId: null,
      })
      return { id, status: 'processing', message: 'Document accepted for processing.' }
    },

    async getDocumentStatus(id) {
      const me = await session()
      if (!me) throw new ApiError(401, 'Not authenticated', 'UNAUTHORIZED')
      const doc = find(id)
      const status = statusOf(doc)
      return {
        id,
        status,
        rejection_reason: status === 'rejected' || status === 'failed' ? doc.reason : null,
        chunks_count: status === 'accepted' ? 4 + doc.topics.length * 3 : 0,
        relevance_score: status === 'processing' ? null : status === 'rejected' ? 0.2 : 0.9,
        readability_score: status === 'processing' ? null : status === 'rejected' ? 0.3 : 0.85,
      }
    },

    async getDocumentTopics(id) {
      await requireRegistered()
      const doc = find(id)
      return statusOf(doc) === 'accepted' ? structuredClone(doc.topics) : []
    },

    async generateDungeon(id) {
      await requireRegistered()
      const doc = find(id)
      if (statusOf(doc) !== 'accepted') {
        throw new ApiError(400, 'Document has no extracted chunks available for dungeon generation.', 'NO_CHUNKS_AVAILABLE')
      }
      const existing = doc.dungeonId ? dungeons.get(doc.dungeonId) : undefined
      if (existing) return view(existing)
      const g = build(doc)
      dungeons.set(g.id, g)
      doc.dungeonId = g.id
      return view(g)
    },

    async retryDocument(id) {
      await requireRegistered()
      const doc = find(id)
      const status = statusOf(doc)
      if (status !== 'failed' && status !== 'rejected') {
        throw new ApiError(400, 'Only failed or rejected documents can be retried.', 'NOT_RETRYABLE')
      }
      // A retry runs the pipeline again; the demo's second pass succeeds unless the content itself was rejected.
      const again: Pick<DocRecord, 'verdict' | 'reason'> =
        doc.verdict === 'failed' ? { verdict: 'accepted', reason: null } : { verdict: doc.verdict, reason: doc.reason }
      Object.assign(doc, again, { startedAt: now(), topics: again.verdict === 'accepted' ? topicsFor(id, doc.name) : [] })
      return { id, status: 'processing', message: 'Document re-queued for processing.' }
    },

    dungeon(id) {
      const g = dungeons.get(id)
      return g ? view(g) : undefined
    },

    generationStatus(id) {
      const g = dungeons.get(id)
      if (!g) return undefined
      const d = view(g)
      return { dungeon_id: id, floors: (d.floors ?? []).map((f) => ({ id: f.id, status: f.status })) }
    },

    retryFloor(floorId) {
      for (const g of dungeons.values()) {
        const index = g.base.floors.findIndex((f) => f.id === floorId)
        if (index >= 0) return g.sim.retry(index, now() - g.startedAt)
      }
      return undefined
    },
  }
}
