import type { User } from '../types/api'

type HandleUser = Pick<User, 'username' | 'is_guest' | 'display_name' | 'tag' | 'handle'>

const has = (s: string | null | undefined): s is string => typeof s === 'string' && s.trim() !== ''

/**
 * D10: handle, else display_name#tag, else display_name, else username (registered only), else "Guest".
 * A Guest's username is an internal id and is never returned.
 */
export function displayHandle(user: HandleUser | null | undefined): string {
  if (!user) return 'Guest'
  if (has(user.handle)) return user.handle
  if (has(user.display_name)) return has(user.tag) ? `${user.display_name}#${user.tag}` : user.display_name
  if (!user.is_guest && has(user.username)) return user.username
  return 'Guest'
}
