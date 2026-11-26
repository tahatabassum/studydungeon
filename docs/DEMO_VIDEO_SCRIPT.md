# StudyDungeon: Demo Video Recording Guide and Voiceover Script

## 1. Goal and rules

- Total length 2:30 to 2:50. The hard limit is under 3:00.
- Show the project working in a desktop browser at https://studydungeon.vercel.app.
- Upload to YouTube as **Public**. Unlisted or private links are not accepted.
- No copyrighted music. Use the YouTube Audio Library, free AI-generated music, or no music.
- No third-party logos or trademarks on screen, other than Kiro (the tool the project is built with).
- No API keys, `.env` contents or personal data visible on screen.

## 2. Before recording (checklist)

- [ ] 2 to 3 minutes before recording, wake the backend and database. Open https://studydungeon.vercel.app and https://studydungeon.vercel.app/api/health/ready. Reload the second one until it reports ready. This wakes Render and Supabase.
- [ ] Prepare a short sample notes PDF (1 to 3 pages) on one clear study topic, for example "How a computer works". Use real sentences, not just bullet fragments.
- [ ] Log in with a registered account and pre-generate one dungeon from that PDF. You will show a finished dungeon so you never wait on camera.
- [ ] Record the upload scene with a second, small PDF (or the same one) so the five upload steps are filmed live. You will speed this up while editing.
- [ ] Use a clean Chrome profile or an Incognito window. Hide the bookmarks bar (Ctrl+Shift+B). Close other tabs.
- [ ] Turn off notifications: Windows Settings > System > Focus (or Do Not Disturb).
- [ ] Set the screen to 1920x1080 and browser zoom to 110% (Ctrl + plus).
- [ ] Open the Kiro IDE with the project. Have these ready: the `.kiro` folder expanded (`specs`, `hooks`, `steering`), and one spec's `tasks.md` open with checked-off tasks.
- [ ] Have a fresh guest session ready: sign out, or use a new Incognito window, so "Try the Demo" starts from the landing page.
- [ ] Do a full dry run once. Time each scene.

## 3. How to record (Windows)

### Option A: OBS Studio (free, recommended)

1. Install OBS Studio from obsproject.com.
2. Settings > Video: Base (Canvas) Resolution **1920x1080**, Output (Scaled) Resolution **1920x1080**, Common FPS Values **60** (or **30** for smaller files).
3. Settings > Output > Recording: Recording Format **MKV** (safe if OBS crashes), Encoder: Hardware (NVENC/AMF/QuickSync) if available, otherwise x264.
4. Settings > Audio: set Mic/Auxiliary Audio to **Disabled**. The voiceover is added later. Desktop Audio can stay on, or be disabled too.
5. In Sources, click + and add **Display Capture** (whole screen) or **Window Capture** (the Chrome window only). For the Kiro scene, use Display Capture.
6. Click Start Recording, do one scene, click Stop Recording. Repeat for each clip.
7. After recording, use File > Remux Recordings to convert each MKV to MP4.

### Option B: Xbox Game Bar (built in)

- Click the browser window, press **Win+Alt+R** to start and stop. It records one app window only, so switch to Display Capture (Option A) for the Kiro IDE scene, or record the IDE as its own window.
- Clips are saved in `Videos\Captures`.

### Option C: Clipchamp screen recorder

- In Clipchamp, choose Record & create > Screen recording. Pick the window or screen, keep the microphone off, and save each clip.

### Recording tips

- Record **each scene as a separate short clip** using the names in the shot list below.
- Move the mouse slowly and deliberately. Pause 1 second before and after each click so the editor has room to cut.
- If you make a mistake, stop and redo only that clip.
- Keep each clip a little longer than its narration. You can trim, but you cannot add footage.

## 4. Shot list

