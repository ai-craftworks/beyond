# Beyond (Solo Leveling) — Codebase Analysis & Bug Report

Date: 2026-08-17
Status: Analysis complete, fixes planned but NOT yet implemented.

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | React Native 0.81.5 + React 19.1.0 |
| Toolchain | Expo SDK 54, TypeScript ~5.8.3 (strict) |
| Navigation | React Navigation v6 (native-stack + bottom-tabs) |
| Database | expo-sqlite ~16.0.10 (async API, singleton, WAL) |
| Audio | expo-audio ~1.1.1 (preloaded `AudioPlayer` cache) |
| Icons | @expo/vector-icons (Ionicons) |
| Platform | Android (com.beyond.app), portrait, dark theme |

`npx tsc --noEmit` passes clean (exit 0). All bugs below are **logic/runtime**, not type errors.

## Bug Report

### High severity — functional/game-breaking

**1. Bonus exercises added to a *completed* session never award EXP**
`src/screens/SessionScreen.tsx:328-346` — once `isAlreadyCompleted`, the Complete button is replaced by a banner, yet the "+ Add" bonus flow (SessionScreen.tsx:154-162) is still active. You can add and complete bonus quests, but `handleFinishSession` is unreachable, so the EXP is never applied to the player. The AboutScreen tip ("Add bonus exercises to a completed session anytime") documents this feature that silently does nothing.
*Fix:* allow re-finishing a completed session when new bonus EXP exists — add a "Claim Bonus EXP" button when `bonusExercises` contains newly completed items; `handleFinishSession` must add only the *un-awarded delta* (guard against double-award).

**2. Edit-exercise modal is bound to create-form state**
`src/screens/ExercisesScreen.tsx:341-351` — the edit modal's "EXP needed for +1 point" field reads `statType`/`expPerStatPt` (the *create* form's state), not the exercise being edited. There is no `editExpPerStatPt` state at all, and `handleSaveEdit` (ExercisesScreen.tsx:96-122) never persists `exp_per_stat_point`. Editing shows the wrong stat label/value and can't change the stat-point cost.
*Fix:* add `editExpPerStatPt`/`editExpStatType` state, bind the field to it, and pass `exp_per_stat_point` in `updateExercise`.

