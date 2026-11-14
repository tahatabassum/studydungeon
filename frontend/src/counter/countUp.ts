export const COUNT_UP_MS = 800

/** The displayed number at time `t` ms: an integer from 0 to target, non-decreasing, exact at the end. */
export function countUpValue(t: number, duration: number, target: number, reduced: boolean): number {
  if (reduced || !(duration > 0) || t >= duration) return target
  if (!(t > 0)) return 0
  return Math.min(target, Math.floor((t / duration) * target))
}
