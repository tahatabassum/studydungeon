import { portraitFor, type PortraitKind } from '@/art/portraits/types'
import data from './lines.json'

export interface CharacterLines {
  /** Spoken before the first question and after a wrong answer. */
  taunts: readonly string[]
  /** Spoken after a correct answer. */
  reactions: readonly string[]
}

const LINES = data as Record<PortraitKind, CharacterLines>

/** Lines for a monster kind. Unknown kinds use the Skeleton lines (via portraitFor). */
export function linesFor(kind: string): CharacterLines {
  return LINES[portraitFor(kind)]
}

/** Deterministic pick: a member of `list` for any finite or non-finite seed. */
export function pickLine(list: readonly string[], seed: number): string {
  if (list.length === 0) return ''
  const s = Number.isFinite(seed) ? Math.floor(seed) : 0
  return list[((s % list.length) + list.length) % list.length]
}
