const nf = new Intl.NumberFormat('en-US')

/**
 * D21: the title-screen line. Null unless `n` is an integer of 1 or more. 1 to 9 players: no number is shown.
 * 10 or more: the exact count, en-US grouped. Nothing is invented, offset or rounded.
 */
export function formatExplorerLine(n: unknown): string | null {
  if (typeof n !== 'number' || !Number.isInteger(n) || n < 1) return null
  if (n < 10) return 'Be among the first explorers'
  return `${nf.format(n)} explorers have braved the dungeon`
}

/** Secondary text helper: "1 explorer" for 1, "N explorers" otherwise. */
export function explorerCountText(n: number): string {
  return `${nf.format(n)} ${n === 1 ? 'explorer' : 'explorers'}`
}
