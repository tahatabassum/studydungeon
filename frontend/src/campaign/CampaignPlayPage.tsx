import { Navigate, useParams } from 'react-router-dom'
import PlayPage from '../pages/PlayPage'

/** `/campaign/:dungeonId/play/:floorId`: the existing play experience, limited to one Floor. */
export default function CampaignPlayPage() {
  const { dungeonId, floorId } = useParams()
  if (!dungeonId || !floorId) return <Navigate to="/" replace />
  return <PlayPage key={`${dungeonId}:${floorId}`} scope={{ dungeonId, floorId }} />
}
