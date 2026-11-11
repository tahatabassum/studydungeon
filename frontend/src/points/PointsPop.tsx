import { useReducedMotion } from '../state/useReducedMotion'
import '../styles/packs.css'
import { pointsText } from './pointsText'

/** "+10 points, reason" next to the damage number. Hidden when there is nothing to say. No animation under reduced motion. */
export function PointsPop({ awarded, reason }: { awarded?: number | null; reason?: string | null }) {
  const reduced = useReducedMotion()
  const text = pointsText(awarded, reason)
  if (!text) return null
  return (
    <span className="sd-points-pop" data-testid="points-pop" data-reduced={reduced ? 'true' : undefined}>
      {text}
    </span>
  )
}
