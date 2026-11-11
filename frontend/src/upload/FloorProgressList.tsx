import { StatusChip } from '../campaign/nodeParts'
import type { Floor } from '../types/api'

export interface FloorProgressListProps {
  floors: readonly Pick<Floor, 'id' | 'index' | 'title' | 'status'>[]
}

/** One row per floor with the shared status chip (Summoning, Ready, Failed...). Used by the wizard result. */
export function FloorProgressList({ floors }: FloorProgressListProps) {
  return (
    <ol className="sd-up__floors" aria-label="Floors of your dungeon" data-testid="floor-progress">
      {floors.map((f) => (
        <li key={f.id} className="sd-up__floor" data-status={f.status}>
          <span className="sd-up__floor-name">{`Floor ${f.index}, ${f.title}`}</span>
          <StatusChip status={f.status} />
        </li>
      ))}
    </ol>
  )
}
