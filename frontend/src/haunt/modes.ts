import type { Floor, RunMode, StartRunRequest } from '@/types/api'

/** The practice modes the picker offers (Daily Haunt has its own button). */
export type PracticeMode = Extract<RunMode, 'weak_topics' | 'exam' | 'replay_floor'>

export const PRACTICE_MODES: readonly PracticeMode[] = ['weak_topics', 'exam', 'replay_floor']

export const MODE_INFO: Readonly<Record<PracticeMode, { label: string; blurb: string }>> = {
  weak_topics: {
    label: 'Weak Topics',
    blurb: 'Practice the topics where your mastery is lowest.',
  },
  exam: {
    label: 'Exam',
    blurb: 'Every topic, then the final boss. Add a timer if you want one.',
  },
  replay_floor: {
    label: 'Replay Floor',
    blurb: 'Play a floor you have already cleared again.',
  },
}

/** Exam timer choices in minutes. The timer is off unless one is picked. */
export const EXAM_MINUTES = [10, 20, 30] as const
export type ExamMinutes = (typeof EXAM_MINUTES)[number]

/** The `startRun` body for a mode. Weak Topics and Exam cover the whole dungeon, so they carry no floor. */
export function modeRequest(mode: PracticeMode | 'daily_haunt', dungeonId: string, floorId?: string): StartRunRequest {
  if (mode === 'replay_floor') {
    if (!floorId) throw new Error('Replay Floor needs a floor.')
    return { dungeon_id: dungeonId, floor_id: floorId, mode }
  }
  return { dungeon_id: dungeonId, floor_id: null, mode }
}

export function isPracticeMode(value: string | undefined): value is PracticeMode {
  return value === 'weak_topics' || value === 'exam' || value === 'replay_floor'
}

export function hauntPath(dungeonId: string): string {
  return `/haunt/${encodeURIComponent(dungeonId)}`
}

/** Route of a practice run: `/campaign/:dungeon/mode/:mode[/:floor][?minutes=N]`. */
export function modePath(dungeonId: string, mode: PracticeMode, opts: { floorId?: string; minutes?: ExamMinutes | null } = {}): string {
  const base = `/campaign/${encodeURIComponent(dungeonId)}/mode/${mode}`
  const withFloor = mode === 'replay_floor' && opts.floorId ? `${base}/${encodeURIComponent(opts.floorId)}` : base
  return mode === 'exam' && opts.minutes ? `${withFloor}?minutes=${opts.minutes}` : withFloor
}

/** Reads `?minutes=` and accepts only the offered choices; anything else means no timer. */
export function parseExamMinutes(search: string): ExamMinutes | null {
  const raw = new URLSearchParams(search).get('minutes')
  const n = raw === null ? NaN : Number(raw)
  return (EXAM_MINUTES as readonly number[]).includes(n) ? (n as ExamMinutes) : null
}

/** Replay lists only floors that are cleared. */
export function replayableFloors(floors: readonly Floor[]): Floor[] {
  return floors.filter((f) => f.status === 'cleared')
}
