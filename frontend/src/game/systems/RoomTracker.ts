import type { GameBridge } from '../events'
import type { DungeonLayout } from '../world/DungeonLayout'
import type { Point } from '../world/RoomLayout'
import { nextRoomEvent } from './roomTracking'

/** Tracks the Current_Room of the player and emits room-entered on change (and once at start). */
export class RoomTracker {
  private current: string | null = null

  constructor(
    private layout: DungeonLayout,
    private readonly getPosition: () => Point,
    private readonly bridge: GameBridge | undefined,
    private readonly onRoomChange?: (roomId: string, first: boolean) => void,
  ) {}

  get currentRoomId(): string | null {
    return this.current
  }

  /** Replace the layout and re-emit the starting room on the next update. */
  reset(layout: DungeonLayout): void {
    this.layout = layout
    this.current = null
  }

  update(): void {
    const id = nextRoomEvent(this.current, this.getPosition(), this.layout)
    if (id === null) return
    const first = this.current === null
    this.current = id
    this.onRoomChange?.(id, first)
    this.bridge?.emit({ type: 'room-entered', roomId: id })
  }
}
