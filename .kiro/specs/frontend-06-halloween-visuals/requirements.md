# Requirements Document

## Introduction

Halloween visual overhaul of StudyDungeon: a gothic-cozy haunted academy where studying is a spell. The scope is purely presentational: Phaser scene art, lighting, character polish, React HUD and screens, landing page, generated Web Audio sound, and verification tooling. Gameplay, balance, the event-bridge contract, API and state logic remain unchanged. Work proceeds in phases: Phase 2 delivers one sample room (Clockwork Crypt) and stops for review; Phase 3 delivers the other four rooms; Phase 4 delivers UI and screens; Phase 5 delivers sound; Phase 6 verifies.

Items marked "(pending D#)" depend on an open decision recorded in design.md and confirmed by the user.

## Glossary

- **Game_Client**: The frontend application under frontend/ (React 19, TypeScript, Vite, Tailwind 4, Phaser 3.90.0).
- **Scene_Renderer**: The Phaser code under src/game/ (GameScene, entities, systems, world, textures).
- **Event_Bridge**: The typed event channel between React and Phaser defined in src/game/events.ts.
- **Room_Theme**: A data record in roomTheme.ts selecting floor, decor, lighting, particles and animated pieces for a room.
- **Theme_Selector**: The pure function selectTheme(kind, isBoss) returning a Room_Theme.
- **Light_System**: The Scene_Renderer subsystem that draws vignette, light pools, glow rings, auras and contact shadows.
- **Flicker_Function**: The pure function returning a light intensity for a time, seed and bounds.
- **Prop_Placer**: The pure function that chooses scatter prop positions for a room.
- **Keep_Out_Zone**: The union of the walkable corridor between player spawn, monster and gate, plus a clearance radius around spawn, monster and gate.
- **Baked_Room_Texture**: One cached texture per room holding all static decoration, created from a RenderTexture.
- **Animated_Piece**: A separately pooled object for motion (clock hands, pendulum, gears, flames, bats, steam).
- **Reduced_Motion**: The existing flag set through the Event_Bridge event set-reduced-motion and the OS preference.
- **Particle_Budget**: The maximum number of simultaneously visible particles; the global ambient cap is MAX_PARTICLES (24).
- **Debug_Overlay**: A development-only display of fps, particle count, tween count, renderer type and texture memory.
- **Audio_Engine**: The Web Audio generator under src/audio/, outside the Scene_Renderer.
- **HUD**: The React heads-up display (Hud, RoomProgress).
- **Spellbook_Panel**: The restyled QuestionPanel.
- **Landing_Page**: src/pages/LandingPage.tsx.
- **Palette_Tokens**: The color tokens in src/index.css and src/game/colors.ts.
- **Perf_Target**: 60 frames per second on an integrated-GPU laptop with 8 GB RAM.

## Requirements

### Requirement 1: Hard constraints

**User Story:** As a maintainer, I want the visual overhaul to leave gameplay and architecture untouched, so that the existing game stays correct and testable.

#### Acceptance Criteria

1. THE Game_Client SHALL preserve all gameplay rules, balance values, API calls and run-state logic unchanged by this feature.
2. THE Game_Client SHALL preserve the Event_Bridge event types and payloads unchanged by this feature.
3. THE Scene_Renderer SHALL import nothing from src/api, src/demo or src/state.
4. WHEN the importBoundary test runs, THE Game_Client SHALL pass the test.
5. THE feature SHALL modify files only under frontend/, plus .kiro/specs/frontend-06-halloween-visuals/, its hooks, and docs/kiro-log-frontend.md.
6. THE Game_Client SHALL draw all art in code or use packs whose licences are recorded in ASSETS_LICENSES.md.
7. THE Game_Client SHALL contain no brand logos, copyrighted characters, film references or copyrighted music.
8. THE Game_Client SHALL keep all existing tests passing at the end of every phase.

### Requirement 2: Performance budget

**User Story:** As a player on a modest laptop, I want smooth rendering, so that the game stays playable.

#### Acceptance Criteria

