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
- Replaced the martial art notes tab with Tutorials — a tutorial is a titled, described series of notes.
- Notes now live inside tutorials; legacy notes show in an Unassigned section and can be moved via the editor.
- Notes inside a tutorial are numbered and can be reordered manually (up/down).
- Upgraded the note editor to a full-screen page with a large auto-growing writing area, character count, attachments and a tutorial picker.
- Refined the note reading view: paragraph spacing, larger line height, tutorial chip.
- Backups now include tutorials.
- Cleaned up the sound design: removed click sounds from micro-toggles (chips, dropdowns, pickers, close buttons, row taps); fixed the overlapping tap + completion sounds on workout rows; tab re-press no longer replays the navigation blip; navigation cards now consistently use the navigate sound.
- Every action now produces at most one sound: removed the ambient profile sound that stacked with the navigation blip; sidebar items skip the blip when already on the destination; session completion plays a single celebration sound (level up > title > whoosh) instead of stacking up to three.

### 19 Oct, 2026

- Added notes inside each martial art (Skills/Notes tabs): title, text, multiple attachments, create/edit/delete, full-screen note detail.
- Redesigned every workout/exercise list onto a single shared row component (library, picker, plan editor, tagged workouts, session quests, group members, profile history) with a tap-to-open detail sheet replacing per-row icon buttons.
- Unified EXP badges, stat/category accent bars, and meta lines across all surfaces.
- Fixed reset-all-data crash, dashboard blank-screen risk, unconfirmed/abandon session exits, and profile achievement stats that only counted the last 15 sessions.
- Added personal records, full session history with filters and streaks, and JSON backup export/import.
- UI polish: higher-contrast muted text, haptics and click sounds on remaining bare controls, accessibility labels on lists/buttons, flatter lists (no more scroll jank on long libraries), and date labels that stay consistent across timezones.
- Dev quality gates: ESLint flat config, jest unit tests for the pure logic utils, and a GitHub Actions workflow running typecheck + lint + tests.
- Added lint, unit tests, and a CI workflow.