| # | Clip file name | Time range | What to show on screen (exact clicks) |
|---|---|---|---|
| 0 | `00_title_card.png` (image, not a recording) | 0:00-0:03 | Title card with `docs/assets/banner.png`, added in the editor. |
| 1 | `01_hook.mp4` | 0:03-0:18 | Open the landing page. Slowly scroll your notes PDF in a viewer for 3 seconds, then cut back to the landing page title "StudyDungeon" and the tagline "Turn your notes into a haunted dungeon." |
| 2 | `02_guest_demo.mp4` | 0:18-0:38 | On the landing page click **Try the Demo**. On the guest name screen type a name and confirm. On the path choice screen pick the demo path (play the sample dungeon). The campaign floor map opens. Hover over the floors slowly. |
| 3 | `03_combat.mp4` | 0:38-1:05 | On the campaign floor map click the first floor to enter. In the combat question panel answer one question correctly: show the damage and the monster HP bar dropping. Answer one question wrongly: show your HP dropping. |
| 4 | `04_memories.mp4` | 1:05-1:20 | After the wrong answer, hold on the "Saved to Memories" scroll and the answer text. Click Continue. Show that the missed question is not asked again right away. Finish the monster, then show the room clear screen. |
| 5 | `05_upload.mp4` | 1:20-1:50 | Go to the dashboard, open the upload page. Choose your PDF (Upload). Show the steps Upload, Read, Check relevance, Detect topics, Summon floors. Show the relevance result. Click **Summon dungeon**. Then cut to your pre-generated dungeon on the floor map. |
| 6 | `06_grounded.mp4` | 1:50-2:00 | In a floor from your own notes, answer a question and hold on the source line that quotes your notes word for word. |
| 7 | `07_progress.mp4` | 2:00-2:20 | Finish a run to reach the scorecard: show accuracy and topic mastery (Weak, Learning, Strong). Go to the dashboard: show the hero, the Memories card and the Daily Haunt. Open the leaderboard: show the Top 3 podium and the Standings list. |
| 8 | `08_kiro.mp4` | 2:20-2:40 | In the Kiro IDE show: the `.kiro/steering` files, the `.kiro/specs` folder (20 specs), one `tasks.md` with completed tasks, `.kiro/hooks`, and a terminal or test result showing property-based tests passing. |
| 9 | `09_end_card.png` (image) | 2:40-2:50 | End card in the editor: URL, "Built with Kiro", GitHub link. |

## 5. Voiceover script

Written for AI text-to-speech at about 145 words per minute. Timestamps are targets. Final timing comes from the generated audio.

### Scene 1: Hook (0:03-0:18)

> You read your notes again and again. And on exam day, you still blank. Active recall works much better, but flashcards are boring. So we turned your notes into a game.

### Scene 2: What it is and the guest demo (0:18-0:38)

> This is StudyDungeon. A haunted dungeon crawl built from your own study notes. You do not need an account. Click Try the Demo, pick a name, and you are in. The demo uses no AI, so it loads at once.

### Scene 3: Combat (0:38-1:05)

> Every monster is a concept you need to know. Answer correctly, and you strike it. Hard questions hit harder, and a streak of three gives a critical hit. Answer wrong, and the monster hits you. If your health runs out, the run ends. The server does all the math, so nobody can cheat.

### Scene 4: Memories (1:05-1:20)

> Here is the clever part. A question you miss is saved to Memories. It does not come straight back. It returns later, on a spaced repetition schedule. That is how you remember it for good.

### Scene 5: Upload (1:20-1:50)

> Now your own notes. Upload a PDF, slides, a document, or a photo. The app reads the file and checks that it is real study material. It detects the topics, then summons one floor for each. Files that are not about studying are rejected with a clear reason.

### Scene 6: Grounded questions (1:50-2:00)

> Every question is grounded in your notes. After each answer, you see the exact line it came from.

### Scene 7: Progress (2:00-2:20)

> At the end, your scorecard shows what is weak, what you are learning, and what is strong. The Daily Haunt brings back the questions you missed. And the leaderboard lets you compete with friends.

### Scene 8: Built with Kiro (2:20-2:40)

> We built it with Kiro. Steering documents acted as a contract between two developers. Twenty specs turned ideas into requirements, design and tasks. Hooks ran checks automatically. Sub-agents worked on tasks in parallel. And property-based tests, with over fifteen hundred frontend and one hundred sixty-five backend tests, caught real bugs.

### Scene 9: Close (2:40-2:50)

> StudyDungeon. By M Taha Tabassum and Muhammad Abdullah. Try it now at studydungeon dot vercel dot app.

### Combined plain text (paste into a TTS tool)

You read your notes again and again. And on exam day, you still blank. Active recall works much better, but flashcards are boring. So we turned your notes into a game.

This is StudyDungeon. A haunted dungeon crawl built from your own study notes. You do not need an account. Click Try the Demo, pick a name, and you are in. The demo uses no AI, so it loads at once.

Every monster is a concept you need to know. Answer correctly, and you strike it. Hard questions hit harder, and a streak of three gives a critical hit. Answer wrong, and the monster hits you. If your health runs out, the run ends. The server does all the math, so nobody can cheat.