**3. "Abandon Session" leaves the quest stuck `in_progress` forever**
`src/screens/SessionScreen.tsx:344` just calls `goBack()`. Penalties only ever apply to `pending` sessions (`src/database/Database.ts:575-604`), so an abandoned session is never penalized, permanently shows IN PROGRESS in history, and can be re-opened/re-completed to farm a second award (compounding bug #5).
*Fix:* on abandon, mark status `skipped` so penalties/history behave consistently.

### Medium severity

**4. Penalty system edge cases** — `src/screens/DashboardScreen.tsx:56-70` fires one blocking `Alert` + penalty sound *per* missed session on **every** focus. Worse, `applyMissedSessionPenalty` (`src/database/Database.ts:592-593`) returns early when `penalty === 0` without updating status, so zero-penalty missed sessions stay `pending` forever and get re-checked endlessly.
*Fix:* aggregate missed sessions into one alert; always transition out of `pending` (mark skipped) regardless of penalty value.

**5. No guard against double-finishing a session** — `handleFinishSession` (`src/screens/SessionScreen.tsx:164`) never checks the session's current status before re-reading the player and re-awarding EXP. A rapid double-tap on "Complete Session" (before the `finishing` re-render disables it) double-counts EXP, levels, stats, and titles.
*Fix:* fetch session status first; bail out if already `completed`; also use a ref-based in-flight lock.

**6. `updatePlayer` hardcodes `WHERE id = 1`** — `src/database/Database.ts:333`. Works today only because `resetAllData` clears `sqlite_sequence`. Any path that creates a player without the sequence reset (or future multi-profile support) silently updates the wrong row.
*Fix:* return/use the real id from `createPlayer` (`lastInsertRowId`) and key updates on it.

### Low severity / polish

7. **`profile` sound never plays** — `src/screens/ProfileScreen.tsx:17` imports `playSound` but never calls it.
8. **Orphaned asset** `assets/sounds/complete.mp3` exists but isn't in the `SOUNDS` map (`src/utils/sounds.ts:29-50`).
9. **`LevelUpModal` animation leak** — the `Animated.loop` pulse (`src/components/LevelUpModal.tsx:38-43`) keeps running after the modal is hidden; no `stopAnimation` on close.
10. **Session EXP bar is stale during a workout** — `src/screens/SessionScreen.tsx:301` shows DB `player.exp` (updated only at finish); only the "+N EXP" badge updates live.
11. **`createExercise` writes `0` to `stat_reward`** and ignores the collected `statReward` form field (`src/database/Database.ts:347`, `src/screens/ExercisesScreen.tsx:51`) — dead/misleading column in all calculation paths (stat gain now derives from `exp_per_stat_point`).
12. **AboutScreen:** computed `expNeeded` is dead code (`src/screens/AboutScreen.tsx:96-99`); text claims "10% bonus on the *entire* session" but code applies it to main exercises only.
13. **Bootstrap error path** (`App.tsx:175-178`) routes to Registration even when the DB init itself failed — a re-register can then throw because tables may be missing.
14. **Registration accepts negative/zero age, weight, height** (`src/screens/RegistrationScreen.tsx:44-54` only checks `isNaN`).

## Approved Fix Plan (scope: all bugs #1-#14)

### Phase 1 — Session integrity (bugs #5, #3, #4)
- **#5 Double-finish guard** (`SessionScreen.tsx`): in `handleFinishSession`, fetch the session status first and abort if `completed`; add an in-flight ref lock so a double-tap can't run twice. Centralize reward math in one place.
- **#3 Abandon** (`SessionScreen.tsx:344`): "Abandon Session" → `updateSession(sessionId, { status: 'skipped' })` before `goBack()`.
- **#4 Penalty edge cases** (`DashboardScreen.tsx` + `Database.ts`):
  - `applyMissedSessionPenalty`: always mark the session `skipped`, even when `penalty === 0`.
  - `checkMissedPenalties`: collect all missed sessions first, show a single aggregated Alert, play one penalty sound.

### Phase 2 — Post-completion bonus EXP (bug #1)
- `SessionScreen.tsx`: when `isAlreadyCompleted` and any *newly completed* bonus exercise exists (track via `exp_reward > 0` + not-yet-awarded), show a **"Claim Bonus EXP"** button alongside the banner.
- `handleFinishSession` gains a mode that awards only the delta EXP/stats/level for new bonus completions (guarded by #5's lock + status check) without duplicating already-awarded main-exercise EXP.

### Phase 3 — Edit-exercise modal (bug #2)
- `ExercisesScreen.tsx`: add `editExpPerStatPt` + `editStatType` state; bind the "EXP needed for +1 point" field (lines 341-351) to edit state; pass `exp_per_stat_point` in `handleSaveEdit`'s `updateExercise`.

### Phase 4 — Player id plumbing (bug #6)
- `Database.ts`: `createPlayer` returns `lastInsertRowId`; store the player id; change `updatePlayer` (and penalty/read functions) to target the real player id instead of hardcoded `id = 1`.

### Phase 5 — Polish (#7-#14)
- **#7** Remove unused `playSound` import from `ProfileScreen`; **#8** delete orphan `assets/sounds/complete.mp3` (or wire it in).
- **#9** `LevelUpModal`: stop the pulse loop when the modal closes (`pulseAnim.stopAnimation()` / `Animated.loop(...).stop()`).
- **#10** `SessionScreen`: live-update the `ExpBar` with `player.exp + expGained` during the session.
- **#11** `ExercisesScreen`/`Database.ts`: drop the dead `statReward` field from the create/update paths (keep column for compat).
- **#12** `AboutScreen`: remove dead `expNeeded` computation; fix "10% on entire session" text to say "main exercises".
- **#13** `App.tsx`: on bootstrap failure, show an error state instead of silently sending to Registration.
- **#14** `RegistrationScreen`: validate positive numeric age/weight/height.

### Verification
- `npx tsc --noEmit` (must stay exit 0)
- Manual smoke test: create exercise → plan → complete session → abandon → re-enter → add bonus → claim → verify EXP/level/stats/titles are awarded exactly once.