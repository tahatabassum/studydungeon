import { describe, expect, it, vi } from 'vitest'
import fc from 'fast-check'
import { chooseHeroCta, type ChooseHeroCtaInput } from './heroCta'
import type { PlayTarget } from '../campaign/floorLayout'

const floorTarget = { type: 'floor', floor: { id: 'f 1', index: 1, title: 'Crypt' }, index: 0 } as unknown as PlayTarget
const finalTarget = { type: 'final', boss: { id: 'b1', name: 'Lich' }, index: 3 } as unknown as PlayTarget

const base = (over: Partial<ChooseHeroCtaInput> = {}): ChooseHeroCtaInput => ({
  isGuest: false,
  demoPending: false,
  dungeonId: 'd1',
  dungeon: { status: 'ready', next: null },
  onPlayDemo: () => {},
  ...over,
})

describe('chooseHeroCta', () => {
  it('guest gets Play the Demo and forwards pending/onClick', () => {
    const onPlayDemo = vi.fn()
    const cta = chooseHeroCta(base({ isGuest: true, demoPending: true, onPlayDemo, dailyHauntSlot: 'x', dungeon: { status: 'ready', next: floorTarget } }))
    expect(cta).toMatchObject({ kind: 'play-demo', label: 'Play the Demo', pending: true })
    if (cta.kind === 'play-demo') cta.onClick()
    expect(onPlayDemo).toHaveBeenCalledOnce()
  })

  it('player with a next floor continues to the encoded play route', () => {
    expect(chooseHeroCta(base({ dungeon: { status: 'ready', next: floorTarget }, dailyHauntSlot: 'x' }))).toEqual({
      kind: 'continue',
      to: '/campaign/d1/play/f%201',
      label: 'Continue the Dungeon',
    })
  })

  it('player with the final boss next continues to the boss', () => {
    const cta = chooseHeroCta(base({ dungeon: { status: 'ready', next: finalTarget } }))
    expect(cta).toMatchObject({ kind: 'continue', to: '/campaign/d1/play/b1' })
  })

  it('shows loading while the dungeon loads', () => {
    expect(chooseHeroCta(base({ dungeon: { status: 'loading', next: null }, dailyHauntSlot: 'x' }))).toEqual({ kind: 'loading' })
  })

  it('uses the Daily Haunt slot when there is no next floor', () => {
    expect(chooseHeroCta(base({ dailyHauntSlot: 'haunt' }))).toEqual({ kind: 'daily-haunt', slot: 'haunt' })
  })

  it('falls back to Play the Demo with no dungeon, next floor or slot', () => {
    expect(chooseHeroCta(base({ dungeonId: null, dungeon: { status: 'idle', next: null } })).kind).toBe('play-demo')
  })

  it('always yields exactly one known kind', () => {
    fc.assert(
      fc.property(
        fc.boolean(),
        fc.boolean(),
        fc.option(fc.constant('d1'), { nil: null }),
        fc.constantFrom('idle', 'loading', 'ready', 'error' as const),
        fc.option(fc.constantFrom(floorTarget, finalTarget), { nil: null }),
        fc.boolean(),
        (isGuest, demoPending, dungeonId, status, next, slot) => {
          const cta = chooseHeroCta(
            base({ isGuest, demoPending, dungeonId, dungeon: { status: status as 'idle', next }, dailyHauntSlot: slot ? 'h' : undefined }),
          )
          expect(['continue', 'daily-haunt', 'play-demo', 'loading']).toContain(cta.kind)
          if (isGuest) expect(cta.kind).toBe('play-demo')
        },
      ),
    )
  })
})
