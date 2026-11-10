import { describe, expect, it } from 'vitest'
import { ENDPOINT_SCHEMAS } from '../schemas'
import { ApiError, friendlyMessage, parseErrorBody } from '../errors'
import {
  WIRE_ENDPOINTS,
  kindFromMonsterType,
  mapAttempt,
  mapClear,
  mapDemoSession,
  mapDueReviews,
  mapDungeon,
  mapFinish,
  mapMe,
  mapProgress,
  mapRun,
  questionTypeFromOptions,
  wireDungeonSchema,
  wireLogoutSchema,
  wireUserSchema,
} from './index'
import {
  wireAttemptCorrect,
  wireAttemptWrong,
  wireClear,
  wireDemoSession,
  wireDueReviews,
  wireDungeon,
  wireErrors,
  wireFinish,
  wireProgress,
  wireRun,
  wireRunResumed,
} from './wire.fixtures'

// Read the shared docs as text through the runtime's built-in fs (no Node typings), like scans.test.ts.
interface Fs {
  readFileSync(path: string, enc: string): string
}
interface NodeRuntime {
  cwd(): string
  getBuiltinModule(id: string): Fs
}
const nodeProcess = (globalThis as unknown as { process: NodeRuntime }).process
const fs = nodeProcess.getBuiltinModule('node:fs')
const docs = `${nodeProcess.cwd().replace(/\\/g, '/')}/../docs`
const readJson = (rel: string): unknown => JSON.parse(fs.readFileSync(`${docs}/${rel}`, 'utf8'))

interface SampleQuestion {
  prompt: string
  options: string[]
  correct_option: number
  difficulty: string
  evidence_quote: string
  explanation: string
}
interface SampleDungeon {
  title: string
  rooms: Array<{ order: number; topic: string; monster: string; hp: number; questions: SampleQuestion[] }>
}

/** Builds the GET /dungeons/{id} body the backend would serve for the seeded sample (answers redacted). */
function sampleAsWire(sample: SampleDungeon) {
  return {
    id: 'sample-dungeon',
    title: sample.title,
    is_public_demo: true,
    created_at: '2026-11-08T10:00:00Z',
    rooms: sample.rooms.map((r, i) => ({
      id: `sample-room-${i}`,
      room_number: r.order + 1,
      topic_name: r.topic,
      monster_name: r.monster,
      monster_type: r.monster,
      monster_hp: r.hp,
      is_boss: i === sample.rooms.length - 1,
      questions: r.questions.map((q, j) => ({ id: `sample-q-${i}-${j}`, prompt: q.prompt, options: q.options, difficulty: q.difficulty })),
    })),
  }
}

describe('kindFromMonsterType (C5)', () => {
  it.each([
    ['Silicon Golem', false, 'gear_golem'],
    ['Memory Wraith', false, 'paper_wraith'],
    ['Packet Spectre', false, 'paper_wraith'],
    ['Toxic Slime', false, 'toxic_slime'],
    ['Memory Eater', false, 'memory_eater'],
    ['The Exam Warden (Boss)', true, 'exam_warden'],
    ['Spectral Overlord', true, 'exam_warden'],
    ['Guardian of Operating Sy', false, 'unknown'],
    ['', false, 'unknown'],
  ])('%s (boss %s) looks like %s', (name, boss, kind) => {
    expect(kindFromMonsterType(name, boss)).toBe(kind)
  })

  it('a boss is always the Exam Warden, whatever its name', () => {
    expect(kindFromMonsterType('Silicon Golem', true)).toBe('exam_warden')
  })
})

describe('questionTypeFromOptions (C6)', () => {
  it('detects true/false and defaults to mcq', () => {
    expect(questionTypeFromOptions(['True', 'False'])).toBe('true_false')
    expect(questionTypeFromOptions(['false', 'TRUE'])).toBe('true_false')
    expect(questionTypeFromOptions(['A', 'B'])).toBe('mcq')
    expect(questionTypeFromOptions(['True', 'False', 'Maybe'])).toBe('mcq')
  })
})

