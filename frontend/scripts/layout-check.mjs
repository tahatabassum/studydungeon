#!/usr/bin/env node
/*
 * Layout_Check: drives a local headless Chrome/Edge over the Chrome DevTools Protocol (no dependency) and
 * asserts that each Fit_Screen fits its window: no page scrollbar, no Nested_Scrollbar outside the allow-list,
 * no clipped text. Starts the Vite dev server in mock mode unless LAYOUT_URL is given.
 *
 * Usage: npm run layout:check -- [--routes /a,/b] [--sizes 1366x768,360x740] [--screenshots <dir>]
 * Env:   LAYOUT_BROWSER (path to chrome/msedge), LAYOUT_URL (use a running server instead of starting vite)
 */
/* global document, innerHeight, innerWidth, getComputedStyle, console, process, Buffer, WebSocket, fetch, setTimeout */
import { spawn, spawnSync } from 'node:child_process'
import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { createServer } from 'node:net'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')

const ALL_ROUTES = ['/', '/login', '/register', '/upload', '/leaderboard', '/choose', '/play-as-guest', '/settings', '/campaign/demo-dungeon']
const SESSION_ROUTES = new Set(['/choose', '/settings', '/campaign/demo-dungeon'])
const ALL_SIZES = ['1366x650', '1366x768', '1536x864', '1920x960', '1920x1080', '2560x1440', '360x740', '740x360']
const PHONES = new Set(['360x740', '740x360'])
const SCROLLERS = '.sd-scroll, .sd-map__scroll, .sd-landing__main'
const DECOR = '.sd-page__atmosphere, [class*="backdrop"], .sd-landing__sky, .sd-map__atmosphere, .sd-moon, .sd-fog, [aria-hidden="true"]'

function arg(name) {
  const i = process.argv.indexOf(`--${name}`)
  return i > -1 ? process.argv[i + 1] : undefined
}
const routes = arg('routes') ? arg('routes').split(',') : ALL_ROUTES
const sizes = arg('sizes') ? arg('sizes').split(',') : ALL_SIZES
const shotDir = arg('screenshots') ? resolve(process.cwd(), arg('screenshots')) : null

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const freePort = () =>
  new Promise((res, rej) => {
    const s = createServer()
    s.once('error', rej)
    s.listen(0, '127.0.0.1', () => {
      const { port } = s.address()
      s.close(() => res(port))
    })
  })
const killTree = (child) => {
  if (!child || child.exitCode !== null) return
  if (process.platform === 'win32') spawnSync('taskkill', ['/PID', String(child.pid), '/T', '/F'], { stdio: 'ignore' })
  else child.kill('SIGKILL')
}

function findBrowser() {
  const env = process.env.LAYOUT_BROWSER
  if (env) {
    if (existsSync(env)) return env
    throw new Error(`LAYOUT_BROWSER does not exist: ${env}`)
  }
  const pf = process.env.PROGRAMFILES ?? 'C:\\Program Files'
  const pf86 = process.env['PROGRAMFILES(X86)'] ?? 'C:\\Program Files (x86)'
  const local = process.env.LOCALAPPDATA ?? ''
  const candidates = [
    `${pf}\\Google\\Chrome\\Application\\chrome.exe`,
    `${pf86}\\Google\\Chrome\\Application\\chrome.exe`,
    `${local}\\Google\\Chrome\\Application\\chrome.exe`,
    `${pf86}\\Microsoft\\Edge\\Application\\msedge.exe`,
    `${pf}\\Microsoft\\Edge\\Application\\msedge.exe`,
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge',
    '/usr/bin/google-chrome',
    '/usr/bin/google-chrome-stable',
    '/usr/bin/chromium',
    '/usr/bin/chromium-browser',
    '/usr/bin/microsoft-edge',
  ]
  const found = candidates.find((p) => existsSync(p))
  if (!found) throw new Error('No Chrome or Edge found. Set LAYOUT_BROWSER to the browser executable.')
  return found
}

async function waitFor(fn, what, ms = 30000) {
  const end = Date.now() + ms
  for (;;) {
    try {
      const v = await fn()
      if (v) return v
    } catch {
      /* retry */
    }
    if (Date.now() > end) throw new Error(`Timed out waiting for ${what}`)
    await sleep(150)
  }
}

