import type { ElementType, HTMLAttributes } from 'react'

export type PanelTone = 'default' | 'parchment' | 'danger' | 'gold'

export interface PanelProps extends HTMLAttributes<HTMLElement> {
  as?: ElementType
  tone?: PanelTone
}

const tones: Record<PanelTone, string> = {
  default: 'bg-panel text-ink border-deep',
  parchment: 'bg-ink text-bg border-gold',
  danger: 'bg-panel text-ink border-danger',
  gold: 'bg-panel text-ink border-gold',
}

export function Panel({
  as: Component = 'div',
  tone = 'default',
  className = '',
  children,
  ...rest
}: PanelProps) {
  return (
    <Component
      className={`rounded-lg border p-4 ${tones[tone]} ${className}`.trim()}
      {...rest}
    >
      {children}
    </Component>
  )
}
