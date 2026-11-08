import type { AnswerResult } from '../types/api'

/**
 * Demo_Rules: agreed demo balance values, used ONLY by the mock/offline path.
 * The backend is authoritative for all game outcomes; Phaser and React
 * components must never import this module.
 */

export interface RulesState {
  playerHp: number
  monsterHp: number
  streak: number
}

export const MAX_PLAYER_HP = 100
/** Legacy default for INITIAL_STATE only. Demo rooms use the HP in demoDungeon.json (80, 90, 85, 85, 220). */
export const MAX_MONSTER_HP = 60
/** Rusty Dagger base damage (C13). Other weapons: see src/weapons/weapons.ts. */
export const WEAPON_DAMAGE = 20
/** Real balance (C12): hard questions x1.25, critical hits x1.5. */
export const HARD_MULTIPLIER = 1.25
export const CRIT_MULTIPLIER = 1.5
/** A correct answer is critical when the streak before it is at least this (the third in a row). */
export const CRIT_AFTER_STREAK = 2

/** Round half to even, like the backend (Python `round`), so mock damage matches exactly. */
export function roundHalfEven(x: number): number {
  const floor = Math.floor(x)
  const diff = x - floor
  if (diff < 0.5) return floor
  if (diff > 0.5) return floor + 1
  return floor % 2 === 0 ? floor : floor + 1
}

/** Damage of one correct strike: base, then hard (x1.25), then critical (x1.5), rounded half to even. */
export function strikeDamage(baseDamage: number, hard: boolean, critical: boolean): number {
  let damage = baseDamage
  if (hard) damage *= HARD_MULTIPLIER
  if (critical) damage *= CRIT_MULTIPLIER
  return roundHalfEven(damage)
}
export const WRONG_ANSWER_DAMAGE = 10
export const CORRECT_SCORE = 100
export const CORRECT_XP = 10

/** Per-encounter damage values. Room monsters and the boss differ on wrong answers. */
export interface RulesProfile {
  weaponDamage: number
  wrongAnswerDamage: number
}

export const ROOM_PROFILE: RulesProfile = Object.freeze({
  weaponDamage: WEAPON_DAMAGE,
  wrongAnswerDamage: WRONG_ANSWER_DAMAGE,
})

export const BOSS_PROFILE: RulesProfile = Object.freeze({
  weaponDamage: 20,
  wrongAnswerDamage: 12,
})

export const INITIAL_STATE: RulesState = Object.freeze({
  playerHp: MAX_PLAYER_HP,
  monsterHp: MAX_MONSTER_HP,
  streak: 0,
})

const clamp = (value: number, min: number, max: number): number =>
  Math.min(max, Math.max(min, value))

/** Pure: returns a new state and result without mutating the input. */
export function applyAnswer(
  state: RulesState,
  correct: boolean,
  profile: RulesProfile = ROOM_PROFILE,
): { next: RulesState; result: Omit<AnswerResult, 'source' | 'explanation'> } {
  const playerHp = clamp(state.playerHp, 0, MAX_PLAYER_HP)
  // The profile carries no max HP (it comes from the dungeon data): the caller owns the
  // upper bound, so only the lower bound is enforced here.
  const monsterHp = Math.max(0, state.monsterHp)

  if (correct) {
    const damage = Math.min(profile.weaponDamage, monsterHp)
    const next: RulesState = {
      playerHp,
      monsterHp: monsterHp - damage,
      streak: state.streak + 1,
    }
    return {
      next,
      result: {
        correct: true,
        damage_dealt: damage,
        monster_hp_remaining: next.monsterHp,
        player_hp_remaining: next.playerHp,
        score_delta: CORRECT_SCORE,
        xp_delta: CORRECT_XP,
        streak: next.streak,
        review_status: 'not_due',
      },
    }
  }

  const playerDamage = Math.min(profile.wrongAnswerDamage, playerHp)
  const next: RulesState = {
    playerHp: playerHp - playerDamage,
    monsterHp,
    streak: 0,
  }
  return {
    next,
    result: {
      correct: false,
      damage_dealt: 0,
      monster_hp_remaining: next.monsterHp,
      player_hp_remaining: next.playerHp,
      score_delta: 0,
      xp_delta: 0,
      streak: 0,
      review_status: 'due',
    },
  }
}