1. THE Scene_Renderer SHALL render at the Perf_Target in every room.
2. THE Scene_Renderer SHALL keep simultaneously visible ambient particles at or below MAX_PARTICLES in every room.
3. THE Scene_Renderer SHALL keep the sum of visible ambient, Animated_Piece and burst objects at or below a per-room total budget defined in design.md.
4. THE Scene_Renderer SHALL reuse objects through ObjectPool for particles, bursts, damage numbers and bats.
5. THE Scene_Renderer SHALL perform no object allocation inside per-frame update methods of new systems.
6. WHEN a room is built, THE Scene_Renderer SHALL render all static decoration of that room into one Baked_Room_Texture.
7. WHEN a room is no longer the current or an adjacent room, THE Scene_Renderer SHALL destroy its Baked_Room_Texture.
8. THE Scene_Renderer SHALL keep total generated texture memory at or below 32 MB at any time.
9. WHERE the Debug_Overlay is enabled by the query parameter debug=1 or a key press, THE Game_Client SHALL display fps, ambient particle count, tween count, renderer type and estimated texture memory.
10. WHERE the Debug_Overlay is not enabled, THE Game_Client SHALL perform no Debug_Overlay work.

### Requirement 3: Renderer fallback

**User Story:** As a player whose browser lacks WebGL, I want the game to still look correct, so that I am not blocked.

#### Acceptance Criteria

1. WHEN the active renderer is not WebGL, THE Scene_Renderer SHALL skip every WebGL-only effect API.
2. THE Light_System SHALL produce vignette and light pools through baked canvas textures with additive blending in both renderers.
3. IF an effect API used by the Scene_Renderer is absent in Phaser 3.90.0, THEN THE Scene_Renderer SHALL fall back to a baked texture without throwing.
4. THE design document SHALL list each Phaser effect API used with the verified source path in node_modules/phaser.

### Requirement 4: Reduced motion and accessibility

**User Story:** As a motion-sensitive player, I want effects that move or flash to be removed, so that I can play comfortably.

#### Acceptance Criteria

1. WHILE Reduced_Motion is active, THE Scene_Renderer SHALL show no camera shake, no screen flash, no light flicker and no lightning.
2. WHILE Reduced_Motion is active, THE Scene_Renderer SHALL hold Animated_Pieces in a fixed pose and show no flying bats.
3. WHILE Reduced_Motion is active, THE Flicker_Function SHALL return a constant intensity equal to the midpoint of its bounds.
4. WHILE Reduced_Motion is active, THE HUD SHALL show no low-health pulse.
5. WHILE Reduced_Motion is active, THE Game_Client SHALL show no room-transition wipe and no animated landing sky.
6. THE Game_Client SHALL keep a text contrast ratio of at least 4.5:1 for body text and 3:1 for large text and UI boundaries on every changed screen.
7. THE Game_Client SHALL not flash more than three times in any one second under normal motion.

### Requirement 5: Palette and art direction

**User Story:** As a player, I want a cohesive spooky-but-charming look, so that the game feels like a haunted academy.

#### Acceptance Criteria

1. THE Palette_Tokens SHALL include pumpkin, ember, ghost green, toxic green, witch purple, magenta, indigo shadow, bone white and blood red entries (pending D1).
2. THE Game_Client SHALL keep every existing semantic token name usable by existing components.
3. THE Game_Client SHALL use blood red only for danger indications and sparing accents.
4. THE Game_Client SHALL avoid gore in all art.
5. WHEN a room is drawn, THE Scene_Renderer SHALL render a warm focal glow against a cool dark surround.
6. THE Palette_Tokens in src/index.css and src/game/colors.ts SHALL hold equal values for every shared token.

### Requirement 6: Theme mapping

**User Story:** As a developer, I want themes selected from data, so that new rooms need no code branching on labels.

#### Acceptance Criteria

1. WHEN selectTheme is called with is_boss true, THE Theme_Selector SHALL return the boss_hall theme.
2. WHEN selectTheme is called with kind paper_wraith and is_boss false, THE Theme_Selector SHALL return the library theme (pending D2).
3. WHEN selectTheme is called with kind toxic_slime and is_boss false, THE Theme_Selector SHALL return the witch_lab theme (pending D2).
4. WHEN selectTheme is called with kind gear_golem and is_boss false, THE Theme_Selector SHALL return the clockwork_crypt theme (pending D2).
5. WHEN selectTheme is called with kind memory_eater and is_boss false, THE Theme_Selector SHALL return the pumpkin_workshop theme (pending D2).
6. IF selectTheme receives an unknown or missing kind and is_boss false, THEN THE Theme_Selector SHALL return the entry theme.
7. THE Theme_Selector SHALL ignore room labels.

### Requirement 7: Sample room, Clockwork Crypt (Phase 2)

