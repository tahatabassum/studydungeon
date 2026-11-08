import { useReducedMotion } from '@/state/useReducedMotion'
import '../styles/shell.css'

/** CSS-only backdrop behind the transparent Phaser canvas: gradient, vignette and slow fog. */
export function ThemedBackdrop() {
  const reduced = useReducedMotion()
  return (
    <div aria-hidden="true" data-testid="themed-backdrop" data-reduced={reduced ? 'true' : undefined} className="sd-backdrop">
      <span className="sd-backdrop__fog sd-backdrop__fog--a" />
      <span className="sd-backdrop__fog sd-backdrop__fog--b" />
    </div>
  )
}
