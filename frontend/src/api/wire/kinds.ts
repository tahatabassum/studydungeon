import type { QuestionType } from '../../types/api'

/**
 * Wire helpers shared by the mappers (C5, C6). Pure, no imports beyond types.
 */

/** Monster looks the art layer knows. Anything else gets the default look ('unknown'). */
export const KNOWN_KINDS = ['paper_wraith', 'toxic_slime', 'gear_golem', 'memory_eater', 'exam_warden'] as const

const KEYWORDS: ReadonlyArray<readonly [RegExp, (typeof KNOWN_KINDS)[number]]> = [
  [/warden|overlord|exam/i, 'exam_warden'],
  [/golem|gear|clockwork|automaton|silicon/i, 'gear_golem'],
  [/slime|ooze|sludge|toxic/i, 'toxic_slime'],
  [/eater|devour|glutton|gorger/i, 'memory_eater'],
  [/wraith|spectre|specter|ghost|phantom|ghoul|spirit/i, 'paper_wraith'],
]

/**
 * C5: the backend's `monster_type` is a display name ("Silicon Golem", "The Exam Warden (Boss)"),
 * not a visual id. A boss is always the Exam Warden look; an unknown name gets the default look.
 */
export function kindFromMonsterType(monsterType: string, isBoss = false): string {
  if (isBoss) return 'exam_warden'
  for (const [re, kind] of KEYWORDS) if (re.test(monsterType)) return kind
  return 'unknown'
}

/** C6: the backend sends no question type; two options "True"/"False" make a true_false question. */
export function questionTypeFromOptions(options: readonly string[]): QuestionType {
  if (options.length === 2) {
    const lower = options.map((o) => o.trim().toLowerCase())
    if (lower.includes('true') && lower.includes('false')) return 'true_false'
  }
  return 'mcq'
}
