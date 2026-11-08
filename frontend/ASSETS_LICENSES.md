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
