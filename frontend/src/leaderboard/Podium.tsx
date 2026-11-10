import { Crown } from 'lucide-react'
import { Avatar, avatarKind } from './Avatar'
import type { BoardRow } from './view'

export interface PodiumProps {
  /** Up to three rows in rank order. */
  rows: readonly BoardRow[]
}

/** Visual order on the stage: second, first, third. */
const STAGE_ORDER = [1, 0, 2] as const

/** Top-3 podium: stone pedestals, first place in the middle and tallest. */
export function Podium({ rows }: PodiumProps) {
  if (rows.length === 0) return null
  return (
    <ol className="sd-podium" aria-label="Top three" data-testid="podium">
      {STAGE_ORDER.map((i) => {
        const row = rows[i]
        if (!row) return <li key={i} aria-hidden="true" className="sd-podium__slot sd-podium__slot--empty" />
        const { entry } = row
        return (
          <li
            key={entry.id}
            className="sd-podium__slot"
            data-place={row.rank}
            data-me={row.isMe ? 'true' : undefined}
          >
            <span className="sr-only">{`Rank ${row.rank}`}</span>
            <span className="sd-podium__crown" aria-hidden="true">
              {i === 0 && <Crown size={22} />}
            </span>
            <Avatar kind={avatarKind(entry, row.isMe)} size={i === 0 ? 64 : 52} className="sd-podium__avatar" />
            <span className="sd-podium__name">
              {entry.display_name}
              {row.isMe && <span className="sd-lb__tag">You</span>}
            </span>
            {row.label && <span className="sd-lb__rival">{row.label}</span>}
            <span className="sd-podium__score">{entry.score.toLocaleString('en-US')}</span>
            <span className="sd-podium__meta">{`Level ${entry.level}`}</span>
            <span className="sd-podium__pedestal" aria-hidden="true">
              {row.rank}
            </span>
          </li>
        )
      })}
    </ol>
  )
}
