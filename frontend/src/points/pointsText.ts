/**
 * Player-facing text for Leaderboard points (frontend-10 D15). Returns null when there is nothing to say:
 * no points, an unusable amount, or (for the explanation) a reason the UI does not know.
 */
const REASON_TEXT: Readonly<Record<string, string>> = {
  first_correct: 'first correct answer this week',
  repeat_correct: 'already answered this week',
  retry: 'second chance, half points',
  practice: 'practice mode, half points',
  room_clear: 'room cleared',
  boss_clear: 'boss defeated',
  pack_complete: 'pack complete',
}

/** "+10 points, already answered this week", "+1 point", or null (hide). Unknown reasons give the amount only. */
export function pointsText(awarded: number | null | undefined, reason?: string | null): string | null {
  if (typeof awarded !== 'number' || !Number.isFinite(awarded) || awarded <= 0) return null
  const amount = Math.floor(awarded)
  if (amount <= 0) return null
  const base = `+${amount} ${amount === 1 ? 'point' : 'points'}`
  const why = reason !== null && reason !== undefined && Object.hasOwn(REASON_TEXT, reason) ? REASON_TEXT[reason] : undefined
  return why ? `${base}, ${why}` : base
}
