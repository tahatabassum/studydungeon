import { useEffect, useState } from 'react'
import { Award, Coins, Star, Swords } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { motion, useReducedMotion } from 'framer-motion'
import '../styles/chest.css'
import { sfx } from '../audio/sfx'
import { Button } from '../components/Button'
import { OverlayFrame } from '../components/OverlayFrame'
import type { ChestReward } from '../types/api'
import { chestView } from './chestView'

export interface ChestOverlayProps {
  /** The Backend `chest_rewards`. Empty or missing renders nothing. */
  rewards: readonly ChestReward[] | null | undefined
  onClose(): void
}

const KIND_ICON: Record<ChestReward['kind'], LucideIcon> = {
  xp: Star,
  coins: Coins,
  weapon: Swords,
  badge: Award,
}

/** Time before the lid opens, in ms (animated case only). */
const OPEN_DELAY_MS = 350

/** A code-drawn chest. The lid swings on its hinge when `open` is true. Decorative. */
function ChestArt({ open, reduced }: { open: boolean; reduced: boolean }) {
  return (
    <svg aria-hidden="true" viewBox="0 0 64 52" className="sd-chest__art" data-open={open ? 'true' : 'false'} data-testid="chest-art">
      {open && <ellipse className="sd-chest__glow" cx="32" cy="22" rx="22" ry="9" />}
      <rect x="6" y="26" width="52" height="22" rx="3" className="sd-chest__body" />
      <rect x="6" y="34" width="52" height="3" className="sd-chest__band" />
      <rect x="28" y="30" width="8" height="10" rx="1.5" className="sd-chest__lock" />
      <motion.g
        initial={false}
        animate={{ rotate: open ? -52 : 0 }}
        transition={reduced ? { duration: 0 } : { type: 'spring', stiffness: 160, damping: 14 }}
        style={{ transformOrigin: '8px 26px' }}
      >
        <path d="M6 26 V18 a12 12 0 0 1 12 -12 h28 a12 12 0 0 1 12 12 V26 Z" className="sd-chest__lid" />
        <rect x="6" y="22" width="52" height="3" className="sd-chest__band" />
      </motion.g>
    </svg>
  )
}

/**
 * The Chest (D23): a DOM overlay after a Floor clear. It lists exactly the Backend `chest_rewards` and
 * is skipped (renders nothing) when they are empty or missing. Keyboard operable: focus starts on Collect,
 * Tab stays inside, Esc and Collect close it. Static under Reduced_Motion: the chest is already open.
 */
export function ChestOverlay({ rewards, onClose }: ChestOverlayProps) {
  const reduced = !!useReducedMotion()
  const [opened, setOpened] = useState(false)
  const view = chestView(rewards)
  const open = reduced || opened
  const shown = view !== null

  useEffect(() => {
    if (!shown) return
    if (reduced) {
      sfx.play('chest')
      return
    }
    const id = window.setTimeout(() => {
      setOpened(true)
      sfx.play('chest')
    }, OPEN_DELAY_MS)
    return () => window.clearTimeout(id)
  }, [shown, reduced])

  if (!view) return null
  return (
    <OverlayFrame
      title="Treasure chest"
      titleId="chest-title"
      initialFocus="button[data-collect]"
      onEscape={onClose}
      zClass="z-[60]"
      widthClass="max-w-sm"
    >
      <div className="sd-chest" data-testid="chest-overlay" data-reduced={reduced ? 'true' : undefined}>
        <ChestArt open={open} reduced={reduced} />
        <p className="sd-chest__lead">{open ? 'Your floor reward' : 'Opening the chest...'}</p>
        <ul className="sd-chest__list" aria-label="Chest contents" data-testid="chest-items">
          {view.items.map((item, i) => {
            const Icon = KIND_ICON[item.kind]
            return (
              <motion.li
                key={`${item.id}-${i}`}
                data-kind={item.kind}
                initial={reduced ? false : { opacity: 0, y: 8 }}
                animate={open ? { opacity: 1, y: 0 } : { opacity: 0, y: 8 }}
                transition={reduced ? { duration: 0 } : { duration: 0.22, delay: i * 0.12 }}
              >
                <Icon aria-hidden="true" size={18} />
                <span className="sd-chest__label">{item.label}</span>
                {item.amountText !== null && <span className="sd-chest__amount">{item.amountText}</span>}
              </motion.li>
            )
          })}
        </ul>
        <Button data-collect onClick={onClose}>
          Collect
        </Button>
      </div>
    </OverlayFrame>
  )
}
