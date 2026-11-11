/**
 * D32: friendly spooky default names. Pure, no network.
 * Entries are ASCII letters only, at most 7 letters, so "Adjective Creature" is at most 15 characters.
 * The lists avoid substrings the Backend moderation refuses (for example "mod" or "root").
 */
export const SPOOKY_ADJECTIVES: readonly string[] = Object.freeze([
  'Hollow',
  'Velvet',
  'Pale',
  'Ashen',
  'Gloomy',
  'Dusky',
  'Wicked',
  'Silent',
  'Eerie',
  'Cursed',
  'Faded',
  'Grim',
  'Haunted',
  'Misty',
  'Murky',
  'Shady',
  'Spooky',
  'Sullen',
  'Twisted',
  'Wailing',
  'Wilted',
  'Frosty',
  'Moonlit',
  'Bitter',
])

export const SPOOKY_CREATURES: readonly string[] = Object.freeze([
  'Raven',
  'Wraith',
  'Ghoul',
  'Moth',
  'Lantern',
  'Specter',
  'Banshee',
  'Goblin',
  'Bat',
  'Crow',
  'Owl',
  'Spider',
  'Imp',
  'Lich',
  'Mummy',
  'Phantom',
  'Ghost',
  'Zombie',
  'Witch',
  'Vampire',
  'Cobweb',
  'Toad',
  'Shade',
  'Newt',
])

/** Returns "Adjective Creature", never equal to `exclude`. */
export function randomSpookyName(rng: () => number = Math.random, exclude?: string): string {
  const total = SPOOKY_ADJECTIVES.length * SPOOKY_CREATURES.length
  // Pick by a single index so the exclusion can be applied deterministically.
  let index = Math.min(total - 1, Math.max(0, Math.floor(rng() * total)))
  const at = (n: number) =>
    `${SPOOKY_ADJECTIVES[Math.floor(n / SPOOKY_CREATURES.length)]} ${SPOOKY_CREATURES[n % SPOOKY_CREATURES.length]}`
  let name = at(index)
  if (exclude !== undefined && name === exclude) {
    index = (index + 1) % total
    name = at(index)
  }
  return name
}

/** A different name from `current`. */
export function rollAnother(current: string, rng: () => number = Math.random): string {
  return randomSpookyName(rng, current)
}
