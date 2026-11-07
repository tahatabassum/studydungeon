import { describe, expect, it } from 'vitest'
import { buildDungeonLayout, roomAt } from './DungeonLayout'

describe('buildDungeonLayout', () => {
  it('rejects empty and duplicate order', () => {
    expect(buildDungeonLayout([])).toEqual({ ok: false, error: 'empty' })
    const dup = buildDungeonLayout([{ id: 'a', order: 1 }, { id: 'b', order: 1 }])
    expect(dup).toEqual({ ok: false, error: 'duplicate-order' })
  })

  it('stacks rooms by order with n-1 gates and spawn in first room', () => {
    const r = buildDungeonLayout([
      { id: 'b', order: 2, is_boss: true },
      { id: 'a', order: 1 },
    ])
    if (!r.ok) throw new Error('expected ok')
    expect(r.layout.rooms.map((x) => x.id)).toEqual(['a', 'b'])
    expect(r.layout.gates).toHaveLength(1)
    expect(r.layout.world.h).toBe(1600)
    expect(roomAt(r.layout, r.layout.spawn)).toBe('a')
    expect(roomAt(r.layout, { x: 10, y: 10 })).toBe('b')
    expect(roomAt(r.layout, { x: 10, y: 1600 })).toBeNull()
  })
})
