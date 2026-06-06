# ⚔ Solo Leveling System

A real-life RPG fitness tracker inspired by the System UI from *Solo Leveling*.
Complete workouts to earn EXP, level up, unlock ranks from E to National Level,
and earn titles based on your performance. Everything runs offline — no accounts,
no servers, no internet required.

---

## Screenshots (UI Preview)

| Registration | Dashboard | Active Session | Level Up |
|---|---|---|---|
| 3-step wizard | Player card + daily quests | Check off exercises | Animated overlay |

The app uses a dark navy and cyan colour palette inspired directly by the System
windows in the manhwa.

---

## Features

- **Hunter Registration** — One-time setup: name, age, weight, height
- **Custom Exercises** — Create any exercise with your own EXP reward and stat boost
- **Workout Plans** — Group exercises into named plans with set/rep configuration
- **Repeat Scheduling** — Set plans to repeat on specific weekdays (Mon–Sun)
- **Daily Quests** — Sessions auto-generate each morning from your active plans
- **EXP System** — Escalating EXP curve: `100 × level^1.5`
- **5 Stats** — Strength, Agility, Endurance, Intelligence, Vitality
- **Rank Progression** — E → D → C → B → A → S → SS → National Level Hunter
- **12 Titles** — Awarded automatically for hitting milestones (levels and stat thresholds)
- **Level-Up Modal** — Full-screen animated overlay when you level up
- **10% Full-Clear Bonus** — Complete every exercise in a session for bonus EXP
- **Session History** — View past sessions and total EXP earned
- **Fully Offline** — SQLite local storage, no internet needed

---

## Tech Stack

| Technology | Version | Purpose |
|---|---|---|
| Expo | ~54.0.35 | Build toolchain and cloud APK builds |
| React Native | 0.81.5 | Core mobile framework |
| React | 19.1.0 | UI library |
| TypeScript | ~5.8.3 | Type-safe JavaScript |
| expo-sqlite | ~16.0.10 | Local SQLite database |
| React Navigation | ~6.x | Screen navigation |
| EAS Build | latest CLI | Cloud APK/AAB compilation |

---

## Prerequisites

You only need two things to run this project:

### 1 — Node.js

Download from https://nodejs.org — choose the **LTS** version (the green button).
Run the installer with all default options.

Verify the install worked by opening a terminal and running:
```
node --version
npm --version
```
Both should print version numbers. If they don't, restart your terminal.

### 2 — Expo Go (on your Android phone)

Install **Expo Go** from the Google Play Store on your Android phone.
This app lets you preview the project by scanning a QR code — no APK needed.

---

## Running for the First Time

Open a terminal (Command Prompt or PowerShell on Windows), then run:

```bash
cd SoloLevelingFinal
npm install
npx expo start
```

### What each command does

**`npm install`**
Downloads all the packages listed in `package.json` into a `node_modules/` folder.
This only needs to run once, or when you add/remove packages.
Takes 1–3 minutes on first run.

**`npx expo start`**
Starts the Metro bundler — a development server that compiles your TypeScript
files and serves them to the phone.
A QR code appears in the terminal when it's ready.

### Connecting your phone

1. Make sure your phone and computer are on the **same WiFi network**
2. Open **Expo Go** on your phone
3. Tap **"Scan QR code"**
4. Point your camera at the QR code in the terminal
5. The app loads in a few seconds

Every time you save a file in your editor, the app reloads on your phone automatically.

> **If the QR code doesn't connect:**
> Run `npx expo start --tunnel` instead. Tunnel mode routes through Expo's servers
> and works even when phone and PC are on different networks (e.g. phone on mobile data).

---

## Building an APK

An APK is a standalone Android app file that installs like any normal app —
no Expo Go required. Builds happen on Expo's cloud servers so your PC
does zero compilation. You do not need Java, Android Studio, or any native tools.

### Step 1 — Create a free Expo account

Go to https://expo.dev and sign up. The free tier is enough for everything here.

### Step 2 — Install EAS CLI

EAS (Expo Application Services) is the cloud build service.

```bash
npm install -g eas-cli
```

The `-g` flag installs it globally so you can use it from any folder.

### Step 3 — Log in to your Expo account

```bash
eas login
```

Enter the email and password you used on expo.dev.

