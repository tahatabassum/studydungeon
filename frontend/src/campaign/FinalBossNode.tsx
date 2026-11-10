import type { KeyboardEvent } from 'react'
import { Skull } from 'lucide-react'
import type { FinalBoss } from '../types/api'
import { FogOverlay } from './FogOverlay'
import { isNavKey, type NavKey } from './floorLayout'
import { StatusChip, cardStyle, columnStyle, sealStyle, type NodeSpot } from './nodeParts'

export interface FinalBossNodeProps {
  boss: FinalBoss
  index: number
  setSize: number
  x: number
  spot: NodeSpot
  focused: boolean
  registerButton(index: number, el: HTMLButtonElement | null): void
  onFocusNode(index: number): void
  onNavigate(index: number, key: NavKey): void
  onActivate(boss: FinalBoss, index: number): void
}

export function finalBossLabel(boss: FinalBoss): string {
  return `Final boss, ${boss.name}. ${boss.unlocked ? 'Ready' : 'Locked until every floor is cleared'}. ${boss.hp} health`
}

/** The Final_Boss at the right end of the path. Fogged and locked until every floor is cleared. */
export function FinalBossNode({
  boss,
  index,
  setSize,
  x,
  spot,
  focused,
  registerButton,
  onFocusNode,
  onNavigate,
  onActivate,
}: FinalBossNodeProps) {
  const status = boss.unlocked ? 'ready' : 'locked'
  const onKeyDown = (e: KeyboardEvent<HTMLButtonElement>) => {
    if (isNavKey(e.key)) {
      e.preventDefault()
      onNavigate(index, e.key)
    }
  }
  return (
    <li
      className="sd-fnode sd-fnode--final"
      data-status={status}
      data-testid="final-boss-node"
      aria-posinset={index + 1}
      aria-setsize={setSize}
      style={columnStyle(x, spot)}
    >
      <div className="sd-fnode__stage" style={sealStyle(spot)}>
        <span aria-hidden="true" className="sd-fnode__halo" />
        <button
          type="button"
          ref={(el) => registerButton(index, el)}
          className="sd-fnode__seal"
          aria-label={finalBossLabel(boss)}
          aria-disabled={boss.unlocked ? undefined : true}
          tabIndex={focused ? 0 : -1}
          onFocus={() => onFocusNode(index)}
          onKeyDown={onKeyDown}
          onClick={() => onActivate(boss, index)}
        >
          <Skull aria-hidden="true" size={Math.round(spot.r * 0.85)} strokeWidth={1.8} />
          <span aria-hidden="true" className="sd-fnode__boss" style={{ top: -2, right: -2 }}>
            <Skull size={15} strokeWidth={2.2} />
          </span>
        </button>
        {!boss.unlocked && <FogOverlay />}
      </div>
      <div className="sd-fcard sd-fcard--final" style={cardStyle(spot)} onClick={() => onActivate(boss, index)}>
        <div aria-hidden="true">
          <p className="sd-fnode__eyebrow">Final boss</p>
          <p className="sd-fnode__name" title={boss.name}>
            {boss.name}
          </p>
          <p className="sd-fnode__meta">
            {boss.unlocked ? `${boss.hp} HP. Face the whole dungeon.` : 'Clear every floor to unlock'}
          </p>
        </div>
        <div className="sd-fnode__row">
          <StatusChip status={status} />
        </div>
      </div>
    </li>
  )
}
