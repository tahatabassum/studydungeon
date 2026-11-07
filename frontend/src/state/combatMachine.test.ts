import { describe, expect, it } from 'vitest'
import type { AnswerResult } from '@/types/api'
import {
  READ_DELAY_CORRECT_MS,
  READ_DELAY_WRONG_MS,
  canAnswer,
  canRetreat,
  damageReceived,
  isCombatActive,
  readDelayMs,
  type CombatState,
} from './combatMachine'

const ALL: CombatState[] = [
  'starting',
  'question',
  'submitting',
  'result',
  'next',
  'monster_defeated',
  'player_defeated',
  'exited',
]

const res = (hp: number) => ({ player_hp_remaining: hp }) as AnswerResult

describe('combatMachine helpers', () => {
  it('readDelayMs', () => {
    expect(READ_DELAY_CORRECT_MS).toBe(1200)
    expect(READ_DELAY_WRONG_MS).toBe(2000)
    expect(readDelayMs(true)).toBe(1200)
    expect(readDelayMs(false)).toBe(2000)
  })

  it('isCombatActive is false only for null and exited', () => {
    expect(isCombatActive(null)).toBe(false)
    expect(isCombatActive('exited')).toBe(false)
    for (const s of ALL.filter((x) => x !== 'exited')) expect(isCombatActive(s)).toBe(true)
  })

  it('canRetreat and canAnswer are true only for question', () => {
    expect(canRetreat(null)).toBe(false)
    expect(canAnswer(null)).toBe(false)
    for (const s of ALL) {
      expect(canRetreat(s)).toBe(s === 'question')
      expect(canAnswer(s)).toBe(s === 'question')
    }
  })

  it('damageReceived', () => {
    expect(damageReceived(100, res(80))).toBe(20)
    expect(damageReceived(100, res(100))).toBe(0)
    expect(damageReceived(50, res(70))).toBe(0)
  })
})
