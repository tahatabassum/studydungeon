/** Renderer choice from the page URL: ?renderer=canvas forces the Canvas renderer (fallback checks). */
export function rendererFromSearch(search: string): 'canvas' | 'auto' {
  return new URLSearchParams(search).get('renderer') === 'canvas' ? 'canvas' : 'auto'
}

/** True when the page URL asks for the debug overlay (?debug=1). */
export function debugRequested(search: string): boolean {
  return new URLSearchParams(search).get('debug') === '1'
}

/** True when the debug overlay should also show the 10 s performance report (on with ?debug=1; ?report=0 turns it off). */
export function reportRequested(search: string): boolean {
  return debugRequested(search) && new URLSearchParams(search).get('report') !== '0'
}

