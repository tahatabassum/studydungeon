import type { KeyboardEvent } from 'react'
import type { BoardKind, LeaderboardPeriod } from '../types/api'

export const BOARD_TABS: ReadonlyArray<{ id: BoardKind; label: string; hint: string }> = [
  { id: 'preloaded', label: 'Preloaded', hint: 'Points from the built-in packs.' },
  { id: 'own_notes', label: 'Own notes', hint: 'Points from dungeons made from your own notes.' },
  { id: 'overall', label: 'Overall', hint: 'Preloaded and own-notes points added together.' },
]
export const PERIOD_TABS: ReadonlyArray<{ id: LeaderboardPeriod; label: string; hint: string }> = [
  { id: 'all', label: 'All-time', hint: 'Every point earned so far.' },
  { id: 'week', label: 'This week', hint: 'Only points earned this week.' },
]

interface TabRowProps<T extends string> {
  name: string
  label: string
  tabs: ReadonlyArray<{ id: T; label: string; hint: string }>
  value: T
  onSelect: (id: T) => void
}

function TabRow<T extends string>({ name, label, tabs, value, onSelect }: TabRowProps<T>) {
  const onKey = (e: KeyboardEvent<HTMLButtonElement>) => {
    if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft' && e.key !== 'Home' && e.key !== 'End') return
    e.preventDefault()
    const i = tabs.findIndex((t) => t.id === value)
    const next = e.key === 'Home' ? 0 : e.key === 'End' ? tabs.length - 1 : (i + (e.key === 'ArrowRight' ? 1 : -1) + tabs.length) % tabs.length
    onSelect(tabs[next].id)
    document.getElementById(`lb-${name}-${tabs[next].id}`)?.focus()
  }
  return (
    <div role="tablist" aria-label={label} className="sd-lb__tabs">
      {tabs.map((t) => (
        <button
          key={t.id}
          id={`lb-${name}-${t.id}`}
          type="button"
          role="tab"
          aria-selected={value === t.id}
          aria-controls="lb-panel"
          tabIndex={value === t.id ? 0 : -1}
          className="sd-lb__tab"
          onClick={() => onSelect(t.id)}
          onKeyDown={onKey}
        >
          {t.label}
        </button>
      ))}
    </div>
  )
}

export interface BoardTabsProps {
  board: BoardKind
  period: LeaderboardPeriod
  onBoard: (b: BoardKind) => void
  onPeriod: (p: LeaderboardPeriod) => void
}

/** Board tabs (Preloaded, Own notes, Overall) and range tabs (All-time, This week) with a one-line explanation. */
export function BoardTabs({ board, period, onBoard, onPeriod }: BoardTabsProps) {
  const hint = `${BOARD_TABS.find((t) => t.id === board)?.hint ?? ''} ${PERIOD_TABS.find((t) => t.id === period)?.hint ?? ''}`.trim()
  return (
    <div className="sd-lb__tabgroup">
      <TabRow name="board" label="Board" tabs={BOARD_TABS} value={board} onSelect={onBoard} />
      <TabRow name="period" label="Time range" tabs={PERIOD_TABS} value={period} onSelect={onPeriod} />
      <p className="sd-lb__hint" data-testid="lb-hint">
        {hint}
      </p>
    </div>
  )
}
