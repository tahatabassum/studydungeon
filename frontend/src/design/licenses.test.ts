import { describe, expect, it } from 'vitest'
import { SPRITE_REGISTRY } from '@/art/sprites'
// Reads ASSETS_LICENSES.md via the runtime's built-in fs module (no Node typings).
interface Fs {
  readFileSync(path: string, enc: string): string
}
interface NodeRuntime {
  cwd(): string
  getBuiltinModule(id: string): Fs
}
const nodeProcess = (globalThis as unknown as { process: NodeRuntime }).process
const fs = nodeProcess.getBuiltinModule('node:fs')
const root = nodeProcess.cwd().replace(/\\/g, '/')
const licenses = fs.readFileSync(`${root}/ASSETS_LICENSES.md`, 'utf8')
// Art sets other than the pixel-sprite registry, named in the file by directory.
const OTHER_ART_SETS = ['src/art/portraits', 'src/art/room']
describe('ASSETS_LICENSES.md', () => {
  it('names every registered sprite', () => {
    const missing = Object.keys(SPRITE_REGISTRY).filter((name) => !licenses.includes(`\`${name}\``))
    expect(missing).toEqual([])
  })
  it('names the other art sets', () => {
    for (const set of OTHER_ART_SETS) expect(licenses, set).toContain(set)
  })
  it('lists the three fonts with OFL and links', () => {
    for (const font of ['Pirata One', 'Cinzel', 'Inter']) expect(licenses).toContain(font)
    expect(licenses).toContain('SIL Open Font License')
    expect(licenses).toMatch(/https:\/\/fonts\.google\.com\/specimen\/Pirata\+One/)
    expect(licenses).toMatch(/https:\/\/fontsource\.org\/fonts\/inter/)
  })
  it('declares audio as original synthesis', () => {
    expect(licenses).toMatch(/synthesi[sz]ed at runtime with the Web Audio API/)
  })
})
