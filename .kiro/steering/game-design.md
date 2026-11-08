# StudyDungeon — Game Design & Combat Balance Rules

## 1. Player Health & Fail State
- Starting HP: **100 HP**.
- Correct Answer: Deals damage to monster, Player HP unchanged.
- Wrong Answer: Monster attacks player for **10 HP** (Boss deals **12 HP**). Monster takes 0 damage.
- Defeat: 0 HP ends the run (`player_defeated: true`). Run can be retried without deleting account XP or previous progress.

## 2. Weapon Unlocks & Damage Calculations
| Weapon | Unlock Requirement | Base Damage | Attack Style |
|---|---|---|---|
| **Rusty Dagger** | Starter Weapon | 20 | Quick slash |
| **Arcane Staff** | 100 Account XP | 25 | Magic bolt |
| **Hunter Crossbow** | Clear 2 Rooms | 30 | Piercing arrow |
| **Spectral Hammer** | Reach Level 3 | 35 | Heavy slam |
| **Flame Sigil** | Defeat 1st Boss | 40 | Fire burst |

### Damage Multiplier Formula:
- `Final Damage = Base Damage`
- If Question Difficulty is **Hard**: `Damage = round(Base Damage * 1.25)`
- If **3 Correct Answers in a Row (Critical)**: `Damage = round(Base Damage * 1.50)` (Calculated on top of difficulty bonus).

## 3. Monster Health & Rooms
- **Standard Room Monster:** 60–100 HP (3–5 questions per encounter).
- **Elite Monster:** 120–160 HP (5–7 questions).
- **Dungeon Boss:** 220–300 HP (6–8 mixed-topic questions).

## 4. Scoring & Spaced Repetition (SM-2 Simplified)
- **Scoring:** Correct (+100), Hard Correct (+150), Room Clear (+50), Boss Clear (+200), Streak Bonus (+25 after 3 consecutive hits).
- **Mastery Bands:**
  - `< 50%`: Weak (Pushed to frequent review)
  - `50% – 79%`: Learning
  - `>= 80%`: Strong
- **SRS Intervals:**
  - Wrong: Review in **10 minutes** (Streak resets to 0).
  - Correct (Marked Difficult): Review in **1 day**.
  - Correct (Normal): Review in **3 days**.
  - Repeated Correct: **7 days**, **14 days**, **30 days**.

