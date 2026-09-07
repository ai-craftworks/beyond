# AGENTS.md

"Beyond" — an offline Solo Leveling-themed RPG fitness tracker. React Native 0.86.3 + Expo SDK 57, TypeScript strict, `expo-sqlite` local storage. No backend, no accounts. This is a single-app repo; `src/` is the only place to change.

## Commands

- `npm start` / `npx expo start` — Metro dev server (`--android` / `--ios` / `--web` also exist)
- `npx expo start --tunnel` — use when the phone can't reach Metro over the LAN
- `npx expo start --clear` — reset Metro cache on red-screen / missing-module errors
- `npx tsc --noEmit` — the **only** static check. There is no lint and no test setup; verify changes with this plus a manual run.
- `eas build --platform android --profile preview|production` — EAS cloud APK build (requires `eas login`). `eas.json` `buildType` is `apk`; both profiles build `apk`, not `aab`.

## Architecture

- Entry: `index.ts` → `App.tsx` (bootstrap: `initAudio` → `initDatabase` → `getPlayer`; routes to Registration or Main). `App.tsx` owns the nav types and both navigators.
- Navigation: Root stack (`Registration`, `Main`, `Session`) + bottom tabs `Dashboard`, `Exercises`, `Plans`, `Profile`, `About` (About = the "Guide" screen). `Session` lives in the root stack, not the tabs, so it hides the tab bar.
- **Rule of thumb:** screens never run raw SQL — all queries live in `src/database/Database.ts`. Game-balance numbers (ranks, EXP curve, titles, colors, unit types) live only in `src/constants/game.ts`; tune difficulty there.
- DB is a singleton `expo-sqlite` connection with WAL. `initDatabase` uses `CREATE TABLE IF NOT EXISTS` plus a `safeAlter` block (Database.ts:146) that idempotently adds columns on every launch — new columns go there, never into a separate migration system.
- Sounds: `expo-audio`, preloaded once in `src/utils/sounds.ts`, fail silently. `playSound('name')` is fire-and-forget.
- All UI colors come from `COLORS` in `game.ts`.

## Hard-earned gotchas

- **`memory/analysis.md` is a live bug list with an approved fix plan (dated 2026-08-17).** Its 14 bugs are still present in the code — read it before editing `SessionScreen.tsx`, `ExercisesScreen.tsx`, `DashboardScreen.tsx`, or `Database.ts`. Highlights: no double-finish guard on `handleFinishSession` (SessionScreen.tsx:164), "Abandon Session" just calls `goBack()` and leaves a session stuck `in_progress` (SessionScreen.tsx:344), and the edit-exercise modal reads the create-form's state instead of the exercise being edited.
- `updatePlayer` and `applyMissedSessionPenalty` hardcode `WHERE id = 1` (Database.ts:333, 596-600) — safe only because the player table is single-row with a reset `sqlite_sequence`.
- Bonus exercises added to an already-completed session are saved but never award EXP — `handleFinishSession` is unreachable once `isAlreadyCompleted` is true.
- The 10% full-clear bonus applies to main exercises only, not the whole session.
- Schema changes beyond adding columns require a fresh install (uninstall/reinstall); `safeAlter` can't alter `CREATE TABLE` statements.
- `readme.md` and `development.md` are user-facing docs and drift from the code (screens, sound filenames, DB path `com.beyond.app`, `stat_reward` column). Trust the code over them.
