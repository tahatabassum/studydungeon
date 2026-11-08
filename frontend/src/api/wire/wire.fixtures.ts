/**
 * Real-backend response samples, written from backend/app/schemas/*.py, docs/openapi.json and the
 * seeded demo dungeon (docs/handoff/demo_dungeon.sample.json). Test data only.
 */
const q = (id: string, prompt: string, difficulty = 'easy') => ({
  id,
  prompt,
  options: ['Control Unit', 'Arithmetic Logic Unit (ALU)', 'Program Counter', 'Memory Data Register'],
  difficulty,
})

export const wireDemoSession = {
  user: {
    id: 'u-guest-1',
    username: 'guest_ab12cd',
    is_guest: true,
    created_at: '2026-11-08T10:00:00Z',
    expires_at: '2026-11-09T10:00:00Z',
  },
  dungeon_id: 'dungeon-demo',
  expires_at: '2026-11-09T10:00:00Z',
}

export const wireDungeon = {
  id: 'dungeon-demo',
  title: 'Computer Systems & Architecture (Seeded Demo)',
  is_public_demo: true,
  created_at: '2026-11-08T10:00:00Z',
  rooms: [
    {
      id: 'room-a',
      room_number: 1,
      topic_name: 'Central Processing Unit (CPU)',
      monster_name: 'Silicon Golem',
      monster_type: 'Silicon Golem',
      monster_hp: 80,
      is_boss: false,
      questions: [q('qa1', 'Which component carries out calculations?'), q('qa2', 'What do registers do?', 'medium')],
    },
    {
      id: 'room-b',
      room_number: 2,
      topic_name: 'Primary & Secondary Storage',
      monster_name: 'Memory Wraith',
      monster_type: 'Memory Wraith',
      monster_hp: 90,
      is_boss: false,
      questions: [q('qb1', 'Why is RAM volatile?'), q('qb2', 'What do SSDs use?', 'medium')],
    },
    {
      id: 'room-boss',
      room_number: 3,
      topic_name: 'Final Exam',
      monster_name: 'The Exam Warden (Boss)',
      monster_type: 'The Exam Warden (Boss)',
      monster_hp: 220,
      is_boss: true,
      questions: [q('qz1', 'Boss question one', 'hard'), { id: 'qz2', prompt: 'True or false?', options: ['True', 'False'], difficulty: 'medium' }],
    },
  ],
}

const runRooms = (hp: [number, number, number], cleared: [boolean, boolean, boolean] = [false, false, false]) => [
  { room_id: 'room-a', room_number: 1, topic_name: 'CPU', monster_name: 'Silicon Golem', monster_max_hp: 80, monster_current_hp: hp[0], is_cleared: cleared[0], is_boss: false },
  { room_id: 'room-b', room_number: 2, topic_name: 'Storage', monster_name: 'Memory Wraith', monster_max_hp: 90, monster_current_hp: hp[1], is_cleared: cleared[1], is_boss: false },
  { room_id: 'room-boss', room_number: 3, topic_name: 'Final Exam', monster_name: 'The Exam Warden (Boss)', monster_max_hp: 220, monster_current_hp: hp[2], is_cleared: cleared[2], is_boss: true },
]

export const wireRun = {
  id: 'run-1',
  dungeon_id: 'dungeon-demo',
  current_hp: 100,
  current_score: 0,
  current_streak: 0,
  xp_earned: 0,
  status: 'active',
  started_at: '2026-11-08T10:15:00Z',
  rooms: runRooms([80, 90, 220]),
}

export const wireRunResumed = {
  ...wireRun,
  current_hp: 80,
  current_score: 240,
  current_streak: 2,
  xp_earned: 20,
  rooms: runRooms([0, 50, 220], [true, false, false]),
}

export const wireAttemptCorrect = {
  attempt_id: 'a1',
  is_correct: true,
  damage_dealt: 20,
  damage_taken: 0,
  is_critical: false,
  current_hp: 100,
  current_score: 120,
  current_streak: 1,
  monster_hp_remaining: 0,
  explanation: 'The ALU is responsible for calculations.',
  evidence_quote: 'The Arithmetic Logic Unit (ALU) performs basic arithmetic and logic operations.',
}

export const wireAttemptWrong = {
  attempt_id: 'a2',
  is_correct: false,
  damage_dealt: 0,
  damage_taken: 10,
  is_critical: false,
  current_hp: 90,
  current_score: 120,
  current_streak: 0,
  monster_hp_remaining: 0,
  explanation: null,
  evidence_quote: null,
}

export const wireClear = { success: true, room_id: 'room-a', xp_delta: 25, is_boss: false }

export const wireFinish = {
  id: 'run-1',
  score: 600,
  xp_earned: 160,
  correct_count: 6,
  total_attempts: 7,
  accuracy: 0.86,
  mastery_band: 'Strong',
  status: 'completed',
}

export const wireProgress = {
  user_id: 'u-guest-1',
  level: 2,
  total_xp: 120,
  unlocked_weapons: ['Rusty Dagger', 'Arcane Staff'],
}

export const wireDueReviews = [
  {
    question_id: 'qa1',
    prompt: 'Which component carries out calculations?',
    options: ['Control Unit', 'Arithmetic Logic Unit (ALU)', 'Program Counter', 'Memory Data Register'],
    next_review_at: '2026-11-08T10:25:00Z',
    repetition_count: 0,
  },
  {
    question_id: 'other-dungeon-q',
    prompt: 'A question from another dungeon',
    options: ['True', 'False'],
    next_review_at: '2026-11-08T10:25:00Z',
    repetition_count: 1,
  },
]

/** Error bodies the backend sends (backend/app/core/errors.py). */
export const wireErrors = {
  code: { detail: { code: 'BOSS_NOT_CLEARED', message: 'Cannot finish run until boss monster is defeated.' } },
  validation: {
    detail: { code: 'VALIDATION_ERROR', message: 'Invalid request parameters or payload', errors: [{ loc: ['body', 'username'], msg: 'Field required', type: 'missing' }] },
  },
  fastapi422: { detail: [{ loc: ['body', 'dungeon_id'], msg: 'Field required', type: 'missing' }] },
}