class Cdp {
  constructor(ws) {
    this.ws = ws
    this.id = 0
    this.pending = new Map()
    this.waiters = []
    ws.addEventListener('message', (e) => {
      const m = JSON.parse(e.data)
      if (m.id && this.pending.has(m.id)) {
        const { res, rej } = this.pending.get(m.id)
        this.pending.delete(m.id)
        if (m.error) rej(new Error(m.error.message))
        else res(m.result)
      } else if (m.method) {
        this.waiters = this.waiters.filter((w) => {
          if (w.method !== m.method) return true
          w.res(m.params)
          return false
        })
      }
    })
  }
  send(method, params = {}) {
    const id = ++this.id
    this.ws.send(JSON.stringify({ id, method, params }))
    return new Promise((res, rej) => this.pending.set(id, { res, rej }))
  }
  once(method) {
    return new Promise((res) => this.waiters.push({ method, res }))
  }
  async eval(expression) {
    const r = await this.send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true })
    if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description ?? 'eval failed')
    return r.result.value
  }
}

// Runs inside the page. Returns a list of problem strings.
const MEASURE = `(${function measure(cfg) {
  const out = []
  const desc = (el) => {
    const id = el.id ? '#' + el.id : ''
    const cls = typeof el.className === 'string' && el.className.trim() ? '.' + el.className.trim().split(/\s+/).slice(0, 2).join('.') : ''
    return el.tagName.toLowerCase() + id + cls
  }
  const de = document.documentElement
  if (!cfg.phone && de.scrollHeight > innerHeight) out.push(`page-v ${de.scrollHeight}>${innerHeight}`)
  if (de.scrollWidth > innerWidth) out.push(`page-h ${de.scrollWidth}>${innerWidth}`)
  for (const el of document.body.querySelectorAll('*')) {
    const s = getComputedStyle(el)
    if (s.display === 'none' || s.visibility === 'hidden') continue
    const sy = /(auto|scroll)/.test(s.overflowY)
    const sx = /(auto|scroll)/.test(s.overflowX)
    if ((sy && el.scrollHeight > el.clientHeight + 1) || (sx && el.scrollWidth > el.clientWidth + 1)) {
      if (!el.matches(cfg.scrollers) && !el.closest(cfg.scrollers + ', ' + cfg.decor)) out.push(`scroller ${desc(el)}`)
      continue
    }
    const hy = s.overflowY === 'hidden' || s.overflowY === 'clip'
    const hx = s.overflowX === 'hidden' || s.overflowX === 'clip'
    if (!hy && !hx) continue
    if (el.closest(cfg.decor) || el.closest(cfg.scrollers) || el.closest('.sr-only')) continue
    const clippedV = hy && el.scrollHeight > el.clientHeight + 1
    const clippedH = hx && el.scrollWidth > el.clientWidth + 1
    if (!clippedV && !clippedH) continue
    if (el.hasAttribute('title') && s.textOverflow === 'ellipsis') continue
    const txt = (el.innerText || '').trim()
    if (el.classList.contains('sd-page--fit') || txt) out.push(`clipped ${desc(el)} ${clippedV ? el.scrollHeight + '>' + el.clientHeight + 'v' : el.scrollWidth + '>' + el.clientWidth + 'h'}`)
  }
  return [...new Set(out)]
}.toString()})`

