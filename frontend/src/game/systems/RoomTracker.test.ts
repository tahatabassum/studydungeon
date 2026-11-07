import { describe, expect, it } from 'vitest'
import { buildDungeonLayout } from '../world/DungeonLayout'
import { nextRoomEvent } from './roomTracking'

const res = buildDungeonLayout([
  { id: 'a', order: 1 },
  { id: 'b', order: 2 },
])
if (!res.ok) throw new Error('layout')
const layout = res.layout
const inA = layout.spawn
const inB = { x: 100, y: 100 }

describe('nextRoomEvent', () => {
  it('emits the starting room on first update', () => {
    expect(nextRoomEvent(null, inA, layout)).toBe('a')
  })
  it('emits nothing while staying in the same room', () => {
    expect(nextRoomEvent('a', inA, layout)).toBeNull()
  })
  it('emits the new room on change', () => {
    expect(nextRoomEvent('a', inB, layout)).toBe('b')
  })
  it('emits nothing outside the world', () => {
    expect(nextRoomEvent('a', { x: -50, y: -50 }, layout)).toBeNull()
  })
})
