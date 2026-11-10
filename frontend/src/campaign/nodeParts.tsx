import type { CSSProperties } from 'react'
import { AlertTriangle, Check, Lock, Play, Sparkles } from 'lucide-react'
import type { FloorStatus } from '../types/api'
import { CARD_GAP } from './floorLayout'

export const STATUS_LABEL: Record<FloorStatus, string> = {
  locked: 'Locked',
  ready: 'Ready',
  generating: 'Summoning',
  failed: 'Failed',
  cleared: 'Cleared',
}

const STATUS_ICON = {
  locked: Lock,
  ready: Play,
  generating: Sparkles,
  failed: AlertTriangle,
  cleared: Check,
} as const

/** Status chip: icon plus text, never colour alone. */
export function StatusChip({ status, label }: { status: FloorStatus; label?: string }) {
  const Icon = STATUS_ICON[status]
  return (
    <span className="sd-chip" data-status={status} data-testid="floor-status">
      <Icon aria-hidden="true" size={12} strokeWidth={2.5} />
      {label ?? STATUS_LABEL[status]}
    </span>
  )
}

/** Centre-point geometry of a node on the map, handed down from FloorMap. */
export interface NodeSpot {
  /** Column width. */
  pitch: number
  /** Seal centre, relative to the top of the map. */
  y: number
  /** Seal radius. */
  r: number
}

/** Style for the node column (an absolutely positioned list item) at column centre `x`. */
export function columnStyle(x: number, spot: NodeSpot): CSSProperties {
  return {
    left: x - spot.pitch / 2,
    width: spot.pitch,
    '--seal-r': `${spot.r}px`,
    // Always narrower than the column, so neighbouring cards can never touch.
    '--card-w': `${Math.min(spot.pitch - 24, 300)}px`,
  } as CSSProperties
}

export function sealStyle(spot: NodeSpot): CSSProperties {
  return { left: spot.pitch / 2 - spot.r, top: spot.y - spot.r, width: spot.r * 2, height: spot.r * 2 }
}

/** The floor card hangs under the seal. */
export function cardStyle(spot: NodeSpot): CSSProperties {
  return { top: spot.y + spot.r + CARD_GAP }
}
