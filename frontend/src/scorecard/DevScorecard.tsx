import { useNavigate, useSearchParams } from 'react-router-dom'
import { Scorecard } from './Scorecard'
import type { ProgressInfo, RunSummary } from '../types/api'

/**
 * DEV only (`/dev/scorecard`): the Scorecard on sample data, so the screen can be reviewed without playing a
 * whole floor. `?case=` picks floor (default), guest, error, pending, weak or nolb (no leaderboard).
 */
const SAMPLE: RunSummary = {
  score: 2400,
  xp: 190,
  correct: 21,
  total: 24,
  accuracy: 0.875,
  floor_rank: 'A',
  level_up: { from: 2, to: 3 },
  weapon_unlocked: 'hunter_crossbow',
  badges_earned: ['first_blood', 'boss_slayer', 'streak_5'],
  leaderboard_rank: 4,
  mastery_by_topic: [
    { topic_id: 't1', title: 'Hardware basics', mastery: 92 },
    { topic_id: 't2', title: 'Memory and storage', mastery: 64 },
    { topic_id: 't3', title: 'Operating systems', mastery: 38 },
  ],
  weak_concepts: [
    { text: 'What does RAM lose when the power goes out?', page: 4 },
    { text: 'Which scheduler gives every process an equal slice of CPU time?', page: 11 },
  ],
  chest_rewards: [
    { id: 'c1', kind: 'xp', label: 'Bonus XP', amount: 40 },
    { id: 'c2', kind: 'coins', label: 'Crypt coins', amount: 60 },
  ],
}

const PROGRESS: ProgressInfo = { level: 3, total_xp: 410, xp_to_next: 190 }

export default function DevScorecard() {
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const kind = params.get('case') ?? 'floor'
  const weak: RunSummary = {
    ...SAMPLE,
    accuracy: 0.46,
    correct: 11,
    floor_rank: 'C',
    level_up: null,
    weapon_unlocked: null,
    badges_earned: [],
    mastery_by_topic: SAMPLE.mastery_by_topic?.map((t) => ({ ...t, mastery: Math.min(t.mastery, 45) })),
  }
  const summary = kind === 'error' || kind === 'pending' ? null : kind === 'weak' ? weak : SAMPLE
  return (
    <Scorecard
      summary={summary}
      pending={kind === 'pending'}
      error={kind === 'error' ? 'Your results could not be loaded.' : null}
      received={{ score: 2400, xp: 150 }}
      progress={PROGRESS}
      isGuest={kind === 'guest'}
      leaderboardEnabled={kind !== 'nolb'}
      title="The Marrow Warden falls!"
      subtitle="Floor 1, The Entry Crypt cleared"
      playAgainLabel="Replay floor"
      exitLabel="Back to the map"
      onRetry={() => navigate('/dev/scorecard')}
      onPlayAgain={() => navigate('/dev/scorecard?case=pending')}
      onExit={() => navigate('/')}
      onViewLeaderboard={() => navigate('/leaderboard')}
      onCreateAccount={() => navigate('/register')}
    />
  )
}
