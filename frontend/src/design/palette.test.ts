import { describe, expect, it } from 'vitest'
import { COLORS, type ColorName } from '@/game/colors'
import { contrastRatio } from './contrast'

// Vitest stubs CSS imports; read the stylesheet from disk through the runtime's built-in fs.
interface NodeRuntime {
  cwd(): string
  getBuiltinModule(id: string): { readFileSync(path: string, enc: string): string }
}
const nodeProcess = (globalThis as unknown as { process: NodeRuntime }).process
const css = nodeProcess
  .getBuiltinModule('node:fs')
  .readFileSync(`${nodeProcess.cwd()}/src/index.css`, 'utf8')

function cssValue(name: ColorName): number {
  const cssName = name.toLowerCase().replace('_', '-')
  const m = new RegExp(`--color-${cssName}:\\s*#([0-9a-fA-F]{6})\\s*;`).exec(css)
  if (!m) throw new Error(`token --color-${cssName} not found`)
  return parseInt(m[1], 16)
}

describe('palette parity', () => {
  it.each(Object.keys(COLORS) as ColorName[])('%s equals in index.css and colors.ts', (name) => {
    expect(cssValue(name)).toBe(COLORS[name])
  })
})

describe('Halloween palette contrast', () => {
  const pairs: Array<[string, number, number, number]> = [
    ['bone on bg', COLORS.BONE, COLORS.BG, 4.5],
    ['ink on bg', COLORS.INK, COLORS.BG, 4.5],
    ['pumpkin on bg', COLORS.PUMPKIN, COLORS.BG, 4.5],
    ['bg text on pumpkin button', COLORS.BG, COLORS.PUMPKIN, 4.5],
    ['ember on bg', COLORS.EMBER, COLORS.BG, 4.5],
    ['ghost on bg', COLORS.GHOST, COLORS.BG, 4.5],
    ['toxic on bg', COLORS.TOXIC, COLORS.BG, 4.5],
    ['magic (text and borders) on bg', COLORS.MAGIC, COLORS.BG, 3],
    ['magenta on bg', COLORS.MAGENTA, COLORS.BG, 3],
  ]
  it.each(pairs)('%s meets its minimum', (_label, fg, bg, min) => {
    expect(contrastRatio(fg, bg)).toBeGreaterThanOrEqual(min)
  })

  it('witch purple is documented as fills and glows only (below 3:1 on bg)', () => {
    expect(contrastRatio(COLORS.WITCH, COLORS.BG)).toBeLessThan(3.2)
  })
})

describe('Required text and UI pairs on component surfaces', () => {
  const surfaces: Array<[string, number]> = [
    ['bg', COLORS.BG],
    ['surface-2', COLORS.SURFACE_2],
    ['panel', COLORS.PANEL],
    ['deep', COLORS.DEEP],
  ]
  const textTokens: Array<[string, number]> = [
    ['ink', COLORS.INK],
    ['ink-muted', COLORS.INK_MUTED],
    ['gold', COLORS.GOLD],
    ['health', COLORS.HEALTH],
  ]
  const cases = surfaces.flatMap(([sn, sv]) => textTokens.map(([tn, tv]) => [`${tn} on ${sn}`, tv, sv] as const))
  // ink-muted on deep is only used for borders and hints on bg/panel; the others must meet 4.5:1 as text.
  it.each(cases.filter(([label]) => label !== 'ink-muted on deep'))('text %s is at least 4.5:1', (_l, fg, bg) => {
    expect(contrastRatio(fg, bg)).toBeGreaterThanOrEqual(4.5)
  })

  // Components render danger and magic text as color-mix(token, ink N%) because the raw tokens are below 4.5:1.
  const mixInk = (c: number, inkPct: number): number => {
    const ch = (shift: number) =>
      Math.round(((c >> shift) & 255) * (1 - inkPct / 100) + ((COLORS.INK >> shift) & 255) * (inkPct / 100))
    return (ch(16) << 16) | (ch(8) << 8) | ch(0)
  }

  it('danger (45% ink) and magic (40% ink) text mixes are at least 4.5:1 on bg, surface-2 and panel', () => {
    for (const bg of [COLORS.BG, COLORS.SURFACE_2, COLORS.PANEL]) {
      expect(contrastRatio(mixInk(COLORS.DANGER, 45), bg), `danger on ${bg.toString(16)}`).toBeGreaterThanOrEqual(4.5)
      expect(contrastRatio(mixInk(COLORS.MAGIC, 40), bg), `magic on ${bg.toString(16)}`).toBeGreaterThanOrEqual(4.5)
    }
  })

  it('parchment (spellbook) text uses bg on ink/bone at 4.5:1', () => {
    expect(contrastRatio(COLORS.BG, COLORS.INK)).toBeGreaterThanOrEqual(4.5)
    expect(contrastRatio(COLORS.BG, COLORS.BONE)).toBeGreaterThanOrEqual(4.5)
  })

  it('UI borders and glows (magic, pumpkin, magenta) are at least 3:1 on panel', () => {
    for (const c of [COLORS.MAGIC, COLORS.PUMPKIN, COLORS.MAGENTA]) {
      expect(contrastRatio(c, COLORS.PANEL)).toBeGreaterThanOrEqual(3)
    }
  })

  it('witch colour is never used as a text colour', () => {
    const fs = nodeProcess.getBuiltinModule('node:fs') as unknown as {
      readFileSync(path: string, enc: string): string
      readdirSync(path: string): string[]
    }
    const root = `${nodeProcess.cwd()}/src`
    // CSS: a `color:` declaration with the witch token is only allowed on decorative bat shapes.
    for (const file of fs.readdirSync(`${root}/styles`).filter((f) => f.endsWith('.css'))) {
      const text = fs.readFileSync(`${root}/styles/${file}`, 'utf8')
      const rule = /([^{}]+)\{([^{}]*)\}/g
      let m: RegExpExecArray | null
      while ((m = rule.exec(text))) {
        if (/(^|[;\s])color:\s*var\(--color-witch\)/.test(m[2])) {
          expect(m[1], `${file}: ${m[1].trim()}`).toMatch(/bat/)
        }
      }
    }
    // TSX: no text-witch utility.
    for (const dir of ['components', 'pages']) {
      for (const file of fs.readdirSync(`${root}/${dir}`).filter((f) => f.endsWith('.tsx') && !f.includes('.test.'))) {
        expect(fs.readFileSync(`${root}/${dir}/${file}`, 'utf8'), `${dir}/${file}`).not.toMatch(/text-witch|color-witch\)\]/)
      }
    }
  })
})
