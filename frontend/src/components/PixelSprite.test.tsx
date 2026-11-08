import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { KEY } from '../art/palette';
import { validatePixelMap, type PixelMap } from '../art/pixelMap';
import { ICONS } from '../art/sprites/icons';
import { PixelSprite } from './PixelSprite';

const tiny: PixelMap = {
  name: 'tiny',
  width: 4,
  height: 2,
  rows: [`${KEY.ink}${KEY.ink}.${KEY.gold}`, `....`],
};

describe('PixelSprite', () => {
  it('renders one rect per run', () => {
    const { container } = render(<PixelSprite map={tiny} />);
    expect(container.querySelectorAll('rect')).toHaveLength(2);
    const svg = container.querySelector('svg');
    expect(svg?.getAttribute('viewBox')).toBe('0 0 4 2');
    expect(svg?.getAttribute('shape-rendering')).toBe('crispEdges');
    expect(svg?.getAttribute('width')).toBe('8');
  });

  it('is aria-hidden when unlabeled', () => {
    const { container } = render(<PixelSprite map={tiny} />);
    const svg = container.querySelector('svg');
    expect(svg?.getAttribute('aria-hidden')).toBe('true');
    expect(svg?.getAttribute('focusable')).toBe('false');
    expect(svg?.getAttribute('role')).toBeNull();
  });

  it('exposes role img with a name when labeled', () => {
    render(<PixelSprite map={tiny} label="Tiny sprite" />);
    expect(screen.getByRole('img', { name: 'Tiny sprite' })).toBeTruthy();
  });
});

describe('ICONS', () => {
  it.each(Object.entries(ICONS))('%s validates with zero errors', (_name, map) => {
    expect(validatePixelMap(map)).toEqual([]);
  });
});
