import { cleanup, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { CARD_H, CARD_W, renderShareCard } from './renderShareCard'
import { COPIED, IMAGE_ERROR, ShareDialog } from './ShareDialog'
import type { ShareData } from './postText'

const data: ShareData = { score: 2400, rank: 4, badges: ['first_blood', 'boss_slayer'], dungeonName: 'Operating Systems', floorRank: 'A' }

// jsdom has no canvas: a no-op 2D context records what was drawn.
const drawn: string[] = []
const ctxStub = new Proxy(
  {},
  {
    get(_t, prop: string) {
      if (prop === 'measureText') return () => ({ width: 10 })
      if (prop === 'createLinearGradient' || prop === 'createRadialGradient') return () => ({ addColorStop: () => {} })
      if (prop === 'fillText') return (text: string) => drawn.push(text)
      return () => {}
    },
    set: () => true,
  },
)
const blobBox = vi.hoisted(() => ({ blob: new Blob(['x'], { type: 'image/png' }) as Blob | null }))

beforeEach(() => {
  drawn.length = 0
  blobBox.blob = new Blob(['x'], { type: 'image/png' })
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(ctxStub as unknown as CanvasRenderingContext2D)
  vi.spyOn(HTMLCanvasElement.prototype, 'toBlob').mockImplementation((cb) => cb(blobBox.blob))
})
afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})

function setClipboard(writeText: (t: string) => Promise<void>) {
  Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true })
}

describe('renderShareCard', () => {
  it('sizes the canvas 1200x630 and draws score, rank, badges, dungeon name and the hashtag', async () => {
    const canvas = document.createElement('canvas')
    await renderShareCard(data, canvas)
    expect([canvas.width, canvas.height]).toEqual([CARD_W, CARD_H])
    expect([CARD_W, CARD_H]).toEqual([1200, 630])
    expect(drawn).toContain('2400')
    expect(drawn).toContain('#4')
    expect(drawn).toContain('Operating Systems')
    expect(drawn).toContain('First Blood')
    expect(drawn).toContain('#KiroweenHackathon26')
  })

  it('waits for the self-hosted fonts before drawing', async () => {
    const load = vi.fn().mockResolvedValue([])
    Object.defineProperty(document, 'fonts', { value: { load }, configurable: true })
    await renderShareCard(data, document.createElement('canvas'))
    const specs = load.mock.calls.map((c) => String(c[0]))
    expect(specs.some((s) => s.includes('Pirata One'))).toBe(true)
    expect(specs.some((s) => s.includes('Cinzel'))).toBe(true)
    expect(specs.some((s) => s.includes('Inter'))).toBe(true)
    Reflect.deleteProperty(document, 'fonts')
  })
})

describe('ShareDialog', () => {
  it('copies the post text, which starts with the hashtag', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined)
    const user = userEvent.setup()
    setClipboard(writeText)
    render(<ShareDialog data={data} onClose={() => {}} />)
    await user.click(screen.getByRole('button', { name: /Copy post text/ }))
    expect(String(writeText.mock.calls[0][0]).startsWith('#KiroweenHackathon26')).toBe(true)
    expect(screen.getByTestId('share-status').textContent).toBe(COPIED)
    expect(screen.queryByTestId('share-fallback')).toBeNull()
  })

  it('falls back to a readonly textarea when the clipboard write is rejected', async () => {
    const user = userEvent.setup()
    setClipboard(() => Promise.reject(new Error('denied')))
    render(<ShareDialog data={data} onClose={() => {}} />)
    await user.click(screen.getByRole('button', { name: /Copy post text/ }))
    const area = (await screen.findByTestId('share-fallback')) as HTMLTextAreaElement
    expect(area.readOnly).toBe(true)
    expect(area.value.startsWith('#KiroweenHackathon26')).toBe(true)
  })

  it('shows "Could not create the image" when toBlob returns null', async () => {
    blobBox.blob = null
    render(<ShareDialog data={data} onClose={() => {}} />)
    await userEvent.setup().click(screen.getByRole('button', { name: /Download PNG/ }))
    const alert = await screen.findByRole('alert')
    expect(alert.textContent).toBe(IMAGE_ERROR)
    expect(IMAGE_ERROR).toBe('Could not create the image')
  })

  it('downloads the PNG through an object URL', async () => {
    const create = vi.fn(() => 'blob:card')
    const revoke = vi.fn()
    Object.defineProperty(URL, 'createObjectURL', { value: create, configurable: true })
    Object.defineProperty(URL, 'revokeObjectURL', { value: revoke, configurable: true })
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {})
    render(<ShareDialog data={data} onClose={() => {}} />)
    await userEvent.setup().click(screen.getByRole('button', { name: /Download PNG/ }))
    await waitFor(() => expect(click).toHaveBeenCalled())
    expect(create).toHaveBeenCalledTimes(1)
    expect(revoke).toHaveBeenCalledWith('blob:card')
    expect(screen.queryByRole('alert')).toBeNull()
  })

  it('closes with Escape', async () => {
    const onClose = vi.fn()
    render(<ShareDialog data={data} onClose={onClose} />)
    await userEvent.setup().keyboard('{Escape}')
    expect(onClose).toHaveBeenCalled()
  })
})

// Req 15.8: the card uses no network and no remote images.
const sources = import.meta.glob(['/src/share/*.ts', '/src/share/*.tsx', '!/src/share/*.test.ts', '!/src/share/*.test.tsx'], {
  query: '?raw',
  import: 'default',
  eager: true,
}) as Record<string, string>

describe('src/share has no network and no remote images', () => {
  it('contains no http(s) URL, fetch(, XMLHttpRequest, new Image or img src', () => {
    const files = Object.keys(sources)
    expect(files.length).toBeGreaterThanOrEqual(3)
    for (const f of files) {
      const code = sources[f]
      expect(code, f).not.toMatch(/https?:|\/\/[a-z0-9.-]+\.[a-z]{2,}\//i)
      expect(code, f).not.toMatch(/\bfetch\s*\(|XMLHttpRequest|sendBeacon|WebSocket/)
      expect(code, f).not.toMatch(/new Image\b|<img\b|drawImage|\.src\s*=/)
      expect(code, f).not.toMatch(/url\(\s*['"]?(https?:)?\/\//)
    }
  })
})
