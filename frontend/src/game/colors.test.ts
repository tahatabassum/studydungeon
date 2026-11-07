import { describe, expect, it } from 'vitest'
import { COLORS, CSS_COLORS, toCss, type ColorName } from './colors'

// Vitest stubs CSS imports and there are no Node typings; read the stylesheet via the runtime fs.
interface NodeRuntime {
  cwd(): string
  getBuiltinModule(id: string): { readFileSync(path: string, enc: string): string }
}
const nodeProcess = (globalThis as unknown as { process: NodeRuntime }).process
const css = nodeProcess
  .getBuiltinModule('node:fs')
  .readFileSync(`${nodeProcess.cwd()}/src/index.css`, 'utf8')

function token(name: ColorName): string {
  const cssName = name.toLowerCase().replace('_', '-')
  const m = new RegExp(`--color-${cssName}:\\s*(#[0-9a-fA-F]{6})\\s*;`).exec(css)
  if (!m) throw new Error(`token --color-${cssName} not found`)
  return m[1].toUpperCase()
}

describe('game colors', () => {
  it.each(Object.keys(COLORS) as ColorName[])('%s matches its index.css token', (name) => {
    expect(toCss(COLORS[name])).toBe(token(name))
    expect(CSS_COLORS[name]).toBe(token(name))
  })
})
