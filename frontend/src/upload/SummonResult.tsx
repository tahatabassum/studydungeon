import { useCallback, useMemo } from 'react'
import { Link } from 'react-router-dom'
import { Map as MapIcon } from 'lucide-react'
import { getApi } from '../api'
import { campaignView } from '../campaign/floorRooms'
import { useGenerationStatus } from '../campaign/useGenerationStatus'
import type { Dungeon } from '../types/api'
import { FloorProgressList } from './FloorProgressList'

export interface SummonResultProps {
  dungeon: Dungeon
}

/**
 * "Your notes became N floors" and the way to the campaign map. The floor list reuses the map's own
 * generation poller and status chips, so a floor reads Summoning until it is Ready.
 */
export function SummonResult({ dungeon }: SummonResultProps) {
  const baseFloors = useMemo(() => campaignView(dungeon).floors ?? [], [dungeon])
  const fetchStatus = useCallback(async () => (await getApi()).getGenerationStatus(dungeon.id), [dungeon.id])
  const generation = useGenerationStatus({ floors: baseFloors, fetchStatus })
  const count = baseFloors.length
  const mapPath = `/campaign/${encodeURIComponent(dungeon.id)}`

  return (
    <section className="sd-up__result" aria-labelledby="up-result-title" data-testid="upload-result">
      <h2 id="up-result-title" className="sd-up__result-h">
        {`Your notes became ${count} ${count === 1 ? 'floor' : 'floors'}`}
      </h2>
      <p className="sd-up__result-sub">{dungeon.name}</p>
      <FloorProgressList floors={generation.floors} />
      {generation.timedOut && (
        <p className="sd-card__muted" role="status">
          Summoning is taking longer than usual.{' '}
          <button type="button" className="sd-link-btn" onClick={generation.resume}>
            Check again
          </button>
        </p>
      )}
      <div role="status" aria-live="polite" className="sr-only" data-testid="upload-floor-live">
        {generation.announcement}
      </div>
      <div className="sd-up__result-cta">
        <Link to={mapPath} className="sd-cta" data-testid="open-map">
          <MapIcon aria-hidden="true" size={18} />
          Open the campaign map
        </Link>
      </div>
    </section>
  )
}
