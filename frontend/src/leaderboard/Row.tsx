import { BadgeIcons } from '../badges/BadgeGrid'
import { Avatar, avatarKind } from './Avatar'
import type { BoardRow } from './view'

const pct = (ratio: number): string => `${Math.round(Math.min(1, Math.max(0, ratio)) * 100)}%`

export interface RowProps {
  row: BoardRow
  /** Provisional (not stored) rank: shown with a tag. */
  provisional?: boolean
}

/** One table row: rank, themed avatar, name (with the rival label), level, score, accuracy, streak, badges. */
export function Row({ row, provisional = false }: RowProps) {
  const { entry } = row
  return (
    <tr
      className="sd-lb__row"
      data-me={row.isMe ? 'true' : undefined}
      data-rival={entry.is_seeded_rival ? 'true' : undefined}
      aria-current={row.isMe ? 'true' : undefined}
    >
      <td className="sd-lb__rank">
        <span className="sr-only">Rank </span>
        {row.rank}
      </td>
      <th scope="row" className="sd-lb__player">
        <div className="sd-lb__pcell">
        <Avatar kind={avatarKind(entry, row.isMe)} />
        <span className="sd-lb__who">
          <span className="sd-lb__name">
            {entry.display_name}
            {row.isMe && <span className="sd-lb__tag">You</span>}
            {row.isMe && provisional && <span className="sd-lb__tag sd-lb__tag--soft">Provisional</span>}
          </span>
          {row.label && <span className="sd-lb__rival">{row.label}</span>}
          <span className="sd-lb__sub">{`Level ${entry.level}, streak ${entry.best_streak}, ${pct(entry.accuracy)}`}</span>
        </span>
        </div>
      </th>
      <td className="sd-lb__num sd-lb__col-level">{entry.level}</td>
      <td className="sd-lb__num sd-lb__score">{entry.score.toLocaleString('en-US')}</td>
      <td className="sd-lb__num sd-lb__col-acc">{pct(entry.accuracy)}</td>
      <td className="sd-lb__num sd-lb__col-streak">{entry.best_streak}</td>
      <td className="sd-lb__col-badges">
        <BadgeIcons ids={entry.badge_ids} />
      </td>
    </tr>
  )
}

/** Column headers, shared by the list and the pinned row. */
export function RowHead() {
  return (
    <thead>
      <tr>
        <th scope="col" className="sd-lb__rank">
          Rank
        </th>
        <th scope="col" className="sd-lb__player">
          Player
        </th>
        <th scope="col" className="sd-lb__num sd-lb__col-level">
          Level
        </th>
        <th scope="col" className="sd-lb__num">
          Score
        </th>
        <th scope="col" className="sd-lb__num sd-lb__col-acc">
          Accuracy
        </th>
        <th scope="col" className="sd-lb__num sd-lb__col-streak">
          Best streak
        </th>
        <th scope="col" className="sd-lb__col-badges">
          Badges
        </th>
      </tr>
    </thead>
  )
}
