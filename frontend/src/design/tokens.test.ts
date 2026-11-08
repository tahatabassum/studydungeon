import { describe, expect, it } from 'vitest'

// Vitest stubs CSS imports (even ?raw/?inline yield ''), and the project has no Node typings,
// so read the stylesheet from disk through the runtime's built-in fs module.
interface NodeRuntime {
  cwd(): string
  getBuiltinModule(id: string): { readFileSync(path: string, enc: string): string }
}
const nodeProcess = (globalThis as unknown as { process: NodeRuntime }).process
const css = nodeProcess
  .getBuiltinModule('node:fs')
  .readFileSync(`${nodeProcess.cwd()}/src/index.css`, 'utf8')

const PALETTE: Record<string, string> = {
  bg: '#100B18',
  'surface-2': '#1C1427',
  panel: '#251A32',
  deep: '#39244F',
  magic: '#9B5DE5',
  accent: '#FF9F1C',
  ink: '#F5EBDD',
  danger: '#C83E4D',
  health: '#59C9A5',
  gold: '#E9B44C',
}

function token(name: string): string {
  const m = new RegExp(`--color-${name}:\\s*(#[0-9a-fA-F]{6})\\s*;`).exec(css)
  if (!m) throw new Error(`token --color-${name} not found`)
  return m[1].toUpperCase()
}

function luminance(hex: string): number {
  const ch = [1, 3, 5].map((i) => {
    const c = parseInt(hex.slice(i, i + 2), 16) / 255
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4
  })
  return 0.2126 * ch[0] + 0.7152 * ch[1] + 0.0722 * ch[2]
}

function contrast(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x)
  return (hi + 0.05) / (lo + 0.05)
}

describe('design tokens', () => {
  it.each(Object.entries(PALETTE))('defines --color-%s as %s', (name, hex) => {
    expect(token(name)).toBe(hex)
  })

  it.each(['background', 'parchment', 'purple', 'blood', 'amber', 'mint', 'muted'])(
    'does not define legacy token --color-%s',
    (name) => {
      expect(css).not.toMatch(new RegExp(`--color-${name}\\s*:`))
    },
  )

  it('focus ring uses the accent token', () => {
    expect(css).toMatch(/:focus-visible\s*{[^}]*var\(--color-accent\)/)
  })

  const ink = token('ink')
  const muted = token('ink-muted')
  const pairs: Array<[string, string, string, number]> = [
    ['ink on bg', ink, token('bg'), 4.5],
    ['ink on panel', ink, token('panel'), 4.5],
    ['ink on surface-2', ink, token('surface-2'), 4.5],
    ['ink-muted on panel', muted, token('panel'), 4.5],
    ['ink-muted on bg', muted, token('bg'), 4.5],
    ['accent on panel', token('accent'), token('panel'), 3],
    ['gold on panel', token('gold'), token('panel'), 3],
    ['health on panel', token('health'), token('panel'), 3],
    ['danger on panel', token('danger'), token('panel'), 3],
    ['bg (dark text) on ink', token('bg'), ink, 4.5],
  ]
  it.each(pairs)('%s meets contrast', (label, fg, bg, min) => {
    const ratio = contrast(fg, bg)
    console.log(`${label}: ${ratio.toFixed(2)}:1 (min ${min})`)
    expect(ratio).toBeGreaterThanOrEqual(min)
  })
})
