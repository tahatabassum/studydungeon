import { PixelSprite } from '../components/PixelSprite'
import { CHARACTER_SPRITES, PLAYER_SPRITES } from '../art/sprites'
import type { PixelMap } from '../art/pixelMap'

export type AvatarKind = 'player' | 'ghost' | 'vampire' | 'skeleton' | 'cat' | 'portrait'

const OTHER_KINDS: readonly AvatarKind[] = ['ghost', 'vampire', 'skeleton', 'cat', 'portrait']

const SPRITE: Record<AvatarKind, PixelMap> = {
  player: PLAYER_SPRITES.player_idle,
  ghost: CHARACTER_SPRITES.friendly_ghost,
  vampire: CHARACTER_SPRITES.small_vampire,
  skeleton: CHARACTER_SPRITES.skeleton_companion,
  cat: CHARACTER_SPRITES.black_cat,
  portrait: CHARACTER_SPRITES.haunted_portrait,
}

/** Stable themed avatar for an entry: the player is the hooded mage, everyone else a spooky friend by id. */
export function avatarKind(entry: { id: string }, isMe: boolean): AvatarKind {
  if (isMe) return 'player'
  let h = 0
  for (const ch of entry.id) h = (h * 31 + (ch.codePointAt(0) ?? 0)) >>> 0
  return OTHER_KINDS[h % OTHER_KINDS.length]
}

export interface AvatarProps {
  kind: AvatarKind
  /** Outer size in px. */
  size?: number
  className?: string
}

/** Decorative code-drawn avatar on a themed disc (the name next to it carries the meaning). */
export function Avatar({ kind, size = 36, className = '' }: AvatarProps) {
  return (
    <span
      aria-hidden="true"
      data-avatar={kind}
      className={`sd-avatar sd-avatar--${kind} ${className}`.trim()}
      style={{ width: size, height: size }}
    >
      <PixelSprite map={SPRITE[kind]} width={Math.round(size * 0.78)} height={Math.round(size * 0.78)} />
    </span>
  )
}