**User Story:** As the product owner, I want one room finished completely first, so that I can approve the look before the rest is built.

#### Acceptance Criteria

1. WHEN the clockwork_crypt theme is built, THE Scene_Renderer SHALL replace the checkerboard floor with a dark flagstone floor with varied tones, cracks, moss, stains, seams and worn edges.
2. WHEN the clockwork_crypt theme is built, THE Scene_Renderer SHALL draw walls with a lit top face and a shaded inner face and arched doorways.
3. WHILE a gate can open, THE Gate SHALL show an iron-banded look with a glow.
4. WHEN the clockwork_crypt theme is built, THE Scene_Renderer SHALL place a broken clock face with moving hands, a pendulum, spinning gears, steam puffs, stone coffins with lids ajar, hanging chains, corner cobwebs and ceiling bats.
5. WHEN the clockwork_crypt theme is built, THE Prop_Placer SHALL place scatter props (bones, candles, papers, floor runes) outside the Keep_Out_Zone.
6. WHEN the clockwork_crypt theme is built, THE Light_System SHALL draw a screen-edge vignette, flickering warm light pools at torches and candles, a glow ring under the active monster, a faint aura on the player and soft contact shadows under all characters.
7. WHEN a monster is idle, THE Monster SHALL play a breathing animation with glowing eyes.
8. WHEN a monster attacks, THE Monster SHALL show a wind-up pose before the strike.
9. WHEN a monster takes a hit, THE Monster SHALL flash.
10. WHEN a monster is defeated, THE Monster SHALL play a spark-poof defeat animation.
11. THE Player SHALL show a clearer silhouette, subtle cape and hat motion and a small shadow.
12. WHEN Phase 2 is complete, THE agent SHALL stop and request user review before starting Phase 3.

### Requirement 8: Light flicker bounds

**User Story:** As a player, I want lights that flicker gently, so that rooms feel alive without distraction.

#### Acceptance Criteria

1. FOR ALL times, seeds and bounds with min not greater than max, THE Flicker_Function SHALL return a value within [min, max].
2. THE Flicker_Function SHALL be deterministic for equal inputs.
3. WHILE Reduced_Motion is active, THE Light_System SHALL apply the constant intensity from the Flicker_Function.

### Requirement 9: Prop placement safety

**User Story:** As a player, I want props never to block my route, so that visuals do not affect movement.

#### Acceptance Criteria

1. FOR ALL room seeds, THE Prop_Placer SHALL return positions whose bounding boxes do not intersect the Keep_Out_Zone.
2. FOR ALL room seeds, THE Prop_Placer SHALL return positions whose bounding boxes do not intersect each other, walls or pillars.
3. FOR ALL room seeds, THE Prop_Placer SHALL return the same positions when called twice with the same seed.
4. THE Prop_Placer SHALL add no physics bodies.

### Requirement 10: Particle caps

**User Story:** As a maintainer, I want enforceable particle limits, so that performance does not regress as themes grow.

#### Acceptance Criteria

1. FOR ALL Room_Themes, THE ambient particle count SHALL be at most MAX_PARTICLES.
2. FOR ALL Room_Themes, THE sum of ambient particles and Animated_Piece counts SHALL be at most the per-room total budget.
3. WHILE Reduced_Motion is active, THE ambient particle count SHALL be at most four.

### Requirement 11: Other four rooms (Phase 3)

**User Story:** As a player, I want every room to feel distinct, so that progress through the dungeon is memorable.

#### Acceptance Criteria

1. THE Scene_Renderer SHALL reuse one shared Light_System and one shared flagstone/wall generator for all five rooms.
2. WHEN the library theme is built, THE Scene_Renderer SHALL draw towering shelves, floating candles, drifting pages, ghostly translucent books, cobwebs and an arched moonlight window with light beams.
3. WHEN the witch_lab theme is built, THE Scene_Renderer SHALL draw a bubbling green cauldron with bubbles and glow, potion shelves, hanging herbs, jars with floating eyes or sparks and purple and green light.
4. WHEN the pumpkin_workshop theme is built, THE Scene_Renderer SHALL draw jack-o'-lanterns with flickering faces, hay bales, a scarecrow, wall tools, warm orange light and floating embers.
5. WHEN the boss_hall theme is built, THE Scene_Renderer SHALL draw a giant moon window, a purple-fire chandelier, a bone-white throne, banners, red and purple torches and heavier fog.
6. WHEN the boss_hall theme is built under normal motion, THE Scene_Renderer SHALL show an occasional lightning flash.
7. WHEN the boss enters, THE Monster SHALL appear larger than other monsters with a glowing aura and a dramatic intro.
8. WHEN Phase 3 is complete, THE agent SHALL stop and request user review.

