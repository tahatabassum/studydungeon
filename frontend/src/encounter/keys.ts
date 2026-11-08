/** Maps a pressed key ("1".."9") to the option it selects, or null for any other key. */
export function keyToOption(key: string, options: readonly string[]): string | null {
  if (!/^[1-9]$/.test(key)) return null
  const k = Number(key)
  return k <= options.length ? options[k - 1] : null
}
