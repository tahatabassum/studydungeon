import type { MasteryBand } from '../types/api'
import { masteryBand } from '../learning/mastery'

export { MASTERY_BAND_LABEL } from '../learning/mastery'

/**
 * Mastery band for a percentage (Req 10.3): Weak below 50, Learning 50 to 79, Strong from 80, with the value
 * clamped to 0 to 100 first. It delegates to the frontend-08 `masteryBand`, so there is one set of boundaries.
 */
export function classifyMastery(percent: number): MasteryBand {
  return masteryBand(percent)
}

/** A topic row for the Scorecard, from either the frontend-08 `mastery_by_topic` or the older `topic_mastery`. */
export interface TopicMasteryRow {
  id: string
  title: string
  percent: number
}

export function topicRows(summary: {
  mastery_by_topic?: { topic_id: string; title: string; mastery: number }[]
  topic_mastery?: { room_id: string; label: string; percent: number }[]
}): TopicMasteryRow[] {
  if (summary.mastery_by_topic && summary.mastery_by_topic.length > 0) {
    return summary.mastery_by_topic.map((t) => ({ id: t.topic_id, title: t.title, percent: t.mastery }))
  }
  return (summary.topic_mastery ?? []).map((t) => ({ id: t.room_id, title: t.label, percent: t.percent }))
}
