import { TrendingUp } from 'lucide-react'
import { ProgressBar } from '../components/ProgressBar'
import type { ProgressInfo } from '../types/api'
import { MasteryBar } from './MasteryBar'
import { MASTERY_BAND_LABEL, clampMastery, masteryBand } from './mastery'
import { StreakCalendar } from './StreakCalendar'
import '../styles/learning.css'

const filled = <T,>(list: readonly T[] | undefined): list is readonly T[] => Array.isArray(list) && list.length > 0

/** True when the response carries at least one of the learning-progress fields. */
export function hasLearningProgress(p: ProgressInfo): boolean {
  return (
    typeof p.notes_conquered_percent === 'number' ||
    filled(p.memory_strength) ||
    filled(p.streak_calendar) ||
    filled(p.weak_concepts)
  )
}

/**
 * What the Backend says about how well the notes are learned. Every block draws only a field that is present;
 * a block whose field is missing is not rendered, and the whole panel disappears when none is.
 */
export function ProgressPanel({ progress }: { progress: ProgressInfo }) {
  if (!hasLearningProgress(progress)) return null
  const conquered = progress.notes_conquered_percent
  const strength = progress.memory_strength
  const calendar = progress.streak_calendar
  const weak = progress.weak_concepts
  return (
    <section className="sd-card sd-dash__wide" aria-labelledby="progress-title" data-testid="progress-panel">
      <h2 id="progress-title" className="sd-card__h">
        <TrendingUp aria-hidden="true" size={18} />
        Your progress
      </h2>
      <div className="sd-progress">
        {typeof conquered === 'number' && (
          <div className="sd-progress__block" data-testid="notes-conquered">
            <h3 className="sd-progress__h">Notes conquered</h3>
            <p className="sd-progress__big">{`${Math.round(clampMastery(conquered))}% of your notes`}</p>
            <ProgressBar value={clampMastery(conquered)} max={100} label="Notes conquered" tone="gold" />
          </div>
        )}
        {filled(strength) && (
          <div className="sd-progress__block" data-testid="memory-strength">
            <h3 className="sd-progress__h">Memory strength by topic</h3>
            <ul className="sd-progress__list">
              {strength.map((t) => {
                const band = masteryBand(t.strength)
                return (
                  <li key={t.topic_id}>
                    <MasteryBar value={t.strength} size={40} stroke={5} />
                    <span>{t.title}</span>
                    <span className="sd-progress__band" data-band={band}>
                      {`${MASTERY_BAND_LABEL[band]} ${Math.round(clampMastery(t.strength))}%`}
                    </span>
                  </li>
                )
              })}
            </ul>
          </div>
        )}
        {filled(calendar) && (
          <div className="sd-progress__block" data-testid="streak-block">
            <h3 className="sd-progress__h">Review streak</h3>
            <StreakCalendar days={calendar} />
          </div>
        )}
        {filled(weak) && (
          <div className="sd-progress__block" data-testid="weakest-concepts">
            <h3 className="sd-progress__h">Weakest concepts</h3>
            <ul className="sd-progress__list">
              {weak.map((c, i) => (
                <li key={`${i}-${c.text}`}>
                  <span>{c.text}</span>
                  {typeof c.page === 'number' ? (
                    <span className="sd-progress__page">{`From your notes: page ${c.page}`}</span>
                  ) : c.source_ref ? (
                    <span className="sd-progress__page">{`From your notes: ${c.source_ref}`}</span>
                  ) : null}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </section>
  )
}
