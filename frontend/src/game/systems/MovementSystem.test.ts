// Feature: frontend-00-playable-slice (regression: addKeys property-name mismatch)
import { describe, expect, it, vi } from 'vitest'

vi.mock('phaser', () => ({
  default: {
    Input: {
      Keyboard: {
        KeyCodes: { W: 87, A: 65, S: 83, D: 68, UP: 38, DOWN: 40, LEFT: 37, RIGHT: 39, SPACE: 32 },
      },
    },
  },
}))

import { MovementSystem, PLAYER_SPEED } from './MovementSystem'

interface FakeKey {
  isDown: boolean
}

/** Mirrors Phaser KeyboardPlugin.addKeys: string -> keyed by the strings, object -> keyed by its names. */
function fakeAddKeys(keys: string | Record<string, number>): Record<string, FakeKey> {
  const out: Record<string, FakeKey> = {}
  if (typeof keys === 'string') {
    for (const k of keys.split(',')) if (k.trim()) out[k.trim()] = { isDown: false }
  } else {
    for (const k in keys) out[k] = { isDown: false }
  }
  return out
}

function setup(exploring: boolean) {
  let created: Record<string, FakeKey> = {}
  const keyboard = {
    addKeys: (k: string | Record<string, number>) => (created = fakeAddKeys(k)),
    addCapture: vi.fn(),
    removeCapture: vi.fn(),
    removeKey: vi.fn(),
  }
  const scene = { input: { keyboard }, physics: { add: { collider: vi.fn(() => ({ destroy: vi.fn() })) } } }
  const player = { body: {}, setVelocity: vi.fn(), tick: vi.fn() }
  const sys = new MovementSystem(
    scene as never,
    player as never,
    () => exploring,
    [],
  )
  return { sys, player, keys: () => created }
}

describe('MovementSystem', () => {
  it('does not throw on update and reads keys by lowercase names', () => {
    const { sys, player } = setup(true)
    expect(() => sys.update(0)).not.toThrow()
    expect(player.setVelocity).toHaveBeenCalledWith(0, 0)
  })

  it('moves diagonally normalized when W and D are down', () => {
    const { sys, player, keys } = setup(true)
    keys().w.isDown = true
    keys().d.isDown = true
    sys.update(0)
    const s = PLAYER_SPEED * Math.SQRT1_2
    const [x, y] = player.setVelocity.mock.calls[0] as [number, number]
    expect(x).toBeCloseTo(s)
    expect(y).toBeCloseTo(-s)
  })

  it('moves with the touch vector at the same speed scale, and the keyboard wins when pressed', () => {
    const { sys, player, keys } = setup(true)
    sys.setTouchVector(0.5, 0)
    sys.update(0)
    expect(player.setVelocity).toHaveBeenLastCalledWith(PLAYER_SPEED * 0.5, 0)
    sys.setTouchVector(3, 4) // a vector over length 1 is clamped, never faster than the keyboard
    sys.update(0)
    const [x, y] = player.setVelocity.mock.calls.at(-1) as [number, number]
    expect(Math.hypot(x, y)).toBeCloseTo(PLAYER_SPEED)
    keys().a.isDown = true
    sys.update(0)
    expect(player.setVelocity).toHaveBeenLastCalledWith(-PLAYER_SPEED, 0)
    keys().a.isDown = false
    sys.setTouchVector(0, 0)
    sys.update(0)
    expect(player.setVelocity).toHaveBeenLastCalledWith(0, 0)
  })

  it('ignores the touch vector when not exploring', () => {
    const { sys, player } = setup(false)
    sys.setTouchVector(1, 0)
    sys.update(0)
    expect(player.setVelocity).toHaveBeenLastCalledWith(0, 0)
  })

  it('zeroes velocity when not exploring', () => {
    const { sys, player, keys } = setup(false)
    keys().w.isDown = true
    sys.update(0)
    expect(player.setVelocity).toHaveBeenCalledWith(0, 0)
  })
})
