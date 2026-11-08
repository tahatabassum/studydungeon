import { describe, expect, it } from 'vitest'
import { drawRoom } from './index'
import { THEMES, THEME_IDS } from '@/game/world/roomTheme'
import { hashString } from './rng'

/** Recording 2D context: every method call is logged, gradients are stubs, props are assignable. */
function recorder(): { ctx: CanvasRenderingContext2D; log: string[] } {
  const log: string[] = []
  const gradient = { addColorStop: (o: number, c: string) => log.push(`stop ${o} ${c}`) }
  const store: Record<string, unknown> = {}
  const ctx = new Proxy(store, {
    get(target, prop: string) {
      if (prop in target) return target[prop]
      if (prop === 'createRadialGradient' || prop === 'createLinearGradient') {
        return (...a: number[]) => {
          log.push(`${prop} ${a.join(',')}`)
          return gradient
        }
      }
      return (...a: unknown[]) => {
        log.push(`${prop} ${a.join(',')}`)
      }
    },
    set(target, prop: string, value: unknown) {
      target[prop] = value
      log.push(`set ${prop} ${String(value)}`)
      return true
    },
  }) as unknown as CanvasRenderingContext2D
  return { ctx, log }
}

function render(id: (typeof THEME_IDS)[number], seed: number): string[] {
  const { ctx, log } = recorder()
  drawRoom(ctx, THEMES[id], { seed, exitGap: true, entryGap: true })
  return log
}

describe('procedural room generators', () => {
  it.each(THEME_IDS)('%s draws without throwing and issues draw calls', (id) => {
    expect(render(id, 7).length).toBeGreaterThan(100)
  })

  it('is deterministic for the same seed and differs for another seed', () => {
    const a = render('clockwork_crypt', hashString('room-1')).join('\n')
    const b = render('clockwork_crypt', hashString('room-1')).join('\n')
    const c = render('clockwork_crypt', hashString('room-2')).join('\n')
    expect(a).toBe(b)
    expect(a).not.toBe(c)
  })

  it.each(['library', 'witch_lab', 'pumpkin_workshop', 'boss_hall'] as const)(
    '%s adds its own dressing beyond the shared floor and walls',
    (id) => {
      const own = render(id, 3)
      expect(own.length).toBeGreaterThan(render('entry', 3).length + 100)
      expect(own.join('\n')).toBe(render(id, 3).join('\n'))
      expect(own.join('\n')).not.toBe(render('clockwork_crypt', 3).join('\n'))
    },
  )

  it('the crypt adds dressing beyond the shared floor and walls', () => {
    expect(render('clockwork_crypt', 1).length).toBeGreaterThan(render('entry', 1).length)
  })
})