async function main() {
  const tmp = mkdtempSync(join(tmpdir(), 'sd-layout-'))
  let vite = null
  let browser = null
  try {
    let base = process.env.LAYOUT_URL
    if (!base) {
      const port = await freePort()
      vite = spawn(process.execPath, [join(root, 'node_modules', 'vite', 'bin', 'vite.js'), '--host', '127.0.0.1', '--port', String(port), '--strictPort'], {
        cwd: root,
        env: { ...process.env, VITE_USE_MOCKS: 'true' },
        stdio: 'ignore',
      })
      base = `http://127.0.0.1:${port}`
      await waitFor(async () => (await fetch(base)).ok, 'the Vite dev server', 60000)
    }
    base = base.replace(/\/$/, '')

    const bport = await freePort()
    browser = spawn(
      findBrowser(),
      ['--headless=new', `--remote-debugging-port=${bport}`, `--user-data-dir=${join(tmp, 'profile')}`, '--no-first-run', '--no-default-browser-check', '--disable-gpu', '--hide-scrollbars=false', 'about:blank'],
      { stdio: 'ignore' },
    )
    await waitFor(async () => (await fetch(`http://127.0.0.1:${bport}/json/version`)).ok, 'the browser')
    const target = await (await fetch(`http://127.0.0.1:${bport}/json/new?about:blank`, { method: 'PUT' })).json()
    const ws = new WebSocket(target.webSocketDebuggerUrl)
    await new Promise((res, rej) => {
      ws.addEventListener('open', res)
      ws.addEventListener('error', rej)
    })
    const cdp = new Cdp(ws)
    await cdp.send('Page.enable')
    await cdp.send('Runtime.enable')

    const results = [] // { route, size, problems }
    const publicRoutes = routes.filter((r) => !SESSION_ROUTES.has(r))
    const sessionRoutes = routes.filter((r) => SESSION_ROUTES.has(r))

    const settle = async (extra = 700) => {
      await waitFor(() => cdp.eval(`document.readyState === 'complete' && !!document.querySelector('main')`), 'the page', 20000).catch(() => {})
      await sleep(extra)
    }
    const goto = async (route) => {
      await cdp.eval(`history.pushState({}, '', ${JSON.stringify(route)}); dispatchEvent(new PopStateEvent('popstate'))`)
    }
    const load = async (path) => {
      const loaded = cdp.once('Page.loadEventFired')
      await cdp.send('Page.navigate', { url: base + path })
      await loaded
      await settle()
    }
    const guestSession = async (query) => {
      await load('/play-as-guest' + query)
      return cdp.eval(`(async () => {
        const input = document.querySelector('#display-name')
        if (!input) return false
        const set = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set
        set.call(input, 'Layout Tester')
        input.dispatchEvent(new Event('input', { bubbles: true }))
        await new Promise((r) => setTimeout(r, 200))
        const btn = [...document.querySelectorAll('button')].find((b) => /accept and continue|start the demo/i.test(b.textContent))
        if (!btn) return false
        btn.click()
        for (let i = 0; i < 50 && !location.pathname.startsWith('/choose'); i++) await new Promise((r) => setTimeout(r, 200))
        return location.pathname.startsWith('/choose')
      })()`)
    }
    const registeredSession = async () => {
      await load('/register')
      return cdp.eval(`(async () => {
        const set = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set
        const fill = (el, v) => { set.call(el, v); el.dispatchEvent(new Event('input', { bubbles: true })) }
        const user = document.querySelector('input[type="text"]')
        const pass = document.querySelector('input[type="password"]')
        if (!user || !pass) return false
        fill(user, 'layout_tester')
        fill(pass, 'correct-horse-9')
        await new Promise((r) => setTimeout(r, 200))
        document.querySelector('button[type="submit"]')?.click()
        for (let i = 0; i < 50 && location.pathname === '/register'; i++) await new Promise((r) => setTimeout(r, 200))
        return location.pathname !== '/register'
      })()`)
    }
    const waitText = (sel, ms = 15000) => cdp.eval(`(async () => { for (let i = 0; i < ${ms / 200}; i++) { if (document.querySelector(${JSON.stringify(sel)})) return true; await new Promise((r) => setTimeout(r, 200)) } return false })()`)
    const tick = () => cdp.eval(`(() => { const b = document.querySelector('[data-testid="ai-notice-check"]'); if (b && !b.disabled && !b.checked) b.click(); return !!b })()`)
    const chooseFile = (name, chars) =>
      cdp.eval(`(() => {
        const input = document.querySelector('input[type="file"]')
        if (!input || input.disabled) return false
        const dt = new DataTransfer()
        dt.items.add(new File(['Cells are the basic unit of life. '.repeat(${Math.ceil(chars / 34)})], ${JSON.stringify(name)}, { type: 'text/plain' }))
        input.files = dt.files
        input.dispatchEvent(new Event('change', { bubbles: true }))
        return true
      })()`)
    const UPLOAD_SCENARIOS = [
      {
        name: 'guest',
        session: () => guestSession(''),
        async run(phone, size) {
          await measure('/upload [guest-locked]', size, phone)
          await tick()
          await sleep(300)
          await measure('/upload [guest-ticked]', size, phone)
          await chooseFile('notes.xyz', 4000)
          await sleep(500)
          await measure('/upload [guest-hint]', size, phone)
        },
      },
      {
        name: 'registered',
        session: registeredSession,
        async run(phone, size) {
          await measure('/upload [registered-locked]', size, phone)
          await tick()
          await chooseFile('biology.txt', 4000)
          await waitText('[data-testid="upload-topics"], [data-testid="upload-verdict"]', 20000)
          await sleep(400)
          await measure('/upload [registered-topics]', size, phone)
          const summoned = await cdp.eval(`(() => { const b = [...document.querySelectorAll('button')].find((x) => /summon dungeon/i.test(x.textContent)); if (b) b.click(); return !!b })()`)
          if (summoned && (await waitText('[data-testid="upload-result"]', 20000))) {
            await sleep(600)
            await measure('/upload [registered-success]', size, phone)
          }
        },
      },
      {
        name: 'quota',
        session: () => guestSession('?mockQuota=player_daily_limit'),
        async run(phone, size) {
          await measure('/upload [quota-used-up]', size, phone)
        },
      },
      {
        name: 'busy',
        session: () => guestSession('?mockAiBusy=1'),
        async run(phone, size) {
          await tick()
          await chooseFile('busy.txt', 4000)
          await waitText('[data-testid="upload-busy"]', 20000)
          await sleep(400)
          await measure('/upload [busy]', size, phone)
        },
      },
    ]
    const UPLOAD_LABELS = ['guest-locked', 'guest-ticked', 'guest-hint', 'registered-locked', 'registered-topics', 'registered-success', 'quota-used-up', 'busy'].map((n) => `/upload [${n}]`)
    const measure = async (route, size, phone) => {
      const problems = await cdp.eval(`${MEASURE}(${JSON.stringify({ phone, scrollers: SCROLLERS, decor: DECOR })})`)
      if (shotDir) {
        mkdirSync(shotDir, { recursive: true })
        const shot = await cdp.send('Page.captureScreenshot', { format: 'png' })
        const name = `${route === '/' ? 'home' : route.replace(/^\//, '').replace(/[^\w-]+/g, '_').replace(/_+$/, '')}_${size}.png`
        writeFileSync(join(shotDir, name), Buffer.from(shot.data, 'base64'))
      }
      results.push({ route, size, problems })
    }

    for (const size of sizes) {
      const [w, h] = size.split('x').map(Number)
      const phone = PHONES.has(size)
      await cdp.send('Emulation.setDeviceMetricsOverride', { width: w, height: h, deviceScaleFactor: 1, mobile: phone })
      await cdp.send('Emulation.setTouchEmulationEnabled', { enabled: phone })
      for (const route of publicRoutes) {
        const loaded = cdp.once('Page.loadEventFired')
        await cdp.send('Page.navigate', { url: base + route })
        await loaded
        await cdp.eval(`sessionStorage.clear()`).catch(() => {})
        await settle()
        await measure(route, size, phone)
      }
      if (sessionRoutes.length) {
        // Create a mock guest session through the UI, then move by client-side navigation (keeps the session).
        const ok = await guestSession('')
        for (const route of sessionRoutes) {
          if (!ok) {
            results.push({ route, size, problems: ['could not create a mock session'] })
            continue
          }
          await goto(route)
          await settle(route.startsWith('/campaign') ? 1500 : 700)
          await measure(route, size, phone)
        }
      }
      if (routes.includes('/upload')) {
        for (const sc of UPLOAD_SCENARIOS) {
          const ok = await sc.session()
          if (!ok) {
            results.push({ route: `/upload [${sc.name}]`, size, problems: ['could not create a mock session'] })
            continue
          }
          await goto('/upload')
          await settle()
          await sc.run(phone, size)
        }
      }
    }    ws.close()

    // Table: one row per route, one column per size.
    const pad = (s, n) => String(s).padEnd(n)
    const rows = routes.flatMap((r) => (r === '/upload' ? [r, ...UPLOAD_LABELS] : [r]))
    const rw = Math.max(...rows.map((r) => r.length), 5) + 2
    console.log(pad('route', rw) + sizes.map((s) => pad(s, 10)).join(''))
    for (const route of rows) {
      const cells = sizes.map((s) => {
        const r = results.find((x) => x.route === route && x.size === s)
        return pad(!r ? '-' : r.problems.length ? `FAIL(${r.problems.length})` : 'ok', 10)
      })
      console.log(pad(route, rw) + cells.join(''))
    }
    const failed = results.filter((r) => r.problems.length)
    if (failed.length) {
      console.log('\nFailures:')
      for (const f of failed) console.log(`  ${f.route} @ ${f.size}: ${f.problems.join(' | ')}`)
    }
    console.log(`\n${results.length - failed.length}/${results.length} passed`)
    process.exitCode = failed.length ? 1 : 0
  } finally {
    killTree(browser)
    killTree(vite)
    await sleep(300)
    try {
      rmSync(tmp, { recursive: true, force: true })
    } catch {
      /* temp profile may still be locked; the OS temp cleaner removes it */
    }
  }
}

main().catch((e) => {
  console.error(e.message)
  process.exit(1)
})
