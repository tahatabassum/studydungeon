import { describe, expect, it } from 'vitest'
import { shouldUseMocks } from '@/api'

// Raw text of every non-test source file under src, keyed by '/src/path'.
const sources = import.meta.glob(['/src/**/*.ts', '/src/**/*.tsx', '!/src/**/*.test.ts', '!/src/**/*.test.tsx'], {
  query: '?raw',
  import: 'default',
  eager: true,
}) as Record<string, string>

const strip = (s: string): string => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')
const staticSpecs = (s: string): string[] =>
  [...strip(s).matchAll(/\b(?:import|export)\b[^'"`;]*?\bfrom\s*['"]([^'"]+)['"]/g)].map((m) => m[1])
const sideEffectSpecs = (s: string): string[] => [...strip(s).matchAll(/\bimport\s*['"]([^'"]+)['"]/g)].map((m) => m[1])
const dynamicSpecs = (s: string): string[] =>
  [...strip(s).matchAll(/\bimport\s*\(\s*['"`]([^'"`]+)['"`]\s*\)/g)].map((m) => m[1])

const OFFLINE_SPEC = /(^|\/)offline(\/|$)/
const MOCK_SPEC = /(^|\/)mock(\/|$)/
const inOffline = (f: string): boolean => f.startsWith('/src/offline/')

const files = Object.keys(sources)

describe('Offline_Module boundary (D15, Req 14.7)', () => {
  it('scans the source tree', () => {
    expect(files.length).toBeGreaterThan(50)
    expect(files.filter(inOffline).length).toBeGreaterThanOrEqual(4)
  })

  it('detector flags the alias, relative and sub-path forms', () => {
    for (const spec of ['@/offline', '@/offline/adapter', '../offline', '../../offline/rules', './offline']) {
      expect(OFFLINE_SPEC.test(spec), spec).toBe(true)
    }
    for (const spec of ['@/api', '../offlineish', 'offline-thing', '@/state/useOfflineMode']) {
      expect(OFFLINE_SPEC.test(spec), spec).toBe(false)
    }
  })

  it('no file outside src/offline (and tests) imports src/offline statically', () => {
    const hits: string[] = []
    for (const f of files.filter((x) => !inOffline(x))) {
      for (const spec of [...staticSpecs(sources[f]), ...sideEffectSpecs(sources[f])]) {
        if (OFFLINE_SPEC.test(spec)) hits.push(`${f}: ${spec}`)
      }
    }
    expect(hits).toEqual([])
  })

  it('src/offline is reached only by one dynamic import: the explicit Offline demo handler', () => {
    const dynamicHits = files.filter((f) => !inOffline(f) && dynamicSpecs(sources[f]).some((s) => OFFLINE_SPEC.test(s)))
    expect(dynamicHits).toEqual(['/src/state/useStartDemo.ts'])
    // ...and only inside chooseOffline, which runs on the player's click.
    const text = sources['/src/state/useStartDemo.ts']
    const handler = text.slice(text.indexOf('const chooseOffline'))
    expect(handler).toMatch(/await import\('@\/offline'\)/)
    expect(text.slice(0, text.indexOf('const chooseOffline'))).not.toMatch(/import\('@\/offline'\)/)
  })

  it('the Offline_Module imports no mock code, so offline in real mode drags nothing from the mock', () => {
    const hits: string[] = []
    for (const f of files.filter(inOffline)) {
      for (const spec of [...staticSpecs(sources[f]), ...dynamicSpecs(sources[f])]) {
        if (MOCK_SPEC.test(spec)) hits.push(`${f}: ${spec}`)
      }
    }
    expect(hits).toEqual([])
  })

  it('the Offline_Module is deterministic: no Math.random anywhere, Date.now only for the default timestamp clock', () => {
    const random = files.filter(inOffline).filter((f) => /Math\.random/.test(strip(sources[f])))
    expect(random).toEqual([])
    const clock = files.filter(inOffline).filter((f) => /Date\.now\(/.test(strip(sources[f])))
    expect(clock).toEqual(['/src/offline/index.ts'])
  })
})

describe('real mode loads no mock or offline code', () => {
  it('only src/api/index.ts reaches the mock adapter, and only through a dynamic import', () => {
    const hits: string[] = []
    for (const f of files.filter((x) => !x.startsWith('/src/api/mock/') && x !== '/src/campaign/DevFloors.tsx')) {
      for (const spec of [...staticSpecs(sources[f]), ...sideEffectSpecs(sources[f])]) {
        if (MOCK_SPEC.test(spec)) hits.push(`${f}: ${spec}`)
      }
    }
    expect(hits).toEqual([])
    const dynamic = files.filter((f) => !f.startsWith('/src/api/mock/') && dynamicSpecs(sources[f]).some((s) => MOCK_SPEC.test(s)))
    expect(dynamic).toEqual(['/src/api/index.ts'])
  })

  it('the Http_Client and the wire layer import neither the mock nor the offline module', () => {
    const real = files.filter((f) => f === '/src/api/client.ts' || f.startsWith('/src/api/wire/'))
    expect(real.length).toBeGreaterThan(5)
    for (const f of real) {
      for (const spec of [...staticSpecs(sources[f]), ...dynamicSpecs(sources[f])]) {
        expect(spec, `${f} imports ${spec}`).not.toMatch(OFFLINE_SPEC)
        expect(spec, `${f} imports ${spec}`).not.toMatch(MOCK_SPEC)
      }
    }
  })

  it('mocks are chosen only by VITE_USE_MOCKS=true', () => {
    expect(shouldUseMocks({})).toBe(false)
    expect(shouldUseMocks({ VITE_USE_MOCKS: 'false' })).toBe(false)
    expect(shouldUseMocks({ VITE_USE_MOCKS: 'true' })).toBe(true)
  })
})

describe('no token or credential in browser storage (Req 13.5)', () => {
  it('auth, session and api code never touches localStorage or sessionStorage', () => {
    const scoped = files.filter((f) => f.startsWith('/src/auth/') || f.startsWith('/src/api/') || f === '/src/state/SessionContext.tsx')
    expect(scoped.length).toBeGreaterThan(10)
    const hits = scoped.filter((f) => /\b(localStorage|sessionStorage)\b/.test(strip(sources[f])))
    expect(hits).toEqual([])
  })
})
