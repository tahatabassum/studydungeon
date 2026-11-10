import { useCallback, useEffect, useRef, useState } from 'react'
import type { PointerEvent as ReactPointerEvent } from 'react'
import type { GameBridge } from '@/game/events'
import { clampToRadius, joystickVector, sameVector, type Vec2 } from './joystickMath'
import '../styles/touch.css'

export interface VirtualJoystickProps {
  bridge: GameBridge
}

const ZERO: Vec2 = { x: 0, y: 0 }

/**
 * Virtual joystick (bottom-left of the play screen). Pointer events with pointer capture; an analog
 * vector with a dead zone, clamped to length 1. The vector goes to Phaser as `set-move-input`, only
 * when it changes, and (0, 0) on release, cancel, lost capture and window blur.
 */
export function VirtualJoystick({ bridge }: VirtualJoystickProps) {
  const baseRef = useRef<HTMLDivElement>(null)
  const pointerId = useRef<number | null>(null)
  const last = useRef<Vec2>(ZERO)
  const [knob, setKnob] = useState<Vec2>(ZERO)

  const emit = useCallback(
    (v: Vec2) => {
      if (sameVector(v, last.current)) return
      last.current = v
      bridge.send({ type: 'set-move-input', x: v.x, y: v.y })
    },
    [bridge],
  )

  const release = useCallback(() => {
    pointerId.current = null
    setKnob(ZERO)
    emit(ZERO)
  }, [emit])

  const track = useCallback(
    (e: ReactPointerEvent<HTMLDivElement>) => {
      const el = baseRef.current
      if (!el) return
      const rect = el.getBoundingClientRect()
      const radius = rect.width / 2
      const dx = e.clientX - (rect.left + radius)
      const dy = e.clientY - (rect.top + rect.height / 2)
      // The knob may travel to the rim; the vector uses the same radius.
      setKnob(clampToRadius(dx, dy, radius * 0.6))
      emit(joystickVector(dx, dy, radius * 0.8))
    },
    [emit],
  )

  const onPointerDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (pointerId.current !== null) return
    pointerId.current = e.pointerId
    e.currentTarget.setPointerCapture?.(e.pointerId)
    e.preventDefault()
    track(e)
  }
  const onPointerMove = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (e.pointerId !== pointerId.current) return
    track(e)
  }
  const onPointerEnd = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (e.pointerId !== pointerId.current) return
    e.currentTarget.releasePointerCapture?.(e.pointerId)
    release()
  }

  // Blur, hidden tab and unmount all stop the hero.
  useEffect(() => {
    const stop = (): void => {
      if (pointerId.current !== null || last.current !== ZERO) release()
    }
    window.addEventListener('blur', stop)
    document.addEventListener('visibilitychange', stop)
    return () => {
      window.removeEventListener('blur', stop)
      document.removeEventListener('visibilitychange', stop)
      if (!sameVector(last.current, ZERO)) {
        last.current = ZERO
        bridge.send({ type: 'set-move-input', x: 0, y: 0 })
      }
    }
  }, [bridge, release])

  return (
    <div
      ref={baseRef}
      role="group"
      aria-label="Movement stick"
      data-testid="virtual-joystick"
      className="sd-stick"
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerEnd}
      onPointerCancel={onPointerEnd}
      onLostPointerCapture={(e) => {
        if (e.pointerId === pointerId.current) release()
      }}
      onContextMenu={(e) => e.preventDefault()}
    >
      <div
        aria-hidden="true"
        className="sd-stick__knob"
        style={{ transform: `translate(${knob.x}px, ${knob.y}px)` }}
      />
    </div>
  )
}
