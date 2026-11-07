import type Phaser from 'phaser'
import { animKey, deriveFrames, frameName, type FrameKind } from '@/art/frames'
import { pixelMapToRgba, validatePixelMap, type PixelMap } from '@/art/pixelMap'
import { DECOR_SPRITES, MONSTER_SPRITES, PLAYER_SPRITES } from '@/art/sprites'

/** Integer texture upscale for the player (keeps physics body in world px). */
export const PLAYER_TEXTURE_SCALE = 2
/** Integer texture upscale for decor. */
export const DECOR_TEXTURE_SCALE = 2

/** Dark outline (night base) that separates the player silhouette from the floor. */
const PLAYER_OUTLINE = 0x0c0912

const PLAYER_BASE = 'player_idle'
export const PLAYER_IDLE_TEXTURE = frameName(PLAYER_BASE, 'idle', 0)
export const PLAYER_IDLE_ANIM = animKey(PLAYER_BASE, 'idle')
export const PLAYER_WALK_ANIM = animKey(PLAYER_BASE, 'walk')

export const MONSTER_FRAME_KINDS: readonly FrameKind[] = ['idle', 'attack', 'hit', 'death']

const FRAME_RATE: Record<FrameKind, number> = { idle: 2, attack: 12, hit: 12, death: 8, walk: 8 }

export interface TextureSpec {
  key: string
  map: PixelMap
  scale: number
  allowLarge: boolean
  /** Optional 0xRRGGBB outline drawn around solid pixels (inside the existing bounds). */
  outline?: number
}
export interface AnimSpec {
  key: string
  textures: string[]
  frameRate: number
  repeat: number
}
export interface ArtPlan {
  textures: TextureSpec[]
  anims: AnimSpec[]
}

function framesPlan(
  plan: ArtPlan,
  base: PixelMap,
  kind: FrameKind,
  scale: number,
  outline?: number,
): void {
  const frames = deriveFrames(base, kind)
  for (const map of frames) {
    plan.textures.push({ key: map.name, map, scale, allowLarge: true, ...(outline === undefined ? {} : { outline }) })
  }
  plan.anims.push({
    key: animKey(base.name, kind),
    textures: frames.map((f) => f.name),
    frameRate: FRAME_RATE[kind],
    repeat: kind === 'idle' || kind === 'walk' ? -1 : 0,
  })
}

/** Pure description of every texture and animation to register at boot. */
export function buildArtPlan(): ArtPlan {
  const plan: ArtPlan = { textures: [], anims: [] }
  for (const base of Object.values(MONSTER_SPRITES)) {
    for (const kind of MONSTER_FRAME_KINDS) framesPlan(plan, base, kind, 1)
  }
  const player = PLAYER_SPRITES[PLAYER_BASE]
  framesPlan(plan, player, 'idle', PLAYER_TEXTURE_SCALE, PLAYER_OUTLINE)
  framesPlan(plan, player, 'walk', PLAYER_TEXTURE_SCALE, PLAYER_OUTLINE)
  for (const map of Object.values(DECOR_SPRITES)) {
    plan.textures.push({ key: map.name, map, scale: DECOR_TEXTURE_SCALE, allowLarge: false })
  }
  return plan
}

/** True when any 4-neighbour of (x, y) is a visible pixel. Pure. */
export function touchesSolid(rgba: ArrayLike<number>, width: number, height: number, x: number, y: number): boolean {
  const solid = (nx: number, ny: number): boolean =>
    nx >= 0 && ny >= 0 && nx < width && ny < height && rgba[(ny * width + nx) * 4 + 3] > 0
  return solid(x - 1, y) || solid(x + 1, y) || solid(x, y - 1) || solid(x, y + 1)
}

function addPlaceholder(scene: Phaser.Scene, key: string): void {
  const tex = scene.textures.createCanvas(key, 1, 1)
  if (!tex) return
  const ctx = tex.getContext()
  ctx.fillStyle = '#C83E4D'
  ctx.fillRect(0, 0, 1, 1)
  tex.refresh()
}

function addTexture(scene: Phaser.Scene, spec: TextureSpec): void {
  const errors = validatePixelMap(spec.map, spec.allowLarge)
  if (errors.length > 0) {
    console.error(`registerArt: invalid pixel map '${spec.map.name}': ${errors[0]}`)
    addPlaceholder(scene, spec.key)
    return
  }
  const { width, height } = spec.map
  const s = spec.scale
  const w = width * s
  const h = height * s
  const tex = scene.textures.createCanvas(spec.key, w, h)
  if (!tex) return
  const ctx = tex.getContext()
  const image = ctx.createImageData(w, h)
  const rgba = pixelMapToRgba(spec.map)
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const src = (y * width + x) * 4
      let r = rgba[src]
      let g = rgba[src + 1]
      let b = rgba[src + 2]
      if (rgba[src + 3] === 0) {
        // Transparent pixel touching a solid one becomes a 1 map-pixel dark outline.
        if (spec.outline === undefined || !touchesSolid(rgba, width, height, x, y)) continue
        r = (spec.outline >> 16) & 255
        g = (spec.outline >> 8) & 255
        b = spec.outline & 255
      }
      for (let sy = 0; sy < s; sy++) {
        for (let sx = 0; sx < s; sx++) {
          const dst = ((y * s + sy) * w + (x * s + sx)) * 4
          image.data[dst] = r
          image.data[dst + 1] = g
          image.data[dst + 2] = b
          image.data[dst + 3] = 255
        }
      }
    }
  }
  ctx.putImageData(image, 0, 0)
  tex.refresh()
}

/**
 * Renders all pixel maps to canvas textures (once, at boot) and creates the
 * animations. Existing keys are skipped, so calling it again is safe.
 */
export function registerArt(scene: Phaser.Scene, plan: ArtPlan = buildArtPlan()): void {
  for (const spec of plan.textures) {
    if (scene.textures.exists(spec.key)) continue
    addTexture(scene, spec)
  }
  for (const anim of plan.anims) {
    if (scene.anims.exists(anim.key)) continue
    scene.anims.create({
      key: anim.key,
      frames: anim.textures.map((key) => ({ key })),
      frameRate: anim.frameRate,
      repeat: anim.repeat,
    })
  }
}
