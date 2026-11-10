import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import {
  FIXTURE_FLOOR_COUNTS,
  buildFloorFixture,
  type FixtureFloorCount,
  type FixtureStatusMode,
} from '../api/mock/fixtures/floorFixture'
import type { FinalBoss, Floor, FloorStatus } from '../types/api'
import { FloorMap } from './FloorMap'
import { useGenerationStatus } from './useGenerationStatus'

/**
 * DEV-only page (D11): `/dev/floors?floors=1|3|10|25&status=mixed&fail=1`.
 * It is registered through `devFloorsRoute`, which exists only when `import.meta.env.DEV` is true.
 * It renders the real FloorMap on fixture data, with a simulated generation (a summoning floor becomes
 * ready after 4 s) and a forced-failure switch (`fail=1`) to try Retry.
 */
const STATUS_MODES: readonly FixtureStatusMode[] = ['mixed', 'locked', 'ready', 'generating', 'failed', 'cleared']
const SIM_STEP_MS = 4000

export function parseFloorCount(raw: string | null): FixtureFloorCount {
  const n = Number(raw)
  return (FIXTURE_FLOOR_COUNTS as readonly number[]).includes(n) ? (n as FixtureFloorCount) : 3
}

export function parseStatusMode(raw: string | null): FixtureStatusMode {
  return (STATUS_MODES as readonly string[]).includes(raw ?? '') ? (raw as FixtureStatusMode) : 'mixed'
}

interface DevMapProps {
  count: FixtureFloorCount
  mode: FixtureStatusMode
  forceFail: boolean
}

function DevMap({ count, mode, forceFail }: DevMapProps) {
  const fixture = useMemo(() => buildFloorFixture(count, mode), [count, mode])
  const initial = useMemo<Floor[]>(() => {
    if (!forceFail) return fixture.floors
    const target = fixture.floors.findIndex((f) => f.status !== 'cleared')
    return fixture.floors.map((f, i) => (i === target ? { ...f, status: 'failed' as const, rank: null } : f))
  }, [fixture, forceFail])
  const [base, setBase] = useState<Floor[]>(initial)
  const [log, setLog] = useState('')
  // What the pretend backend says; polled through the same hook the real map uses.
  const server = useRef(new Map<string, FloorStatus>(initial.map((f) => [f.id, f.status])))

  useEffect(() => {
    const t = setInterval(() => {
      for (const [id, status] of server.current) {
        if (status === 'generating') {
          server.current.set(id, 'ready')
          break
        }
      }
    }, SIM_STEP_MS)
    return () => clearInterval(t)
  }, [])

  const fetchStatus = useCallback(
    async () => ({
      dungeon_id: fixture.dungeon.id,
      floors: [...server.current].map(([id, status]) => ({ id, status })),
    }),
    [fixture],
  )
  const generation = useGenerationStatus({ floors: base, fetchStatus, intervalMs: 1000 })

  const finalBoss: FinalBoss = {
    ...fixture.final_boss,
    unlocked: generation.floors.length > 0 && generation.floors.every((f) => f.status === 'cleared'),
  }

  return (
    <div className="sd-dev-wrap">
      <FloorMap
        title={fixture.dungeon.name}
        floors={generation.floors}
        finalBoss={finalBoss}
        announcement={generation.announcement}
        timedOut={generation.timedOut}
        onResume={generation.resume}
        backTo="/"
        onOpenFloor={(f) => setLog(`Would start Floor ${f.index} (${f.id}) with mode floor.`)}
        onOpenFinal={(b) => setLog(`Would start the final boss (${b.id}).`)}
        onRetryFloor={(f) => {
          server.current.set(f.id, 'generating')
          setBase(generation.floors.map((x) => (x.id === f.id ? { ...x, status: 'generating' as const } : x)))
          setLog(`Retrying Floor ${f.index}...`)
        }}
      />
      <aside
        aria-label="Development controls"
        className="sd-dev-bar flex items-center gap-x-4 gap-y-0 border-t border-deep bg-panel px-3 text-xs text-ink"
      >
        {/* A strip under the map, not an overlay: it never covers a card. */}
        <p className="font-semibold">Dev fixtures: {count} floors, status {mode}{forceFail ? ', forced failure' : ''}</p>
        <nav aria-label="Fixture size" className="flex flex-wrap gap-2">
          {FIXTURE_FLOOR_COUNTS.map((n) => (
            <Link key={n} className="underline" to={`?floors=${n}&status=${mode}${forceFail ? '&fail=1' : ''}`}>
              {n}
            </Link>
          ))}
          <Link className="underline" to={`?floors=${count}&status=${mode}&fail=${forceFail ? 0 : 1}`}>
            {forceFail ? 'No forced failure' : 'Force a failure'}
          </Link>
        </nav>
        <p role="status" aria-live="polite" className="min-h-4 truncate text-ink-muted">
          {log}
        </p>
      </aside>
    </div>
  )
}

export default function DevFloors() {
  const [params] = useSearchParams()
  const count = parseFloorCount(params.get('floors'))
  const mode = parseStatusMode(params.get('status'))
  const forceFail = params.get('fail') === '1'
  return <DevMap key={`${count}:${mode}:${forceFail}`} count={count} mode={mode} forceFail={forceFail} />
}
