import { useEffect, useId, useRef, useState } from 'react'
import { MasteryBar } from '../learning/MasteryBar'
import { MASTERY_BAND_LABEL, clampMastery, masteryBand } from '../learning/mastery'
import type { Floor } from '../types/api'

type Topic = Floor['topics'][number]

function TopicRow({ topic }: { topic: Topic }) {
  const text = `${MASTERY_BAND_LABEL[masteryBand(topic.mastery)]} ${Math.round(clampMastery(topic.mastery))}`
  return (
    <li className="sd-topic">
      {/* The band is written out next to the name, so the ring is decoration here. */}
      <span aria-hidden="true" className="sd-topic__ring">
        <MasteryBar value={topic.mastery} size={24} stroke={3} />
      </span>
      <span className="sd-topic__text">
        {/* The full name stays in the DOM (for assistive tech); CSS truncates it with an ellipsis. */}
        <span className="sd-topic__name" title={topic.title}>
          {topic.title}
        </span>
        <span className="sd-topic__band">{text}</span>
      </span>
    </li>
  )
}

export interface TopicListProps {
  floor: Floor
  /** How many topics show in the card; the rest sit behind "+N more". */
  rows: number
  /** Roving tabindex: the "+N more" control is in the tab order only on the focused node. */
  tabbable: boolean
}

/**
 * Topics with mastery, in normal flow inside the floor card (nothing is positioned over a neighbour).
 * Beyond `rows` topics a "+N more" button opens a popover with the rest. It closes on Esc and on a
 * click outside, and its state is exposed with aria-expanded.
 */
export function TopicList({ floor, rows, tabbable }: TopicListProps) {
  const [open, setOpen] = useState(false)
  const wrapRef = useRef<HTMLDivElement>(null)
  const buttonRef = useRef<HTMLButtonElement>(null)
  const popoverId = useId()
  const shown = floor.topics.slice(0, rows)
  const rest = floor.topics.slice(rows)

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return
      setOpen(false)
      if (wrapRef.current?.contains(document.activeElement)) buttonRef.current?.focus()
    }
    const onDown = (e: PointerEvent) => {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('keydown', onKey)
    document.addEventListener('pointerdown', onDown)
    return () => {
      document.removeEventListener('keydown', onKey)
      document.removeEventListener('pointerdown', onDown)
    }
  }, [open])

  return (
    <div className="sd-topics" ref={wrapRef} data-open={open ? 'true' : undefined}>
      <ul className="sd-topics__list" aria-label={`Topics on Floor ${floor.index}`} data-testid={`floor-topics-${floor.index}`}>
        {shown.map((t) => (
          <TopicRow key={t.id} topic={t} />
        ))}
      </ul>
      {rest.length > 0 && (
        <>
          <button
            ref={buttonRef}
            type="button"
            className="sd-topics__more"
            aria-expanded={open}
            aria-controls={open ? popoverId : undefined}
            tabIndex={tabbable ? 0 : -1}
            aria-label={`+${rest.length} more ${rest.length === 1 ? 'topic' : 'topics'} on Floor ${floor.index}`}
            onClick={() => setOpen((o) => !o)}
          >
            +{rest.length} more
          </button>
          {open && (
            <div id={popoverId} role="group" aria-label={`More topics on Floor ${floor.index}`} className="sd-topics__pop" tabIndex={0} data-testid={`floor-more-${floor.index}`}>
              <ul className="sd-topics__list">
                {rest.map((t) => (
                  <TopicRow key={t.id} topic={t} />
                ))}
              </ul>
            </div>
          )}
        </>
      )}
    </div>
  )
}
