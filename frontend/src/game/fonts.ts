/** Font stacks for Phaser text; mirror the CSS design tokens (with fallbacks). */
export const FONT_DISPLAY = '"Pirata One", "Cinzel", Georgia, serif'
export const FONT_LABEL = '"Cinzel", Georgia, serif'
export const FONT_BODY = '"Inter", system-ui, sans-serif'

export type FontWaitResult = 'loaded' | 'timeout' | 'unavailable'

/**
 * Waits for `ready` (e.g. document.fonts.ready) up to timeoutMs.
 * Never rejects. Undefined or rejected ready -> 'unavailable'.
 */
export async function waitForFonts(
  ready: Promise<unknown> | undefined,
  timeoutMs = 1500,
): Promise<FontWaitResult> {
  if (!ready) return 'unavailable'
  let timer: ReturnType<typeof setTimeout> | undefined
  const timeout = new Promise<FontWaitResult>((resolve) => {
    timer = setTimeout(() => resolve('timeout'), timeoutMs)
  })
  const loaded = ready.then(
    (): FontWaitResult => 'loaded',
    (): FontWaitResult => 'unavailable',
  )
  try {
    return await Promise.race([loaded, timeout])
  } finally {
    if (timer !== undefined) clearTimeout(timer)
  }
}

const PHASER_FONT_LOADS = ['16px "Pirata One"', '16px "Cinzel"', '16px "Inter"']

/**
 * Canvas text does not trigger CSS font loading, so request the families explicitly.
 * Safe where document.fonts is missing (jsdom); never throws.
 */
export async function ensureFontsLoaded(
  doc: Document | undefined = typeof document === 'undefined' ? undefined : document,
): Promise<void> {
  try {
    const fonts = doc?.fonts
    if (!fonts || typeof fonts.load !== 'function') return
    await Promise.all(
      PHASER_FONT_LOADS.map((f) => fonts.load(f).catch(() => undefined)),
    )
  } catch {
    // ignore: fallback stacks apply
  }
}
