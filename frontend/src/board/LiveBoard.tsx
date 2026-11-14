import type { CSSProperties } from 'react'
import { Link } from 'react-router-dom'
import { AlertTriangle, Trophy } from 'lucide-react'
import { Avatar, avatarKind } from '../leaderboard/Avatar'
import { BadgeIcons } from '../badges/BadgeGrid'
import type { BoardEntry, BoardKind, BoardResponse, LeaderboardPeriod } from '../types/api'
import { buildLiveBoardView } from './boardView'
import { formatWeekReset } from './countdown'
import { rivalLabelOf } from './rivalLabel'
import { useBoard } from './useBoard'
import { useNow } from './useNow'
import { YouPanel } from './YouPanelView'
import { boardHint } from './BoardTabs'
import type { BadgeId } from '../types/api'

export const TIE_BREAK_NOTE = 'Ties go to whoever reached the total first.'

const STAGE_ORDER = [1, 0, 2] as const

function nameOf(e: BoardEntry): string {
  return e.display_name ?? e.handle
}

/** Skeleton in the shape of the board grid (podium and panel left, rows right); sizes come from CSS. */
export function BoardSkeleton() {
  return (
    <div className="sd-lb__skeleton" role="status" aria-live="polite" aria-label="Loading the leaderboard" data-testid="lb-skeleton">
      <div className="sd-lb__grid" aria-hidden="true">
        <div className="sd-lb__left">
          <span className="sd-skel sd-lb__skel-pod" />
          <span className="sd-skel sd-lb__skel-you" />
        </div>
        <div className="sd-lb__skel-rows">
          {Array.from({ length: 8 }, (_, i) => (
            <span key={i} className="sd-skel sd-lb__skel-row" />
          ))}
        </div>
      </div>
      <span className="sr-only">Loading the leaderboard</span>
    </div>
  )
}
function LivePodium({ entries, mePublicId }: { entries: BoardEntry[]; mePublicId: string | undefined }) {
  if (entries.length === 0) return null
  return (
    <ol className="sd-podium" aria-label="Top three" data-testid="podium">
      {STAGE_ORDER.map((i) => {
        const e = entries[i]
        if (!e) return <li key={i} aria-hidden="true" className="sd-podium__slot sd-podium__slot--empty" />
        const isMe = e.public_id === mePublicId
        const label = rivalLabelOf(e)
        return (
          <li key={e.public_id} className="sd-podium__slot" data-place={e.rank} data-me={isMe ? 'true' : undefined}>
            <span className="sr-only">{`Rank ${e.rank}`}</span>
            <span className="sd-podium__crown" aria-hidden="true" />
            <Avatar kind={avatarKind({ id: e.public_id }, isMe)} size={i === 0 ? 44 : 38} className="sd-podium__avatar" />
            <span className="sd-podium__name">
              <span className="sd-lb__nametext" title={nameOf(e)}>
                {nameOf(e)}
              </span>
              {isMe && <span className="sd-lb__tag">You</span>}
            </span>
            {label && <span className="sd-lb__rival">{label}</span>}
            <span className="sd-podium__score">{e.points.toLocaleString('en-US')}</span>
            <span className="sd-podium__meta">{`Level ${e.level}`}</span>
            <span className="sd-podium__pedestal" aria-hidden="true">
              {e.rank}
            </span>
          </li>
        )
      })}
    </ol>
  )
}

function LiveRow({ e, isMe }: { e: BoardEntry; isMe: boolean }) {
  const label = rivalLabelOf(e)
  return (
    <tr className="sd-lb__row" data-me={isMe ? 'true' : undefined} data-rival={label ? 'true' : undefined} aria-current={isMe ? 'true' : undefined}>
      <td className="sd-lb__rank">
        <span className="sr-only">Rank </span>
        {e.rank}
      </td>
      <th scope="row" className="sd-lb__player">
        <div className="sd-lb__pcell">
          <Avatar kind={avatarKind({ id: e.public_id }, isMe)} />
          <span className="sd-lb__who">
            <span className="sd-lb__name">
              <span className="sd-lb__nametext" title={nameOf(e)}>
                {nameOf(e)}
              </span>
              {isMe && <span className="sd-lb__tag">You</span>}
            </span>
            {label && <span className="sd-lb__rival">{label}</span>}
            <span className="sd-lb__sub">{`Level ${e.level}`}</span>
          </span>
        </div>
      </th>
      <td className="sd-lb__num sd-lb__col-level">{e.level}</td>
      <td className="sd-lb__num sd-lb__score">{e.points.toLocaleString('en-US')}</td>
      <td className="sd-lb__num sd-lb__col-acc">{e.rooms_cleared}</td>
      <td className="sd-lb__col-badges">
        <BadgeIcons ids={(e.badge_ids ?? []) as BadgeId[]} />
      </td>
    </tr>
  )
}

