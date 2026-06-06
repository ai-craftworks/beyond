# Solo Leveling System — Developer Documentation

This document explains every file, every function, and every concept in this project.
It is written for someone who is new to React Native and mobile development.
Read it top to bottom the first time, then use it as a reference later.

---

## Table of Contents

1. [What is this app, technically?](#1-what-is-this-app-technically)
2. [How the project is structured](#2-how-the-project-is-structured)
3. [How React Native works (quick primer)](#3-how-react-native-works-quick-primer)
4. [Entry point — index.ts](#4-entry-point--indexts)
5. [Root component — App.tsx](#5-root-component--apptsx)
6. [Constants — src/constants/game.ts](#6-constants--srcconstantsgamets)
7. [Database — src/database/Database.ts](#7-database--srcdatabasedatabasets)
8. [Shared components — src/components/](#8-shared-components--srccomponents)
9. [Screens — src/screens/](#9-screens--srcscreens)
10. [How data flows through the app](#10-how-data-flows-through-the-app)
11. [How the game mechanics work](#11-how-the-game-mechanics-work)
12. [How to add new features](#12-how-to-add-new-features)

---

## 1. What is this app, technically?

This is a **React Native** app built with **Expo**.

- **React Native** is a framework that lets you write JavaScript/TypeScript code that runs as a real native Android or iOS app — not a website inside a browser.
- **Expo** is a toolchain that sits on top of React Native and handles the hard parts: building APKs, managing native modules, running a preview server.
- **TypeScript** is JavaScript with types. Instead of `let name = "Bhaswanth"`, you write `let name: string = "Bhaswanth"`. This catches mistakes before you even run the code.
- **SQLite** is a local database that lives as a single file on the phone. There is no internet, no server, no account needed. All data stays on the device.

---

## 2. How the project is structured

```
SoloLevelingFinal/
│
├── index.ts                  ← The very first file that runs
├── App.tsx                   ← Root of the entire app (navigation lives here)
├── app.json                  ← Expo config: app name, package ID, icons
├── package.json              ← All dependencies and their versions
├── babel.config.js           ← Code transpiler config (you rarely touch this)
├── tsconfig.json             ← TypeScript rules
├── eas.json                  ← Cloud build config for EAS Build
│
└── src/
    ├── constants/
    │   └── game.ts           ← All game numbers, colours, ranks, titles
    │
    ├── database/
    │   └── Database.ts       ← Every database read/write function
    │
    ├── components/
    │   ├── UIComponents.tsx  ← Reusable styled pieces (buttons, inputs, etc.)
    │   └── LevelUpModal.tsx  ← The animated level-up overlay
    │
    └── screens/
        ├── RegistrationScreen.tsx  ← First-launch wizard
        ├── DashboardScreen.tsx     ← Home screen / today's quests
        ├── ExercisesScreen.tsx     ← Exercise library
        ├── PlansScreen.tsx         ← Workout plan builder
        ├── SessionScreen.tsx       ← Active workout session
        └── ProfileScreen.tsx       ← Player stats and titles
```

**The golden rule:** screens talk to the database and display the result. They never contain raw SQL. They never talk to each other directly. All shared logic lives in `constants/` or `database/`.

---

## 3. How React Native works (quick primer)

If you are new to React Native, here are the three concepts you need to understand everything else.

### Components
A component is a function that returns UI. Everything you see on screen is a component.

```typescript
// This is a component. It's just a function.
const MyBox = () => {
  return (
    <View style={{ backgroundColor: 'blue', padding: 20 }}>
      <Text style={{ color: 'white' }}>Hello!</Text>
    </View>
  );
};
```

`View` is like a `div` in HTML. `Text` is like a `p`. React Native has its own set of built-in components.

### State
State is data that, when it changes, causes the component to re-render (redraw itself).

```typescript
const [level, setLevel] = useState(1);
// level = the current value
// setLevel = the function to change it
// When you call setLevel(2), the component redraws with level = 2
```

### useEffect
`useEffect` runs code when the component first appears on screen (or when specific values change).

```typescript
useEffect(() => {
  loadData(); // runs once when screen opens
}, []); // the empty [] means "only run once on mount"
```

---

## 4. Entry point — `index.ts`

```typescript
import { registerRootComponent } from 'expo';
import App from './App';
registerRootComponent(App);
```

**What this does:**
This is the very first file Android runs when the app launches. It has one job: tell Expo "this is the root component of the app". Think of it like the front door — it just points inside to `App.tsx`. You will never need to change this file.

---

## 5. Root component — `App.tsx`

This is the most important file in the project. It does three things:

### 5.1 — Bootstrap the app

```typescript
const bootstrap = async () => {
  await initDatabase();        // create all SQLite tables if they don't exist yet
  const player = await getPlayer(); // check if a player has registered before
  setAppState(player ? 'main' : 'register'); // decide which screen to show
};
```

Every single time the app opens, this function runs first. It:
1. Creates the database tables (safe to run every time — it uses `CREATE TABLE IF NOT EXISTS`)
2. Checks if a player row exists in the database
3. If yes → go to the main app. If no → go to registration.

### 5.2 — Define navigation types

```typescript
export type RootStackParamList = {
  Registration: undefined;   // no parameters needed
  Main: undefined;           // no parameters needed
  Session: { sessionId: number }; // needs a sessionId number
};

export type TabParamList = {
  Dashboard: undefined;
  Exercises: undefined;
  Plans: undefined;
  Profile: undefined;
};
```

These TypeScript types are exported so every screen can use them. They define which screens exist and what data each screen needs when you navigate to it. For example, the `Session` screen needs a `sessionId` so it knows which session to load.

### 5.3 — Build the navigation tree

The app has two navigators nested inside each other:

```
RootStack (NativeStackNavigator)
├── Registration      ← shown only on first launch
├── Main              ← the bottom tab navigator
│   ├── Dashboard
│   ├── Exercises
│   ├── Plans
│   └── Profile
└── Session           ← full screen, no tab bar visible
```

**Why two navigators?**
The `Session` screen needs to cover the entire screen including hiding the tab bar. That's only possible if it lives in the root stack, not inside the tabs. When you navigate to `Session`, the tab bar disappears automatically.

**`NativeStackNavigator`** — handles screen transitions (slide, fade) and the back button.

**`BottomTabNavigator`** — the four tabs at the bottom of the screen.

---

## 6. Constants — `src/constants/game.ts`

This file contains all the numbers that define how the game works. If you want to make levelling faster or slower, add more ranks, add new titles — you only change this one file.

### 6.1 — RANKS

```typescript
export const RANKS = [
  { rank: 'E', label: 'E-Rank Hunter', minLevel: 1,  color: '#9E9E9E' },
  { rank: 'D', label: 'D-Rank Hunter', minLevel: 10, color: '#4CAF50' },
  // ... and so on up to National
];
```

Each rank has:
- `rank` — the short letter shown in badges
- `label` — the full name shown in the profile
- `minLevel` — the minimum level needed to have this rank
- `color` — the hex colour used for this rank across the whole UI

### 6.2 — `getRankForLevel(level)`

```typescript
export const getRankForLevel = (level: number) => {
  for (let i = RANKS.length - 1; i >= 0; i--) {
    if (level >= RANKS[i].minLevel) return RANKS[i];
  }
  return RANKS[0];
};
```

**What it does:** Given a level number, returns the correct rank object.

**How it works:** It loops through the RANKS array backwards (from highest to lowest). The first rank where `level >= minLevel` is the correct one. Walking backwards means it finds the highest rank the player qualifies for.

**Example:** Level 25 → loops back: National needs 99 (no), SS needs 90 (no), S needs 70 (no), A needs 50 (no), B needs 35 (no), C needs 20 → yes! Returns C-Rank.

### 6.3 — `expRequiredForLevel(level)`

```typescript
export const expRequiredForLevel = (level: number): number =>
  Math.floor(100 * Math.pow(level, 1.5));
```

**What it does:** Returns how much EXP is needed to get through a given level.

**The formula:** `100 × level^1.5`
- Level 1 needs 100 EXP
- Level 5 needs 559 EXP
- Level 10 needs 3162 EXP
- Level 50 needs 35,355 EXP

The `^1.5` exponent makes early levels fast and high levels feel like a real grind — exactly like the manhwa.

**To make levelling easier:** Change `1.5` to `1.2`. To make it harder, use `1.8`.

### 6.4 — `calculateLevelFromTotalExp(totalExp)`

```typescript
export const calculateLevelFromTotalExp = (totalExp: number) => {
  let level = 1;
  let remaining = totalExp;
  while (level < 100) {
    const needed = expRequiredForLevel(level);
    if (remaining < needed) break;
    remaining -= needed;
    level++;
  }
  return { level, expInCurrentLevel: remaining, expToNext: expRequiredForLevel(level) };
};
```

**What it does:** Takes the total EXP ever earned (e.g. 5000) and figures out what level the player should be.

**How it works:** It keeps subtracting level thresholds from the total EXP until it can't subtract anymore. Whatever level it stopped at is the current level. Whatever EXP was left over is the EXP in the current level.

**Example:** 400 total EXP. Level 1 costs 100 → remaining = 300. Level 2 costs 283 → remaining = 17. Level 3 costs 520 → 17 < 520, stop. Result: Level 3, 17 EXP in.

### 6.5 — STATS

```typescript
export const STATS = [
  { key: 'strength',     label: 'Strength',     icon: '⚔️',  color: '#FF6B6B' },
  { key: 'agility',      label: 'Agility',      icon: '💨',  color: '#00BCD4' },
  { key: 'endurance',    label: 'Endurance',    icon: '🛡️',  color: '#4CAF50' },
  { key: 'intelligence', label: 'Intelligence', icon: '🧠',  color: '#AB47BC' },
  { key: 'vitality',     label: 'Vitality',     icon: '❤️',  color: '#FF9800' },
] as const;
```

The `key` field is critical — it exactly matches the column name in the `player` database table. This is how screens can do `(player as any)[stat.key]` to dynamically read any stat value without writing five separate lines of code.

### 6.6 — EXERCISE_CATEGORIES

```typescript
export const EXERCISE_CATEGORIES = [
  { value: 'strength',    label: 'Strength',    stat: 'strength'     },
  { value: 'cardio',      label: 'Cardio',      stat: 'endurance'    },
  { value: 'agility',     label: 'Agility',     stat: 'agility'      },
  { value: 'flexibility', label: 'Flexibility', stat: 'vitality'     },
  { value: 'mental',      label: 'Mental',      stat: 'intelligence' },
];
```

This maps a workout category to which stat it boosts. When a player creates a "Cardio" exercise, the `stat` field automatically becomes `endurance`. The ExercisesScreen uses this to auto-fill the stat selector when a category is chosen.

### 6.7 — TITLE_CONDITIONS

```typescript
export const TITLE_CONDITIONS = [
  {
    title: 'Iron Will',
    description: 'Completed your very first workout.',
    check: (p: PlayerSnapshot) => p.level >= 1
  },
  {
    title: 'Shadow Monarch',
    description: 'Reached Level 50. You stand alone.',
    check: (p: PlayerSnapshot) => p.level >= 50
  },
  // ... 10 more conditions
];
```

Each title condition has a `check` function that receives the player's current stats and returns `true` if the title should be awarded. After every session, `SessionScreen` loops through all conditions and awards any new ones.

**To add a new title:** Just add a new object to this array. No other file needs changing.

### 6.8 — COLORS

```typescript
export const COLORS = {
  bgPrimary:   '#0A0E1A',   // deepest dark navy — used as page background
  bgSecondary: '#0D1526',   // card background
  accentCyan:  '#00D4FF',   // the main highlight colour — buttons, borders, EXP bar
  accentGold:  '#FFD700',   // used for level numbers and title text
  textPrimary: '#E8F4FD',   // near-white main text
  // ... and more
};
```

Every single colour in the app comes from this object. If you want to change the theme, this is the only place you need to edit.

---

## 7. Database — `src/database/Database.ts`

This file contains every database operation in the app. Screens import functions from here — they never write SQL themselves.

### 7.1 — What is SQLite?

SQLite is a database that lives as a single file on the phone at:
```
/data/data/com.sololevelingsystem.app/databases/SoloLeveling.db
```

It works like any SQL database (tables, rows, columns) but requires no server. The `expo-sqlite` package gives us JavaScript functions to talk to it.

### 7.2 — The singleton connection

```typescript
let _db: SQLite.SQLiteDatabase | null = null;

export const getDb = async (): Promise<SQLite.SQLiteDatabase> => {
  if (_db) return _db;
  _db = await SQLite.openDatabaseAsync('SoloLeveling.db');
  return _db;
};
```

**What this does:** Opens a connection to the database file. The first time it's called, it opens the file and saves the connection in `_db`. Every time after that, it just returns the saved connection.

**Why:** Opening a database connection is slow. By saving it, we only pay that cost once per app session. This pattern is called a "singleton."

### 7.3 — `initDatabase()`

```typescript
export const initDatabase = async (): Promise<void> => {
  const db = await getDb();
  await db.execAsync(`
    PRAGMA journal_mode = WAL;
    CREATE TABLE IF NOT EXISTS player ( ... );
    CREATE TABLE IF NOT EXISTS exercises ( ... );
    CREATE TABLE IF NOT EXISTS plans ( ... );
    CREATE TABLE IF NOT EXISTS plan_exercises ( ... );
    CREATE TABLE IF NOT EXISTS sessions ( ... );
    CREATE TABLE IF NOT EXISTS session_exercises ( ... );
    CREATE TABLE IF NOT EXISTS titles ( ... );
  `);
};
```

**What this does:** Creates all 7 tables. Called once when the app boots.

**`CREATE TABLE IF NOT EXISTS`** means "create this table, but if it already exists, do nothing." This makes it safe to call every time the app starts.

**`PRAGMA journal_mode = WAL`** — WAL (Write-Ahead Logging) is a performance setting that makes writes faster and safer.

### 7.4 — The 7 database tables

| Table | What it stores | Key columns |
|---|---|---|
| `player` | The single player profile | level, exp, stats, title |
| `exercises` | All custom exercises | name, exp_reward, stat_type, stat_reward |
| `plans` | Workout plans | name, is_active, repeat_days (JSON) |
| `plan_exercises` | Which exercises are in which plan | plan_id, exercise_id, sets, reps |
| `sessions` | Daily workout instances | plan_id, date, status, total_exp |
| `session_exercises` | Individual exercises inside a session | session_id, exercise_name, is_completed |
| `titles` | Earned titles | title, description, earned_at |

**Foreign keys:** `plan_exercises` has `ON DELETE CASCADE` which means if you delete a plan, all its exercises are automatically deleted too. Same for sessions and session_exercises.

### 7.5 — Player functions

**`createPlayer(name, age, weight, height)`**
Inserts one row into the `player` table. Called once from `RegistrationScreen`. All other fields (level, exp, stats) start at their default values defined in the `CREATE TABLE` statement.

**`getPlayer()`**
Returns the single player row. Uses `getFirstAsync` which returns one row or null. Every screen that needs player data calls this.

**`updatePlayer(updates)`**
```typescript
export const updatePlayer = async (updates: Partial<Player>): Promise<void> => {
  const keys = Object.keys(updates);
  const fields = keys.map(k => `${k} = ?`).join(', ');
  await db.runAsync(`UPDATE player SET ${fields} WHERE id = 1`, Object.values(updates));
};
```
Takes an object with only the fields that changed and builds a dynamic UPDATE statement. For example, `updatePlayer({ level: 5, strength: 15 })` generates `UPDATE player SET level = ?, strength = ? WHERE id = 1`. This way you never have to write a separate function for every field.

### 7.6 — Exercise functions

**`createExercise(exercise)`** — Inserts a new exercise and returns its new ID (called `lastInsertRowId`).

**`getExercises()`** — Returns all exercises ordered newest first using `getAllAsync`.

**`deleteExercise(id)`** — Deletes one exercise. Because `plan_exercises` has `ON DELETE CASCADE`, the exercise is also removed from any plans it belongs to.

### 7.7 — Plan functions

**`createPlan(plan)`** — Inserts a new plan. The `repeat_days` field is stored as a JSON string like `'["Mon","Wed","Fri"]'` because SQLite doesn't have an array type.

**`getPlanExercises(planId)`** — This is the most complex query in the app:
```sql
SELECT pe.*, e.name as exercise_name, e.exp_reward, e.stat_type, e.stat_reward
FROM plan_exercises pe
JOIN exercises e ON pe.exercise_id = e.id
WHERE pe.plan_id = ?
ORDER BY pe.order_index
```
It joins `plan_exercises` with `exercises` so you get the exercise name and reward info alongside the sets and reps. This avoids making two separate database calls.

**`updatePlan(id, updates)`** — Works the same as `updatePlayer` — builds a dynamic UPDATE from whatever fields you pass in. Used to toggle `is_active` and update `repeat_days`.

### 7.8 — Session functions

**`createSession(plan)`** — Creates a new session row for today. Gets today's date with `new Date().toISOString().split('T')[0]` which gives `"2026-06-05"` format.

**`populateSessionExercises(sessionId, planId)`** — After creating a session, this copies all exercises from the plan into the session. This is a "snapshot" — if you later edit the plan, the session's exercises don't change. This is important for history accuracy.

**`getTodaySessions()`** — Returns all sessions where `date` equals today's date string. Used by DashboardScreen to show the quest list.

**`completeSessionExercise(id)`** — Sets `is_completed = 1` for a single exercise row. This is what happens when a player taps an exercise in the session screen.

**`updateSession(id, updates)`** — Updates a session's status, timestamps, and total EXP. Called twice during a session: once when started (status → `in_progress`), once when finished (status → `completed`).

### 7.9 — Title functions

**`saveTitle(title, description)`**
```typescript
try {
  await db.runAsync(`INSERT INTO titles (title, description) VALUES (?, ?)`, [...]);
  return true;  // new title — was inserted
} catch {
  return false; // already earned — UNIQUE constraint blocked the insert
}
```
The `titles` table has `UNIQUE` on the `title` column. If you try to insert the same title twice, SQLite throws an error. We catch that error and return `false` instead. This is intentional — it's a clean way to handle "already earned" without doing a SELECT first.

---

## 8. Shared components — `src/components/`

### 8.1 — `UIComponents.tsx`

This file has 8 reusable components used by multiple screens. They all follow the Solo Leveling dark navy / cyan design.

**`SystemPanel`** — The glowing card container. Used as the wrapper for almost every section on screen.
```typescript
<SystemPanel glow>          // glow=true adds a cyan border shadow
  <Text>Content here</Text>
</SystemPanel>
```

**`SystemButton`** — The styled button with 4 visual variants:
- `primary` (default) — solid cyan background, dark text
- `secondary` — blue background
- `danger` — red background
- `ghost` — transparent with cyan border

Has a `loading` prop that replaces the text with a spinner automatically.

**`SystemInput`** — A labelled text field. Takes a `label` (shown above), `value`, and `onChangeText`. Has `keyboardType` for numeric inputs and `multiline` for text areas.

**`SectionHeader`** — The title row used at the top of each panel. Can have a subtitle and an optional action link (like "+ Create") on the right.

**`StatRow`** — One row in the stats list. Shows an icon, label, optional progress bar, and value. The `showBar` prop enables the progress bar, and `maxValue` sets what 100% looks like.

**`ExpBar`** — The horizontal EXP progress bar at the top of the player card. Takes `current` and `max` values and calculates the fill percentage automatically.

**`RankBadge`** — The small bordered rank letter chip (E, D, C...). Takes a `color` prop from the rank object.

**`EmptyState`** — Shown when a list has no items. Shows a big icon, title text, and optional subtitle.

### 8.2 — `LevelUpModal.tsx`

This is the dramatic full-screen overlay shown when the player levels up after completing a session.

**How the animation works:**

```typescript
// Three animated values are set up
const scaleAnim   = useRef(new Animated.Value(0.4)).current;  // starts small
const opacityAnim = useRef(new Animated.Value(0)).current;    // starts invisible
const pulseAnim   = useRef(new Animated.Value(0.5)).current;  // for the blinking header
```

When `visible` becomes `true`:
1. `scaleAnim` springs from 0.4 to 1.0 — the card bounces into view
2. `opacityAnim` fades from 0 to 1 — the card fades in at the same time
3. After those finish, `pulseAnim` starts looping — the "◆ LEVEL UP ◆" text pulses between 50% and 100% opacity continuously

```typescript
Animated.parallel([
  Animated.spring(scaleAnim,   { toValue: 1, friction: 6, ... }),
  Animated.timing(opacityAnim, { toValue: 1, duration: 350, ... }),
]).start(() => {
  // this callback runs AFTER the entry animation finishes
  Animated.loop( ... pulseAnim ... ).start();
});
```

`Animated.parallel` runs two animations at the same time. The `.start(callback)` fires the callback when both are done.

The modal also shows the `newTitle` if one was earned in the same session, displayed in a gold banner.

---

## 9. Screens — `src/screens/`

### 9.1 — `RegistrationScreen.tsx`

**Purpose:** Shown only on first launch. Collects player info in 3 steps.

**Step management:**
```typescript
const [step, setStep] = useState(0); // 0 = Identity, 1 = Physical, 2 = Confirm
```
The screen renders different form content based on the current `step` value. This is called a "wizard" pattern.

**`handleNext()`** — Validates the current step's fields. If anything is missing or invalid, it calls `Alert.alert()` to show a popup. If valid, calls `setStep(step + 1)` to advance.

**`handleRegister()`** — Called on the final step. Calls `createPlayer()` with the collected data, then calls `navigation.replace('Main')`. `replace` is used instead of `navigate` so the user cannot press the Android back button to return to registration.

**Scan animation:** A `useRef(new Animated.Value(0.3))` that loops between 0.3 and 1.0 opacity, making the "◈ SYSTEM INITIALISED ◈" text pulse on screen.

---

### 9.2 — `DashboardScreen.tsx`

**Purpose:** The home screen. Shows the player card, stats overview, and today's workout sessions as "quests."

**`useFocusEffect`:**
```typescript
useFocusEffect(
  useCallback(() => { loadData(); }, [])
);
```
This is different from `useEffect`. It runs every time the screen comes into focus — not just when it first mounts. So when you finish a session and come back to the dashboard, it automatically reloads and shows the updated completed status.

**`generateTodaySessions()`** — This is the most important function in the screen:
```typescript
for (const plan of plans) {
  if (!plan.is_active) continue;                    // skip inactive plans
  const days = JSON.parse(plan.repeat_days);        // parse ["Mon","Wed"] from string
  if (days.length > 0 && !days.includes(todayDay)) continue; // skip if not scheduled today
  if (existing.some(s => s.plan_id === plan.id))    continue; // skip if session exists
  const sessionId = await createSession(plan);      // create a new session
  await populateSessionExercises(sessionId, plan.id);
}
```
This runs every time the screen focuses. It is safe to run multiple times because it checks if a session already exists before creating one. This is called "idempotent" — running it 10 times has the same result as running it once.

**`QuestCard`** sub-component — A small component defined inside the same file that renders one session as a tappable card. If the session is completed or skipped, `disabled={true}` prevents tapping it again.

---

### 9.3 — `ExercisesScreen.tsx`

**Purpose:** Shows all created exercises and lets the player create new ones via a bottom sheet modal.

**Modal pattern:**
```typescript
const [modal, setModal] = useState(false);
// ...
<Modal visible={modal} animationType="slide" transparent ...>
```
A `Modal` component wraps the create form. `visible={modal}` shows/hides it. `animationType="slide"` makes it slide up from the bottom. `transparent` allows the dimmed overlay behind it.

**`handleCreate()`** — Validates that the name is filled, EXP reward is a number, and stat reward is a number. Then calls `createExercise()` and reloads the list.

**Left border colour:** Each exercise card has its left border coloured to match its primary stat. This is calculated by looking up the category → stat → colour chain:
```
category "cardio" → stat "endurance" → color "#4CAF50" (green)
```

---

### 9.4 — `PlansScreen.tsx`

**Purpose:** Create and manage workout plans. Assign exercises to plans. Set which days of the week they repeat. Toggle them active or inactive.

**Three modals:**
1. **Create Plan** — name, description, day picker
2. **Manage Plan** — shows assigned exercises, active toggle
3. **Add Exercise** — pick an exercise from the library, set sets/reps

**Day picker:**
```typescript
const toggleDay = (day: string) =>
  setRepeatDays(prev =>
    prev.includes(day) ? prev.filter(d => d !== day) : [...prev, day]
  );
```
If the day is already in the array, remove it. If it's not, add it. The result is stored as a JSON string in the database: `'["Mon","Wed","Fri"]'`.

**`openManage(plan)`** — When you tap a plan card, this loads two things at once: the exercises already in this plan, and all available exercises (for the add exercise modal). Both are needed before the manage sheet opens.

**Active toggle:** Uses the React Native `Switch` component. When toggled, calls `updatePlan(plan.id, { is_active: next })` where `next` is `0` or `1` (SQLite uses integers for booleans).

---

### 9.5 — `SessionScreen.tsx`

**Purpose:** The active workout session. The core gameplay loop.

**Loading:**
```typescript
useEffect(() => { loadSession(); }, []);
```
On mount, loads both the session's exercises and the player simultaneously using `Promise.all`, which runs both database calls at the same time instead of waiting for one before starting the other.

**`handleCompleteExercise(ex)`:**
```typescript
// 1. Update local state immediately (feels instant)
setExercises(prev => prev.map(e => e.id === ex.id ? { ...e, is_completed: 1 } : e));
setExpGained(prev => prev + ex.exp_reward);

// 2. Trigger the flash animation
triggerFlash();

// 3. Save to database (happens in background)
await completeSessionExercise(ex.id!);
```
This is called "optimistic UI updating." The UI responds instantly when the player taps an exercise — the animation plays and the checkmark appears — and the database write happens in the background. The player never waits.

**`triggerFlash()`:**
```typescript
flashAnim.setValue(1);    // instantly make the overlay visible
flashScale.setValue(0.8); // instantly make the text small
Animated.parallel([
  Animated.timing(flashAnim,  { toValue: 0, duration: 700 }),  // fade out
  Animated.spring(flashScale, { toValue: 1, friction: 4 }),     // bounce to full size
]).start();
```
Creates the "+EXP" cyan flash that appears when an exercise is checked. The text bounces up to full size while the background fades away.

**`handleFinishSession()`** — The most important function in the app:

```
Step 1: Count completed exercises, sum their EXP rewards
Step 2: If ALL exercises were done, add a 10% bonus
Step 3: Sum stat gains (each exercise has a stat_type and stat_reward)
Step 4: Calculate new level from new total EXP
Step 5: Check all TITLE_CONDITIONS — award any newly met ones
Step 6: Save everything to the database in one updatePlayer call
Step 7: Mark the session as completed
Step 8: Show LevelUpModal if levelled up, otherwise go back
```

**`ExerciseItem`** sub-component — Each exercise row with its own animation:
```typescript
const checkAnim = useRef(new Animated.Value(done ? 1 : 0)).current;
const scale = checkAnim.interpolate({
  inputRange:  [0, 0.5, 1],
  outputRange: [1, 1.3,  1],  // grows to 130% then back to 100%
});
```
When tapped, `checkAnim` animates from 0 to 1. The `interpolate` maps that 0→1 range onto a scale of 1→1.3→1, making the circle indicator pop outward then settle back.

---

### 9.6 — `ProfileScreen.tsx`

**Purpose:** Read-only view of the player's full status. Nothing here writes to the database.

**`loadAll()`:**
```typescript
const [p, t, s] = await Promise.all([getPlayer(), getTitles(), getRecentSessions(15)]);
```
Loads player, titles, and sessions all at the same time with `Promise.all`. The result is destructured directly into three variables.

**Rank banner:** Uses the player's level to get the rank, then uses the rank's `color` for the large rank letter and the border. The large letter is 76px and semi-transparent (`opacity: 0.9`).

**Stats bars:** The `maxValue` for each bar is `Math.max(100, statValue)`. This means once a stat exceeds 100, the bar rescales to that value — so the bar never shows "completely full" and always gives the player a sense of room to grow.

---

## 10. How data flows through the app

Here is the complete journey of a workout from creation to completion:

```
1. ExercisesScreen
   User creates "Push-ups" (Strength, +20 EXP, +1 Strength)
   → createExercise() → INSERT INTO exercises

2. PlansScreen
   User creates "Morning Grind" plan
   → createPlan() → INSERT INTO plans

   User taps "Manage" → taps "+ Add" → picks Push-ups, 3 sets × 15 reps
   → addExerciseToPlan() → INSERT INTO plan_exercises

   User toggles plan Active, sets repeat Mon-Fri
   → updatePlan() → UPDATE plans SET is_active=1, repeat_days='["Mon","Tue","Wed","Thu","Fri"]'

3. DashboardScreen (next morning)
   generateTodaySessions() runs:
   → It's Tuesday, plan is active, Tuesday is in repeat_days, no session yet today
   → createSession(plan) → INSERT INTO sessions (status='pending')
   → populateSessionExercises(sessionId, planId)
      → reads plan_exercises joined with exercises
      → INSERT INTO session_exercises (copies Push-ups with its rewards)

4. DashboardScreen
   User sees "Morning Grind" quest card, taps it
   → navigation.navigate('Session', { sessionId: 3 })

5. SessionScreen loads
   → getSessionExercises(3) → returns Push-ups row
   → updateSession(3, { status: 'in_progress' })

   User taps Push-ups → handleCompleteExercise()
   → local state updates instantly
   → completeSessionExercise(id) → UPDATE session_exercises SET is_completed=1

   User taps "Complete Session" → handleFinishSession()
   → totalExp = 20 (all done, so × 1.1 = 22 EXP)
   → statDeltas = { strength: 1 }
   → newTotalExp = oldTotalExp + 22
   → level recalculated from newTotalExp
   → TITLE_CONDITIONS checked → 'Iron Will' is new → saveTitle('Iron Will', ...)
   → updatePlayer({ level, exp, strength: 11, title: 'Iron Will', ... })
   → updateSession(3, { status: 'completed', total_exp: 22 })
   → LevelUpModal shown (if levelled) or goBack()

6. DashboardScreen (when user returns)
   useFocusEffect fires loadData() again
   → getTodaySessions() → returns the session with status='completed'
   → Quest card now shows "✓ COMPLETED" and "+22 EXP"
```

---

## 11. How the game mechanics work

### EXP and Levelling

Every exercise has an `exp_reward`. When you complete it, that EXP is added to your `total_exp` in the player table. After every session, the app recalculates your level from scratch using the total EXP:

```
Total EXP earned: 500
Level 1 costs 100 → remaining: 400
Level 2 costs 283 → remaining: 117
Level 3 costs 520 → 117 < 520, stop.
Result: Level 3, 117/520 EXP
```

### Stats

Each exercise has a `stat_type` and `stat_reward`. When you complete an exercise:
- `stat_type: 'strength'` and `stat_reward: 2` → your Strength increases by 2
- Multiple exercises of the same stat type stack: two Strength exercises → +4 total

Stats are capped at 9999 with `Math.min(value, 9999)`.

### 10% Full-Clear Bonus

If you complete every single exercise in a session (not just some), the total EXP is multiplied by 1.1 before being applied. This rewards players for finishing the whole workout rather than just doing one exercise.

### Titles

After every session completes, every condition in `TITLE_CONDITIONS` is checked against the updated player stats. If a condition returns `true` and the title hasn't been earned yet, it is inserted into the `titles` table. The first new title earned becomes the player's active displayed title.

---

## 12. How to add new features

### Add a new stat (e.g. "Luck")

1. **`src/constants/game.ts`** — add to `STATS` array:
   ```typescript
   { key: 'luck', label: 'Luck', icon: '🍀', color: '#00E676' }
   ```

2. **`src/database/Database.ts`** — add column to the `CREATE TABLE player` statement:
   ```sql
   luck INTEGER DEFAULT 10,
   ```
   Also add `luck` to the `Player` interface:
   ```typescript
   luck: number;
   ```

3. **`src/screens/SessionScreen.tsx`** — in `handleFinishSession`, the stat delta loop already handles any stat key dynamically, so no changes needed there.

4. Uninstall and reinstall the app (SQLite schema changes require a fresh database).

---

### Add a new title condition

In **`src/constants/game.ts`**, add to `TITLE_CONDITIONS`:
```typescript
{
  title: 'Lucky Star',
  description: 'Luck stat reached 50.',
  check: (p) => (p as any).luck >= 50,
},
```
Nothing else needs to change.

---

### Add a new screen

1. Create `src/screens/MyNewScreen.tsx`
2. In **`App.tsx`**, add it to the navigator:
   ```typescript
   // In RootStackParamList:
   MyNew: undefined;

   // In the Stack.Navigator:
   <Stack.Screen name="MyNew" component={MyNewScreen} />
   ```
3. Navigate to it from any screen:
   ```typescript
   navigation.navigate('MyNew');
   ```

---

### Change how often EXP is needed to level up

In **`src/constants/game.ts`**, change this one line:
```typescript
export const expRequiredForLevel = (level: number): number =>
  Math.floor(100 * Math.pow(level, 1.5));
//                                   ^^^
//                         Change this exponent
//                         Lower = easier (try 1.2)
//                         Higher = harder (try 2.0)
```
