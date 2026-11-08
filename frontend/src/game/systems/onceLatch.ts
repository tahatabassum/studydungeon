/** Runs an action at most once per result. Pure: no Phaser import. */
export interface OnceLatch {
  /** Runs the action the first time only; returns true when it ran. */
  fire(): boolean
  readonly fired: boolean
}

export function createOnceLatch(action: () => void): OnceLatch {
  let fired = false
  return {
    fire() {
      if (fired) return false
      fired = true
      action()
      return true
    },
    get fired() {
      return fired
    },
  }
}
