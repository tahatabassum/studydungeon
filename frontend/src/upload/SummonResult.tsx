import { useCallback, useMemo } from 'react'
import { Link } from 'react-router-dom'
import { Map as MapIcon } from 'lucide-react'
import { getApi } from '../api'
import { campaignView } from '../campaign/floorRooms'
import { StatusChip } from '../campaign/nodeParts'
import { useGenerationStatus } from '../campaign/useGenerationStatus'
import type { Dungeon } from '../types/api'

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
      <ol className="sd-up__floors" aria-label="Floors of your dungeon">
        {generation.floors.map((f) => (
          <li key={f.id} className="sd-up__floor" data-status={f.status}>
            <span className="sd-up__floor-name">{`Floor ${f.index}, ${f.title}`}</span>
            <StatusChip status={f.status} />
          </li>
        ))}
      </ol>
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
