import { Navigate, useLocation, useParams } from 'react-router-dom'
import PlayPage from '../pages/PlayPage'
import { isPracticeMode, parseExamMinutes } from './modes'

/**
 * `/campaign/:dungeonId/mode/:mode[/:floorId]`: Weak Topics, Exam or Replay Floor in the campaign play
 * flow. `?minutes=10|20|30` turns the Exam timer on; without it there is no timer.
 */
export default function ModePlayPage() {
  const { dungeonId, mode, floorId } = useParams()
  const { search } = useLocation()
  if (!dungeonId || !isPracticeMode(mode)) return <Navigate to="/" replace />
  if (mode === 'replay_floor' && !floorId) return <Navigate to={`/campaign/${encodeURIComponent(dungeonId)}`} replace />
  const examMinutes = mode === 'exam' ? parseExamMinutes(search) : null
  return (
    <PlayPage
      key={`${dungeonId}:${mode}:${floorId ?? ''}:${examMinutes ?? ''}`}
      scope={{ dungeonId, floorId: mode === 'replay_floor' ? (floorId ?? null) : null, mode }}
      examMinutes={examMinutes}
    />
  )
}
