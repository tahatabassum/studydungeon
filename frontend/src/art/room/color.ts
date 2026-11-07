/** Pure color helpers for the procedural room generators. */

/** 0xRRGGBB to '#rrggbb'. */
export function hex(n: number): string {
  return `#${(n & 0xffffff).toString(16).padStart(6, '0')}`
}

/** 0xRRGGBB to 'rgba(r,g,b,a)'. */
export function rgba(n: number, a: number): string {
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`
}

/** Multiply every channel by f (f < 1 darkens, f > 1 lightens), clamped. */
export function shade(n: number, f: number): number {
  const c = (v: number): number => Math.max(0, Math.min(255, Math.round(v * f)))
  return (c((n >> 16) & 255) << 16) | (c((n >> 8) & 255) << 8) | c(n & 255)
}
