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
