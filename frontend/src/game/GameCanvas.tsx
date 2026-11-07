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
    return () => {
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
      className={`outline-none focus-visible:ring-2 focus-visible:ring-amber ${className ?? ''}`}
    >
      {failed && (
        <p role="alert" className="p-4 text-parchment">
          The game could not start in this browser. Try a browser with WebGL or canvas support.
        </p>
      )}
    </div>
  )
}
