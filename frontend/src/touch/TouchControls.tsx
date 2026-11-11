import type { GameBridge } from '@/game/events'
import { EngageButton, useEngageTarget } from './EngageButton'
import { VirtualJoystick } from './VirtualJoystick'
import '../styles/touch.css'

export interface TouchControlsProps {
  bridge: GameBridge
}

/**
 * The touch overlay: joystick bottom-left, Engage bottom-right. Mount it only in touch mode and only
 * while exploring (no popup, pause or other overlay), so it never covers them.
 */
export function TouchControls({ bridge }: TouchControlsProps) {
  const target = useEngageTarget(bridge)
  return (
    <div className="sd-touch" data-testid="touch-controls">
      <VirtualJoystick bridge={bridge} />
      <EngageButton bridge={bridge} target={target} />
    </div>
  )
}
