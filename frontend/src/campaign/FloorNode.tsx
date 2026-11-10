import type { KeyboardEvent } from 'react'
import { RotateCcw, Skull } from 'lucide-react'
import { MasteryBar } from '../learning/MasteryBar'
import type { Floor } from '../types/api'
import { FogOverlay } from './FogOverlay'
import { isNavKey, type NavKey } from './floorLayout'
import { STATUS_LABEL, StatusChip, cardStyle, columnStyle, sealStyle, type NodeSpot } from './nodeParts'
import { TopicList } from './TopicList'

export interface FloorNodeProps {
  floor: Floor
  /** Position of this node on the map (0-based) and the number of nodes. */
  index: number
  setSize: number
  /** Centre x of the column, and where the seal sits in it. */
  x: number
  spot: NodeSpot
  /** Topic rows the card shows before "+N more". */
  topicRows: number
  /** Roving tabindex: only the focused node is in the tab order. */
  focused: boolean
  /** Campaign extras (mastery ring, topic counts). False for a backend that has no floors. */
  extras: boolean
  registerButton(index: number, el: HTMLButtonElement | null): void
  onFocusNode(index: number): void
  onNavigate(index: number, key: NavKey): void
  onActivate(floor: Floor, index: number): void
  onRetry(floor: Floor): void
}

export function floorLabel(floor: Floor, extras: boolean): string {
  const parts = [`Floor ${floor.index}, ${floor.title}`, STATUS_LABEL[floor.status]]
  if (floor.status === 'cleared' && floor.rank) parts.push(`Rank ${floor.rank}`)
  parts.push(`Boss ${floor.boss.name}`)
  if (extras && floor.topics.length > 0) {
    const mastery = Math.round(floor.topics.reduce((sum, t) => sum + t.mastery, 0) / floor.topics.length)
    parts.push(`Average mastery ${mastery} percent`)
  }
  return parts.join('. ')
}

/** Topic bars show once there is something to measure: a playable or cleared floor with topics. */
function showsTopics(floor: Floor): boolean {
  return floor.topics.length > 0 && (floor.status === 'ready' || floor.status === 'cleared')
}

export function averageMastery(floor: Floor): number {
  if (floor.topics.length === 0) return 0
  return floor.topics.reduce((sum, t) => sum + t.mastery, 0) / floor.topics.length
}

/** One floor on the map: a stone seal on the path (mastery ring, boss icon, rank) and a card under it. */
export function FloorNode({
  floor,
  index,
  setSize,
  x,
  spot,
  topicRows,
  focused,
  extras,
  registerButton,
  onFocusNode,
  onNavigate,
  onActivate,
  onRetry,
}: FloorNodeProps) {
  const onKeyDown = (e: KeyboardEvent<HTMLButtonElement>) => {
    if (isNavKey(e.key)) {
      e.preventDefault()
      onNavigate(index, e.key)
    }
  }
  const topicCount = floor.topics.length
  return (
    <li
      className="sd-fnode"
      data-status={floor.status}
      data-testid={`floor-node-${floor.index}`}
      aria-posinset={index + 1}
      aria-setsize={setSize}
      style={columnStyle(x, spot)}
    >
      <div className="sd-fnode__stage" style={sealStyle(spot)}>
        <span aria-hidden="true" className="sd-fnode__halo" />
        {floor.status === 'generating' && <span aria-hidden="true" data-testid="floor-spinner" className="sd-fnode__summon" />}
        <button
          type="button"
          ref={(el) => registerButton(index, el)}
          className="sd-fnode__seal"
          aria-label={floorLabel(floor, extras)}
          aria-disabled={floor.status === 'locked' || floor.status === 'generating' ? true : undefined}
          tabIndex={focused ? 0 : -1}
          onFocus={() => onFocusNode(index)}
          onKeyDown={onKeyDown}
          onClick={() => onActivate(floor, index)}
        >
          {extras ? (
            <MasteryBar value={averageMastery(floor)} size={spot.r * 2 - 8} stroke={5}>
              <span className="sd-fnode__num">{floor.index}</span>
            </MasteryBar>
          ) : (
            <span className="sd-fnode__num">{floor.index}</span>
          )}
          <span aria-hidden="true" className="sd-fnode__boss" data-testid="floor-boss-icon">
            <Skull size={15} strokeWidth={2.2} />
          </span>
          {floor.status === 'cleared' && floor.rank && (
            <span aria-hidden="true" className="sd-fnode__rank" data-rank={floor.rank} data-testid="floor-rank">
              {floor.rank}
            </span>
          )}
        </button>
        {floor.status === 'locked' && <FogOverlay />}
      </div>

      <div
        className="sd-fcard"
        style={cardStyle(spot)}
        onClick={(e) => {
          if (e.target === e.currentTarget || (e.target as HTMLElement).closest('[data-plate-info]')) {
            onActivate(floor, index)
          }
        }}
      >
        <div data-plate-info aria-hidden="true">
          <p className="sd-fnode__eyebrow">Floor {floor.index}</p>
          <p className="sd-fnode__name" title={floor.title}>
            {floor.title}
          </p>
          {floor.status === 'generating' ? (
            <p className="sd-fnode__meta" data-testid="floor-summoning">
              Floor {floor.index} is being summoned...
            </p>
          ) : floor.status === 'failed' ? (
            <p className="sd-fnode__meta">Floor {floor.index} could not be summoned</p>
          ) : (
            <p className="sd-fnode__meta sd-fnode__meta--boss" title={`Boss: ${floor.boss.name}`}>
              {extras && topicCount > 0 ? `${topicCount} ${topicCount === 1 ? 'topic' : 'topics'}, ` : ''}
              Boss: {floor.boss.name}
            </p>
          )}
        </div>
        <div className="sd-fnode__row">
          <StatusChip status={floor.status} />
          {floor.status === 'cleared' && floor.rank && (
            <span className="sd-fnode__meta" data-testid="floor-rank-text">
              Rank {floor.rank}
            </span>
          )}
          {floor.status === 'failed' && (
            <button
              type="button"
              className="sd-fnode__retry"
              aria-label={`Retry Floor ${floor.index}`}
              tabIndex={focused ? 0 : -1}
              onClick={() => onRetry(floor)}
            >
              <RotateCcw aria-hidden="true" size={13} />
              Retry
            </button>
          )}
        </div>
        {extras && showsTopics(floor) && <TopicList floor={floor} rows={topicRows} tabbable={focused} />}
      </div>
    </li>
  )
}
