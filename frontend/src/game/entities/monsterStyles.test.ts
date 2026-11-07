import { describe, expect, it } from 'vitest'
import { BOSS_SCALE, getMonsterStyle } from './monsterStyles'
import { COLORS } from '../colors'

const ROOM_KINDS = ['paper_wraith', 'toxic_slime', 'gear_golem', 'memory_eater'] as const

describe('getMonsterStyle', () => {
  it('returns the defined style for each known room kind', () => {
    expect(getMonsterStyle('paper_wraith', false)).toMatchObject({ texture: 'monster', aura: COLORS.MAGIC, scale: 1 })
    expect(getMonsterStyle('toxic_slime', false)).toMatchObject({ texture: 'monster-slime', aura: 0x4fbf5a, scale: 1 })
    expect(getMonsterStyle('gear_golem', false)).toMatchObject({ texture: 'monster-gear', aura: COLORS.ACCENT, scale: 1 })
    expect(getMonsterStyle('memory_eater', false)).toMatchObject({ texture: 'monster-eater', aura: 0x3fa7c9, scale: 1 })
  })

  it('gives the four room kinds distinct textures and auras', () => {
    const styles = ROOM_KINDS.map((k) => getMonsterStyle(k, false))
    expect(new Set(styles.map((s) => s.texture)).size).toBe(4)
    expect(new Set(styles.map((s) => s.aura)).size).toBe(4)
  })

  it('falls back to the default style for unknown or undefined kinds', () => {
    const a = getMonsterStyle('does_not_exist', false)
    const b = getMonsterStyle(undefined, false)
    expect(a).toEqual(b)
    expect(a.texture).toBe('monster')
    expect(a.scale).toBe(1)
    expect(getMonsterStyle('toString', false)).toEqual(a)
  })

  it('boss style is distinct from all room styles and uses the boss scale', () => {
    const boss = getMonsterStyle('paper_wraith', true)
    expect(boss.scale).toBe(1.8)
    expect(BOSS_SCALE).toBe(1.8)
    for (const k of [...ROOM_KINDS, 'unknown']) {
      const s = getMonsterStyle(k, false)
      expect(boss).not.toEqual(s)
      expect(boss.aura).not.toBe(s.aura)
    }
  })

  it('boss look is independent of kind', () => {
    expect(getMonsterStyle(undefined, true)).toEqual(getMonsterStyle('exam_warden', true))
  })

  it('non-boss exam_warden does not get the boss scale', () => {
    const s = getMonsterStyle('exam_warden', false)
    expect(s.scale).toBe(1)
    expect(s).not.toEqual(getMonsterStyle('exam_warden', true))
  })
})
