import { describe, expect, it } from 'vitest'
import type Phaser from 'phaser'
import { ROOM_TEXTURE_BYTES, RoomBaker } from './RoomBaker'
import { THEMES } from '../world/roomTheme'

/** Minimal scene stand-in that records textures and images; the recording 2D context accepts any draw call. */
function fakeScene(failCanvas = false): Pick<Phaser.Scene, 'textures' | 'add'> {
  const keys = new Set<string>()
  const ctx = new Proxy({} as Record<string, unknown>, {
    get: (t, p: string) =>
      p in t
        ? t[p]
        : p.startsWith('create')
          ? () => ({ addColorStop: () => undefined })
          : () => undefined,
    set: (t, p: string, v) => {
      t[p] = v
      return true
    },
  })
  const scene = {
    textures: {
      exists: (k: string) => keys.has(k),
      remove: (k: string) => keys.delete(k),
      createCanvas: (k: string) => {
        if (failCanvas) return null
        keys.add(k)
        return { getContext: () => ctx, refresh: () => undefined }
      },
    },
    add: {
      image: () => {
        const img = { setOrigin: () => img, setDepth: () => img, destroy: () => undefined }
        return img
      },
    },
  }
  return scene as unknown as Pick<Phaser.Scene, 'textures' | 'add'>
}

const opts = { exitGap: true, entryGap: false }
const origin = { x: 0, y: 0 }

describe('RoomBaker', () => {
  it('reports 3.9 MiB per baked room and release lowers the total', () => {
    const baker = new RoomBaker(fakeScene())
    expect(baker.estimatedBytes()).toBe(0)
    for (const id of ['a', 'b', 'c']) expect(baker.bake(id, THEMES.clockwork_crypt, origin, opts)).not.toBeNull()
    expect(baker.estimatedBytes()).toBe(3 * ROOM_TEXTURE_BYTES)
    expect(ROOM_TEXTURE_BYTES / 1024 / 1024).toBeCloseTo(3.9, 1)
    baker.release('a')
    expect(baker.estimatedBytes()).toBe(2 * ROOM_TEXTURE_BYTES)
    baker.releaseAll()
    expect(baker.estimatedBytes()).toBe(0)
  })

  it('baking the same room twice does not add memory', () => {
    const baker = new RoomBaker(fakeScene())
    baker.bake('a', THEMES.entry, origin, opts)
    baker.bake('a', THEMES.entry, origin, opts)
    expect(baker.estimatedBytes()).toBe(ROOM_TEXTURE_BYTES)
  })

  it('returns null without throwing when the canvas is unavailable', () => {
    const baker = new RoomBaker(fakeScene(true))
    expect(baker.bake('a', THEMES.entry, origin, opts)).toBeNull()
    expect(baker.estimatedBytes()).toBe(0)
  })
})
