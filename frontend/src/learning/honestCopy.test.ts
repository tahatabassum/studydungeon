/**
 * Honest-copy lint: the learning, haunt, campaign, scorecard, dashboard and tutorial screens show measured
 * numbers only. They never promise that anything will be memorized, remembered or kept forever.
 * **Validates: Requirements 10.5**
 */
import { describe, expect, it } from 'vitest'

// Raw text of every non-test source file in the copy-bearing folders.
const sources = import.meta.glob(
  [
    '/src/{learning,haunt,campaign,scorecard,dashboard,tutorial}/**/*.{ts,tsx}',
    '!/src/**/*.test.ts',
    '!/src/**/*.test.tsx',
    '!/src/**/*.property.test.ts',
  ],
  { query: '?raw', import: 'default', eager: true },
) as Record<string, string>

export const BANNED: ReadonlyArray<readonly [string, RegExp]> = [
  ['guarantee', /guarantee/i],
  ['never forget', /never\s+forget/i],
  ['will remember', /will\s+remember/i],
  ['100% memor', /100\s*%\s*memor/i],
  ['remember forever', /remember(ed)?\s+(\w+\s+)?forever/i],
  ['will never forget', /won'?t\s+(ever\s+)?forget/i],
  ['forget nothing', /forget\s+nothing/i],
  ['permanent memory', /permanent(ly)?\s+(memor|remember)/i],
  ['perfect recall', /perfect\s+(recall|memory|retention)/i],
]

// Comments are not copy; everything else (string literals, template text, JSX text) is scanned.
const strip = (s: string): string => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:'"`])\/\/.*$/gm, '$1')

describe('honest copy', () => {
  it('scans the copy-bearing folders', () => {
    expect(Object.keys(sources).length).toBeGreaterThan(30)
  })

  it('uses none of the banned phrases', () => {
    const hits: string[] = []
    for (const [file, text] of Object.entries(sources)) {
      const body = strip(text)
      for (const [name, pattern] of BANNED) if (pattern.test(body)) hits.push(`${file}: "${name}"`)
    }
    expect(hits).toEqual([])
  })

  it('catches the phrases it is meant to catch', () => {
    const samples = ['We guarantee results', 'You will never forget it', 'You will remember this', '100% memorized', 'remember it forever']
    for (const s of samples) expect(BANNED.some(([, p]) => p.test(s)), s).toBe(true)
    expect(BANNED.some(([, p]) => p.test('Lay them to rest to keep them in mind.'))).toBe(false)
  })
})
