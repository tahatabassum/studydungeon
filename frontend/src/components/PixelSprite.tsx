import { useMemo } from 'react';
import { pixelMapToRuns, type PixelMap } from '../art/pixelMap';

export interface PixelSpriteProps {
  map: PixelMap;
  /** Screen pixels per sprite pixel. Default 2. */
  scale?: number;
  /** Explicit size in px; overrides `scale` for that axis. */
  width?: number;
  height?: number;
  className?: string;
  /** Accessible name. When omitted the sprite is decorative (aria-hidden). */
  label?: string;
}

/** Renders a PixelMap as crisp inline SVG, one rect per horizontal run. */
export function PixelSprite({
  map,
  scale = 2,
  width,
  height,
  className,
  label,
}: PixelSpriteProps) {
  const runs = useMemo(() => pixelMapToRuns(map), [map]);
  const a11y = label
    ? { role: 'img' as const, 'aria-label': label }
    : { 'aria-hidden': true as const, focusable: 'false' as const };
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox={`0 0 ${map.width} ${map.height}`}
      width={width ?? map.width * scale}
      height={height ?? map.height * scale}
      shapeRendering="crispEdges"
      className={className}
      {...a11y}
    >
      {label ? <title>{label}</title> : null}
      {runs.map((r) => (
        <rect
          key={`${r.x}-${r.y}`}
          x={r.x}
          y={r.y}
          width={r.length}
          height={1}
          fill={r.color}
        />
      ))}
    </svg>
  );
}
