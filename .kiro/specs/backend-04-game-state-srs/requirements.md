# Spec 04: Authoritative Game State & Spaced Repetition (SRS)

## Requirements
1. Authoritative verification of submitted answers.
2. Exact damage formulas: weapons (20 to 40 base damage), 1.25x hard multiplier, 1.5x critical streak multiplier.
3. Player HP tracking: 100 starting HP, monster counter-attack deals 10 HP (Boss 12 HP).
4. Idempotency handling via `attempt_id`.
5. SM-2 spaced repetition scheduler: incorrect answers due in 10 minutes, correct in 1-30 days.