### Step 4 — Link the project to your account

Run this from inside the project folder:

```bash
cd SoloLevelingFinal
eas init
```

When asked "Would you like to create a new EAS project?", type **y** and press Enter.
This writes your project ID into `app.json`.

### Step 5 — Start the build

```bash
eas build --platform android --profile preview
```

What happens:
- Your source code is uploaded to Expo's build servers
- Expo compiles it into a real Android APK in the cloud
- You see live build progress in the terminal
- When done (usually 5–15 minutes), you get a download link

You can also monitor the build and download the APK at:
**https://expo.dev/builds**

### Step 6 — Install the APK on your phone

**Option A — Direct download on phone:**
Open the download link directly on your Android phone and tap the APK file.

**Option B — Transfer from PC:**
Download the APK to your PC, then transfer it to your phone via USB cable or
send it to yourself via email/messaging app.

**Enabling installation from unknown sources:**

Android blocks APK installs from outside the Play Store by default.
To allow it:

- **Android 8+:** Settings → Apps → Special app access → Install unknown apps →
  select your browser or file manager → allow
- **Older Android:** Settings → Security → Unknown sources → enable

Then tap the APK file and tap **Install**.

---

## Build Profiles

The `eas.json` file defines two build profiles:

```json
{
  "build": {
    "preview": {
      "android": { "buildType": "apk" }
    },
    "production": {
      "android": { "buildType": "apk" }
    }
  }
}
```

| Profile | Command | Use for |
|---|---|---|
| `preview` | `eas build --platform android --profile preview` | Testing — fast build, APK format |
| `production` | `eas build --platform android --profile production` | Final release APK |

Both produce APK files. If you ever want to publish to the Play Store,
change `"buildType": "apk"` to `"buildType": "aab"` for the production profile
(Play Store requires AAB format).

---

## Project Structure

```
SoloLevelingFinal/
│
├── index.ts                  App entry point
├── App.tsx                   Root component — navigation and database init
├── app.json                  Expo config (name, package ID, SDK version)
├── package.json              All dependencies with exact versions
├── eas.json                  EAS cloud build configuration
├── babel.config.js           Babel transpiler config
├── tsconfig.json             TypeScript compiler config
├── .gitignore                Files excluded from Git version control
│
└── src/
    ├── constants/
    │   └── game.ts           Ranks, EXP formula, stats, titles, colour palette
    │
    ├── database/
    │   └── Database.ts       All SQLite tables and CRUD operations
    │
    ├── components/
    │   ├── UIComponents.tsx  SystemPanel, SystemButton, ExpBar, StatRow, etc.
    │   └── LevelUpModal.tsx  Animated level-up full-screen overlay
    │
    └── screens/
        ├── RegistrationScreen.tsx   First-launch 3-step wizard
        ├── DashboardScreen.tsx      Home — player card, stats, daily quests
        ├── ExercisesScreen.tsx      Create and manage custom exercises
        ├── PlansScreen.tsx          Build plans, assign exercises, schedule days
        ├── SessionScreen.tsx        Active workout — check off exercises, earn EXP
        └── ProfileScreen.tsx        Full stats, rank, earned titles, history
```

---

## Database

All data is stored locally in a SQLite database at:
```
/data/data/com.sololevelingsystem.app/databases/SoloLeveling.db
```

This file is private to the app. It persists through app updates but is
deleted when the app is uninstalled.

### Tables

| Table | Purpose |
|---|---|
| `player` | Single-row player profile (level, EXP, all 5 stats, title) |
| `exercises` | All custom exercises created by the player |
| `plans` | Workout plans with name and repeat schedule |
| `plan_exercises` | Join table — which exercises belong to which plan |
| `sessions` | Daily workout instances generated from active plans |
| `session_exercises` | Individual exercise rows within a session |
| `titles` | All earned titles with dates |

---

## Rank System

| Rank | Minimum Level | Colour |
|---|---|---|
| E | 1 | Grey |
| D | 10 | Green |
| C | 20 | Blue |
| B | 35 | Purple |
| A | 50 | Orange |
| S | 70 | Gold |
| SS | 90 | Red |
| National | 99 | Cyan |

---

## Title System

Titles are awarded automatically when conditions are met. Currently 12 titles:

