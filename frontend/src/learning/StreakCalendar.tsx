import { Check } from 'lucide-react'
import type { ProgressInfo } from '../types/api'
import '../styles/learning.css'

export type CalendarDay = NonNullable<ProgressInfo['streak_calendar']>[number]

export const CALENDAR_WEEKS = 12
const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] as const

const parse = (date: string): Date => new Date(`${date}T00:00:00Z`)

function label(date: string): string {
  return parse(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' })
}

/**
 * Lays days out in week columns (Sunday at the top) and keeps the last 12 weeks. A day is `null` when the
 * week starts or ends outside the given days. Pure; the days come from the Backend.
 */
export function layoutWeeks(days: readonly CalendarDay[]): (CalendarDay | null)[][] {
  const weeks: (CalendarDay | null)[][] = []
  for (const day of days) {
    const weekday = parse(day.date).getUTCDay()
    if (weeks.length === 0 || weekday === 0) weeks.push(Array.from({ length: 7 }, () => null))
    weeks[weeks.length - 1][weekday] = day
  }
  return weeks.slice(-CALENDAR_WEEKS)
}

/**
 * Review calendar of the last 12 weeks as a table: weekdays down, weeks across. Each day has a text label
 * ("Mar 3, reviewed") and a reviewed day also carries a check mark, so the grid never relies on colour alone.
 */
export function StreakCalendar({ days }: { days: readonly CalendarDay[] }) {
  const weeks = layoutWeeks(days)
  if (weeks.length === 0) return null
  return (
    <table className="sd-cal" data-testid="streak-calendar">
      <caption>Days you reviewed, last 12 weeks</caption>
      <thead>
        <tr>
          <td />
          {weeks.map((_, i) => (
            <th key={i} scope="col" className="sr-only">{`Week ${i + 1}`}</th>
          ))}
        </tr>
      </thead>
      <tbody>
        {WEEKDAYS.map((name, weekday) => (
          <tr key={name}>
            <th scope="row">{name}</th>
            {weeks.map((week, i) => {
              const day = week[weekday]
              if (!day) return <td key={i} />
              return (
                <td key={i}>
                  <span className="sd-cal__day" data-reviewed={day.reviewed ? 'true' : 'false'} data-testid="cal-day">
                    {day.reviewed && <Check aria-hidden="true" size={12} strokeWidth={3} />}
                    <span className="sr-only">{`${label(day.date)}, ${day.reviewed ? 'reviewed' : 'not reviewed'}`}</span>
                  </span>
                </td>
              )
            })}
          </tr>
        ))}
      </tbody>
    </table>
  )
}