describe('mapDungeon against docs/handoff/demo_dungeon.sample.json', () => {
  const sample = readJson('handoff/demo_dungeon.sample.json') as SampleDungeon
  const wire = sampleAsWire(sample)
  const dungeon = mapDungeon(wireDungeonSchema.parse(wire))

  it('keeps the real HP values (80, 90, 85, 220) and never hard-codes them', () => {
    expect(dungeon.rooms.map((r) => r.monster.max_hp)).toEqual(sample.rooms.map((r) => r.hp))
    expect(dungeon.rooms.map((r) => r.monster.max_hp)).toEqual([80, 90, 85, 220])
  })

  it('maps title, topic, order, boss flag and monster look', () => {
    expect(dungeon.name).toBe(sample.title)
    expect(dungeon.rooms.map((r) => r.label)).toEqual(sample.rooms.map((r) => r.topic))
    expect(dungeon.rooms.map((r) => r.order)).toEqual([1, 2, 3, 4])
    expect(dungeon.rooms.map((r) => r.is_boss)).toEqual([false, false, false, true])
    expect(dungeon.rooms.map((r) => r.monster.kind)).toEqual(['gear_golem', 'paper_wraith', 'paper_wraith', 'exam_warden'])
  })

  it('flattens the room questions and links them to their monster', () => {
    const total = sample.rooms.reduce((n, r) => n + r.questions.length, 0)
    expect(dungeon.questions).toHaveLength(total)
    for (const room of dungeon.rooms) {
      for (const qid of room.monster.question_ids) expect(dungeon.questions.some((q) => q.id === qid)).toBe(true)
    }
  })

  it('never carries an answer, explanation or quote', () => {
    const text = JSON.stringify(dungeon)
    for (const q of sample.rooms.flatMap((r) => r.questions)) {
      expect(text).not.toContain(q.evidence_quote)
      expect(text).not.toContain(q.explanation)
    }
    expect(text).not.toContain('correct_option')
  })

  it('produces a value the domain schema accepts', () => {
    expect(ENDPOINT_SCHEMAS.getDungeon.schema.safeParse(dungeon).success).toBe(true)
  })

  it('sorts rooms by room_number even when the backend sends them out of order', () => {
    const shuffled = { ...wire, rooms: [...wire.rooms].reverse() }
    const d = mapDungeon(wireDungeonSchema.parse(shuffled))
    expect(d.rooms.map((r) => r.order)).toEqual([1, 2, 3, 4])
  })
})