Here is the clever part. A question you miss is saved to Memories. It does not come straight back. It returns later, on a spaced repetition schedule. That is how you remember it for good.

Now your own notes. Upload a PDF, slides, a document, or a photo. The app reads the file and checks that it is real study material. It detects the topics, then summons one floor for each. Files that are not about studying are rejected with a clear reason.

Every question is grounded in your notes. After each answer, you see the exact line it came from.

At the end, your scorecard shows what is weak, what you are learning, and what is strong. The Daily Haunt brings back the questions you missed. And the leaderboard lets you compete with friends.

We built it with Kiro. Steering documents acted as a contract between two developers. Twenty specs turned ideas into requirements, design and tasks. Hooks ran checks automatically. Sub-agents worked on tasks in parallel. And property-based tests, with over fifteen hundred frontend and one hundred sixty-five backend tests, caught real bugs.

StudyDungeon. By M Taha Tabassum and Muhammad Abdullah. Try it now at studydungeon dot vercel dot app.

## 6. Making the voiceover with AI

Free or low-cost tools:

- **ElevenLabs** (free tier): the most natural voices. The free tier has a monthly character limit, which is enough for this script.
- **Clipchamp text to speech**: built into the editor, free, and easy to place on the timeline.
- **CapCut text to speech**: built in, many voices.
- **Microsoft Edge Read Aloud** (fallback): open the script text in Edge, press Ctrl+Shift+U. Use the "Natural" voices. You would need to record the audio output separately, so use this only if the other tools fail.

Tips:

- Pick **one calm narrator voice** and keep it for every scene.
- **Generate each scene as its own audio file** (`vo_01.mp3` to `vo_09.mp3`). This makes timing easy: you place one clip under one video clip.
- If a name or word sounds wrong, respell it phonetically in the TTS tool (for example "Kiro" as "Keer-oh").
- Set speed to normal. Do not speed up the voice to fit the time. Trim video instead.
- Export as MP3 or WAV. Listen to every file before editing.

## 7. Editing steps (Clipchamp or CapCut)

1. Create a new 1920x1080 (16:9) project and import all clips, the voiceover files and `docs/assets/banner.png`.
2. Put the banner on the timeline as a **3-second title card** at the very start.
3. Add the video clips in order. Place each voiceover file under its matching clip.
4. Align each clip to its narration. Trim dead time at the start and end of every clip.
5. **Speed up waiting parts** (upload, reading, summoning) by 2x to 4x.
6. Add a **zoom-in** on key moments: the "Saved to Memories" scroll and the evidence quote. Zoom to 125 to 150% for about 2 seconds.
7. Generate **auto-captions** and check the text. Fix names and "StudyDungeon".
8. Optional: add quiet background music from the YouTube Audio Library at about **-25 dB** under the voice. Skip music if unsure about the licence.
9. Add an **end card** for 3 to 5 seconds: the URL https://studydungeon.vercel.app, "Built with Kiro", and the GitHub link https://github.com/tahatabassum/studydungeon.
10. Check the total length is under 3:00, then export as **1080p MP4**.

## 8. Upload to YouTube

1. Go to YouTube Studio and click Create > Upload videos.
2. Title: `StudyDungeon: turn your notes into a haunted dungeon (built with Kiro)`.
3. Description template:

```
StudyDungeon turns your study notes into a playable haunted dungeon. Upload a PDF, slides, a document or a photo. AI builds source-grounded questions. Right answers hurt monsters, wrong answers are saved to Memories and come back through spaced repetition.

Play it now (no sign-up): https://studydungeon.vercel.app
Code: https://github.com/tahatabassum/studydungeon

Built with Kiro: steering docs, 20 specs, hooks, parallel sub-agents and property-based tests.

Team: M Taha Tabassum, Muhammad Abdullah
```

4. Select "No, it's not made for kids".
5. Set Visibility to **Public**.
6. Copy the video link. Paste it into the Devpost submission and into `README.md`.
7. Open the link in an Incognito window (signed out) to confirm it plays.

## 9. Final pre-submit checklist

- [ ] Length is under 3:00.
- [ ] Audio is clear and the voice is not louder or quieter between scenes.
- [ ] Every feature shown works on the live site.
- [ ] No API keys, `.env` contents or personal data on screen.
- [ ] No copyrighted music and no third-party logos.
- [ ] The video is Public and plays when signed out.
- [ ] The link is in Devpost and in the README: [FILL IN: YouTube URL].
