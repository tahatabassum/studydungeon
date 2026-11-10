import { Suspense, lazy, type ReactElement } from 'react'
import { Route } from 'react-router-dom'

/**
 * D11: the `/dev/floors` route. The lazy import sits behind a static `import.meta.env.DEV` check, so a
 * production build drops the page, the fixtures and the route. `dev` can be passed to test both cases.
 */
const DevFloorsPage = import.meta.env.DEV ? lazy(() => import('./DevFloors')) : null

export const DEV_FLOORS_PATH = '/dev/floors'

export function devFloorsRoute(dev: boolean = import.meta.env.DEV): ReactElement | null {
  if (!dev || DevFloorsPage === null) return null
  return (
    <Route
      path={DEV_FLOORS_PATH}
      element={
        <Suspense fallback={<p>Loading fixtures...</p>}>
          <DevFloorsPage />
        </Suspense>
      }
    />
  )
}
