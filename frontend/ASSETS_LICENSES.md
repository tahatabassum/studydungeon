# Assets and Licenses

## Fonts (self-hosted via Fontsource, no external font hosts at runtime)

| Font | Role | Package | Version | License | Sources |
| --- | --- | --- | --- | --- | --- |
| Pirata One | Display | `@fontsource/pirata-one` | 5.3.0 | SIL Open Font License 1.1 | [Google Fonts](https://fonts.google.com/specimen/Pirata+One), [Fontsource](https://fontsource.org/fonts/pirata-one) |
| Cinzel | Labels | `@fontsource/cinzel` | 5.3.0 | SIL Open Font License 1.1 | [Google Fonts](https://fonts.google.com/specimen/Cinzel), [Fontsource](https://fontsource.org/fonts/cinzel) |
| Inter | Body | `@fontsource/inter` | 5.3.0 | SIL Open Font License 1.1 | [Google Fonts](https://fonts.google.com/specimen/Inter), [Fontsource](https://fontsource.org/fonts/inter) |

Only the latin subset is bundled: Pirata One 400, Cinzel 400/700, Inter 400/600. The fonts are unchanged by the Halloween visuals work.

## Art and audio

- All art is code-drawn: sprites, room floors, walls and dressing, glow textures and the vignette are generated at runtime from code (canvas 2D and Phaser graphics). The landing-page bats and icons are inline SVG written for this project.
- All sound is synthesized at runtime with the Web Audio API (oscillators and filtered noise). There are no audio files.
- There are no third-party art, sound or sprite packs, so no pack licences apply.

## Encounter portraits (Phase 2)

- The six encounter characters are code-drawn originals (Canvas2D, `src/art/portraits/`): Paper Ghost, Count Memoria (vampire), Scarf Skeleton, Clockwork Golem, Marigold the Witch and the Exam Warden. Each has five poses (idle, talking, hurt, taunt, defeated).
- They use only the project palette tokens and shapes written for this project. No third-party art, no traced or copied characters, and nothing taken from the layout reference game other than the general idea of a large character beside a speech panel. No licences apply.

## Encounter portraits

The six encounter portraits (Paper Wraith, Skeleton, Vampire, Witch, Clockwork Golem, Exam Warden) are original
artwork drawn in code with Canvas2D (`src/art/portraits/`), using only the project palette tokens. They are
menacing Halloween characters without gore. No third-party or commercial game art, sprites, fonts or styles were
copied or traced, and no image files are used. They carry the same license as the rest of the project source.

## Weapon strikes and Armory icons (Phase 3)
- The five weapon strike effects (dagger slash, staff bolt, crossbow arrow, hammer shockwave, flame sigil burst) and the critical-hit star are drawn in code with Phaser Graphics (`src/game/systems/WeaponFxSystem.ts`) from the project palette. No image, sprite or audio files were added.
- The enraged boss ambient variant is synthesized at runtime with the Web Audio API (`src/audio/ambient.ts`).
- Armory icons are `lucide-react` line icons (ISC licence, already a dependency). No emoji. No new dependencies.

## Game feel and ranks (frontend-08 Phase 5)
- The boss death sparks and embers, the loot burst (coins and soul gems), the combo aura tint and the damage-number pop reuse the code-drawn 12 px `spark` dot texture (`src/game/systems/sparkTexture.ts`) and the project palette. No image, sprite or audio files were added.
- Two new sound cues, `bossfall` (falling groan under a soft noise rumble) and `loot` (two-note coin tink), are synthesized at runtime with the Web Audio API in `src/audio/sfx.ts` (oscillators and filtered noise). They are quiet and follow the mute switch.
- The Chest in `src/rewards/ChestOverlay.tsx` is an inline SVG drawn in code; its reward icons are `lucide-react` line icons (ISC licence, already a dependency). The Combo meter is CSS only. No emoji. No new dependencies.

## Badges, intro story and share card (frontend-07 Phase 7)
- Badge icons, the intro story illustrations and the 1200x630 share card art are code-drawn (inline SVG and canvas paths). No image files, no remote images, no new assets.
- The share card text uses only the self-hosted Fontsource fonts listed above (Pirata One, Cinzel, Inter; SIL Open Font License 1.1), loaded with `document.fonts.load` before drawing. No external font host is contacted.
## Tutorial, polish and equip (frontend-08 Phase 6)
- The tutorial scene (a five-cell corridor, hero and monster) uses `lucide-react` line icons (ISC licence, already a dependency) and CSS only. The sample memory scroll is the existing code-drawn component.
- Five new sound cues, `requeue`, `scroll`, `combo`, `finale` and `chest`, are synthesized at runtime with the Web Audio API in `src/audio/sfx.ts` (oscillators and filtered noise). They are quiet and follow the mute switch.
- No image, sprite or audio files were added. No emoji. No new dependencies.
## Art sets (frontend-04 RPG polish, final inventory)
Every art set below is original work made for this project, authored as code (pixel maps or Canvas2D drawing) from the project palette. No third-party art, sprite packs, traced or copied characters, or image files are used. No third-party art licences apply; the art carries the same licence as the project source.
- **Monsters** (`src/art/sprites/monsters.ts`, pixel maps): `paper_wraith`, `toxic_slime`, `gear_golem`, `memory_eater`, `exam_warden`.
- **Player** (`src/art/sprites/player.ts`, pixel maps): `player_idle`, `player_idle_walk_0`, `player_idle_walk_1`.
- **Icons** (`src/art/sprites/icons.ts`, pixel maps): `heart`, `crown`, `lock`, `check`, `skull`, `star`.
- **Decor** (`src/art/sprites/decor.ts`, pixel maps): `decor_bookshelf`, `decor_candle`, `decor_cobweb`, `decor_cauldron`, `decor_potion`, `decor_gear`, `decor_chain`, `decor_tomb`, `decor_rune`, `decor_column`.
- **Characters** (`src/art/sprites/characters.ts`, pixel maps): `friendly_ghost`, `small_vampire`, `skeleton_companion`, `bat`, `black_cat`, `haunted_portrait`.
- **Encounter portraits** (`src/art/portraits`, Canvas2D): original drawings, described in the portraits sections above.
- **Room art** (`src/art/room`, Canvas2D): original floors, walls and dressing generated from code.
## Audio
All sound is original synthesis: cues are synthesized at runtime with the Web Audio API (oscillators and filtered noise) in `src/audio/`. There are no audio files and no samples.
## Fonts
Pirata One, Cinzel and Inter are licensed under the SIL Open Font License 1.1 (<https://openfontlicense.org/>); sources are in the Fonts table at the top of this file.
