import { describe, expect, it } from 'vitest'

// Source scans: read files as text via the runtime's built-in fs module (no Node typings).
interface Stat {
  isDirectory(): boolean
}
interface Fs {
  readFileSync(path: string, enc: string): string
  readdirSync(path: string): string[]
  statSync(path: string): Stat
}
interface NodeRuntime {
  cwd(): string
  getBuiltinModule(id: string): Fs
}
const nodeProcess = (globalThis as unknown as { process: NodeRuntime }).process
const fs = nodeProcess.getBuiltinModule('node:fs')
const root = nodeProcess.cwd().replace(/\\/g, '/')
const srcDir = `${root}/src`

function walk(dir: string): string[] {
  const out: string[] = []
  for (const name of fs.readdirSync(dir)) {
    if (name === 'node_modules') continue
    const full = `${dir}/${name}`
    if (fs.statSync(full).isDirectory()) out.push(...walk(full))
    else out.push(full)
  }
  return out
}

const allFiles = walk(srcDir)
const isTest = (f: string) => /\.test\.[^/]+$/.test(f)
const rel = (f: string) => f.slice(root.length + 1)

function scan(files: string[], re: RegExp): string[] {
  const hits: string[] = []
  for (const f of files) {
    fs.readFileSync(f, 'utf8')
      .split(/\r?\n/)
      .forEach((line, i) => {
        if (re.test(line)) hits.push(`${rel(f)}:${i + 1}: ${line.trim().slice(0, 120)}`)
      })
  }
  return hits
}

describe('source scans', () => {
  it('has no emoji or dingbat pictographs in non-test ts/tsx/css', () => {
    const files = allFiles.filter((f) => /\.(ts|tsx|css)$/.test(f) && !isTest(f))
    expect(scan(files, /[\p{Extended_Pictographic}\u2700-\u27BF]/u)).toEqual([])
  })

  it('has no legacy token class names or var() references', () => {
    const classRe =
      /\b(bg|text|border|ring|outline|from|to|via|shadow|fill|stroke)-(background|parchment|purple|blood|amber|mint|muted)\b/
    const varRe = /var\(--color-(background|parchment|purple|blood|amber|mint|muted)\)/
    const tsx = allFiles.filter((f) => f.endsWith('.tsx') && !isTest(f))
    const indexHtml = `${root}/index.html`
    const hits = [
      ...scan([...tsx, indexHtml], classRe),
      ...scan(
        allFiles.filter((f) => /\.(css|ts|tsx)$/.test(f) && !isTest(f)),
        varRe,
      ),
    ]
    expect(hits).toEqual([])
  })

  const pkg = JSON.parse(fs.readFileSync(`${root}/package.json`, 'utf8')) as {
    dependencies?: Record<string, string>
    devDependencies?: Record<string, string>
  }

  it('pins every @fontsource dependency to an exact version', () => {
    const deps = { ...pkg.dependencies, ...pkg.devDependencies }
    const bad = Object.entries(deps)
      .filter(([n, v]) => n.startsWith('@fontsource/') && !/^\d+\.\d+\.\d+$/.test(v))
      .map(([n, v]) => `${n}@${v}`)
    expect(bad).toEqual([])
  })

  it('main.tsx imports only latin-* fontsource CSS, max two weights per family', () => {
    const main = fs.readFileSync(`${srcDir}/main.tsx`, 'utf8')
    const imports = [...main.matchAll(/import\s+['"](@fontsource\/[^'"]+)['"]/g)].map((m) => m[1])
    const bad = imports.filter((p) => !/^@fontsource\/[^/]+\/latin-\d+\.css$/.test(p))
    expect(bad).toEqual([])
    const perFamily = new Map<string, Set<string>>()
    for (const p of imports) {
      const m = /^@fontsource\/([^/]+)\/latin-(\d+)\.css$/.exec(p)
      if (m) perFamily.set(m[1], (perFamily.get(m[1]) ?? new Set()).add(m[2]))
    }
    for (const [family, weights] of perFamily) {
      expect(weights.size, family).toBeLessThanOrEqual(2)
    }
  })

  it('references no external font hosts', () => {
    const files = [...allFiles.filter((f) => !isTest(f)), `${root}/index.html`]
    expect(scan(files, /fonts\.googleapis\.com|fonts\.gstatic\.com/)).toEqual([])
  })
})
