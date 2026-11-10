import { Suspense, lazy, type ReactElement } from 'react'
import { Route } from 'react-router-dom'

/**
 * The `/dev/scorecard` route. The lazy import sits behind a static `import.meta.env.DEV` check, so a
 * production build drops the page and its sample data. `dev` can be passed to test both cases.
 */
const DevScorecardPage = import.meta.env.DEV ? lazy(() => import('./DevScorecard')) : null

export const DEV_SCORECARD_PATH = '/dev/scorecard'

export function devScorecardRoute(dev: boolean = import.meta.env.DEV): ReactElement | null {
  if (!dev || DevScorecardPage === null) return null
  return (
    <Route
      path={DEV_SCORECARD_PATH}
      element={
        <Suspense fallback={<p>Loading sample...</p>}>
          <DevScorecardPage />
        </Suspense>
      }
    />
  )
}