| Title | Condition |
|---|---|
| Iron Will | Complete your first workout |
| Arise | Reach Level 5 |
| Shadow Soldier | Reach Level 10 |
| Double Dungeon | Reach Level 20 |
| Monarch's Gaze | Reach Level 35 |
| Shadow Monarch | Reach Level 50 |
| Absolute Being | Reach Level 70 |
| Strength Apostle | Strength stat reaches 50 |
| Wind Dancer | Agility stat reaches 50 |
| Iron Body | Endurance stat reaches 50 |
| Brilliant Mind | Intelligence stat reaches 50 |
| Undying | Vitality stat reaches 50 |

---

## Troubleshooting

### `npm install` fails with ERESOLVE

```bash
rmdir /s /q node_modules     # Windows
del package-lock.json        # Windows
npm install
```

If it still fails, the versions in `package.json` may conflict.
The key constraint: `react-native-safe-area-context` must be `~5.6.0`
and `react-native-screens` must be `~4.16.0` for RN 0.81.5 compatibility.

---

### "Project is incompatible with this version of Expo Go"

Your installed Expo Go version must match the SDK version in `package.json`.
This project uses **Expo SDK 54**. Check which SDK your Expo Go supports:
open Expo Go → tap your profile/settings icon → SDK version is shown.

If they don't match, either:
- Update Expo Go via the Play Store, or
- Download the matching Expo Go from https://expo.dev/go

---

### QR code scans but app doesn't load

Try tunnel mode:
```bash
npx expo start --tunnel
```

Tunnel bypasses WiFi restrictions by routing through Expo's servers.

---

### Red error screen on phone

Shake the phone (or press `r` in the Metro terminal) to reload.
The full error message is printed in the terminal — that's where to look first.

For a fresh start:
```bash
npx expo start --clear
```

---

### EAS build fails

1. Check the full build logs at https://expo.dev/builds (tap your failed build)
2. The most common causes and fixes:

| Error | Fix |
|---|---|
| `safe-area-context` C++ compile error | Set version to `~5.6.0` in package.json |
| `react-native-screens` C++ compile error | Set version to `~4.16.0` in package.json |
| `eas init` not run | Run `eas init` from the project folder |
| Not logged in | Run `eas login` |

---

### App data is gone after reinstall

Expected behaviour. The SQLite database is stored in the app's private storage
and is wiped when the app is uninstalled. After reinstalling, the registration
screen will appear and you start fresh.

---

### TypeScript errors in editor

```bash
npx tsc --noEmit
```

This runs the TypeScript compiler without producing output files — it just
reports errors. All errors must be zero before building.

---

## Exact Package Versions (reference)

These are the tested, working versions. Do not change them without testing.

```json
"expo":                            "~54.0.35",
"expo-sqlite":                     "~16.0.10",
"expo-status-bar":                 "~3.0.0",
"expo-asset":                      "~12.0.13",
"@react-navigation/native":        "~6.1.18",
"@react-navigation/native-stack":  "~6.11.0",
"@react-navigation/bottom-tabs":   "~6.6.1",
"react":                           "19.1.0",
"react-native":                    "0.81.5",
"react-native-safe-area-context":  "~5.6.0",
"react-native-screens":            "~4.16.0",
"react-native-gesture-handler":    "~2.28.0"
```

---

## Contributing / Modifying

### Adding a new exercise category
Edit `EXERCISE_CATEGORIES` in `src/constants/game.ts`. No other file needs changing.

### Adding a new title
Edit `TITLE_CONDITIONS` in `src/constants/game.ts`. No other file needs changing.

### Changing the EXP curve
Edit `expRequiredForLevel` in `src/constants/game.ts`. Change the `1.5` exponent.
Lower = easier. Higher = harder.

### Adding a new screen
1. Create the screen file in `src/screens/`
2. Add it to `RootStackParamList` or `TabParamList` in `App.tsx`
3. Add a `<Stack.Screen>` or `<Tab.Screen>` entry in `App.tsx`

See `development.md` for detailed step-by-step instructions on all of the above.

---

## License

Personal use project. Solo Leveling IP belongs to Chugong / D&C Media / Kakao Entertainment.
This app is not affiliated with or endorsed by the original creators.
