# ⚔ Beyond

A real-life RPG fitness tracker inspired by the System UI from *Solo Leveling*.
Complete workouts, earn EXP, level up, unlock ranks from E to National Level Hunter,
and earn titles based on your performance. Everything is stored locally on your device —
no accounts, no internet required, no cloud sync.

---

## Table of Contents

1. [Features](#features)
2. [Prerequisites](#prerequisites)
3. [Project Setup](#project-setup)
4. [Preview on Your Phone](#preview-on-your-phone)
5. [Building an APK — Preview Build](#building-an-apk--preview-build)
6. [Building an APK — Production Build](#building-an-apk--production-build)
7. [Installing the APK on Your Phone](#installing-the-apk-on-your-phone)
8. [Project Structure](#project-structure)
9. [Game Mechanics](#game-mechanics)
10. [Database Schema](#database-schema)
11. [Sound Effects](#sound-effects)
12. [Troubleshooting](#troubleshooting)
13. [Package Versions](#package-versions)

---

## Features

- **Hunter Registration** — One-time setup collecting name, age, weight and height
- **Custom Exercises** — Create exercises with unit types (reps, km, metres, minutes, seconds), EXP per unit, and stat boosts. Edit or delete anytime.
- **Workout Plans** — Group exercises into named plans. Set repeat days, sets, target amount, and a missed-quest penalty. Edit plans anytime.
- **Daily Quests** — Sessions auto-generate each morning from active plans
- **Bonus Exercises** — Add optional exercises to any session for extra EXP with no penalty if skipped
- **EXP per Unit** — EXP scales with actual output (10 push-ups = 20 EXP at 2 EXP/rep; 20 push-ups = 40 EXP)
- **Session Replay** — Completed sessions stay open so you can add bonus exercises after finishing
- **Missed Quest Penalty** — Configurable EXP deduction applied automatically the next morning if a quest is not completed
- **5 Stats** — Strength, Agility, Endurance, Intelligence, Vitality
- **Rank Progression** — E → D → C → B → A → S → SS → National Level Hunter
- **12 Titles** — Awarded automatically when level and stat milestones are hit
- **Level-Up Modal** — Full-screen animated overlay when you level up
- **Sound System** — 10 context-aware sound effects (boot, quest start, exercise done, level up, penalty, and more)
- **Reset** — Wipe all data and start fresh from the Profile screen
- **Fully Offline** — SQLite local storage, no internet required

---

## Prerequisites

You need only two things installed on your computer.

### 1 — Node.js

Download from **https://nodejs.org** — choose the **LTS** version (green button).
Run the installer with all default settings.

After installing, open a terminal (Command Prompt or PowerShell on Windows) and verify:
```
node --version
npm --version
```
Both should print a version number. If they show an error, restart your terminal and try again.

### 2 — Expo Go (on your Android phone)

Install **Expo Go** from the Google Play Store.
This is used only for previewing — not needed once you install the real APK.

---

## Project Setup

Open a terminal, navigate to the project folder, and install all dependencies:

```
cd SoloLevelingFinal
npm install
```

This downloads all packages into `node_modules/`. It takes 1–3 minutes and only needs to run once, or whenever you add new packages.

---

## Preview on Your Phone

This runs the app instantly on your phone without building an APK. Hot reloads on every file save.

### Step 1 — Start the development server

```
npx expo start
```

A QR code appears in the terminal after a few seconds.

### Step 2 — Connect your phone

- Your phone and computer must be on the **same WiFi network**
- Open **Expo Go** on your phone
- Tap **Scan QR code**
- Point at the QR code in the terminal
- The app loads in a few seconds ✓

Every time you save a file, the app refreshes automatically on your phone.

### If the QR code does not connect

Run with tunnel mode — this works even if your phone and PC are on different networks:
```
npx expo start --tunnel
```

### If you see a Metro error or red screen

Clear the bundler cache and restart:
```
npx expo start --clear
```

Shake your phone (or press `r` in the terminal) to reload the app at any time.

---

## Building an APK — Preview Build

A preview APK is a standalone file you can install on any Android phone without Expo Go.
The build runs on **Expo's cloud servers** — your PC does zero compilation.
You do not need Java, Android Studio, or any native tools.

### Step 1 — Create a free Expo account

Go to **https://expo.dev** and sign up. The free tier is sufficient for everything here.

### Step 2 — Install EAS CLI

EAS (Expo Application Services) is Expo's cloud build service.

```
npm install -g eas-cli
```

The `-g` flag installs it globally so you can run it from any folder.

Verify it installed:
```
eas --version
```

### Step 3 — Log in to your Expo account

```
eas login
```

Enter the email and password you used at expo.dev.

### Step 4 — Link the project to your account

Run this from inside the project folder:

```
cd SoloLevelingFinal
eas init
```

When asked **"Would you like to create a new EAS project?"**, type `y` and press Enter.
This writes your project ID into `app.json` automatically.

If it asks for a project name, enter: `Beyond`

### Step 5 — Update app.json (if not already done)

Open `app.json` and make sure it looks like this:

```json
{
  "expo": {
    "name": "Beyond",
    "slug": "beyond-app",
    "version": "1.0.0",
    "orientation": "portrait",
    "icon": "./assets/icon.png",
    "userInterfaceStyle": "dark",
    "backgroundColor": "#0A0E1A",
    "splash": {
      "image": "./assets/icon.png",
      "resizeMode": "contain",
      "backgroundColor": "#0A0E1A"
    },
    "android": {
      "package": "com.beyond.app",
      "permissions": [],
      "adaptiveIcon": {
        "foregroundImage": "./assets/icon.png",
        "backgroundColor": "#0A0E1A"
      }
    },
    "plugins": [
      "expo-sqlite",
      "expo-audio"
    ]
  }
}
```

> If you do not have an `icon.png` yet, remove the `icon`, `splash`, and `adaptiveIcon` fields for now. The build will succeed without them and use a default Expo icon.

### Step 6 — Start the preview build

```
eas build --platform android --profile preview
```

What happens next:
- Your source code is uploaded to Expo's servers (takes ~30 seconds)
- The build is queued — position shown in the terminal
- Build takes **5–15 minutes** depending on queue length
- When done, a **download link** appears in the terminal
- You can also monitor progress and download at: **https://expo.dev/builds**

The `preview` profile in `eas.json` produces an **APK** file (`.apk`) which can be directly installed on any Android device.

---

## Building an APK — Production Build

Production builds are identical to preview builds but intended for distribution.
Use this when you want the final, release-quality version.

```
eas build --platform android --profile production
```

The only difference is the `production` profile is the standard EAS release build.
Build time and process are the same as preview.

> **Play Store:** If you want to upload to the Google Play Store, change `"buildType": "apk"` to `"buildType": "aab"` in the `production` section of `eas.json`. The Play Store requires AAB format. Direct installs require APK format.

### Versioning before a production build

Before each production build, update the version in `app.json`:
```json
"version": "1.0.1"
```
And increment `versionCode` inside the `android` block:
```json
"android": {
  "versionCode": 2,
  ...
}
```
`versionCode` must increase with every upload to the Play Store. `version` is the human-readable number shown to users.

---

## Installing the APK on Your Phone

### Option A — Download directly on your phone

Open the download link from the EAS build directly on your Android phone and tap it.
Your browser will download the `.apk` file.

### Option B — Transfer from PC via USB

1. Download the `.apk` to your PC
2. Connect your phone via USB cable
3. Open File Explorer → your phone → Internal Storage
4. Copy the `.apk` file to any folder (e.g. Downloads)
5. On your phone, open a file manager and navigate to that folder
6. Tap the `.apk` file

### Option C — Send to yourself

Email the `.apk` to yourself, or send it via WhatsApp, Telegram, or any messaging app.
Open it on your phone and tap to install.

### Enabling installation from unknown sources

Android blocks APK files from outside the Play Store by default. You need to allow it once:

**Android 8 and above:**
Settings → Apps → tap the three-dot menu → Special app access → Install unknown apps → select the app you used to open the file (e.g. Chrome, Files) → toggle **Allow from this source**

**Older Android:**
Settings → Security → Unknown sources → Enable

After enabling, tap the APK file again and tap **Install**.

---

## Project Structure

```
SoloLevelingFinal/
│
├── index.ts                    App entry point
├── App.tsx                     Root — navigation tree, DB init, audio init
├── app.json                    Expo config (name, package ID, icons, plugins)
├── eas.json                    EAS cloud build config (APK profiles)
├── package.json                All dependencies with exact versions
├── babel.config.js             Babel transpiler config
├── tsconfig.json               TypeScript compiler settings
├── .gitignore                  Files excluded from Git
│
├── assets/
│   ├── icon.png                App icon (1024×1024 px)
│   └── sounds/
│       ├── boot.wav            System boot hum
│       ├── navigate.wav        Tab switch blip
│       ├── click.mp3           Button tap
│       ├── exerciseDone.mp3    Exercise completion hit
│       ├── sessionDone.mp3     Session complete whoosh
│       ├── levelup.mp3         Level-up epic chime
│       ├── title.mp3           Title earned ping
│       ├── penalty.wav         Missed quest warning
│       ├── profile.mp3         Profile scan ambient
│       └── questStart.wav      Quest start tension
│
└── src/
    ├── constants/
    │   └── game.ts             Ranks, EXP formula, unit types, stats, titles, colours
    │
    ├── database/
    │   └── Database.ts         All SQLite tables and every CRUD function
    │
    ├── utils/
    │   └── sounds.ts           Sound engine (expo-audio), 10 sound events
    │
    ├── components/
    │   ├── UIComponents.tsx    Shared styled components (SystemPanel, ExpBar, etc.)
    │   └── LevelUpModal.tsx    Animated level-up full-screen overlay
    │
    └── screens/
        ├── RegistrationScreen.tsx   First-launch 3-step wizard
        ├── DashboardScreen.tsx      Home — player card, stats, daily quests, penalties
        ├── ExercisesScreen.tsx      Exercise library — create, edit, delete
        ├── PlansScreen.tsx          Plan builder — exercises, days, penalty, edit
        ├── SessionScreen.tsx        Active session — main quests, bonus quests, completion
        └── ProfileScreen.tsx        Stats, rank, titles, history, reset
```

---

## Game Mechanics

### EXP and Levelling

EXP is earned by completing exercises. Each exercise has an **EXP per unit** value that scales with your actual output:

```
EXP earned = actual_amount × exp_per_unit
```

Examples:
- Push-ups at 2 EXP/rep: 10 reps = 20 EXP, 50 reps = 100 EXP
- Running at 5 EXP/km: 3 km = 15 EXP, 10 km = 50 EXP
- Plank at 1 EXP/min: 5 min = 5 EXP, 30 min = 30 EXP

A **10% bonus** is applied when every exercise in a session is completed.

### Levelling Curve

EXP required per level: `100 × level^1.5`

| Level | EXP needed for this level |
|---|---|
| 1 | 100 |
| 5 | 559 |
| 10 | 3,162 |
| 20 | 8,944 |
| 50 | 35,355 |
| 99 | 985,171 |

### Rank Progression

| Rank | Unlocks at Level |
|---|---|
| E-Rank Hunter | 1 |
| D-Rank Hunter | 10 |
| C-Rank Hunter | 20 |
| B-Rank Hunter | 35 |
| A-Rank Hunter | 50 |
| S-Rank Hunter | 70 |
| SS-Rank Hunter | 90 |
| National Level Hunter | 99 |

### Stats

Five stats are boosted by completing exercises. Each exercise is assigned a stat type and a stat reward value (e.g. Strength +2 per session completed). Stats are displayed in the Status Window on the Profile screen.

| Stat | Boosted by |
|---|---|
| Strength ⚔️ | Strength training exercises |
| Agility 💨 | Agility / speed exercises |
| Endurance 🛡️ | Cardio exercises |
| Intelligence 🧠 | Mental / study exercises |
| Vitality ❤️ | Flexibility exercises |

### Titles

Titles are awarded automatically when conditions are met. The most recently earned title is displayed on your player card.

| Title | Condition |
|---|---|
| Iron Will | Complete your first workout |
| Arise | Reach Level 5 |
| Shadow Soldier | Reach Level 10 |
| Double Dungeon | Reach Level 20 |
| Monarch's Gaze | Reach Level 35 |
| Shadow Monarch | Reach Level 50 |
| Absolute Being | Reach Level 70 |
| Strength Apostle | Strength stat ≥ 50 |
| Wind Dancer | Agility stat ≥ 50 |
| Iron Body | Endurance stat ≥ 50 |
| Brilliant Mind | Intelligence stat ≥ 50 |
| Undying | Vitality stat ≥ 50 |

### Missed Quest Penalty

Each plan can have a penalty EXP value (default 0). If a daily quest is not completed by the end of the day, the penalty is automatically deducted from your EXP the next time you open the app. A warning alert is shown telling you how much was deducted. Penalty cannot reduce EXP below zero.

### Bonus Exercises

Any session — including already-completed ones — can have bonus exercises added from the session screen. Bonus exercises give EXP if completed but carry no penalty if skipped. This lets you add extra work to a finished session without affecting your official quest record.

---

## Database

All data is stored in a local SQLite database file at:
```
/data/data/com.beyond.app/databases/SoloLeveling.db
```

This file is private to the app and persists through updates. It is deleted only when the app is uninstalled.

### Tables

| Table | Purpose |
|---|---|
| `player` | Single-row player profile: level, EXP, all stats, current title |
| `exercises` | All exercises with unit type, EXP per unit, stat rewards |
| `plans` | Workout plans with schedule and missed-quest penalty |
| `plan_exercises` | Join table: which exercises belong to which plan, with sets and target |
| `sessions` | Daily workout instances generated from active plans |
| `session_exercises` | Exercise rows inside a session with actual amounts completed |
| `bonus_exercises` | Optional exercises added to a session for extra EXP |
| `titles` | All earned titles with dates |

### Schema upgrades without data loss

The app uses a `safeAlter` approach to add new columns to existing tables on each launch:
```typescript
const safeAlter = async (sql: string) => {
  try { await db.execAsync(sql); } catch (_) {}
};
await safeAlter(`ALTER TABLE exercises ADD COLUMN unit_type TEXT DEFAULT 'reps'`);
```
This means updating the app never erases your existing player data, exercises, plans, or history.

---

## Sound Effects

The sound system uses `expo-audio`. Sounds are loaded once at startup and cached.
Sound failures are silent — the app continues normally if a sound file is missing.

| Sound event | Trigger |
|---|---|
| `boot` | App launches |
| `navigate` | Switching between tabs |
| `click` | Button taps on registration screen |
| `questStart` | Opening an active session |
| `exerciseDone` | Checking off an exercise |
| `sessionDone` | Completing a session without levelling up |
| `levelUp` | Levelling up after a session |
| `title` | Earning a new title |
| `penalty` | Missed quest penalty applied |
| `profile` | Opening the Profile screen |

All sound files live in `assets/sounds/`. To replace a sound, simply swap the file with a new one of the same name and format. Both `.mp3` and `.wav` are supported.

---

## Troubleshooting

### `npm install` fails with ERESOLVE

```
rmdir /s /q node_modules
del package-lock.json
npm install
```

If it still fails, check that these exact versions are in `package.json`:
- `react-native-safe-area-context`: `~5.6.0`
- `react-native-screens`: `~4.16.0`

These are the versions Expo SDK 54 officially requires for RN 0.81.5.

---

### "Project is incompatible with this version of Expo Go"

Your Expo Go app version must match the SDK version in the project. This project uses **Expo SDK 54**.

Check your Expo Go version: open Expo Go → tap your profile icon → SDK version is listed.

To get the matching Expo Go: https://expo.dev/go → select SDK 54 → download for Android.

---

### QR code scans but app does not load

Try tunnel mode:
```
npx expo start --tunnel
```

---

### Red error screen on phone

1. Shake the phone → tap Reload
2. Check the terminal for the full error message
3. If it mentions a missing module: `npx expo start --clear`

---

### EAS build fails

1. Go to https://expo.dev/builds and tap your failed build
2. Click **"View logs"** — the actual error is near the bottom

Common causes and fixes:

| Error message | Fix |
|---|---|
| `safe-area-context` C++ compile error | Set `react-native-safe-area-context` to `~5.6.0` in `package.json` |
| `react-native-screens` C++ compile error | Set `react-native-screens` to `~4.16.0` in `package.json` |
| `eas init` not run | Run `eas init` inside the project folder |
| Not logged in | Run `eas login` |
| `icon.png` not found | Remove `icon`, `splash`, `adaptiveIcon` fields from `app.json` or add the file |
| Keystore prompt | Answer `y` — EAS generates and stores it securely |

---

### App data gone after reinstall

Expected — the SQLite database is stored in the app's private storage and is wiped on uninstall. After reinstalling, the registration screen appears and you start fresh.

To reset data without uninstalling: Profile screen → scroll to bottom → **Reset All Data & Start Fresh**.

---

### Sound not playing

1. Check that the file exists in `assets/sounds/` with the exact filename used in `sounds.ts`
2. Check phone volume is not zero
3. Sounds play even in silent mode (`playsInSilentMode: true` is set)
4. Sound failures are silent — open Metro logs to see any warnings

---

### TypeScript errors in editor

```
npx tsc --noEmit
```

This checks all files without producing output. All errors must be zero before building.

---

## Package Versions

These exact versions are tested and working together. Do not change them without testing.

```json
"expo":                           "~54.0.35",
"expo-sqlite":                    "~16.0.10",
"expo-status-bar":                "~3.0.0",
"expo-asset":                     "~12.0.13",
"expo-audio":                     "~1.1.1",
"@react-navigation/native":       "~6.1.18",
"@react-navigation/native-stack": "~6.11.0",
"@react-navigation/bottom-tabs":  "~6.6.1",
"react":                          "19.1.0",
"react-native":                   "0.81.5",
"react-native-safe-area-context": "~5.6.0",
"react-native-screens":           "~4.16.0",
"react-native-gesture-handler":   "~2.31.2"
```

---

## Quick Reference

```bash
# Install dependencies (run once after cloning)
npm install

# Preview on phone via Expo Go
npx expo start

# Preview via tunnel (different WiFi / hotspot)
npx expo start --tunnel

# Clear Metro cache
npx expo start --clear

# Install EAS CLI (run once)
npm install -g eas-cli

# Log in to Expo
eas login

# Link project to your Expo account (run once)
eas init

# Build preview APK (for testing)
eas build --platform android --profile preview

# Build production APK (for release)
eas build --platform android --profile production

# Check TypeScript
npx tsc --noEmit
```