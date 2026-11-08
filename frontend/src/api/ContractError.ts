/**
 * Thrown when a response does not match its zod schema. The message names the endpoint
 * and the failing field path, e.g.
 * `Contract mismatch at GET /progress: total_xp: Invalid input: expected number, received string`.
 */
export class ContractError extends Error {
  constructor(
    public readonly endpoint: string,
    public readonly path: string,
    public readonly detail: string,
  ) {
    super(`Contract mismatch at ${endpoint}: ${path}: ${detail}`)
    this.name = 'ContractError'
  }
}

/** Formats a zod issue path as `entries[2].score` (root becomes `(response)`). */
export function formatIssuePath(path: ReadonlyArray<PropertyKey>): string {
  if (path.length === 0) return '(response)'
  let out = ''
  for (const seg of path) {
    if (typeof seg === 'number') out += `[${seg}]`
    else out += out === '' ? String(seg) : `.${String(seg)}`
  }
  return out
}

/** Friendly player-facing text for an error, with a ContractError-aware message. */
export function describeError(err: unknown, fallback: string): string {
  if (err instanceof ContractError) {
    return `The server sent an unexpected response (${err.endpoint}, field ${err.path}).`
  }
  return fallback
}