describe('mappers on real response samples', () => {
  it('maps every sample to a domain value its schema accepts', () => {
    expect(ENDPOINT_SCHEMAS.startDemoSession.schema.safeParse(mapDemoSession(WIRE_ENDPOINTS.startDemoSession.schema.parse(wireDemoSession))).success).toBe(true)
    expect(ENDPOINT_SCHEMAS.getDungeon.schema.safeParse(mapDungeon(WIRE_ENDPOINTS.getDungeon.schema.parse(wireDungeon))).success).toBe(true)
    expect(ENDPOINT_SCHEMAS.startRun.schema.safeParse(mapRun(WIRE_ENDPOINTS.startRun.schema.parse(wireRun))).success).toBe(true)
    expect(ENDPOINT_SCHEMAS.clearRoom.schema.safeParse(mapClear(WIRE_ENDPOINTS.clearRoom.schema.parse(wireClear))).success).toBe(true)
    expect(ENDPOINT_SCHEMAS.finishRun.schema.safeParse(mapFinish(WIRE_ENDPOINTS.finishRun.schema.parse(wireFinish))).success).toBe(true)
    expect(ENDPOINT_SCHEMAS.getProgress.schema.safeParse(mapProgress(WIRE_ENDPOINTS.getProgress.schema.parse(wireProgress))).success).toBe(true)
    const due = mapDueReviews(WIRE_ENDPOINTS.getDueReviews.schema.parse(wireDueReviews), () => undefined)
    expect(ENDPOINT_SCHEMAS.getDueReviews.schema.safeParse(due).success).toBe(true)
  })

  it('run start: current_hp becomes player_hp; the first uncleared room is current', () => {
    const run = mapRun(WIRE_ENDPOINTS.startRun.schema.parse(wireRun))
    expect(run).toMatchObject({ player_hp: 100, monster_hp: 80, current_room_id: 'room-a' })
    const resumed = mapRun(WIRE_ENDPOINTS.getRun.schema.parse(wireRunResumed))
    expect(resumed).toMatchObject({ player_hp: 80, monster_hp: 50, current_room_id: 'room-b', score: 240, streak: 2 })
  })

  it('run with every room cleared points at the last room', () => {
    const all = { ...wireRun, rooms: wireRun.rooms.map((r) => ({ ...r, is_cleared: true, monster_current_hp: 0 })) }
    expect(mapRun(WIRE_ENDPOINTS.startRun.schema.parse(all)).current_room_id).toBe('room-boss')
  })

  it('attempt: renames fields, uses the passed monster HP and weapon, omits null text', () => {
    const ok = mapAttempt(WIRE_ENDPOINTS.submitAttempt.schema.parse(wireAttemptCorrect), { monsterHpRemaining: 60, scoreDelta: 120, weaponId: 'rusty_dagger' })
    expect(ok).toMatchObject({ correct: true, damage_dealt: 20, monster_hp_remaining: 60, player_hp_remaining: 100, score_delta: 120, streak: 1, weapon_id: 'rusty_dagger', is_critical: false })
    expect(ok.evidence_quote).toContain('Arithmetic Logic Unit')
    expect('xp_delta' in ok).toBe(false)
    expect('source' in ok).toBe(false)
    const bad = mapAttempt(WIRE_ENDPOINTS.submitAttempt.schema.parse(wireAttemptWrong), { monsterHpRemaining: 60, scoreDelta: 0, weaponId: 'rusty_dagger' })
    expect(bad).toMatchObject({ correct: false, damage_dealt: 0, player_hp_remaining: 90, streak: 0 })
    expect('explanation' in bad).toBe(false)
    expect('evidence_quote' in bad).toBe(false)
  })

  it('room clear and finish keep the real numbers', () => {
    expect(mapClear(WIRE_ENDPOINTS.clearRoom.schema.parse(wireClear))).toEqual({ xp_delta: 25, is_boss: false })
    expect(mapFinish(WIRE_ENDPOINTS.finishRun.schema.parse(wireFinish))).toEqual({
      score: 600,
      xp: 160,
      correct: 6,
      total: 7,
      accuracy: 0.86,
      mastery_band: 'Strong',
    })
  })

  it('progress: weapon names become ids; locked weapons carry the real rule; no xp_to_next', () => {
    const p = mapProgress(WIRE_ENDPOINTS.getProgress.schema.parse(wireProgress))
    expect(p.xp_to_next).toBeUndefined()
    expect(p.unlocked_weapons).toEqual(['rusty_dagger', 'arcane_staff'])
    expect(p.weapons?.map((w) => [w.id, w.unlock_level])).toEqual([
      ['rusty_dagger', 1],
      ['arcane_staff', 1],
      ['hunter_crossbow', 3],
      ['spectral_hammer', 3],
      ['flame_sigil', 3],
    ])
    expect(p.weapons?.find((w) => w.id === 'hunter_crossbow')?.requirement).toBe('Clear 2 rooms')
  })

  it('progress ignores unknown weapon names and always includes the dagger', () => {
    const p = mapProgress({ level: 1, total_xp: 0, unlocked_weapons: ['Mystery Blade'] })
    expect(p.unlocked_weapons).toEqual(['rusty_dagger'])
  })

  it('due reviews: id is the question id; unknown rooms get an empty room_id; duplicates are dropped', () => {
    const items = WIRE_ENDPOINTS.getDueReviews.schema.parse([...wireDueReviews, wireDueReviews[0]])
    const due = mapDueReviews(items, (q) => (q === 'qa1' ? 'room-a' : undefined))
    expect(due.map((d) => [d.id, d.room_id, d.question.type])).toEqual([
      ['qa1', 'room-a', 'mcq'],
      ['other-dungeon-q', '', 'true_false'],
    ])
  })
})

describe('auth bodies (C22)', () => {
  it('register and login return a bare user; extra fields are dropped', () => {
    const u = wireUserSchema.parse(wireDemoSession.user)
    expect(mapDemoSession(WIRE_ENDPOINTS.startDemoSession.schema.parse(wireDemoSession)).user).toEqual({
      id: 'u-guest-1',
      username: 'guest_ab12cd',
      is_guest: true,
    })
    expect(u.created_at).toBe('2026-11-08T10:00:00Z')
  })

  it('GET /auth/me returns the user with expires_at, null for a registered user', () => {
    expect(mapMe(wireUserSchema.parse(wireDemoSession.user)).expires_at).toBe('2026-11-09T10:00:00Z')
    const registered = wireUserSchema.parse({ id: 'u2', username: 'ada', is_guest: false, created_at: '2026-11-08T10:00:00Z', expires_at: null })
    expect(mapMe(registered)).toEqual({ user: { id: 'u2', username: 'ada', is_guest: false }, expires_at: null })
  })

  it('logout is { success: true }', () => {
    expect(wireLogoutSchema.safeParse({ success: true }).success).toBe(true)
    expect(wireLogoutSchema.safeParse({}).success).toBe(false)
  })
})