/** The one caption line: what the selection means, and for This week when it resets (from the API). */
function Caption({ board, period, data }: { board: BoardKind; period: LeaderboardPeriod; data: BoardResponse | null }) {
  const reset = period === 'week' && data?.week ? formatWeekReset(data.week) : ''
  const hint = boardHint(board, period)
  return (
    <p className="sd-lb__hint" data-testid="lb-hint" title={reset ? `${hint} ${reset}` : hint}>
      {hint}
      {reset && (
        <>
          {' '}
          <span data-testid="lb-week-reset">{reset}</span>
        </>
      )}
    </p>
  )
}
export interface LiveBoardProps {
  board: BoardKind
  period: LeaderboardPeriod
  isGuest: boolean
}

/** The live board of real players: podium, table, the live You panel, and the refresh details. */
export function LiveBoard({ board, period, isGuest }: LiveBoardProps) {
  const { status, data, error, stale, refresh } = useBoard(board, period)
  const nowMs = useNow()

  if (status === 'loading') {
    return (
      <>
        <Caption board={board} period={period} data={null} />
        <BoardSkeleton />
      </>
    )
  }
  if (status === 'error' || !data) {
    return (
      <>
        <Caption board={board} period={period} data={null} />
        <section className="sd-card sd-lb__notice sd-card--alert">
          <div className="sd-lb__notice-icon" aria-hidden="true">
            <AlertTriangle size={30} />
          </div>
          <h2 className="sd-lb__notice-title">The board could not be loaded</h2>
          <p role="alert" className="sd-card__muted">
            {error}
          </p>
          <button type="button" className="sd-ghost-btn" onClick={refresh}>
            Retry
          </button>
        </section>
      </>
    )
  }

  const view = buildLiveBoardView(data)
  const mePublicId = data.me?.public_id
  const next = Date.parse(data.next_refresh_at)
  return (
    <>
      <Caption board={board} period={period} data={data} />
      {stale && (
        <p role="status" className="sd-lb__stale">
          Could not refresh. Showing the last results.
        </p>
      )}
      <div className="sd-lb__grid">
        <div className="sd-lb__left">
          <LivePodium entries={view.podium} mePublicId={mePublicId} />
          <YouPanel
            me={data.me}
            isGuest={isGuest}
            updatedAt={data.updated_at}
            nextRefreshMs={Number.isNaN(next) ? null : next}
            nowMs={nowMs}
          />
        </div>
        <div className="sd-lb__right">
          {view.empty ? (
            <section className="sd-card sd-lb__notice">
              <div className="sd-lb__notice-icon" aria-hidden="true">
                <Trophy size={30} />
              </div>
              <h2 className="sd-lb__notice-title">Be the first to enter</h2>
              <p className="sd-card__muted" data-testid="lb-empty">
                No one has points on this board yet.
              </p>
              <Link to="/choose" className="sd-cta">
                Play
              </Link>
            </section>
          ) : (
            view.rows.length > 0 && (
              <div className="sd-lb__rowsbox">
                <table className="sd-lb__table" aria-label="Rankings" data-many={view.rows.length > 8 ? 'true' : undefined} style={rowsVars(view.rows.length)}>
                  <thead className="sr-only">
                    <tr>
                      <th scope="col">Rank</th>
                      <th scope="col">Player</th>
                      <th scope="col">Level</th>
                      <th scope="col">Points</th>
                      <th scope="col">Rooms</th>
                      <th scope="col">Badges</th>
                    </tr>
                  </thead>
                  <tbody>
                    {view.rows.map((e) => (
                      <LiveRow key={e.public_id} e={e} isMe={e.public_id === mePublicId} />
                    ))}
                  </tbody>
                </table>
              </div>
            )
          )}
          {!view.empty && (
            <p className="sd-lb__foot" data-testid="lb-foot">
              {TIE_BREAK_NOTE}
            </p>
          )}
        </div>
      </div>
    </>
  )
}

/** CSS custom property with the number of rows in each column of the two-column layout (a count, not a size). */
export function rowsVars(n: number): CSSProperties {
  return { '--lb-half': Math.ceil(n / 2) } as CSSProperties
}