# ⚔ Solo Leveling System

A real-life RPG fitness tracker. No Java. No Android Studio. Works on Windows.

---

## Prerequisites (install once)

**Node.js** — https://nodejs.org — download the LTS version, run the installer.

Confirm it worked:
```
node --version
npm --version
```
Both should print a version number. If not, restart your terminal after installing.

**Expo Go** (on your Android phone) — install from the Play Store.

---

## Run the app (preview on your phone)

Open Command Prompt or PowerShell, navigate to the project folder, then:

```
cd SoloLevelingExpo
npm install
npx expo start
```

`npm install` runs once to download packages (~1–2 min).  
`npx expo start` starts the server and prints a **QR code**.

On your phone:
1. Open **Expo Go**
2. Tap **Scan QR code**
3. Point at the QR code in the terminal
4. App loads ✓

> Phone and PC must be on the **same WiFi**.  
> If it doesn't connect, run `npx expo start --tunnel` instead.

---

## Build an APK (no Expo Go, installs like a normal app)

Builds happen on Expo's servers — your PC does zero compilation.

**Step 1 — Create a free account at https://expo.dev**

**Step 2 — Install EAS CLI and log in**
```
npm install -g eas-cli
eas login
```

**Step 3 — Link the project to your account**
```
cd SoloLevelingExpo
eas init
```
Answer **Yes** when asked to create a new project.

**Step 4 — Build**
```
eas build --platform android --profile preview
```
- Answer **Yes** if asked to generate a keystore
- Build takes ~5–15 minutes on Expo's cloud
- A download link appears when done
- Also viewable at: https://expo.dev/builds

**Step 5 — Install on your phone**
1. Open the download link on your phone
2. Tap the `.apk` file
3. If Android blocks it: Settings → Security → **Install unknown apps** → allow your browser
4. Tap Install

---

## Troubleshooting

| Problem | Fix |
|---|---|
| `ERESOLVE` dependency error | `rm -rf node_modules` then `npm install` |
| `PluginError` on `npx expo start` | Make sure `app.json` only has `"expo-sqlite"` in plugins — no reanimated |
| QR code won't connect | Run `npx expo start --tunnel` |
| Red error screen on phone | Shake phone → Reload, or check terminal for the message |
| Metro cache issues | `npx expo start --clear` |
| EAS build fails | Check logs at https://expo.dev/builds |
| App data wiped | Expected — SQLite is deleted when the app is uninstalled |

---

## Dependency versions

All three navigation packages must be the same major version (v7):

```
@react-navigation/native        ^7.2.5
@react-navigation/native-stack  ^7.16.0
@react-navigation/bottom-tabs   ^7.16.2
expo                            ~56.0.8
expo-sqlite                     ^56.0.4
react-native                    0.85.3
```

`react-native-reanimated` is **not** used in this project. If you see a
`PluginError` about reanimated, check that `app.json` plugins only contains
`"expo-sqlite"` and that `babel.config.js` has no `react-native-reanimated/plugin` line.