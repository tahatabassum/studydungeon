/**
 * Fog over a locked node. Two soft layers (a pre-rendered noise tile plus gradients) drift with a CSS
 * transform only: no canvas, no per-frame work. Static under Reduced_Motion (see campaign.css).
 */
export function FogOverlay() {
  return (
    <span aria-hidden="true" data-testid="floor-fog" className="sd-fogveil">
      <span className="sd-fogveil__layer" />
      <span className="sd-fogveil__layer sd-fogveil__layer--b" />
    </span>
  )
}