### Requirement 12: HUD and question panel (Phase 4)

**User Story:** As a player, I want the interface to match the haunted look while staying readable, so that studying is pleasant.

#### Acceptance Criteria

1. THE HUD SHALL use dark stone frames with orange and purple glow edges, cobweb corners, candle-flame accents on the room tracker and bone dividers.
2. WHILE player health is at or below 25 percent and Reduced_Motion is inactive, THE HUD SHALL show a red pulse.
3. THE Spellbook_Panel SHALL show a parchment texture, a flickering corner candle and ink-style options with a hover glow.
4. WHILE Reduced_Motion is active, THE Spellbook_Panel SHALL show a static candle.
5. THE Spellbook_Panel SHALL keep the existing question, option and keyboard behaviour unchanged.

### Requirement 13: Feedback effects

**User Story:** As a player, I want clear visual feedback for answers, so that I understand outcomes at once.

#### Acceptance Criteria

1. WHEN an answer is correct, THE Scene_Renderer SHALL show a green ghost-wisp burst.
2. WHEN an answer is wrong, THE Scene_Renderer SHALL show a purple-red curse flash.
3. WHEN damage is dealt, THE Scene_Renderer SHALL show a floating damage number.
4. WHILE Reduced_Motion is active, THE curse flash SHALL be replaced by a static tint that fades without flashing.
5. THE feedback effects SHALL draw from pooled objects.

### Requirement 14: Screens (Phase 4)

**User Story:** As a player, I want the landing, victory, defeat, pause and transition screens to share the theme, so that the experience is consistent.

#### Acceptance Criteria

1. THE Landing_Page SHALL show a night sky with a large moon, drifting fog, crossing bats, a flickering title and a pumpkin-orange glowing "Try the Demo" button.
2. THE Landing_Page SHALL load without Phaser and without raster image files larger than 100 KB in total.
3. WHEN the player wins, THE VictoryOverlay SHALL show floating embers, bat confetti and an XP counter.
4. WHEN the player is defeated, THE DefeatOverlay SHALL show fading candles.
5. THE PauseMenu SHALL use the same frame style as the HUD.
6. WHEN the current room changes and Reduced_Motion is inactive, THE Scene_Renderer SHALL play a bat-swarm or mist transition that ends within 600 ms.
7. WHEN the player presses any key or pointer during a transition, THE Scene_Renderer SHALL end the transition at once.

### Requirement 15: Sound (Phase 5)

**User Story:** As a player, I want subtle spooky sound, so that atmosphere improves without annoying me.

#### Acceptance Criteria

1. THE Audio_Engine SHALL generate all sound with Web Audio and use no audio files.
2. WHILE sound is enabled, THE Audio_Engine SHALL play a low wind drone bed whose gain is at most 5 percent of master gain.
3. WHILE sound is enabled, THE Audio_Engine SHALL play occasional creaks and distant owl calls at random intervals between 20 and 60 seconds.
4. WHEN a hit, miss, door, victory or boss-entrance event occurs, THE Audio_Engine SHALL play the matching stinger.
5. WHILE the game is muted, THE Audio_Engine SHALL produce no output.
6. WHEN the Game_Client starts, THE Audio_Engine SHALL use the default chosen in D8.
7. IF the AudioContext is unavailable, THEN THE Audio_Engine SHALL do nothing and not throw.

### Requirement 16: Verification (Phase 6)

**User Story:** As a maintainer, I want evidence that the overhaul is safe and fast, so that I can merge confidently.

#### Acceptance Criteria

1. WHEN Phase 6 runs, THE agent SHALL run typecheck, lint, the full test suite and the production build, and all SHALL pass.
2. THE feature SHALL add automated tests for theme mapping, flicker bounds, particle caps, prop placement and palette contrast, including property-based tests.
3. WHEN Phase 6 runs, THE agent SHALL request fps and particle readings from the user using the Debug_Overlay in each room.
4. WHEN Phase 6 runs, THE agent SHALL record a contrast check and a reduced-motion check for each changed screen.
5. WHEN Phase 6 runs, THE agent SHALL update ASSETS_LICENSES.md and docs/kiro-log-frontend.md.
