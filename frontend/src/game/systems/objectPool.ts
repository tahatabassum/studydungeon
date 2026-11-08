/** Generic bounded object pool. Pure: no Phaser import. */
export interface PoolOptions<T> {
  create: () => T
  /** Called on every acquire, before the object is handed out. */
  reset: (obj: T) => void
  max: number
}

export class ObjectPool<T> {
  private readonly free: T[] = []
  private readonly inUse = new Set<T>()
  private created = 0

  constructor(private readonly opts: PoolOptions<T>) {}

  get createdCount(): number {
    return this.created
  }

  get activeCount(): number {
    return this.inUse.size
  }

  /** Returns a reused object if one is free, else a new one; null when at max. */
  acquire(): T | null {
    let obj = this.free.pop()
    if (obj === undefined) {
      if (this.created >= this.opts.max) return null
      obj = this.opts.create()
      this.created++
    }
    this.opts.reset(obj)
    this.inUse.add(obj)
    return obj
  }

  /** Returns an object to the pool. Ignores objects not currently handed out. */
  release(obj: T): void {
    if (!this.inUse.delete(obj)) return
    this.free.push(obj)
  }

  /** Snapshot of objects currently handed out. */
  active(): T[] {
    return [...this.inUse]
  }

  /** Releases everything currently handed out. */
  releaseAll(): void {
    for (const o of this.inUse) this.free.push(o)
    this.inUse.clear()
  }

  /** Drops all references; caller destroys the objects via the callback. */
  clear(dispose?: (obj: T) => void): void {
    if (dispose) {
      for (const o of this.free) dispose(o)
      for (const o of this.inUse) dispose(o)
    }
    this.free.length = 0
    this.inUse.clear()
    this.created = 0
  }
}
