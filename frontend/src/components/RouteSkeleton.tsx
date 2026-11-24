/** Neutral placeholder shown while the session is being restored; no interactive content. */
export default function RouteSkeleton() {
  return <div className="sd-route-skeleton" aria-hidden="true" style={{ minHeight: '100vh' }} />;
}
