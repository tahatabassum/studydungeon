import { describe, expect, it } from 'vitest'
import { BOSS_SCALE, MONSTER_SCALE, getMonsterStyle } from './monsterStyles'
import { COLORS } from '../colors'
import { MONSTER_SPRITES } from '@/art/sprites'

const ROOM_KINDS = ['paper_wraith', 'toxic_slime', 'gear_golem', 'memory_eater'] as const

describe('getMonsterStyle', () => {
  it('returns the defined style for each known room kind', () => {
    expect(getMonsterStyle('paper_wraith', false)).toMatchObject({
      sprite: 'paper_wraith',
      texture: 'paper_wraith_idle_0',
      aura: COLORS.MAGIC,
      scale: MONSTER_SCALE,
    })
    expect(getMonsterStyle('toxic_slime', false)).toMatchObject({ sprite: 'toxic_slime', aura: 0x4fbf5a })
    expect(getMonsterStyle('gear_golem', false)).toMatchObject({ sprite: 'gear_golem', aura: COLORS.ACCENT })
    expect(getMonsterStyle('memory_eater', false)).toMatchObject({ sprite: 'memory_eater', aura: 0x3fa7c9 })
  })

  it('gives the four room kinds distinct sprites, textures and auras', () => {
    const styles = ROOM_KINDS.map((k) => getMonsterStyle(k, false))
    expect(new Set(styles.map((s) => s.texture)).size).toBe(4)
    expect(new Set(styles.map((s) => s.aura)).size).toBe(4)
  })

  it('exposes animation keys for idle, attack, hit and death', () => {
    expect(getMonsterStyle('gear_golem', false).anims).toEqual({
      idle: 'gear_golem:idle',
      attack: 'gear_golem:attack',
      hit: 'gear_golem:hit',
      death: 'gear_golem:death',
    })
  })

  it('every style points to a registered monster sprite', () => {
    for (const k of [...ROOM_KINDS, 'unknown']) {
      expect(MONSTER_SPRITES[getMonsterStyle(k, false).sprite]).toBeDefined()
    }
    expect(MONSTER_SPRITES[getMonsterStyle('x', true).sprite]).toBeDefined()
  })

  it('falls back to the default style for unknown or undefined kinds', () => {
    const a = getMonsterStyle('does_not_exist', false)
    const b = getMonsterStyle(undefined, false)
    expect(a).toEqual(b)
    expect(a.sprite).toBe('paper_wraith')
    expect(a.scale).toBe(MONSTER_SCALE)
    expect(getMonsterStyle('toString', false)).toEqual(a)
  })

  it('boss style is distinct from all room styles and uses the large boss scale', () => {
    const boss = getMonsterStyle('paper_wraith', true)
    expect(boss.scale).toBe(BOSS_SCALE)
    expect(BOSS_SCALE).toBeGreaterThanOrEqual(2.5)
    expect(BOSS_SCALE).toBeLessThanOrEqual(3)
    expect(boss.sprite).toBe('exam_warden')
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
    expect(s.scale).toBe(MONSTER_SCALE)
    expect(s).not.toEqual(getMonsterStyle('exam_warden', true))
  })
})
