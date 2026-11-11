import { badgeInfo } from '../badges/badges'

/** What a share card and its post text show. Measured values only: no memorization claims (Req 15). */
export interface ShareData {
  score: number
  /** Leaderboard rank, when the run has one. */
  rank?: number | null
  /** Earned badge ids; unknown ids are ignored. */
  badges: readonly string[]
  dungeonName: string
  /** Floor rank letter (S, A, B or C) when the run was a Floor. */
  floorRank?: string | null
}

/** Every post starts with this hashtag (Req 15.7). */
export const SHARE_HASHTAG = '#KiroweenHackathon26'

const MAX_NAME = 60

/** One line, no control characters, capped. Unicode is kept. */
export function cleanName(name: string): string {
  // eslint-disable-next-line no-control-regex -- stripping control characters is the point
  const flat = name.replace(/[\u0000-\u001f\u007f-\u009f\u2028\u2029]+/g, ' ').replace(/\s+/g, ' ').trim()
  const chars = Array.from(flat)
  const cut = chars.length > MAX_NAME ? `${chars.slice(0, MAX_NAME - 1).join('')}...` : flat
  return cut.length > 0 ? cut : 'StudyDungeon'
}

export function shareScore(score: number): number {
  return Number.isFinite(score) ? Math.max(0, Math.round(score)) : 0
}

export function shareRank(rank: number | null | undefined): number | null {
  return typeof rank === 'number' && Number.isFinite(rank) && rank >= 1 ? Math.round(rank) : null
}

/** Badge labels for the earned, known ids, in the given order. */
export function badgeLabels(ids: readonly string[]): string[] {
  const out: string[] = []
  for (const id of ids) {
    const info = badgeInfo(id)
    if (info && !out.includes(info.label)) out.push(info.label)
  }
  return out
}

/** The post text. It always begins with the hashtag, whatever the data holds. */
export function buildPostText(data: ShareData): string {
  const rank = shareRank(data.rank)
  const labels = badgeLabels(data.badges)
  const lines = [
    `${SHARE_HASHTAG} I just cleared "${cleanName(data.dungeonName)}" in StudyDungeon, a game that turns my own notes into a dungeon.`,
    `Dungeon score ${shareScore(data.score)}${rank ? `, rank #${rank}` : ''}${data.floorRank ? `, floor rank ${data.floorRank}` : ''}.`,
  ]
  if (labels.length > 0) lines.push(`Badges: ${labels.join(', ')}.`)
  lines.push('Built with Kiro.')
  return lines.join('\n')
}
