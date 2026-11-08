# Kiro log: frontend

## frontend-06 Halloween visuals (phases 2 to 6)

Branch: feature/frontend-halloween-visuals (from feature/frontend-rpg-polish). No gameplay, balance, Event_Bridge, API or state changes. Phaser code imports nothing from api, demo or state.

### What was built

- Phase 2 (sample room): new palette tokens, contrast helper, theme ids, pure flicker function, keep-out zones and seeded prop placement, theme budgets. Procedural floor and wall generators, baked per-room CanvasTexture (RoomBaker, lazy current and next room), glow and vignette textures, LightSystem, animated Clockwork Crypt pieces, gate and character polish, debug overlay (`?debug=1` or F3) and `?renderer=canvas`.
- Phase 3 (other rooms): Haunted Library, Witch's Laboratory, Pumpkin Workshop and the Boss Hall of the Exam Warden on the shared lighting system, with all-theme budget and placement tests.
- Phase 4 (UI): stone-frame HUD with low-health state, spellbook question panel, answer feedback effects, landing page, victory, defeat and pause screens, room transitions. All pure CSS or inline SVG, static under reduced motion.
- Phase 5 (sound): synthesized ambient wind bed with creaks and a distant owl, new 'miss' and 'boss' stingers, wiring from the React side only.
- Phase 6 (verification): contrast and witch-not-text tests, verification report, licence and log updates, full checks. Task 11 (user fps readings) is open.

### Decisions D1 to D11 (as implemented)

- D1 Palette: kept existing semantic tokens and added pumpkin, ember, ghost, toxic, witch, magenta, indigo, bone and blood-red.
- D2 Room mapping: gear_golem is the Clockwork Crypt, paper_wraith the Library, toxic_slime the Witch's Laboratory, memory_eater the Pumpkin Workshop, is_boss the Boss Hall.
- D3 Camera: follow camera kept, zoom 1.0 as a named constant.
- D4 Art source: code-drawn only.
- D5 Lighting: baked radial-glow textures with ADD blend and a baked vignette, one path for WebGL and Canvas.
- D6 Baking: one CanvasTexture per room.
- D7 Debug overlay: dev-only, `?debug=1` or F3.
- D8 Sound default: quiet, unmuted, master 0.25, bed at most 5% of master.
- D9 Branch: new branch from feature/frontend-rpg-polish.
- D10 Baking cadence: lazy, current and next room only.
- D11 Lightning: pooled overlay, peak alpha 0.25, at most once per 8 s, off under reduced motion.

### Deviations

- D8 one-shot ceiling: design said creak and owl at most 10% of master. The owl was inaudible in use, so `ONESHOT_GAIN` is now 0.35 (about 0.09 absolute). The first one-shot plays 8 to 15 s after start, later ones 20 to 60 s, alternating owl and creak with the owl first. A suspended AudioContext is resumed again on the next key or pointer press.
- Phase 6 contrast: raw danger and magic tokens were below 4.5:1 as text. Token values were left alone and the components (LandingPage, Hud, QuestionPanel) now mix them with ink for text.
- Reduced-motion rows in the verification report are code and test based; browser checks are pending.

### Commits

- fcd6da6
- 86f256b
- 6202b78
- c824c3a
- Phase 6 and the owl fix are uncommitted at the time of writing.

### Test counts

- Before this run: at least 267 tests required as the baseline.
- After Phase 6: 64 files, 402 tests passing. Typecheck, lint and production build pass.
