import { describe, expect, it } from 'vitest'

// Raw text of every non-test source file under src/game, keyed by './path' relative to src/game.
const modules = import.meta.glob(['./**/*.ts', './**/*.tsx', '!./**/*.test.ts', '!./**/*.test.tsx'], {
  query: '?raw',
  import: 'default',
  eager: true,
}) as Record<string, string>

/** Normalises a relative specifier against a './a/b.ts' key; result is relative to src/game (may start with '../'). */
function resolveFromGame(file: string, spec: string): string[] {
  const parts = file.split('/').slice(1, -1) // drop '.' and file name
  for (const seg of spec.split('/')) {
    if (seg === '' || seg === '.') continue
    if (seg === '..') {
      if (parts.length > 0 && parts[parts.length - 1] !== '..') parts.pop()
      else parts.push('..')
    } else parts.push(seg)
  }
  return parts
}

/** Collects module specifiers from static imports/exports and dynamic import(). */
function specifiers(source: string): string[] {
  const text = source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')
  const found: string[] = []
  const patterns = [
    /\b(?:import|export)\b[^'"`;]*?\bfrom\s*['"]([^'"]+)['"]/g,
    /\bimport\s*['"]([^'"]+)['"]/g,
    /\bimport\s*\(\s*['"`]([^'"`]+)['"`]\s*\)/g,
    /\brequire\s*\(\s*['"]([^'"]+)['"]\s*\)/g,
  ]
  for (const re of patterns) for (const m of text.matchAll(re)) found.push(m[1])
  return found
}

function isForbidden(spec: string, file: string): boolean {
  if (/^@\/(api|demo|state)(\/|$)/.test(spec)) return true
  if (!spec.startsWith('.')) return false
  // src/game/../api -> ['..', 'api', ...]
  const [up, dir] = resolveFromGame(file, spec)
  return up === '..' && ['api', 'demo', 'state'].includes(dir ?? '')
}

describe('game import boundary', () => {
  const files = Object.keys(modules)

  it('scans some source files', () => {
    expect(files.length).toBeGreaterThan(0)
  })

  it('detector flags forbidden specifiers and allows types', () => {
    const f = './systems/x.ts'
    expect(isForbidden('@/api', f)).toBe(true)
    expect(isForbidden('@/state/runReducer', f)).toBe(true)
    expect(isForbidden('../../demo/rules', f)).toBe(true)
    expect(isForbidden('../../api', f)).toBe(true)
    expect(isForbidden('@/types/api', f)).toBe(false)
    expect(isForbidden('../events', f)).toBe(false)
    expect(specifiers(`import('@/api')\nimport { a } from "@/demo"\nimport type { T } from '@/types/api'`)).toEqual([
      '@/demo',
      '@/types/api',
      '@/api',
    ])
  })

  it('no game file imports from api, demo or state', () => {
    const violations: string[] = []
    for (const file of files) {
      for (const spec of specifiers(modules[file])) {
        if (isForbidden(spec, file)) violations.push(`${file}: ${spec}`)
      }
    }
    expect(violations).toEqual([])
  })
})