describe('wire schemas against docs/openapi.json', () => {
  interface OpenApi {
    components: { schemas: Record<string, { required?: string[] }> }
  }
  const spec = readJson('openapi.json') as OpenApi
  const required = (name: string): string[] => spec.components.schemas[name]?.required ?? []

  it.each([
    ['AttemptResponse', wireAttemptCorrect],
    ['RunDetailResponse', wireRun],
    ['RunRoomState', wireRun.rooms[0]],
    ['RunSummaryResponse', wireFinish],
    ['DungeonDetailView', wireDungeon],
    ['DungeonRoomView', wireDungeon.rooms[0]],
    ['QuestionGameplayView', wireDungeon.rooms[0].questions[0]],
    ['ProgressResponse', wireProgress],
    ['ReviewQuestionItem', wireDueReviews[0]],
    ['DemoSessionResponse', wireDemoSession],
    ['UserResponse', wireDemoSession.user],
  ])('%s: every required property is present in our sample', (name, sample) => {
    const keys = required(name)
    expect(keys.length).toBeGreaterThan(0)
    for (const key of keys) expect(sample, `${name}.${key}`).toHaveProperty(key)
  })

  it('every wire schema accepts the sample for its endpoint', () => {
    expect(WIRE_ENDPOINTS.getDungeon.schema.safeParse(wireDungeon).success).toBe(true)
    expect(WIRE_ENDPOINTS.startRun.schema.safeParse(wireRun).success).toBe(true)
    expect(WIRE_ENDPOINTS.submitAttempt.schema.safeParse(wireAttemptCorrect).success).toBe(true)
    expect(WIRE_ENDPOINTS.submitAttempt.schema.safeParse(wireAttemptWrong).success).toBe(true)
    expect(WIRE_ENDPOINTS.finishRun.schema.safeParse(wireFinish).success).toBe(true)
    expect(WIRE_ENDPOINTS.getProgress.schema.safeParse(wireProgress).success).toBe(true)
    expect(WIRE_ENDPOINTS.getDueReviews.schema.safeParse(wireDueReviews).success).toBe(true)
  })
})

describe('error bodies (C16, C18, C24, C28)', () => {
  it('reads string, {code,message}, validation and 422 array details', () => {
    expect(parseErrorBody({ detail: 'nope' })).toEqual({ message: 'nope' })
    expect(parseErrorBody(wireErrors.code)).toEqual({ message: 'Cannot finish run until boss monster is defeated.', code: 'BOSS_NOT_CLEARED' })
    expect(parseErrorBody(wireErrors.validation).code).toBe('VALIDATION_ERROR')
    expect(parseErrorBody(wireErrors.fastapi422)).toEqual({
      message: 'Field required',
      code: 'VALIDATION_ERROR',
      fields: [{ field: 'dungeon_id', message: 'Field required' }],
    })
    expect(parseErrorBody(null)).toEqual({})
    expect(parseErrorBody('text')).toEqual({})
  })

  it.each([
    'BOSS_NOT_CLEARED',
    'MONSTER_ALIVE',
    'RUN_FINISHED',
    'OUT_OF_ORDER_ROOM',
    'ROOM_ALREADY_CLEARED',
    'UNKNOWN_WEAPON',
    'WEAPON_LOCKED',
    'QUESTION_NOT_FOUND',
    'GUEST_FORBIDDEN',
  ])('%s has a friendly message', (code) => {
    const text = friendlyMessage(code, 409)
    expect(text).toBeTruthy()
    expect(text).not.toContain(code)
  })

  it('401 means the guest session expired; unknown codes give no override', () => {
    expect(friendlyMessage(undefined, 401)).toContain('expired')
    expect(friendlyMessage('SOMETHING_ELSE', 500)).toBeUndefined()
    expect(new ApiError(401, 'x').code).toBeUndefined()
  })
})
