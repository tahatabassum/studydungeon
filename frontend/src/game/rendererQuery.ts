/** Renderer choice from the page URL: ?renderer=canvas forces the Canvas renderer (fallback checks). */
export function rendererFromSearch(search: string): 'canvas' | 'auto' {
  return new URLSearchParams(search).get('renderer') === 'canvas' ? 'canvas' : 'auto'
}

/** True when the page URL asks for the debug overlay (?debug=1). */
export function debugRequested(search: string): boolean {
  return new URLSearchParams(search).get('debug') === '1'
}
