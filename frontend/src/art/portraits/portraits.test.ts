import { describe, expect, it } from 'vitest'
import { PORTRAITS, PORTRAIT_KINDS, POSES, portraitFor } from './index'

/** A recording canvas stub: every method is a no-op that returns a chainable stub (gradients etc.). */
function stubCtx(): { ctx: CanvasRenderingContext2D; calls: string[] } {
  const calls: string[] = []
  const make = (): unknown =>
    new Proxy(function () {}, {
      get: (_t, prop) => {
        if (prop === 'then') return undefined
        return (...args: unknown[]) => {
          void args
          calls.push(String(prop))
          return make()
        }
      },
      set: () => true,
      apply: () => make(),
    })
  const ctx = new Proxy(
    {},
    {
      get: (_t, prop) => (...args: unknown[]) => {
        void args
        calls.push(String(prop))
        return make()
      },
      set: () => true,
    },
  )
  return { ctx: ctx as CanvasRenderingContext2D, calls }
}

describe('portraits', () => {
  it('registers all 6 characters', () => {
    expect([...PORTRAIT_KINDS].sort()).toEqual(['ghost', 'golem', 'skeleton', 'vampire', 'warden', 'witch'])
    for (const k of PORTRAIT_KINDS) expect(typeof PORTRAITS[k]).toBe('function')
  })

  it.each(PORTRAIT_KINDS.flatMap((k) => POSES.map((p) => [k, p] as const)))('draws %s in the %s pose', (kind, pose) => {
    const { ctx, calls } = stubCtx()
    expect(() => PORTRAITS[kind](ctx, pose)).not.toThrow()
    expect(calls.length).toBeGreaterThan(20)
    expect(calls).toContain('clearRect')
  })

  it('falls back to the Skeleton for an unknown kind', () => {
    expect(portraitFor('mystery_meat')).toBe('skeleton')
  })

  it('maps the demo monster kinds to the specified characters', () => {
    expect([
      portraitFor('paper_wraith'),
      portraitFor('toxic_slime'),
      portraitFor('gear_golem'),
      portraitFor('memory_eater'),
      portraitFor('exam_warden'),
    ]).toEqual(['ghost', 'witch', 'golem', 'vampire', 'warden'])
  })
})
