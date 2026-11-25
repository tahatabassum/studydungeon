# StudyDungeon: Demo Video Script (under 3:00)

Target length: 2:50. Record on a desktop browser, which is the device the game was built for.

## Before you record

- Wake the Render backend and Supabase first. Open the live URL and `/api/health`, and wait until both respond.
- Pre-upload the sample notes so a dungeon is already generated. Do not wait on ingestion or a cold start on camera.
- Record at 1080p. Set browser zoom to 110 to 125 percent so text is readable. Hide bookmarks and other tabs.
- Have a registered account with a ready dungeon, plus a fresh guest session in a second window.
- Open `.kiro/specs`, `.kiro/hooks` and `.kiro/steering` in the editor, and have a few tasks queued to run in parallel for the montage.
- Use a good microphone and record narration separately if needed.

## Timeline

| Time | On screen | Narration |
|---|---|---|
| 0:00-0:15 | Landing page, then a cluttered notes PDF | "You reread your notes and still blank on the exam. What if your notes were a dungeon, and every monster was something you need to know?" |
| 0:15-0:35 | Click "Try the Demo", enter a guest name, enter the dungeon | "StudyDungeon is a haunted learning RPG. No sign-up. The demo uses zero AI calls, so it loads instantly." |
| 0:35-1:00 | Switch to the logged-in account. Upload the PDF. Show the relevance check result, then the generated dungeon with topic rooms | "Upload PDFs, slides, docs or photos of notes. A relevance gate rejects non-study files. Then AI builds topic rooms with questions grounded in your own text." (Show the pre-generated dungeon; do not wait.) |
| 1:00-1:40 | Enter a room. Answer correctly (damage numbers, streak). Answer one wrong (HP drops, toast "Saved to Memories"). Show the evidence quote after an answer | "Right answers hit the monster. Wrong answers cost you HP and are saved to Memories to review in ten minutes. Every answer shows the exact quote from your notes. The server computes all damage, so the game cannot be cheated." |
| 1:40-1:55 | Defeat the monster, room clear, new weapon unlock | "Clear rooms to earn XP and unlock weapons, from the Rusty Dagger to the Flame Sigil." |
| 1:55-2:15 | Run scorecard with mastery bands, then Memories and Daily Haunt | "The scorecard shows what is Weak, Learning or Strong. Memories and the Daily Haunt bring back what you missed at the right time." |
| 2:15-2:20 | Leaderboard with named guests | "Compete on the leaderboard, even as a guest." |
| 2:20-2:45 | **Kiro montage (25 s).** Show `.kiro/specs` (20 spec folders), a spec's requirements, design and tasks, the two hooks running tests on save, the steering files, and several tasks running in parallel via sub-agents. Show a property-based test catching a bug | "We built this with Kiro. Twenty specs turned ideas into requirements, design and tasks. Steering files were the contract between backend and frontend. Hooks ran our tests on every save. Sub-agents worked tasks in parallel, and property tests caught real bugs." |
| 2:45-2:50 | Logo and URL | "StudyDungeon. Turn your notes into a dungeon. Try it now." |

## Rules checklist

- [ ] Under 3 minutes in total.
- [ ] No copyrighted music. Use royalty-free or original audio only, or none.
- [ ] Upload to YouTube as **Public** (not unlisted or private) and paste the link in Devpost: [FILL IN: YouTube URL].
- [ ] Show the project running on the device it was built for: a desktop browser.
- [ ] Show the Kiro workflow clearly: specs, hooks, steering, parallel tasks.
- [ ] No API keys, `.env` contents or personal data visible on screen.
- [ ] Check captions and audio levels before uploading.
