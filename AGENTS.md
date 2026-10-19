# AGENTS.md

"Beyond" — an offline Solo Leveling-themed RPG fitness tracker. React Native 0.86.3 + Expo SDK 57, TypeScript strict, `expo-sqlite` local storage. No backend, no accounts. This is a single-app repo; `src/` is the only place to change.

## Commands

- `npm start` / `npx expo start` — Metro dev server (`--android` / `--ios` / `--web` also exist)
- `npx expo start --tunnel` — use when the phone can't reach Metro over the LAN
- `npx expo start --clear` — reset Metro cache on red-screen / missing-module errors
- Three static gates (CI runs all three via `.github/workflows/ci.yml`): `npm run typecheck` (`npx tsc --noEmit`), `npm run lint` (ESLint flat config, must have **0 errors**; `react-hooks/refs` and `react-hooks/set-state-in-effect` are deliberately downgraded to warnings in `eslint.config.js` — they fire on standard RN `Animated` refs and modal reset-in-effect patterns, don't "fix" those by restructuring), `npm test` (jest-expo; pure logic tests under `src/utils/__tests__/`). Verify changes with all three plus a manual run.
- `eas build --platform android --profile preview|production` — EAS cloud APK build (requires `eas login`). `eas.json` `buildType` is `apk`; both profiles build `apk`, not `aab`.

## Architecture

- Entry: `index.ts` → `App.tsx` (bootstrap: `initAudio` → `initDatabase` → `getPlayer`; routes to Registration or Main). `App.tsx` owns the nav types and both navigators.
- Navigation: Root stack (`Registration`, `Main`, `Session`, `History` = the "Quest Log" screen) + bottom tabs `Dashboard`, `Exercises`, `Plans`, `Profile`, `About` (About = the "Guide" screen). `Session` and `History` live in the root stack, not the tabs, so they hide the tab bar.
- **Rule of thumb:** screens never run raw SQL — all queries live in `src/database/Database.ts`. Game-balance numbers (ranks, EXP curve, titles, colors, unit types) live only in `src/constants/game.ts`; tune difficulty there.
- DB is a singleton `expo-sqlite` connection with WAL. `initDatabase` uses `CREATE TABLE IF NOT EXISTS` plus a `safeAlter` block (Database.ts:171) that idempotently adds columns on every launch — new columns go there, never into a separate migration system.
- Dates: sessions are keyed by the **UTC** date string (`new Date().toISOString().split('T')[0]`); format/parse date-only strings in UTC via `src/utils/dates.ts` (never `slice(0,10)` or local `toLocaleDateString`), or quest labels and streaks drift in non-UTC timezones.
- `tsconfig.json` pins `"types": ["jest"]` — `@types/jest`'s `exports` field breaks TS's automatic `@types` scan, so removing it reintroduces `describe`/`expect` type errors in `src/utils/__tests__/`.
- Sounds: `expo-audio`, preloaded once in `src/utils/sounds.ts`, fail silently. `playSound('name')` is fire-and-forget.
- All UI colors come from `COLORS` in `game.ts`.

## Hard-earned gotchas

- `memory/analysis.md` (dated 2026-08-17) is **RESOLVED** — 13 of its 14 bugs are fixed (only `stat_reward` still written as a dead `0` in `createExercise`, kept for column compat). Read it for historical context before touching session/penalty logic, but its "bugs still present" claims no longer hold.
- The 10% full-clear bonus applies to main exercises only, not the whole session (AboutScreen says so explicitly).
- Schema changes beyond adding columns require a fresh install (uninstall/reinstall); `safeAlter` can't alter `CREATE TABLE` statements.
- `readme.md` and `development.md` are user-facing docs and drift from the code (screens, sound filenames, DB path `com.beyond.app`, `stat_reward` column). Trust the code over them.
