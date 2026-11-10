import { describe, expect, it } from 'vitest'

// Raw text of every non-test source file under src, keyed by '/src/path'.
const sources = import.meta.glob(['/src/**/*.ts', '/src/**/*.tsx', '!/src/**/*.test.ts', '!/src/**/*.test.tsx'], {
  query: '?raw',
  import: 'default',
  eager: true,
}) as Record<string, string>

const strip = (s: string): string => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')
const staticSpecs = (s: string): string[] =>
  [...strip(s).matchAll(/\b(?:import|export)\b[^'"`;]*?\bfrom\s*['"]([^'"]+)['"]/g)].map((m) => m[1])
const dynamicSpecs = (s: string): string[] =>
  [...strip(s).matchAll(/\bimport\s*\(\s*['"`]([^'"`]+)['"`]\s*\)/g)].map((m) => m[1])

const MOCK_SPEC = /(^|\/)mock(\/|$)/
const DEV_ONLY = new Set(['/src/campaign/DevFloors.tsx'])

describe('real mode loads no mock module', () => {
  const files = Object.keys(sources).filter((f) => !f.startsWith('/src/api/mock/') && !DEV_ONLY.has(f))

  it('scans the source tree', () => {
    expect(files.length).toBeGreaterThan(20)
  })

  it('only src/api/index.ts reaches the mock adapter, and only through a dynamic import', () => {
    const staticHits: string[] = []
    const dynamicHits: string[] = []
    for (const f of files) {
      for (const spec of staticSpecs(sources[f])) if (MOCK_SPEC.test(spec)) staticHits.push(`${f}: ${spec}`)
      for (const spec of dynamicSpecs(sources[f])) if (MOCK_SPEC.test(spec)) dynamicHits.push(f)
    }
    expect(staticHits).toEqual([])
    expect(dynamicHits).toEqual(['/src/api/index.ts'])
  })

  it('the Http_Client and the wire layer import no demo rules, rank or mastery helpers', () => {
    const real = Object.keys(sources).filter((f) => f === '/src/api/client.ts' || f.startsWith('/src/api/wire/'))
    expect(real.length).toBeGreaterThan(5)
    for (const f of real) {
      for (const spec of staticSpecs(sources[f])) {
        expect(spec, `${f} imports ${spec}`).not.toMatch(/demo|learning\/rank|mockMastery|seededRng|draw|requeue/)
      }
    }
  })

  it('no screen, hook or reducer imports the mock rules (draw, requeue, mastery, rank, retry multiplier)', () => {
    const MOCK_RULES = /(^|\/)(offline\/rules|demo\/rules|learning\/(requeue|draw|masteryStore|seededRng|rank))$/
    // Only the mock adapters and the pure modules they call may reach them.
    const allowed = (f: string): boolean =>
      f.startsWith('/src/api/mock/') ||
      f.startsWith('/src/offline/') ||
      f.startsWith('/src/demo/') ||
      /^\/src\/learning\/(requeue|draw|masteryStore|seededRng|rank)\.ts$/.test(f)
    const hits: string[] = []
    for (const f of Object.keys(sources)) {
      if (allowed(f)) continue
      for (const spec of [...staticSpecs(sources[f]), ...dynamicSpecs(sources[f])]) {
        if (MOCK_RULES.test(spec)) hits.push(`${f}: ${spec}`)
      }
    }
    expect(hits).toEqual([])
  })

  it('retry effects are worded from the response and never computed in the UI', () => {
    const display = ['/src/learning/retryRules.ts', '/src/learning/MemoryScroll.tsx', '/src/encounter/EncounterPopup.tsx', '/src/state/pendingRequeue.ts']
    for (const f of display) {
      const text = strip(sources[f])
      expect(text, f).not.toMatch(/RETRY_MULTIPLIER|REQUEUE_GAP|MAX_RETURNS/)
      expect(text, f).not.toMatch(/damage_dealt\s*[*/]|retry_multiplier\s*[*/]|\*\s*(shownResult|result)\.retry_multiplier/)
    }
  })

  it('floor fixtures (3 or more floors) are reachable only from the DEV route page and tests', () => {
    const hits = Object.keys(sources).filter(
      (f) =>
        !f.startsWith('/src/api/mock/fixtures/') &&
        !DEV_ONLY.has(f) &&
        staticSpecs(sources[f]).some((s) => /fixtures\/(floorFixture|floors\.\d+|index)$/.test(s)),
    )
    expect(hits).toEqual([])
  })
})
