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
export const MAX_MONSTER_HP = 60
export const WEAPON_DAMAGE = 20
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
  // The profile carries no max HP (room 60, boss 120): the caller owns the
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
