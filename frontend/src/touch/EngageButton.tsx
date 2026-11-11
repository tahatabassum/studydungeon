import { useEffect, useState } from 'react'
import type { GameBridge } from '@/game/events'
import '../styles/touch.css'

export interface EngageTarget {
  kind: 'monster' | 'revenant' | null
  name?: string
}

const NONE: EngageTarget = { kind: null }

/** What the Engage button should say for a target. */
export function engageLabel(t: EngageTarget): string {
  if (t.kind === 'monster') return `Fight ${t.name ?? 'the monster'}`
  if (t.kind === 'revenant') return 'Face the memory'
  return 'Engage'
}

/** Tracks Phaser's `engage-available` events (sent only when the target changes). */
export function useEngageTarget(bridge: GameBridge): EngageTarget {
  const [target, setTarget] = useState<EngageTarget>(NONE)
  useEffect(
    () =>
      bridge.on((e) => {
        if (e.type !== 'engage-available') return
        setTarget(e.kind === null ? NONE : { kind: e.kind, name: e.name })
      }),
    [bridge],
  )
  return target
}

export interface EngageButtonProps {
  bridge: GameBridge
  target: EngageTarget
}

/** Bottom-right action button. Sends `engage-request`, handled like E or Space in Phaser. */
export function EngageButton({ bridge, target }: EngageButtonProps) {
  const ready = target.kind !== null
  return (
    <button
      type="button"
      data-testid="engage-button"
      className="sd-engage"
      data-ready={ready ? 'true' : 'false'}
      disabled={!ready}
      onClick={() => bridge.send({ type: 'engage-request' })}
    >
      {engageLabel(target)}
    </button>
  )
}
