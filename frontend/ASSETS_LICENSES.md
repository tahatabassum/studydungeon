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
