/** Rolling frame-time statistics for the debug report. Pure: no Phaser import, no allocation after construction. */
export const REPORT_WINDOW_MS = 10_000
const CAPACITY = 4096

export interface FrameReport {
  /** Frames in the window and the time they span, in ms. */
  frames: number
  spanMs: number
  /** Average fps over the window (frames divided by time). */
  avgFps: number
  /** Average fps of the slowest 1 percent of frames ("1% low"). */
  low1Fps: number
}

export class FrameStats {
  private readonly times = new Float32Array(CAPACITY)
  private readonly scratch = new Float32Array(CAPACITY)
  private head = 0
  private count = 0

  /** Record one frame time in ms. Bad values are ignored. */
  push(dtMs: number): void {
    if (!(dtMs > 0) || !Number.isFinite(dtMs)) return
    this.times[this.head] = dtMs
    this.head = (this.head + 1) % CAPACITY
    if (this.count < CAPACITY) this.count++
  }

  clear(): void {
    this.head = 0
    this.count = 0
  }

  /** Statistics over the most recent `windowMs` of frames. All zeros when nothing was recorded. */
  report(windowMs: number = REPORT_WINDOW_MS): FrameReport {
    let n = 0
    let span = 0
    for (let i = 0; i < this.count && span < windowMs; i++) {
      const dt = this.times[(this.head - 1 - i + CAPACITY) % CAPACITY]
      this.scratch[n++] = dt
      span += dt
    }
    if (n === 0 || span <= 0) return { frames: 0, spanMs: 0, avgFps: 0, low1Fps: 0 }
    // Slowest frames first: sort the used part ascending, then read from the end.
    const used = this.scratch.subarray(0, n)
    used.sort()
    const worst = Math.max(1, Math.ceil(n * 0.01))
    let worstSum = 0
    for (let i = 0; i < worst; i++) worstSum += used[n - 1 - i]
    return { frames: n, spanMs: span, avgFps: (n * 1000) / span, low1Fps: (worst * 1000) / worstSum }
  }
}
