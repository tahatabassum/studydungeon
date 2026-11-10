import { useDashboardDungeon } from '../dashboard/useDashboardDungeon'
import { useSession } from '../state/SessionContext'
import '../styles/haunt.css'
import { DailyHauntButton } from './DailyHauntButton'
import { ModePickerButton } from './ModePickerButton'

/** The Dashboard's Daily Haunt slot: the Daily Haunt button and the practice modes. */
export function DashboardHaunt() {
  const { dungeonId } = useSession()
  const dungeon = useDashboardDungeon(dungeonId)
  return (
    <div className="sd-haunt" data-testid="dashboard-haunt">
      <DailyHauntButton dungeonId={dungeonId} />
      <div className="sd-haunt__row">
        <ModePickerButton dungeonId={dungeonId} floors={dungeon.floors} />
      </div>
    </div>
  )
}
