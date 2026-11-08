import { useEffect, useRef, useState } from 'react'
import Phaser from 'phaser'
import type { GameBridge } from './events'
import { createGameConfig } from './config'

interface GameCanvasProps {
  bridge: GameBridge
  className?: string
}

export function GameCanvas({ bridge, className }: GameCanvasProps) {
  const parentRef = useRef<HTMLDivElement>(null)
  const gameRef = useRef<Phaser.Game | null>(null)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    const parent = parentRef.current
    if (!parent || gameRef.current) return
    try {
      gameRef.current = new Phaser.Game(createGameConfig(parent, bridge))
    } catch {
      gameRef.current = null
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setFailed(true)
    }
    // Phaser polls parent size, but refresh immediately when the stage box changes (well within 250 ms)
    // and tell the scene the measured size so it can refit zoom and overlays.
    const ro =
      typeof ResizeObserver === 'undefined'
        ? null
        : new ResizeObserver((entries) => {
            gameRef.current?.scale.refresh()
            const box = entries[0]?.contentRect
            const width = Math.round(box?.width ?? parent.clientWidth)
            const height = Math.round(box?.height ?? parent.clientHeight)
            if (width > 0 && height > 0) bridge.send({ type: 'set-viewport', width, height })
          })
    ro?.observe(parent)
    return () => {
      ro?.disconnect()
      gameRef.current?.destroy(true)
      gameRef.current = null
    }
  }, [bridge])

  return (
    <div
      ref={parentRef}
      aria-label="Dungeon game"
      role="application"
      tabIndex={0}
      className={`overflow-hidden outline-none focus-visible:ring-2 focus-visible:ring-accent ${className ?? ''}`}
    >
      {failed && (
        <p role="alert" className="p-4 text-ink">
          The game could not start in this browser. Try a browser with WebGL or canvas support.
        </p>
      )}
    </div>
  )
}
