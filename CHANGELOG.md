# Changelogs

### 05 June, 2026

- Created the application with Claude.

### 06 June, 2026

- Integrated sounds.
- Fixed bottom tab bar overlap issue.

### 08 June, 2026

- Modified workouts to add exp per unit.
- Midified workouts to add different types of units.
- Added penality for plans.

### 09 June, 2026

- Added more sound effects.

### 10 June, 2026

- Added Guide screen for app usage tips.

### 11 June, 2026

- Fixed plan screen issues.
- Converted sounds from wav to mp3.

### 21 Sep, 2026

- Added more units for workouts.
- Added affected body parts for workouts.
- Added manual plans.
- Modified exp calculation based on all units.

### 12 Oct, 2026

- Modified modals into individual screens for worouts.
- Added martial arts and skills functionalities.

### 18 Oct, 2026

- Added skill groups (create/manage groups per martial art, assign skills to multiple groups).
- Added group filter chips and tag chips on the martial art detail screen.
- Redesigned the dashboard rank ring into a level badge.
- Removed the sidebar open sound and its skyblue right border.
- Added media (image/GIF/video) support for workouts — pick demos in create/edit forms, tappable thumbnails in the exercise library, auto file cleanup on delete.
- Added shared media picker and viewer components, now used by both skills and workouts.
- Added fullscreen landscape video playback with screen orientation unlock while open.
- Tapping skill demos now opens them fullscreen.

### 19 Oct, 2026

- Added notes inside each martial art (Skills/Notes tabs): title, text, multiple attachments, create/edit/delete, full-screen note detail.
- Redesigned every workout/exercise list onto a single shared row component (library, picker, plan editor, tagged workouts, session quests, group members, profile history) with a tap-to-open detail sheet replacing per-row icon buttons.
- Unified EXP badges, stat/category accent bars, and meta lines across all surfaces.
- Fixed reset-all-data crash, dashboard blank-screen risk, unconfirmed/abandon session exits, and profile achievement stats that only counted the last 15 sessions.
- Added personal records, full session history with filters and streaks, and JSON backup export/import.
- UI polish: higher-contrast muted text, haptics and click sounds on remaining bare controls, accessibility labels on lists/buttons, flatter lists (no more scroll jank on long libraries), and date labels that stay consistent across timezones.
- Dev quality gates: ESLint flat config, jest unit tests for the pure logic utils, and a GitHub Actions workflow running typecheck + lint + tests.
- Added lint, unit tests, and a CI workflow.