/**
 * src/database/Database.ts
 * =========================
 * All SQLite operations using expo-sqlite (the Expo-managed SQLite driver).
 * Uses the new expo-sqlite v14+ synchronous API via useSQLiteContext for reads
 * and the async openDatabaseAsync for writes/init.
 *
 * We export a singleton `db` promise and typed helper functions.
 * Every screen calls these helpers — never raw SQL.
 */

import * as SQLite from 'expo-sqlite';
import { calculateLevelFromTotalExp } from '../utils/math';
import { unitSuffix, calculateMartialLevelFromTotalExp, getBeltForLevel } from '../constants/game';

// ─────────────────────────────────────────────
// SINGLETON CONNECTION
// ─────────────────────────────────────────────

let _db: SQLite.SQLiteDatabase | null = null;

export const getDb = async (): Promise<SQLite.SQLiteDatabase> => {
  if (_db) return _db;
  _db = await SQLite.openDatabaseAsync('SoloLeveling.db');
  return _db;
};

// ─────────────────────────────────────────────
// INIT  (create all tables)
// ─────────────────────────────────────────────

export const initDatabase = async (): Promise<void> => {
  const db = await getDb();

  await db.execAsync(`
    PRAGMA journal_mode = WAL;

    CREATE TABLE IF NOT EXISTS player (
      id            INTEGER PRIMARY KEY AUTOINCREMENT,
      name          TEXT    NOT NULL,
      age           INTEGER DEFAULT 0,
      weight        REAL    DEFAULT 0,
      height        REAL    DEFAULT 0,
      level         INTEGER DEFAULT 1,
      exp           INTEGER DEFAULT 0,
      exp_to_next   INTEGER DEFAULT 100,
      total_exp     INTEGER DEFAULT 0,
      title         TEXT    DEFAULT 'Iron Will',
      strength      INTEGER DEFAULT 10,
      agility       INTEGER DEFAULT 10,
      endurance     INTEGER DEFAULT 10,
      intelligence  INTEGER DEFAULT 10,
      vitality      INTEGER DEFAULT 10,
      created_at    TEXT    DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS exercises (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      name        TEXT    NOT NULL,
      description TEXT    DEFAULT '',
      exp_reward  INTEGER DEFAULT 20,
      unit_type   TEXT    DEFAULT 'reps',
      exp_per_unit REAL   DEFAULT 2,
      unit_label  TEXT    DEFAULT 'reps',
      stat_type   TEXT    DEFAULT 'strength',
      stat_reward INTEGER DEFAULT 1,
      category    TEXT    DEFAULT 'strength',
      units       TEXT    DEFAULT '[]',
      primary_unit TEXT   DEFAULT 'reps',
      media_type  TEXT    DEFAULT 'none',
      media_uri   TEXT    DEFAULT '',
      created_at  TEXT    DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS exercise_body_parts (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      exercise_id INTEGER NOT NULL,
      body_part   TEXT    NOT NULL,
      UNIQUE (exercise_id, body_part),
      FOREIGN KEY (exercise_id) REFERENCES exercises(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS plans (
      id              INTEGER PRIMARY KEY AUTOINCREMENT,
      name            TEXT    NOT NULL,
      description     TEXT    DEFAULT '',
      is_active       INTEGER DEFAULT 0,
      repeat_days     TEXT    DEFAULT '[]',
      penalty_exp     INTEGER DEFAULT 0,
      created_at      TEXT    DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS plan_exercises (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      plan_id     INTEGER NOT NULL,
      exercise_id INTEGER NOT NULL,
      sets        INTEGER DEFAULT 3,
      target      REAL    DEFAULT 10,
      unit_values TEXT    DEFAULT '[]',
      order_index INTEGER DEFAULT 0,
      FOREIGN KEY (plan_id)     REFERENCES plans(id)     ON DELETE CASCADE,
      FOREIGN KEY (exercise_id) REFERENCES exercises(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS sessions (
      id            INTEGER PRIMARY KEY AUTOINCREMENT,
      plan_id       INTEGER NOT NULL,
      plan_name     TEXT    DEFAULT '',
      date          TEXT    NOT NULL,
      status        TEXT    DEFAULT 'pending',
      total_exp     INTEGER DEFAULT 0,
      started_at    TEXT    DEFAULT '',
      completed_at  TEXT    DEFAULT '',
      is_manual     INTEGER DEFAULT 0,
      FOREIGN KEY (plan_id) REFERENCES plans(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS session_exercises (
      id              INTEGER PRIMARY KEY AUTOINCREMENT,
      session_id      INTEGER NOT NULL,
      exercise_id     INTEGER DEFAULT 0,
      exercise_name   TEXT    DEFAULT '',
      sets_total      INTEGER DEFAULT 3,
      target          REAL    DEFAULT 10,
      unit_type       TEXT    DEFAULT 'reps',
      unit_label      TEXT    DEFAULT 'reps',
      units           TEXT    DEFAULT '[]',
      primary_unit    TEXT    DEFAULT 'reps',
      unit_values     TEXT    DEFAULT '[]',
      actual_units    TEXT    DEFAULT '[]',
      exp_per_unit    REAL    DEFAULT 2,
      actual_amount   REAL    DEFAULT 0,
      is_completed    INTEGER DEFAULT 0,
      exp_reward      REAL    DEFAULT 0,
      stat_type       TEXT    DEFAULT 'strength',
      stat_reward     INTEGER DEFAULT 1,
      is_bonus        INTEGER DEFAULT 0,
      FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS titles (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      title       TEXT NOT NULL UNIQUE,
      description TEXT DEFAULT '',
      earned_at   TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS bonus_exercises (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      session_id  INTEGER NOT NULL,
      exercise_id INTEGER NOT NULL,
      exercise_name TEXT  DEFAULT '',
      target      REAL   DEFAULT 0,
      unit_type   TEXT   DEFAULT 'reps',
      unit_label  TEXT   DEFAULT 'reps',
      units       TEXT   DEFAULT '[]',
      primary_unit TEXT  DEFAULT 'reps',
      unit_values TEXT   DEFAULT '[]',
      actual_units TEXT  DEFAULT '[]',
      exp_per_unit REAL  DEFAULT 2,
      actual_amount REAL DEFAULT 0,
      is_completed INTEGER DEFAULT 0,
      exp_reward  REAL   DEFAULT 0,
      stat_type   TEXT   DEFAULT 'strength',
      stat_reward INTEGER DEFAULT 1,
      FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE CASCADE
    );
  `);

  // Safely add new columns to existing installs — ALTER TABLE ignores errors if column exists
  const safeAlter = async (sql: string) => {
    try { await db.execAsync(sql); } catch {}
  };
  await safeAlter(`ALTER TABLE exercises ADD COLUMN unit_type TEXT DEFAULT 'reps'`);
  await safeAlter(`ALTER TABLE exercises ADD COLUMN exp_per_unit REAL DEFAULT 2`);
  await safeAlter(`ALTER TABLE exercises ADD COLUMN unit_label TEXT DEFAULT 'reps'`);
  await safeAlter(`ALTER TABLE exercises ADD COLUMN exp_unit_count REAL DEFAULT 1`);
  await safeAlter(`ALTER TABLE plans ADD COLUMN penalty_exp INTEGER DEFAULT 0`);
  await safeAlter(`ALTER TABLE plan_exercises ADD COLUMN target REAL DEFAULT 10`);
  await safeAlter(`ALTER TABLE session_exercises ADD COLUMN target REAL DEFAULT 10`);
  await safeAlter(`ALTER TABLE session_exercises ADD COLUMN unit_type TEXT DEFAULT 'reps'`);
  await safeAlter(`ALTER TABLE session_exercises ADD COLUMN unit_label TEXT DEFAULT 'reps'`);
  await safeAlter(`ALTER TABLE session_exercises ADD COLUMN exp_per_unit REAL DEFAULT 2`);
  await safeAlter(`ALTER TABLE session_exercises ADD COLUMN actual_amount REAL DEFAULT 0`);
  await safeAlter(`ALTER TABLE session_exercises ADD COLUMN is_bonus INTEGER DEFAULT 0`);
  await safeAlter(`ALTER TABLE session_exercises ADD COLUMN exp_unit_count REAL DEFAULT 1`);
  await safeAlter(`ALTER TABLE bonus_exercises ADD COLUMN exp_unit_count REAL DEFAULT 1`);
  await safeAlter(`ALTER TABLE exercises ADD COLUMN exp_per_stat_point REAL DEFAULT 20`);
  await safeAlter(`ALTER TABLE session_exercises ADD COLUMN exp_per_stat_point REAL DEFAULT 20`);
  await safeAlter(`ALTER TABLE bonus_exercises ADD COLUMN exp_per_stat_point REAL DEFAULT 20`);
  await safeAlter(`ALTER TABLE bonus_exercises ADD COLUMN exp_awarded INTEGER DEFAULT 0`);
  await safeAlter(`ALTER TABLE sessions ADD COLUMN is_manual INTEGER DEFAULT 0`);
  await safeAlter(`ALTER TABLE exercises ADD COLUMN units TEXT DEFAULT '[]'`);
  await safeAlter(`ALTER TABLE exercises ADD COLUMN primary_unit TEXT DEFAULT 'reps'`);
  await safeAlter(`ALTER TABLE plan_exercises ADD COLUMN unit_values TEXT DEFAULT '[]'`);
  await safeAlter(`ALTER TABLE session_exercises ADD COLUMN units TEXT DEFAULT '[]'`);
  await safeAlter(`ALTER TABLE session_exercises ADD COLUMN primary_unit TEXT DEFAULT 'reps'`);
  await safeAlter(`ALTER TABLE session_exercises ADD COLUMN unit_values TEXT DEFAULT '[]'`);
  await safeAlter(`ALTER TABLE session_exercises ADD COLUMN actual_units TEXT DEFAULT '[]'`);
  await safeAlter(`ALTER TABLE bonus_exercises ADD COLUMN units TEXT DEFAULT '[]'`);
  await safeAlter(`ALTER TABLE bonus_exercises ADD COLUMN primary_unit TEXT DEFAULT 'reps'`);
  await safeAlter(`ALTER TABLE bonus_exercises ADD COLUMN unit_values TEXT DEFAULT '[]'`);
  await safeAlter(`ALTER TABLE bonus_exercises ADD COLUMN actual_units TEXT DEFAULT '[]'`);
  await safeAlter(`ALTER TABLE exercises ADD COLUMN media_type TEXT DEFAULT 'none'`);
  await safeAlter(`ALTER TABLE exercises ADD COLUMN media_uri TEXT DEFAULT ''`);
  // Per-exercise personal records: best primary-unit value ever completed.
  await safeAlter(`ALTER TABLE exercises ADD COLUMN pr_value REAL DEFAULT 0`);
  await safeAlter(`ALTER TABLE exercises ADD COLUMN pr_unit TEXT DEFAULT ''`);
  await safeAlter(`ALTER TABLE exercises ADD COLUMN pr_at TEXT DEFAULT ''`);
  // Notes live inside tutorials (NULL tutorial_id = unassigned legacy note).
  await safeAlter(`ALTER TABLE art_notes ADD COLUMN tutorial_id INTEGER DEFAULT NULL`);
  await safeAlter(`ALTER TABLE art_notes ADD COLUMN order_index INTEGER DEFAULT 0`);

  // Create bonus_exercises table if it doesn't exist
  await db.execAsync(`
    CREATE TABLE IF NOT EXISTS bonus_exercises (
      id            INTEGER PRIMARY KEY AUTOINCREMENT,
      session_id    INTEGER NOT NULL,
      exercise_id   INTEGER NOT NULL,
      exercise_name TEXT    DEFAULT '',
      target        REAL   DEFAULT 0,
      unit_type     TEXT   DEFAULT 'reps',
      unit_label    TEXT   DEFAULT 'reps',
      units         TEXT   DEFAULT '[]',
      primary_unit  TEXT   DEFAULT 'reps',
      unit_values   TEXT   DEFAULT '[]',
      actual_units  TEXT   DEFAULT '[]',
      exp_per_unit  REAL   DEFAULT 2,
      actual_amount REAL DEFAULT 0,
      is_completed  INTEGER DEFAULT 0,
      exp_reward    REAL   DEFAULT 0,
      stat_type     TEXT   DEFAULT 'strength',
      stat_reward   INTEGER DEFAULT 1,
      FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS martial_arts (
      id            INTEGER PRIMARY KEY AUTOINCREMENT,
      name          TEXT    NOT NULL,
      description   TEXT    DEFAULT '',
      icon          TEXT    DEFAULT 'flame',
      color         TEXT    DEFAULT '#00D4FF',
      total_exp     INTEGER DEFAULT 0,
      level         INTEGER DEFAULT 1,
      exp           INTEGER DEFAULT 0,
      exp_to_next   INTEGER DEFAULT 0,
      created_at    TEXT    DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS skills (
      id              INTEGER PRIMARY KEY AUTOINCREMENT,
      martial_art_id  INTEGER NOT NULL,
      name            TEXT    NOT NULL,
      description     TEXT    DEFAULT '',
      media_type      TEXT    DEFAULT 'none',
      media_uri       TEXT    DEFAULT '',
      total_exp       INTEGER DEFAULT 0,
      level           INTEGER DEFAULT 1,
      exp             INTEGER DEFAULT 0,
      exp_to_next     INTEGER DEFAULT 0,
      created_at      TEXT    DEFAULT (datetime('now')),
      FOREIGN KEY (martial_art_id) REFERENCES martial_arts(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS skill_exercises (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      skill_id    INTEGER NOT NULL,
      exercise_id INTEGER NOT NULL,
      UNIQUE (skill_id, exercise_id),
      FOREIGN KEY (skill_id)    REFERENCES skills(id)    ON DELETE CASCADE,
      FOREIGN KEY (exercise_id) REFERENCES exercises(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS tutorials (
      id             INTEGER PRIMARY KEY AUTOINCREMENT,
      martial_art_id INTEGER NOT NULL,
      title          TEXT    NOT NULL,
      description    TEXT    DEFAULT '',
      created_at     TEXT    DEFAULT (datetime('now')),
      updated_at     TEXT    DEFAULT '',
      FOREIGN KEY (martial_art_id) REFERENCES martial_arts(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS art_notes (
      id             INTEGER PRIMARY KEY AUTOINCREMENT,
      martial_art_id INTEGER NOT NULL,
      tutorial_id    INTEGER DEFAULT NULL,
      order_index    INTEGER DEFAULT 0,
      title          TEXT    NOT NULL,
      body           TEXT    DEFAULT '',
      media          TEXT    DEFAULT '[]',
      created_at     TEXT    DEFAULT (datetime('now')),
      updated_at     TEXT    DEFAULT '',
      FOREIGN KEY (martial_art_id) REFERENCES martial_arts(id) ON DELETE CASCADE,
      FOREIGN KEY (tutorial_id)   REFERENCES tutorials(id)    ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS item_groups (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      kind        TEXT    NOT NULL,
      name        TEXT    NOT NULL,
      color       TEXT    DEFAULT '#00D4FF',
      created_at  TEXT    DEFAULT (datetime('now')),
      UNIQUE (kind, name)
    );

    CREATE TABLE IF NOT EXISTS exercise_groups (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      exercise_id INTEGER NOT NULL,
      group_id    INTEGER NOT NULL,
      UNIQUE (exercise_id, group_id)
    );

    CREATE TABLE IF NOT EXISTS plan_groups (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      plan_id     INTEGER NOT NULL,
      group_id    INTEGER NOT NULL,
      UNIQUE (plan_id, group_id)
    );

    CREATE TABLE IF NOT EXISTS skill_groups (
      id             INTEGER PRIMARY KEY AUTOINCREMENT,
      martial_art_id INTEGER NOT NULL,
      name           TEXT    NOT NULL,
      color          TEXT    DEFAULT '#00D4FF',
      created_at     TEXT    DEFAULT (datetime('now')),
      FOREIGN KEY (martial_art_id) REFERENCES martial_arts(id) ON DELETE CASCADE,
      UNIQUE (martial_art_id, name)
    );

    CREATE TABLE IF NOT EXISTS skill_group_links (
      id       INTEGER PRIMARY KEY AUTOINCREMENT,
      skill_id INTEGER NOT NULL,
      group_id INTEGER NOT NULL,
      UNIQUE (skill_id, group_id),
      FOREIGN KEY (skill_id) REFERENCES skills(id)         ON DELETE CASCADE,
      FOREIGN KEY (group_id) REFERENCES skill_groups(id)   ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS settings (
      id    INTEGER PRIMARY KEY AUTOINCREMENT,
      key   TEXT NOT NULL UNIQUE,
      value TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS body_metrics (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      measured_at TEXT NOT NULL,
      weight      REAL DEFAULT 0,
      note        TEXT DEFAULT '',
      created_at  TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS challenges (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      name        TEXT NOT NULL,
      description TEXT DEFAULT '',
      start_date  TEXT NOT NULL,
      end_date    TEXT NOT NULL,
      created_at  TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS challenge_goals (
      id            INTEGER PRIMARY KEY AUTOINCREMENT,
      challenge_id  INTEGER NOT NULL,
      exercise_id   INTEGER NOT NULL,
      exercise_name TEXT    DEFAULT '',
      unit_type     TEXT    NOT NULL DEFAULT 'reps',
      target        REAL    NOT NULL DEFAULT 0,
      created_at    TEXT    DEFAULT (datetime('now')),
      UNIQUE (challenge_id, exercise_id, unit_type)
    );
  `);

  // ─────────────────────────────────────────────
  // BACKFILL  legacy single-unit rows → multi-unit JSON (idempotent)
  // Only touches rows whose units column is still empty; safe on every launch.
  // ─────────────────────────────────────────────
  const legacyUnits = (type: string | null, label: string | null): string => {
    const t = type && type.length > 0 ? type : 'reps';
    const l = label && label.length > 0 ? label : unitSuffix(t);
    return JSON.stringify([{ type: t, label: l, default: 1 }]);
  };
  const legacyValues = (type: string | null, value: number): string => {
    const t = type && type.length > 0 ? type : 'reps';
    return JSON.stringify([{ type: t, value: Number.isFinite(value) ? value : 0 }]);
  };

  const exerciseRows = await db.getAllAsync<{ id: number; unit_type: string; unit_label: string }>(
    `SELECT id, unit_type, unit_label FROM exercises WHERE units IS NULL OR units = '' OR units = '[]'`
  );
  for (const r of exerciseRows) {
    await db.runAsync(
      `UPDATE exercises SET units = ?, primary_unit = ? WHERE id = ?`,
      [legacyUnits(r.unit_type, r.unit_label), r.unit_type || 'reps', r.id]
    );
  }

  const planRows = await db.getAllAsync<{ id: number; target: number; unit_type: string; unit_label: string }>(
    `SELECT pe.id, pe.target, e.unit_type, e.unit_label
       FROM plan_exercises pe JOIN exercises e ON pe.exercise_id = e.id
      WHERE pe.unit_values IS NULL OR pe.unit_values = '' OR pe.unit_values = '[]'`
  );
  for (const r of planRows) {
    await db.runAsync(
      `UPDATE plan_exercises SET unit_values = ? WHERE id = ?`,
      [legacyValues(r.unit_type, r.target), r.id]
    );
  }

  const sessionRows = await db.getAllAsync<{
    id: number; target: number; actual_amount: number; unit_type: string; unit_label: string;
  }>(
    `SELECT id, target, actual_amount, unit_type, unit_label FROM session_exercises
      WHERE units IS NULL OR units = '' OR units = '[]'`
  );
  for (const r of sessionRows) {
    await db.runAsync(
      `UPDATE session_exercises SET units = ?, primary_unit = ?, unit_values = ?, actual_units = ? WHERE id = ?`,
      [legacyUnits(r.unit_type, r.unit_label), r.unit_type || 'reps',
       legacyValues(r.unit_type, r.target), legacyValues(r.unit_type, r.actual_amount), r.id]
    );
  }

  const bonusRows = await db.getAllAsync<{
    id: number; target: number; actual_amount: number; unit_type: string; unit_label: string;
  }>(
    `SELECT id, target, actual_amount, unit_type, unit_label FROM bonus_exercises
      WHERE units IS NULL OR units = '' OR units = '[]'`
  );
  for (const r of bonusRows) {
    await db.runAsync(
      `UPDATE bonus_exercises SET units = ?, primary_unit = ?, unit_values = ?, actual_units = ? WHERE id = ?`,
      [legacyUnits(r.unit_type, r.unit_label), r.unit_type || 'reps',
       legacyValues(r.unit_type, r.target), legacyValues(r.unit_type, r.actual_amount), r.id]
    );
  }
};

// ─────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────

export interface Player {
  id?: number;
  name: string;
  age: number;
  weight: number;
  height: number;
  level: number;
  exp: number;
  exp_to_next: number;
  total_exp: number;
  title: string;
  strength: number;
  agility: number;
  endurance: number;
  intelligence: number;
  vitality: number;
  created_at?: string;
}

export interface Exercise {
  id?: number;
  name: string;
  description: string;
  exp_reward: number;    // kept for backwards compat with old rows
  unit_type: string;
  exp_per_unit: number;
  unit_label: string;
  exp_unit_count: number; 
  exp_per_stat_point: number; 
  stat_type: string;
  category: string;
  units?: string;        // JSON array of UnitSpec: [{ type, label, default }]
  primary_unit?: string; // unit type that drives EXP
  media_type: MediaType;
  media_uri: string;
  pr_value?: number;     // best primary-unit value ever completed (0 = none)
  pr_unit?: string;      // unit type the PR was set in
  pr_at?: string;        // ISO timestamp of the PR
  body_parts?: string;   // JSON array, populated by getExercises (join table, not a column)
  groups?: string;       // JSON array of group ids, populated by getExercises (join table, not a column)
  created_at?: string;
}

export interface Plan {
  id?: number;
  name: string;
  description: string;
  is_active: number;
  repeat_days: string;
  penalty_exp: number;
  groups?: string;       // JSON array of group ids, populated by getPlans (join table, not a column)
  created_at?: string;
}

export interface Group {
  id?: number;
  kind: string;          // 'exercise' | 'plan'
  name: string;
  color: string;
  created_at?: string;
}

/** A per-martial-art skill group (e.g. Punching, Kicks). Not global. */
export interface SkillGroup {
  id?: number;
  martial_art_id: number;
  name: string;
  color: string;
  created_at?: string;
  member_count?: number; // populated by getSkillGroups
}

export interface PlanExercise {
  id?: number;
  plan_id: number;
  exercise_id: number;
  exercise_name?: string;
  exp_per_unit?: number;
  exp_unit_count?: number;
  unit_type?: string;
  unit_label?: string;
  stat_type?: string;
  stat_reward?: number;
  sets: number;
  target: number;        // renamed from reps — holds the target amount
  unit_values?: string;  // JSON array: [{ type, value }]
  units?: string;        // JSON array of UnitSpec (joined from exercises)
  primary_unit?: string; // joined from exercises
  order_index: number;
}

export interface Session {
  id?: number;
  plan_id: number;
  plan_name: string;
  date: string;
  status: 'pending' | 'in_progress' | 'completed' | 'skipped';
  total_exp: number;
  started_at: string;
  completed_at: string;
  is_manual?: number;
}

export interface SessionExercise {
  id?: number;
  session_id: number;
  exercise_id: number;
  exercise_name: string;
  sets_total: number;
  target: number;
  unit_type: string;
  unit_label: string;
  units?: string;         // JSON array of UnitSpec
  primary_unit?: string;
  unit_values?: string;   // JSON array of planned [{ type, value }]
  actual_units?: string;  // JSON array of actual [{ type, value }]
  exp_per_unit: number;
  exp_unit_count: number;  
  exp_per_stat_point: number;
  actual_amount: number;
  is_completed: number;
  exp_reward: number;
  stat_type: string;
  is_bonus: number;
}

export interface BonusExercise {
  id?: number;
  session_id: number;
  exercise_id: number;
  exercise_name: string;
  target: number;
  unit_type: string;
  unit_label: string;
  units?: string;         // JSON array of UnitSpec
  primary_unit?: string;
  unit_values?: string;   // JSON array of planned [{ type, value }]
  actual_units?: string;  // JSON array of actual [{ type, value }]
  exp_per_unit: number;
  exp_unit_count: number;
  exp_per_stat_point: number;
  actual_amount: number;
  is_completed: number;
  exp_reward: number;
  exp_awarded: number;
  stat_type: string;
}

export interface EarnedTitle {
  id: number;
  title: string;
  description: string;
  earned_at: string;
}

// ─────────────────────────────────────────────
// CHALLENGES  (user-defined goals with a deadline)
// ─────────────────────────────────────────────

export interface Challenge {
  id?: number;
  name: string;
  description: string;
  start_date: string;   // UTC 'YYYY-MM-DD', inclusive
  end_date: string;     // UTC 'YYYY-MM-DD', inclusive
  created_at?: string;
}

export interface ChallengeGoal {
  id?: number;
  challenge_id: number;
  exercise_id: number;
  exercise_name: string;     // snapshot; live name when the exercise still exists
  unit_type: string;
  target: number;            // total volume across the whole window
  created_at?: string;
  exercise_exists?: number;  // 0/1, populated by getChallengeGoals
}

/** One completed exercise row (main or bonus) inside a challenge window. */
export interface ChallengeActivityRow {
  date: string;
  exercise_id: number;
  sets: number;
  actual_amount: number;
  primary_unit: string;
  unit_type: string;
  actual_units: string;
}

export interface MartialArt {
  id?: number;
  name: string;
  description: string;
  icon: string;
  color: string;
  total_exp: number;
  level: number;
  exp: number;
  exp_to_next: number;
  created_at?: string;
  skill_count?: number;
}

export type MediaType = 'none' | 'image' | 'video';

export interface Skill {
  id?: number;
  martial_art_id: number;
  name: string;
  description: string;
  media_type: MediaType;
  media_uri: string;
  total_exp: number;
  level: number;
  exp: number;
  exp_to_next: number;
  created_at?: string;
  exercise_count?: number;
  groups?: string;       // JSON array of skill-group ids, populated by getSkills (join table, not a column)
}

/** One attachment stored on a note; parsed from the note's `media` JSON column. */
export interface NoteMedia {
  type: 'image' | 'video';
  uri: string;
}

/** A titled series of notes under a martial art. */
export interface Tutorial {
  id?: number;
  martial_art_id: number;
  title: string;
  description: string;
  created_at?: string;
  updated_at?: string;
  note_count?: number;   // populated by getTutorials
}

export interface Note {
  id?: number;
  martial_art_id: number;
  tutorial_id: number | null;
  order_index: number;
  title: string;
  body: string;
  media: string;         // JSON array of NoteMedia, stored as a column
  created_at?: string;
  updated_at?: string;
  tutorial_title?: string; // optional join, for the parent chip on NoteDetail
}

/** Safe parse of a note's `media` JSON column; never throws on bad/legacy data. */
export const parseNoteMedia = (json?: string): NoteMedia[] => {
  if (!json) return [];
  try {
    const parsed = JSON.parse(json);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (m): m is NoteMedia =>
        !!m && (m.type === 'image' || m.type === 'video') && typeof m.uri === 'string' && !!m.uri
    );
  } catch {
    return [];
  }
};

export interface SkillExercise {
  id?: number;
  skill_id: number;
  exercise_id: number;
}

// ─────────────────────────────────────────────
// PLAYER
// ─────────────────────────────────────────────

export const createPlayer = async (
  name: string, age: number, weight: number, height: number
): Promise<number> => {
  const db = await getDb();
  const result = await db.runAsync(
    `INSERT INTO player (name, age, weight, height) VALUES (?, ?, ?, ?)`,
    [name, age, weight, height]
  );
  return result.lastInsertRowId;
};

export const getPlayer = async (): Promise<Player | null> => {
  const db = await getDb();
  const row = await db.getFirstAsync<Player>(`SELECT * FROM player ORDER BY id ASC LIMIT 1`);
  return row ?? null;
};

export const updatePlayer = async (updates: Partial<Player>): Promise<void> => {
  const db = await getDb();
  const keys = Object.keys(updates);
  if (keys.length === 0) return;
  const { id, ...fieldsToSet } = updates;
  let targetId = id;
  if (targetId == null) {
    const row = await db.getFirstAsync<{ id: number }>(`SELECT id FROM player ORDER BY id ASC LIMIT 1`);
    targetId = row?.id;
  }
  if (targetId == null) return;
  const keys2 = Object.keys(fieldsToSet);
  if (keys2.length === 0) return;
  const fields = keys2.map(k => `${k} = ?`).join(', ');
  const values = [...Object.values(fieldsToSet)];
  await db.runAsync(`UPDATE player SET ${fields} WHERE id = ?`, [...values, targetId]);
};

// ─────────────────────────────────────────────
// EXERCISES
// ─────────────────────────────────────────────

export const createExercise = async (
  ex: Omit<Exercise, 'id' | 'created_at' | 'body_parts' | 'groups'>,
  bodyParts: string[] = [],
  groupIds: number[] = []
): Promise<number> => {
  const db = await getDb();
  let id: number | undefined;
  await db.withTransactionAsync(async () => {
    const result = await db.runAsync(
      `INSERT INTO exercises (name, description, exp_reward, unit_type, exp_per_unit, exp_unit_count, unit_label, exp_per_stat_point, stat_type, stat_reward, category, units, primary_unit, media_type, media_uri)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [ex.name, ex.description, ex.exp_reward, ex.unit_type, ex.exp_per_unit,
       ex.exp_unit_count ?? 1, ex.unit_label, ex.exp_per_stat_point ?? 20,
       ex.stat_type, 0, ex.category, ex.units ?? '[]', ex.primary_unit ?? ex.unit_type,
       ex.media_type ?? 'none', ex.media_uri ?? '']
    );
    id = result.lastInsertRowId;
    for (const bp of bodyParts) {
      await db.runAsync(
        `INSERT INTO exercise_body_parts (exercise_id, body_part) VALUES (?, ?)`,
        [id, bp]
      );
    }
    for (const gid of groupIds) {
      await db.runAsync(
        `INSERT OR IGNORE INTO exercise_groups (exercise_id, group_id) VALUES (?, ?)`,
        [id, gid]
      );
    }
  });
  return id!;
};

export const getExercises = async (): Promise<Exercise[]> => {
  const db = await getDb();
  const exercises = await db.getAllAsync<Exercise>(`SELECT * FROM exercises ORDER BY created_at DESC`);
  const parts = await db.getAllAsync<{ exercise_id: number; body_part: string }>(
    `SELECT exercise_id, body_part FROM exercise_body_parts`
  );
  const links = await db.getAllAsync<{ exercise_id: number; group_id: number }>(
    `SELECT exercise_id, group_id FROM exercise_groups`
  );
  const byExercise = new Map<number, string[]>();
  for (const p of parts) {
    const arr = byExercise.get(p.exercise_id) ?? [];
    arr.push(p.body_part);
    byExercise.set(p.exercise_id, arr);
  }
  const groupsByExercise = new Map<number, number[]>();
  for (const l of links) {
    const arr = groupsByExercise.get(l.exercise_id) ?? [];
    arr.push(l.group_id);
    groupsByExercise.set(l.exercise_id, arr);
  }
  return exercises.map(ex => ({
    ...ex,
    body_parts: JSON.stringify(byExercise.get(ex.id!) ?? []),
    groups: JSON.stringify(groupsByExercise.get(ex.id!) ?? []),
  }));
};

/** Deletes an exercise and its dependants. Returns its media URI to remove from disk (if any). */
export const deleteExercise = async (id: number): Promise<string | null> => {
  const db = await getDb();
  const ex = await db.getFirstAsync<{ media_uri: string; media_type: string }>(
    `SELECT media_uri, media_type FROM exercises WHERE id = ?`, [id]
  );
  // FK enforcement is off — clean dependants explicitly.
  await db.runAsync(`DELETE FROM skill_exercises WHERE exercise_id = ?`, [id]);
  await db.runAsync(`DELETE FROM exercise_groups WHERE exercise_id = ?`, [id]);
  await db.runAsync(`DELETE FROM exercises WHERE id = ?`, [id]);
  return ex && ex.media_type !== 'none' && ex.media_uri ? ex.media_uri : null;
};

export const updateExercise = async (
  id: number,
  updates: Partial<Exercise>,
  bodyParts?: string[],
  groupIds?: number[]
): Promise<void> => {
  const db = await getDb();
  const { body_parts, groups, ...fields } = updates;
  const keys = Object.keys(fields);
  if (keys.length === 0 && bodyParts === undefined && groupIds === undefined) return;
  await db.withTransactionAsync(async () => {
    if (keys.length > 0) {
      const setClause = keys.map(k => `${k} = ?`).join(', ');
      await db.runAsync(`UPDATE exercises SET ${setClause} WHERE id = ?`, [...Object.values(fields), id]);
    }
    if (bodyParts !== undefined) {
      await db.runAsync(`DELETE FROM exercise_body_parts WHERE exercise_id = ?`, [id]);
      for (const bp of bodyParts) {
        await db.runAsync(
          `INSERT INTO exercise_body_parts (exercise_id, body_part) VALUES (?, ?)`,
          [id, bp]
        );
      }
    }
    if (groupIds !== undefined) {
      await db.runAsync(`DELETE FROM exercise_groups WHERE exercise_id = ?`, [id]);
      for (const gid of groupIds) {
        await db.runAsync(
          `INSERT OR IGNORE INTO exercise_groups (exercise_id, group_id) VALUES (?, ?)`,
          [id, gid]
        );
      }
    }
  });
};

// ─────────────────────────────────────────────
// PLANS
// ─────────────────────────────────────────────

export const createPlan = async (plan: Omit<Plan, 'id' | 'created_at' | 'groups'>, groupIds: number[] = []): Promise<number> => {
  const db = await getDb();
  let id: number | undefined;
  await db.withTransactionAsync(async () => {
    const result = await db.runAsync(
      `INSERT INTO plans (name, description, is_active, repeat_days, penalty_exp) VALUES (?, ?, ?, ?, ?)`,
      [plan.name, plan.description, plan.is_active, plan.repeat_days, plan.penalty_exp]
    );
    id = result.lastInsertRowId;
    for (const gid of groupIds) {
      await db.runAsync(
        `INSERT OR IGNORE INTO plan_groups (plan_id, group_id) VALUES (?, ?)`,
        [id, gid]
      );
    }
  });
  return id!;
};

export const getPlans = async (): Promise<Plan[]> => {
  const db = await getDb();
  const plans = await db.getAllAsync<Plan>(`SELECT * FROM plans ORDER BY created_at DESC`);
  const links = await db.getAllAsync<{ plan_id: number; group_id: number }>(
    `SELECT plan_id, group_id FROM plan_groups`
  );
  const groupsByPlan = new Map<number, number[]>();
  for (const l of links) {
    const arr = groupsByPlan.get(l.plan_id) ?? [];
    arr.push(l.group_id);
    groupsByPlan.set(l.plan_id, arr);
  }
  return plans.map(p => ({ ...p, groups: JSON.stringify(groupsByPlan.get(p.id!) ?? []) }));
};

export const setPlanGroups = async (planId: number, groupIds: number[]): Promise<void> => {
  const db = await getDb();
  await db.withTransactionAsync(async () => {
    await db.runAsync(`DELETE FROM plan_groups WHERE plan_id = ?`, [planId]);
    for (const gid of groupIds) {
      await db.runAsync(
        `INSERT OR IGNORE INTO plan_groups (plan_id, group_id) VALUES (?, ?)`,
        [planId, gid]
      );
    }
  });
};

export const updatePlan = async (id: number, updates: Partial<Plan>): Promise<void> => {
  const db = await getDb();
  const { groups, ...fields } = updates;
  const keys = Object.keys(fields);
  if (keys.length === 0) return;
  const setClause = keys.map(k => `${k} = ?`).join(', ');
  await db.runAsync(`UPDATE plans SET ${setClause} WHERE id = ?`, [...Object.values(fields), id]);
};

export const deletePlan = async (id: number): Promise<void> => {
  const db = await getDb();
  await db.runAsync(`DELETE FROM plan_groups WHERE plan_id = ?`, [id]);
  await db.runAsync(`DELETE FROM plans WHERE id = ?`, [id]);
};

// ─────────────────────────────────────────────
// GROUPS  (organizational only — never affect EXP/ranks)
// ─────────────────────────────────────────────

export const getGroups = async (kind: string): Promise<Group[]> => {
  const db = await getDb();
  return db.getAllAsync<Group>(
    `SELECT * FROM item_groups WHERE kind = ? ORDER BY name COLLATE NOCASE ASC`,
    [kind]
  );
};

export const createGroup = async (kind: string, name: string, color: string): Promise<number> => {
  const db = await getDb();
  const trimmed = name.trim();
  const existing = await db.getFirstAsync<{ id: number }>(
    `SELECT id FROM item_groups WHERE kind = ? AND name = ? COLLATE NOCASE`,
    [kind, trimmed]
  );
  if (existing) return existing.id;
  const result = await db.runAsync(
    `INSERT INTO item_groups (kind, name, color) VALUES (?, ?, ?)`,
    [kind, trimmed, color]
  );
  return result.lastInsertRowId;
};

/**
 * Rename a group. Returns false when another group of the same kind already
 * uses that name (case-insensitive) so callers can show feedback instead of
 * hitting the UNIQUE (kind, name) constraint.
 */
export const renameGroup = async (id: number, name: string): Promise<boolean> => {
  const db = await getDb();
  const trimmed = name.trim();
  const clash = await db.getFirstAsync<{ id: number }>(
    `SELECT id FROM item_groups
      WHERE name = ? COLLATE NOCASE
        AND id != ?
        AND kind = (SELECT kind FROM item_groups WHERE id = ?)`,
    [trimmed, id, id],
  );
  if (clash) return false;
  await db.runAsync(`UPDATE item_groups SET name = ? WHERE id = ?`, [trimmed, id]);
  return true;
};

export const deleteGroup = async (id: number): Promise<void> => {
  const db = await getDb();
  await db.runAsync(`DELETE FROM exercise_groups WHERE group_id = ?`, [id]);
  await db.runAsync(`DELETE FROM plan_groups WHERE group_id = ?`, [id]);
  await db.runAsync(`DELETE FROM item_groups WHERE id = ?`, [id]);
};

// ─────────────────────────────────────────────
// SKILL GROUPS  (per-martial-art; organizational only)
// ─────────────────────────────────────────────

export const getSkillGroups = async (martialArtId: number): Promise<SkillGroup[]> => {
  const db = await getDb();
  const groups = await db.getAllAsync<SkillGroup>(
    `SELECT * FROM skill_groups WHERE martial_art_id = ? ORDER BY name COLLATE NOCASE ASC`,
    [martialArtId]
  );
  const counts = await db.getAllAsync<{ group_id: number; count: number }>(
    `SELECT l.group_id, COUNT(*) as count FROM skill_group_links l
       JOIN skill_groups g ON l.group_id = g.id
      WHERE g.martial_art_id = ? GROUP BY l.group_id`, [martialArtId]
  );
  const byGroup: Record<number, number> = {};
  for (const c of counts) byGroup[c.group_id] = c.count;
  return groups.map(g => ({ ...g, member_count: byGroup[g.id!] ?? 0 }));
};

export const createSkillGroup = async (
  martialArtId: number, name: string, color: string
): Promise<number> => {
  const db = await getDb();
  const trimmed = name.trim();
  const existing = await db.getFirstAsync<{ id: number }>(
    `SELECT id FROM skill_groups WHERE martial_art_id = ? AND name = ? COLLATE NOCASE`,
    [martialArtId, trimmed]
  );
  if (existing) return existing.id;
  const result = await db.runAsync(
    `INSERT INTO skill_groups (martial_art_id, name, color) VALUES (?, ?, ?)`,
    [martialArtId, trimmed, color]
  );
  return result.lastInsertRowId;
};

/**
 * Rename a skill group. Returns false when another group of the same martial
 * art already uses that name (case-insensitive) so callers can show feedback
 * instead of hitting the UNIQUE (martial_art_id, name) constraint.
 */
export const renameSkillGroup = async (id: number, name: string): Promise<boolean> => {
  const db = await getDb();
  const trimmed = name.trim();
  const clash = await db.getFirstAsync<{ id: number }>(
    `SELECT id FROM skill_groups
      WHERE name = ? COLLATE NOCASE
        AND id != ?
        AND martial_art_id = (SELECT martial_art_id FROM skill_groups WHERE id = ?)`,
    [trimmed, id, id],
  );
  if (clash) return false;
  await db.runAsync(`UPDATE skill_groups SET name = ? WHERE id = ?`, [trimmed, id]);
  return true;
};

export const deleteSkillGroup = async (id: number): Promise<void> => {
  const db = await getDb();
  await db.runAsync(`DELETE FROM skill_group_links WHERE group_id = ?`, [id]);
  await db.runAsync(`DELETE FROM skill_groups WHERE id = ?`, [id]);
};

/** Replaces a skill's group assignments with the given ids. */
export const setSkillGroupIds = async (skillId: number, groupIds: number[]): Promise<void> => {
  const db = await getDb();
  await db.withTransactionAsync(async () => {
    await db.runAsync(`DELETE FROM skill_group_links WHERE skill_id = ?`, [skillId]);
    for (const gid of groupIds) {
      await db.runAsync(
        `INSERT OR IGNORE INTO skill_group_links (skill_id, group_id) VALUES (?, ?)`,
        [skillId, gid]
      );
    }
  });
};

export const getSkillGroupIds = async (skillId: number): Promise<number[]> => {
  const db = await getDb();
  const rows = await db.getAllAsync<{ group_id: number }>(
    `SELECT group_id FROM skill_group_links WHERE skill_id = ?`, [skillId]
  );
  return rows.map(r => r.group_id);
};

// Removes pending sessions for a plan from today — called when plan is deactivated or deleted
export const cancelTodayPendingSessions = async (planId: number): Promise<void> => {
  const db = await getDb();
  const today = new Date().toISOString().split('T')[0];
  await db.runAsync(
    `DELETE FROM sessions WHERE plan_id = ? AND date = ? AND status = 'pending'`,
    [planId, today]
  );
};

export const addExerciseToPlan = async (pe: Omit<PlanExercise, 'id'>): Promise<void> => {
  const db = await getDb();
  await db.runAsync(
    `INSERT INTO plan_exercises (plan_id, exercise_id, sets, target, unit_values, order_index)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [pe.plan_id, pe.exercise_id, pe.sets, pe.target, pe.unit_values ?? '[]', pe.order_index]
  );
};

export const getPlanExercises = async (planId: number): Promise<PlanExercise[]> => {
  const db = await getDb();
  return db.getAllAsync<PlanExercise>(
    `SELECT pe.*, e.name as exercise_name, e.exp_per_unit, e.exp_unit_count, e.exp_per_stat_point, e.unit_type, e.unit_label, e.stat_type, e.units, e.primary_unit
     FROM plan_exercises pe
     JOIN exercises e ON pe.exercise_id = e.id
     WHERE pe.plan_id = ?
     ORDER BY pe.order_index`,
    [planId]
  );
};

export const removeExerciseFromPlan = async (planExerciseId: number): Promise<void> => {
  const db = await getDb();
  await db.runAsync(`DELETE FROM plan_exercises WHERE id = ?`, [planExerciseId]);
};

// ─────────────────────────────────────────────
// SESSIONS
// ─────────────────────────────────────────────

export const createSession = async (plan: Plan, isManual = false): Promise<number> => {
  const db = await getDb();
  const today = new Date().toISOString().split('T')[0];
  const result = await db.runAsync(
    `INSERT INTO sessions (plan_id, plan_name, date, is_manual) VALUES (?, ?, ?, ?)`,
    [plan.id!, plan.name, today, isManual ? 1 : 0]
  );
  return result.lastInsertRowId;
};

// Whether a session already exists today for the given plan (auto or manual).
export const hasSessionToday = async (planId: number): Promise<boolean> => {
  const db = await getDb();
  const today = new Date().toISOString().split('T')[0];
  const row = await db.getFirstAsync<{ id: number }>(
    `SELECT id FROM sessions WHERE plan_id = ? AND date = ? LIMIT 1`,
    [planId, today]
  );
  return !!row;
};

// Exercise count per plan, keyed by plan_id — used by the Add Plan picker.
export const getPlanExerciseCounts = async (): Promise<Record<number, number>> => {
  const db = await getDb();
  const rows = await db.getAllAsync<{ plan_id: number; count: number }>(
    `SELECT plan_id, COUNT(*) as count FROM plan_exercises GROUP BY plan_id`
  );
  const counts: Record<number, number> = {};
  for (const r of rows) counts[r.plan_id] = r.count;
  return counts;
};

export const populateSessionExercises = async (sessionId: number, planId: number): Promise<void> => {
  const planExercises = await getPlanExercises(planId);
  const db = await getDb();
  for (const pe of planExercises) {
    await db.runAsync(
      `INSERT INTO session_exercises
         (session_id, exercise_id, exercise_name, sets_total, target, unit_type, unit_label, units, primary_unit, unit_values, exp_per_unit, exp_unit_count, exp_per_stat_point, stat_type, is_bonus)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0)`,
      [sessionId, pe.exercise_id, pe.exercise_name ?? '', pe.sets, pe.target,
       pe.unit_type ?? 'reps', pe.unit_label ?? 'reps',
       pe.units ?? '[]', pe.primary_unit ?? pe.unit_type ?? 'reps', pe.unit_values ?? '[]',
       pe.exp_per_unit ?? 2, pe.exp_unit_count ?? 1,
       (pe as any).exp_per_stat_point ?? 20,
       pe.stat_type ?? 'strength']
    );
  }
};

export const getTodaySessions = async (): Promise<Session[]> => {
  const db = await getDb();
  const today = new Date().toISOString().split('T')[0];
  // Return today's sessions when the plan is still active, the session was
  // manually added, or the player already started/finished it.
  return db.getAllAsync<Session>(
    `SELECT s.* FROM sessions s
     INNER JOIN plans p ON s.plan_id = p.id
     WHERE s.date = ?
       AND (p.is_active = 1 OR s.is_manual = 1 OR s.status IN ('in_progress', 'completed'))
     ORDER BY s.id DESC`,
    [today]
  );
};

export const getRecentSessions = async (limit = 20): Promise<Session[]> => {
  const db = await getDb();
  return db.getAllAsync<Session>(
    `SELECT * FROM sessions ORDER BY date DESC, id DESC LIMIT ?`, [limit]
  );
};

/** Full session history, newest first. `status` filters (e.g. 'completed'). */
export const getAllSessions = async (status?: string): Promise<Session[]> => {
  const db = await getDb();
  if (status && status !== 'all') {
    return db.getAllAsync<Session>(
      `SELECT * FROM sessions WHERE status = ? ORDER BY date DESC, id DESC`, [status]
    );
  }
  return db.getAllAsync<Session>(
    `SELECT * FROM sessions ORDER BY date DESC, id DESC`
  );
};

export interface LifetimeStats {
  /** All completed sessions ever (not capped to the visible history). */
  completed: number;
  /** Total EXP across all completed sessions. */
  totalExp: number;
  /** Distinct dates (YYYY-MM-DD) with a completed session, newest first. */
  completedDates: string[];
}

export const getLifetimeStats = async (): Promise<LifetimeStats> => {
  const db = await getDb();
  const agg = await db.getFirstAsync<{ completed: number; total_exp: number | null }>(
    `SELECT COUNT(*) AS completed, COALESCE(SUM(total_exp), 0) AS total_exp
     FROM sessions WHERE status = 'completed'`
  );
  const rows = await db.getAllAsync<{ date: string }>(
    `SELECT DISTINCT date FROM sessions WHERE status = 'completed' ORDER BY date DESC`
  );
  return {
    completed: agg?.completed ?? 0,
    totalExp: agg?.total_exp ?? 0,
    completedDates: rows.map(r => r.date),
  };
};

export const getSessionExercises = async (sessionId: number): Promise<SessionExercise[]> => {
  const db = await getDb();
  return db.getAllAsync<SessionExercise>(
    `SELECT * FROM session_exercises WHERE session_id = ? ORDER BY id`, [sessionId]
  );
};

export const updateSession = async (id: number, updates: Partial<Session>): Promise<void> => {
  const db = await getDb();
  const keys = Object.keys(updates);
  if (keys.length === 0) return;
  const fields = keys.map(k => `${k} = ?`).join(', ');
  await db.runAsync(`UPDATE sessions SET ${fields} WHERE id = ?`, [...Object.values(updates), id]);
};

export const getSession = async (id: number): Promise<Session | null> => {
  const db = await getDb();
  return db.getFirstAsync<Session>(`SELECT * FROM sessions WHERE id = ?`, [id]);
};

// actualAmount = how much the player actually did (reps, km, minutes, etc.)
// expEarned = actualAmount × exp_per_unit × sets (calculated in SessionScreen)
/**
 * Records a completed value against the exercise's personal record.
 * Returns true when a new PR was set. A completion in a different unit than
 * the stored PR (the exercise's unit was reworked) starts a fresh baseline
 * instead of comparing incomparable numbers.
 */
const recordExercisePr = async (
  db: SQLite.SQLiteDatabase, exerciseId: number, value: number, unit: string
): Promise<boolean> => {
  const row = await db.getFirstAsync<{ pr_value: number | null; pr_unit: string | null }>(
    `SELECT pr_value, pr_unit FROM exercises WHERE id = ?`, [exerciseId]
  );
  if (!row) return false;
  const sameUnit = (row.pr_unit ?? '') === unit;
  if (sameUnit && value <= (row.pr_value ?? 0)) return false;
  await db.runAsync(
    `UPDATE exercises SET pr_value = ?, pr_unit = ?, pr_at = ? WHERE id = ?`,
    [value, unit, new Date().toISOString(), exerciseId]
  );
  return true;
};

export const completeSessionExercise = async (
  id: number, actualAmount: number, expEarned: number, actualUnits: string = '[]'
): Promise<boolean> => {
  const db = await getDb();
  await db.runAsync(
    `UPDATE session_exercises SET is_completed = 1, actual_amount = ?, exp_reward = ?, actual_units = ? WHERE id = ?`,
    [actualAmount, expEarned, actualUnits, id]
  );
  const meta = await db.getFirstAsync<{ exercise_id: number; primary_unit: string | null; unit_type: string | null }>(
    `SELECT exercise_id, primary_unit, unit_type FROM session_exercises WHERE id = ?`, [id]
  );
  if (!meta) return false;
  return recordExercisePr(db, meta.exercise_id, actualAmount, meta.primary_unit || meta.unit_type || 'reps');
};

// ─────────────────────────────────────────────
// TITLES
// ─────────────────────────────────────────────

export const saveTitle = async (title: string, description: string): Promise<boolean> => {
  const db = await getDb();
  try {
    await db.runAsync(
      `INSERT INTO titles (title, description) VALUES (?, ?)`, [title, description]
    );
    return true; // newly inserted
  } catch {
    return false; // UNIQUE constraint — already earned
  }
};

export const getTitles = async (): Promise<EarnedTitle[]> => {
  const db = await getDb();
  return db.getAllAsync<EarnedTitle>(`SELECT * FROM titles ORDER BY earned_at DESC`);
};

export const getBonusExercises = async (sessionId: number): Promise<BonusExercise[]> => {
  const db = await getDb();
  return db.getAllAsync<BonusExercise>(
    `SELECT * FROM bonus_exercises WHERE session_id = ? ORDER BY id`, [sessionId]
  );
};

export const addBonusExerciseToSession = async (
  sessionId: number, exercise: Exercise, target: number,
  unitValues: string = '[]'
): Promise<void> => {
  const db = await getDb();
  await db.runAsync(
    `INSERT INTO bonus_exercises
       (session_id, exercise_id, exercise_name, target, unit_type, unit_label, units, primary_unit, unit_values, exp_per_unit, exp_unit_count, exp_per_stat_point, stat_type)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [sessionId, exercise.id!, exercise.name, target,
     exercise.unit_type ?? 'reps', exercise.unit_label ?? 'reps',
     exercise.units ?? '[]', exercise.primary_unit ?? exercise.unit_type ?? 'reps', unitValues,
     exercise.exp_per_unit ?? 2, exercise.exp_unit_count ?? 1,
     exercise.exp_per_stat_point ?? 20, exercise.stat_type ?? 'strength']
  );
};

export const completeBonusExercise = async (
  id: number, actualAmount: number, expEarned: number, actualUnits: string = '[]'
): Promise<boolean> => {
  const db = await getDb();
  await db.runAsync(
    `UPDATE bonus_exercises SET is_completed = 1, actual_amount = ?, exp_reward = ?, actual_units = ? WHERE id = ?`,
    [actualAmount, expEarned, actualUnits, id]
  );
  const meta = await db.getFirstAsync<{ exercise_id: number; primary_unit: string | null; unit_type: string | null }>(
    `SELECT exercise_id, primary_unit, unit_type FROM bonus_exercises WHERE id = ?`, [id]
  );
  if (!meta) return false;
  return recordExercisePr(db, meta.exercise_id, actualAmount, meta.primary_unit || meta.unit_type || 'reps');
};

// Marks bonus exercises as having had their EXP awarded to the player.
// Used so that "Claim Bonus EXP" on an already-completed session only
// applies each bonus exercise's reward once.
export const markBonusExercisesAwarded = async (ids: number[]): Promise<void> => {
  if (ids.length === 0) return;
  const db = await getDb();
  const placeholders = ids.map(() => '?').join(', ');
  await db.runAsync(
    `UPDATE bonus_exercises SET exp_awarded = 1 WHERE id IN (${placeholders})`,
    ids
  );
};

export const getMissedSessions = async (): Promise<Session[]> => {
  const db = await getDb();
  const today = new Date().toISOString().split('T')[0];
  return db.getAllAsync<Session>(
    `SELECT * FROM sessions WHERE date < ? AND status = 'pending'`, [today]
  );
};

export const applyMissedSessionPenalty = async (sessionId: number): Promise<number> => {
  const db = await getDb();
  const session = await db.getFirstAsync<{ plan_id: number; is_manual: number }>(
    `SELECT plan_id, is_manual FROM sessions WHERE id = ?`, [sessionId]
  );
  if (!session) return 0;
  const plan = await db.getFirstAsync<{ penalty_exp: number }>(
    `SELECT penalty_exp FROM plans WHERE id = ?`, [session.plan_id]
  );
  // Manually-added sessions are optional for the day — never penalised.
  const penalty = session.is_manual ? 0 : (plan?.penalty_exp ?? 0);
  // Always move the session out of 'pending' — even a zero-penalty missed quest
  // must not be reprocessed on every load.
  await db.runAsync(`UPDATE sessions SET status = 'skipped' WHERE id = ?`, [sessionId]);
  if (penalty === 0) return 0;
  const player = await db.getFirstAsync<{ id: number; total_exp: number; exp: number }>(
    `SELECT id, total_exp, exp FROM player ORDER BY id ASC LIMIT 1`
  );
  if (!player) return 0;
  const newTotal = Math.max(0, player.total_exp - penalty);
  const { level, expInCurrentLevel, expToNext } = calculateLevelFromTotalExp(newTotal);
  await db.runAsync(
    `UPDATE player SET exp = ?, total_exp = ?, level = ?, exp_to_next = ? WHERE id = ?`,
    [expInCurrentLevel, newTotal, level, expToNext, player.id]
  );
  return penalty;
};

/**
 * Deletes ALL data from every table and resets the singleton DB connection.
 * After calling this, the app should navigate back to Registration.
 */
export const resetAllData = async (): Promise<void> => {
  const db = await getDb();
  await db.execAsync(`
    DELETE FROM challenge_goals;
    DELETE FROM challenges;
    DELETE FROM skill_group_links;
    DELETE FROM skill_groups;
    DELETE FROM skill_exercises;
    DELETE FROM skills;
    DELETE FROM art_notes;
    DELETE FROM tutorials;
    DELETE FROM martial_arts;
    DELETE FROM bonus_exercises;
    DELETE FROM session_exercises;
    DELETE FROM sessions;
    DELETE FROM plan_groups;
    DELETE FROM plan_exercises;
    DELETE FROM plans;
    DELETE FROM exercise_groups;
    DELETE FROM item_groups;
    DELETE FROM exercise_body_parts;
    DELETE FROM exercises;
    DELETE FROM titles;
    DELETE FROM body_metrics;
    DELETE FROM settings;
    DELETE FROM player;
  `);
  await db.execAsync(`
    DELETE FROM sqlite_sequence WHERE name IN
      ('player','exercises','exercise_body_parts','plans','plan_exercises','sessions','session_exercises','titles','bonus_exercises','martial_arts','skills','skill_exercises','art_notes','tutorials','item_groups','exercise_groups','plan_groups','skill_groups','skill_group_links','settings','body_metrics','challenges','challenge_goals');
  `);
};

// ─────────────────────────────────────────────
// SETTINGS  (small key/value store for app preferences)
// ─────────────────────────────────────────────

export const getSetting = async (key: string): Promise<string | null> => {
  const db = await getDb();
  const row = await db.getFirstAsync<{ value: string }>(
    `SELECT value FROM settings WHERE key = ?`, [key]
  );
  return row?.value ?? null;
};

export const setSetting = async (key: string, value: string): Promise<void> => {
  const db = await getDb();
  await db.runAsync(
    `INSERT INTO settings (key, value) VALUES (?, ?)
      ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
    [key, value]
  );
};

// ─────────────────────────────────────────────
// BODY METRICS  (periodic weight entries for the Progress screen)
// ─────────────────────────────────────────────

export interface BodyMetric {
  id?: number;
  measured_at: string; // 'YYYY-MM-DD'
  weight: number;
  note: string;
  created_at?: string;
}

export const getBodyMetrics = async (): Promise<BodyMetric[]> => {
  const db = await getDb();
  return db.getAllAsync<BodyMetric>(
    `SELECT * FROM body_metrics ORDER BY measured_at DESC, id DESC`
  );
};

export const addBodyMetric = async (metric: { measured_at: string; weight: number; note?: string }): Promise<number> => {
  const db = await getDb();
  const result = await db.runAsync(
    `INSERT INTO body_metrics (measured_at, weight, note) VALUES (?, ?, ?)`,
    [metric.measured_at, metric.weight, metric.note ?? '']
  );
  // Keep the player's registration weight in sync with the latest entry.
  await db.runAsync(`UPDATE player SET weight = ? WHERE id = 1`, [metric.weight]);
  return result.lastInsertRowId;
};

export const deleteBodyMetric = async (id: number): Promise<void> => {
  const db = await getDb();
  await db.runAsync(`DELETE FROM body_metrics WHERE id = ?`, [id]);
};

// ─────────────────────────────────────────────
// CHALLENGES
// Progress is always derived from logged session rows - nothing is cached,
// so editing history or deleting a session can never desync a challenge.
// ─────────────────────────────────────────────

export const getChallenges = async (): Promise<Challenge[]> => {
  const db = await getDb();
  return db.getAllAsync<Challenge>(
    `SELECT * FROM challenges ORDER BY start_date DESC, id DESC`
  );
};

export const getChallenge = async (id: number): Promise<Challenge | null> => {
  const db = await getDb();
  return db.getFirstAsync<Challenge>(`SELECT * FROM challenges WHERE id = ?`, [id]);
};

export const createChallenge = async (
  challenge: Omit<Challenge, 'id' | 'created_at'>
): Promise<number> => {
  const db = await getDb();
  const result = await db.runAsync(
    `INSERT INTO challenges (name, description, start_date, end_date) VALUES (?, ?, ?, ?)`,
    [challenge.name, challenge.description, challenge.start_date, challenge.end_date]
  );
  return result.lastInsertRowId;
};

export const updateChallenge = async (
  id: number,
  updates: Partial<Omit<Challenge, 'id' | 'created_at'>>
): Promise<void> => {
  const db = await getDb();
  const keys = Object.keys(updates);
  if (keys.length === 0) return;
  const setClause = keys.map(k => `${k} = ?`).join(', ');
  await db.runAsync(
    `UPDATE challenges SET ${setClause} WHERE id = ?`,
    [...Object.values(updates), id]
  );
};

export const deleteChallenge = async (id: number): Promise<void> => {
  const db = await getDb();
  await db.withTransactionAsync(async () => {
    await db.runAsync(`DELETE FROM challenge_goals WHERE challenge_id = ?`, [id]);
    await db.runAsync(`DELETE FROM challenges WHERE id = ?`, [id]);
  });
};

const CHALLENGE_GOAL_SELECT = `
  SELECT g.id, g.challenge_id, g.exercise_id,
         COALESCE(e.name, g.exercise_name) AS exercise_name,
         g.unit_type, g.target, g.created_at,
         CASE WHEN e.id IS NULL THEN 0 ELSE 1 END AS exercise_exists
    FROM challenge_goals g
    LEFT JOIN exercises e ON e.id = g.exercise_id`;

export const getChallengeGoals = async (challengeId: number): Promise<ChallengeGoal[]> => {
  const db = await getDb();
  return db.getAllAsync<ChallengeGoal>(
    `${CHALLENGE_GOAL_SELECT} WHERE g.challenge_id = ? ORDER BY g.id`,
    [challengeId]
  );
};

export const getAllChallengeGoals = async (): Promise<ChallengeGoal[]> => {
  const db = await getDb();
  return db.getAllAsync<ChallengeGoal>(
    `${CHALLENGE_GOAL_SELECT} ORDER BY g.challenge_id, g.id`
  );
};

export const addChallengeGoal = async (
  goal: Pick<ChallengeGoal, 'challenge_id' | 'exercise_id' | 'exercise_name' | 'unit_type' | 'target'>
): Promise<number> => {
  const db = await getDb();
  const result = await db.runAsync(
    `INSERT INTO challenge_goals (challenge_id, exercise_id, exercise_name, unit_type, target)
     VALUES (?, ?, ?, ?, ?)
     ON CONFLICT(challenge_id, exercise_id, unit_type)
     DO UPDATE SET target = excluded.target, exercise_name = excluded.exercise_name`,
    [goal.challenge_id, goal.exercise_id, goal.exercise_name, goal.unit_type, goal.target]
  );
  return result.lastInsertRowId;
};

export const updateChallengeGoalTarget = async (id: number, target: number): Promise<void> => {
  const db = await getDb();
  await db.runAsync(`UPDATE challenge_goals SET target = ? WHERE id = ?`, [target, id]);
};

export const deleteChallengeGoal = async (id: number): Promise<void> => {
  const db = await getDb();
  await db.runAsync(`DELETE FROM challenge_goals WHERE id = ?`, [id]);
};

/**
 * Every completed exercise (main + bonus) logged between two UTC dates,
 * inclusive. Bonus rows count as a single set. Used by the Challenges screens.
 */
export const getChallengeActivity = async (
  fromDate: string,
  toDate: string
): Promise<ChallengeActivityRow[]> => {
  const db = await getDb();
  return db.getAllAsync<ChallengeActivityRow>(
    `SELECT s.date AS date,
            se.exercise_id AS exercise_id,
            COALESCE(se.sets_total, 1) AS sets,
            se.actual_amount AS actual_amount,
            COALESCE(se.primary_unit, se.unit_type, 'reps') AS primary_unit,
            COALESCE(se.unit_type, 'reps') AS unit_type,
            COALESCE(se.actual_units, '[]') AS actual_units
       FROM session_exercises se
       JOIN sessions s ON s.id = se.session_id
      WHERE se.is_completed = 1 AND s.date >= ? AND s.date <= ?
     UNION ALL
     SELECT s.date,
            be.exercise_id,
            1,
            be.actual_amount,
            COALESCE(be.primary_unit, be.unit_type, 'reps'),
            COALESCE(be.unit_type, 'reps'),
            COALESCE(be.actual_units, '[]')
       FROM bonus_exercises be
       JOIN sessions s ON s.id = be.session_id
      WHERE be.is_completed = 1 AND s.date >= ? AND s.date <= ?`,
    [fromDate, toDate, fromDate, toDate]
  );
};

// ─────────────────────────────────────────────
// BACKUP  (export / import a full JSON snapshot)
// ─────────────────────────────────────────────

/** Every table included in a backup, in delete-safe order (children first). */
const BACKUP_TABLES = [
  'challenge_goals', 'challenges',
  'skill_group_links', 'skill_groups', 'skill_exercises', 'skills', 'art_notes', 'tutorials',
  'martial_arts', 'bonus_exercises', 'session_exercises', 'sessions',
  'plan_groups', 'plan_exercises', 'plans', 'exercise_groups', 'item_groups',
  'exercise_body_parts', 'exercises', 'titles', 'settings', 'body_metrics', 'player',
] as const;

export const BACKUP_APP_ID = 'beyond';
export const BACKUP_SCHEMA_VERSION = 1;

export interface BackupFile {
  app: typeof BACKUP_APP_ID;
  schemaVersion: number;
  exportedAt: string;
  tables: Record<string, unknown[]>;
}

/**
 * Snapshot every table into a plain JSON object. Note: attached demo media
 * files (images/videos) live on the filesystem, not in SQLite, and are NOT
 * included — only game data is backed up.
 */
export const exportAllData = async (): Promise<BackupFile> => {
  const db = await getDb();
  const tables: Record<string, unknown[]> = {};
  for (const t of BACKUP_TABLES) {
    tables[t] = await db.getAllAsync(`SELECT * FROM ${t}`);
  }
  return {
    app: BACKUP_APP_ID,
    schemaVersion: BACKUP_SCHEMA_VERSION,
    exportedAt: new Date().toISOString(),
    tables,
  };
};

export type ImportFailure =
  | 'not-backup'      // wrong/absent app marker
  | 'bad-shape'       // tables missing or not an object
  | 'no-player'       // player row missing — this isn't a playable save
  | 'failed';         // unexpected DB error (wrapped by caller)

export class ImportBackupError extends Error {
  constructor(public kind: ImportFailure) { super(`import failed: ${kind}`); }
}

/**
 * Wipe every table and replay a backup on top, preserving original ids so
 * foreign-key-ish references between rows (session_id, plan_id, ...) stay
 * intact. Only keys that exist in the current schema are written, so backups
 * from older app versions import cleanly. Throws ImportBackupError on invalid
 * input; the caller shows the friendly message.
 */
export const importAllData = async (input: unknown): Promise<number> => {
  if (!input || typeof input !== 'object') throw new ImportBackupError('not-backup');
  const backup = input as Partial<BackupFile>;
  if (backup.app !== BACKUP_APP_ID || !backup.tables || typeof backup.tables !== 'object') {
    throw new ImportBackupError('not-backup');
  }
  const playerRows = backup.tables.player;
  if (!Array.isArray(playerRows) || playerRows.length === 0) throw new ImportBackupError('no-player');

  const db = await getDb();
  let imported = 0;

  try {
    await db.withTransactionAsync(async () => {
      // Same wipe order as resetAllData: children before parents.
      await db.execAsync(`
        DELETE FROM challenge_goals;
        DELETE FROM challenges;
        DELETE FROM skill_group_links;
        DELETE FROM skill_groups;
        DELETE FROM skill_exercises;
        DELETE FROM skills;
        DELETE FROM art_notes;
        DELETE FROM tutorials;
        DELETE FROM martial_arts;
        DELETE FROM bonus_exercises;
        DELETE FROM session_exercises;
        DELETE FROM sessions;
        DELETE FROM plan_groups;
        DELETE FROM plan_exercises;
        DELETE FROM plans;
        DELETE FROM exercise_groups;
        DELETE FROM item_groups;
        DELETE FROM exercise_body_parts;
        DELETE FROM exercises;
        DELETE FROM titles;
        DELETE FROM body_metrics;
        DELETE FROM settings;
        DELETE FROM player;
        DELETE FROM sqlite_sequence WHERE name IN
          ('player','exercises','exercise_body_parts','plans','plan_exercises','sessions','session_exercises','titles','bonus_exercises','martial_arts','skills','skill_exercises','art_notes','tutorials','item_groups','exercise_groups','plan_groups','skill_groups','skill_group_links','settings','body_metrics','challenges','challenge_goals');
      `);

      for (const t of BACKUP_TABLES) {
        const rows = backup.tables![t];
        if (!Array.isArray(rows) || rows.length === 0) continue;
        const cols = (await db.getAllAsync<{ name: string }>(`PRAGMA table_info(${t})`)).map(c => c.name);
        for (const row of rows) {
          if (!row || typeof row !== 'object') continue;
          const rec = row as Record<string, unknown>;
          const keys = Object.keys(rec).filter(k => cols.includes(k));
          if (keys.length === 0) continue;
          await db.runAsync(
            `INSERT INTO ${t} (${keys.join(', ')}) VALUES (${keys.map(() => '?').join(', ')})`,
            keys.map(k => (rec[k] === undefined ? null : rec[k]) as SQLite.SQLiteBindValue)
          );
          imported++;
        }
      }

      // Explicit-id inserts update AUTOINCREMENT sequences automatically, but
      // only when a row exceeds the old max — normalise so the next local
      // insert never collides with an imported id.
      for (const t of BACKUP_TABLES) {
        const max = await db.getFirstAsync<{ m: number | null }>(`SELECT MAX(id) AS m FROM ${t}`);
        if (max?.m != null) {
          await db.runAsync(`UPDATE sqlite_sequence SET seq = ? WHERE name = ?`, [max.m, t]);
        } else {
          await db.runAsync(`DELETE FROM sqlite_sequence WHERE name = ?`, [t]);
        }
      }
    });
  } catch (e) {
    if (e instanceof ImportBackupError) throw e;
    console.error('importAllData error:', e);
    throw new ImportBackupError('failed');
  }

  return imported;
};

export const getSessionSummary = async (sessionId: number): Promise<{
  exercises: { name: string; actual_amount: number; unit_label: string; units: string; primary_unit: string; actual_units: string; exp_reward: number; is_completed: number }[];
  bonuses:   { name: string; actual_amount: number; unit_label: string; units: string; primary_unit: string; actual_units: string; exp_reward: number; is_completed: number }[];
}> => {
  const db = await getDb();
  const exercises = await db.getAllAsync<any>(
    `SELECT exercise_name as name, actual_amount, COALESCE(unit_label, 'reps') as unit_label,
            COALESCE(units, '[]') as units, COALESCE(primary_unit, unit_type, 'reps') as primary_unit,
            COALESCE(actual_units, '[]') as actual_units, exp_reward, is_completed
     FROM session_exercises WHERE session_id = ? ORDER BY id`,
    [sessionId]
  );
  const bonuses = await db.getAllAsync<any>(
    `SELECT exercise_name as name, actual_amount, COALESCE(unit_label, 'reps') as unit_label,
            COALESCE(units, '[]') as units, COALESCE(primary_unit, unit_type, 'reps') as primary_unit,
            COALESCE(actual_units, '[]') as actual_units, exp_reward, is_completed
     FROM bonus_exercises WHERE session_id = ? ORDER BY id`,
    [sessionId]
  );
  return { exercises, bonuses };
};

// ─────────────────────────────────────────────
// MARTIAL ARTS
// ─────────────────────────────────────────────

export const createMartialArt = async (
  art: Pick<MartialArt, 'name' | 'description' | 'icon' | 'color'>
): Promise<number> => {
  const db = await getDb();
  const expToNext = calculateMartialLevelFromTotalExp(0).expToNext;
  const result = await db.runAsync(
    `INSERT INTO martial_arts (name, description, icon, color, total_exp, level, exp, exp_to_next)
     VALUES (?, ?, ?, ?, 0, 1, 0, ?)`,
    [art.name, art.description, art.icon, art.color, expToNext]
  );
  return result.lastInsertRowId;
};

/**
 * An art's proficiency is derived entirely from its skills: total EXP is the
 * sum of its skills' EXP, and level/belt follow from that. The art has no
 * independent EXP pool, so untagged/general training never moves it.
 */
interface SkillAgg { skill_count: number; total_exp: number; }

const deriveArt = (art: MartialArt, agg?: SkillAgg): MartialArt => {
  const totalExp = agg?.total_exp ?? 0;
  const { level, expInCurrentLevel, expToNext } = calculateMartialLevelFromTotalExp(totalExp);
  return {
    ...art,
    total_exp: totalExp,
    level,
    exp: expInCurrentLevel,
    exp_to_next: expToNext,
    skill_count: agg?.skill_count ?? 0,
  };
};

export const getMartialArts = async (): Promise<MartialArt[]> => {
  const db = await getDb();
  const arts = await db.getAllAsync<MartialArt>(
    `SELECT * FROM martial_arts ORDER BY created_at DESC`
  );
  const aggs = await db.getAllAsync<SkillAgg & { martial_art_id: number }>(
    `SELECT martial_art_id, COUNT(*) as skill_count, COALESCE(SUM(total_exp), 0) as total_exp
       FROM skills GROUP BY martial_art_id`
  );
  const byArt: Record<number, SkillAgg> = {};
  for (const a of aggs) byArt[a.martial_art_id] = a;
  return arts.map(a => deriveArt(a, byArt[a.id!]));
};

export const getMartialArt = async (id: number): Promise<MartialArt | null> => {
  const db = await getDb();
  const art = await db.getFirstAsync<MartialArt>(`SELECT * FROM martial_arts WHERE id = ?`, [id]);
  if (!art) return null;
  const agg = await db.getFirstAsync<SkillAgg>(
    `SELECT COUNT(*) as skill_count, COALESCE(SUM(total_exp), 0) as total_exp
       FROM skills WHERE martial_art_id = ?`,
    [id]
  );
  return deriveArt(art, agg ?? undefined);
};

export const updateMartialArt = async (id: number, updates: Partial<MartialArt>): Promise<void> => {
  const db = await getDb();
  const { id: _drop, skill_count: _drop2, created_at: _drop3, ...fields } = updates;
  const keys = Object.keys(fields);
  if (keys.length === 0) return;
  const setClause = keys.map(k => `${k} = ?`).join(', ');
  await db.runAsync(`UPDATE martial_arts SET ${setClause} WHERE id = ?`, [...Object.values(fields), id]);
};

/** Deletes an art, its skills, skill groups and all tags. Returns media URIs to remove from disk. */
export const deleteMartialArt = async (id: number): Promise<string[]> => {
  const db = await getDb();
  const skills = await db.getAllAsync<{ id: number; media_uri: string; media_type: string }>(
    `SELECT id, media_uri, media_type FROM skills WHERE martial_art_id = ?`, [id]
  );
  const noteRows = await db.getAllAsync<{ media: string }>(
    `SELECT media FROM art_notes WHERE martial_art_id = ?`, [id]
  );
  await db.withTransactionAsync(async () => {
    // FK enforcement is off — clean dependants explicitly.
    await db.runAsync(
      `DELETE FROM skill_group_links WHERE group_id IN (SELECT id FROM skill_groups WHERE martial_art_id = ?)`,
      [id]
    );
    await db.runAsync(`DELETE FROM skill_groups WHERE martial_art_id = ?`, [id]);
    await db.runAsync(
      `DELETE FROM skill_exercises WHERE skill_id IN (SELECT id FROM skills WHERE martial_art_id = ?)`,
      [id]
    );
    await db.runAsync(`DELETE FROM skills WHERE martial_art_id = ?`, [id]);
    await db.runAsync(`DELETE FROM art_notes WHERE martial_art_id = ?`, [id]);
    await db.runAsync(`DELETE FROM tutorials WHERE martial_art_id = ?`, [id]);
    await db.runAsync(`DELETE FROM martial_arts WHERE id = ?`, [id]);
  });
  return [
    ...skills
      .filter(s => s.media_type !== 'none' && s.media_uri)
      .map(s => s.media_uri),
    ...noteRows.flatMap(r => parseNoteMedia(r.media).map(m => m.uri)),
  ];
};

export const createSkill = async (
  skill: Pick<Skill, 'martial_art_id' | 'name' | 'description' | 'media_type' | 'media_uri'>
): Promise<number> => {
  const db = await getDb();
  const expToNext = calculateMartialLevelFromTotalExp(0).expToNext;
  const result = await db.runAsync(
    `INSERT INTO skills (martial_art_id, name, description, media_type, media_uri, total_exp, level, exp, exp_to_next)
     VALUES (?, ?, ?, ?, ?, 0, 1, 0, ?)`,
    [skill.martial_art_id, skill.name, skill.description,
     skill.media_type ?? 'none', skill.media_uri ?? '', expToNext]
  );
  return result.lastInsertRowId;
};

export const getSkills = async (martialArtId: number): Promise<Skill[]> => {
  const db = await getDb();
  const skills = await db.getAllAsync<Skill>(
    `SELECT * FROM skills WHERE martial_art_id = ? ORDER BY created_at ASC`, [martialArtId]
  );
  const counts = await db.getAllAsync<{ skill_id: number; count: number }>(
    `SELECT skill_id, COUNT(*) as count FROM skill_exercises GROUP BY skill_id`
  );
  const bySkill: Record<number, number> = {};
  for (const c of counts) bySkill[c.skill_id] = c.count;
  const links = await db.getAllAsync<{ skill_id: number; group_id: number }>(
    `SELECT l.skill_id, l.group_id FROM skill_group_links l
       JOIN skill_groups g ON l.group_id = g.id
      WHERE g.martial_art_id = ?`, [martialArtId]
  );
  const groupsBySkill = new Map<number, number[]>();
  for (const l of links) {
    const arr = groupsBySkill.get(l.skill_id) ?? [];
    arr.push(l.group_id);
    groupsBySkill.set(l.skill_id, arr);
  }
  return skills.map(s => ({
    ...s,
    exercise_count: bySkill[s.id!] ?? 0,
    groups: JSON.stringify(groupsBySkill.get(s.id!) ?? []),
  }));
};

export const getSkill = async (id: number): Promise<Skill | null> => {
  const db = await getDb();
  return db.getFirstAsync<Skill>(`SELECT * FROM skills WHERE id = ?`, [id]);
};

export const updateSkill = async (id: number, updates: Partial<Skill>): Promise<void> => {
  const db = await getDb();
  const { id: _drop, exercise_count: _drop2, created_at: _drop3, ...fields } = updates;
  const keys = Object.keys(fields);
  if (keys.length === 0) return;
  const setClause = keys.map(k => `${k} = ?`).join(', ');
  await db.runAsync(`UPDATE skills SET ${setClause} WHERE id = ?`, [...Object.values(fields), id]);
};

/** Deletes a skill, its workout/group tags. Returns the media URI to remove from disk (if any). */
export const deleteSkill = async (id: number): Promise<string | null> => {
  const db = await getDb();
  const skill = await db.getFirstAsync<{ media_uri: string; media_type: string }>(
    `SELECT media_uri, media_type FROM skills WHERE id = ?`, [id]
  );
  await db.withTransactionAsync(async () => {
    await db.runAsync(`DELETE FROM skill_exercises WHERE skill_id = ?`, [id]);
    await db.runAsync(`DELETE FROM skill_group_links WHERE skill_id = ?`, [id]);
    await db.runAsync(`DELETE FROM skills WHERE id = ?`, [id]);
  });
  return skill && skill.media_type !== 'none' && skill.media_uri ? skill.media_uri : null;
};

export const addExerciseToSkill = async (skillId: number, exerciseId: number): Promise<void> => {
  const db = await getDb();
  await db.runAsync(
    `INSERT OR IGNORE INTO skill_exercises (skill_id, exercise_id) VALUES (?, ?)`,
    [skillId, exerciseId]
  );
};

export const removeExerciseFromSkill = async (skillId: number, exerciseId: number): Promise<void> => {
  const db = await getDb();
  await db.runAsync(
    `DELETE FROM skill_exercises WHERE skill_id = ? AND exercise_id = ?`,
    [skillId, exerciseId]
  );
};

export const getTaggedExerciseIdsForSkill = async (skillId: number): Promise<number[]> => {
  const db = await getDb();
  const rows = await db.getAllAsync<{ exercise_id: number }>(
    `SELECT exercise_id FROM skill_exercises WHERE skill_id = ?`, [skillId]
  );
  return rows.map(r => r.exercise_id);
};

export const getExercisesForSkill = async (skillId: number): Promise<Exercise[]> => {
  const db = await getDb();
  const exercises = await db.getAllAsync<Exercise>(
    `SELECT e.* FROM exercises e
       JOIN skill_exercises se ON se.exercise_id = e.id
      WHERE se.skill_id = ?
      ORDER BY e.name`,
    [skillId]
  );
  if (exercises.length === 0) return [];
  const ids = exercises.map(e => e.id!);
  const placeholders = ids.map(() => '?').join(', ');
  const parts = await db.getAllAsync<{ exercise_id: number; body_part: string }>(
    `SELECT exercise_id, body_part FROM exercise_body_parts WHERE exercise_id IN (${placeholders})`,
    ids
  );
  const byExercise = new Map<number, string[]>();
  for (const p of parts) {
    const arr = byExercise.get(p.exercise_id) ?? [];
    arr.push(p.body_part);
    byExercise.set(p.exercise_id, arr);
  }
  return exercises.map(ex => ({ ...ex, body_parts: JSON.stringify(byExercise.get(ex.id!) ?? []) }));
};

/** A belt earned by crossing a proficiency threshold (skill- or art-level). */
export interface BeltPromotion {
  name: string;
  kind: 'skill' | 'art';
  from: string;
  to: string;
}

/**
 * Awards proficiency EXP to every skill tagged to the given exercise
 * completions. Each item's EXP is added once per tagged skill. Martial arts
 * have no independent EXP — their proficiency is derived from their skills.
 * Returns every belt promotion earned along the way (skill and art level).
 */
export const awardMartialProficiency = async (
  items: { exercise_id: number; exp: number }[]
): Promise<BeltPromotion[]> => {
  const promotions: BeltPromotion[] = [];
  const valid = items.filter(i => i.exercise_id > 0 && i.exp > 0);
  if (valid.length === 0) return promotions;

  const db = await getDb();
  const ids = [...new Set(valid.map(i => i.exercise_id))];
  const placeholders = ids.map(() => '?').join(', ');
  const tags = await db.getAllAsync<{ exercise_id: number; skill_id: number }>(
    `SELECT exercise_id, skill_id FROM skill_exercises WHERE exercise_id IN (${placeholders})`,
    ids
  );
  if (tags.length === 0) return promotions;

  const skillExp: Record<number, number> = {};
  for (const item of valid) {
    for (const t of tags) {
      if (t.exercise_id !== item.exercise_id) continue;
      skillExp[t.skill_id] = (skillExp[t.skill_id] ?? 0) + item.exp;
    }
  }

  // Snapshot pre-award state so belt crossings can be detected.
  const skillIds = Object.keys(skillExp).map(Number);
  const ph = skillIds.map(() => '?').join(', ');
  const before = await db.getAllAsync<{ id: number; name: string; martial_art_id: number; total_exp: number }>(
    `SELECT id, name, martial_art_id, total_exp FROM skills WHERE id IN (${ph})`,
    skillIds
  );
  const artIds = [...new Set(before.map(s => s.martial_art_id))];
  const artBefore: Record<number, number> = {};
  if (artIds.length > 0) {
    const aph = artIds.map(() => '?').join(', ');
    const rows = await db.getAllAsync<{ martial_art_id: number; sum: number }>(
      `SELECT martial_art_id, COALESCE(SUM(total_exp), 0) as sum FROM skills
        WHERE martial_art_id IN (${aph}) GROUP BY martial_art_id`,
      artIds
    );
    for (const r of rows) artBefore[r.martial_art_id] = r.sum;
  }
  const artNames: Record<number, string> = {};
  if (artIds.length > 0) {
    const aph = artIds.map(() => '?').join(', ');
    const rows = await db.getAllAsync<{ id: number; name: string }>(
      `SELECT id, name FROM martial_arts WHERE id IN (${aph})`, artIds
    );
    for (const r of rows) artNames[r.id] = r.name;
  }

  const applySkillExp = async (id: number, gained: number): Promise<void> => {
    const row = await db.getFirstAsync<{ total_exp: number }>(
      `SELECT total_exp FROM skills WHERE id = ?`, [id]
    );
    if (!row) return;
    const newTotal = (row.total_exp ?? 0) + gained;
    const { level, expInCurrentLevel, expToNext } = calculateMartialLevelFromTotalExp(newTotal);
    await db.runAsync(
      `UPDATE skills SET total_exp = ?, level = ?, exp = ?, exp_to_next = ? WHERE id = ?`,
      [newTotal, level, expInCurrentLevel, expToNext, id]
    );
  };

  await db.withTransactionAsync(async () => {
    for (const [id, gained] of Object.entries(skillExp)) {
      await applySkillExp(Number(id), gained);
    }
  });

  // Compare belts before/after — promotions are pure visuals for callers.
  const artDelta: Record<number, number> = {};
  for (const s of before) {
    const gained = skillExp[s.id] ?? 0;
    const oldLevel = calculateMartialLevelFromTotalExp(s.total_exp ?? 0).level;
    const newLevel = calculateMartialLevelFromTotalExp((s.total_exp ?? 0) + gained).level;
    const oldBelt = getBeltForLevel(oldLevel);
    const newBelt = getBeltForLevel(newLevel);
    if (newBelt.belt !== oldBelt.belt) {
      promotions.push({ name: s.name, kind: 'skill', from: oldBelt.belt, to: newBelt.belt });
    }
    artDelta[s.martial_art_id] = (artDelta[s.martial_art_id] ?? 0) + gained;
  }
  for (const [artIdStr, gained] of Object.entries(artDelta)) {
    const artId = Number(artIdStr);
    const oldTotal = artBefore[artId] ?? 0;
    const oldBelt = getBeltForLevel(calculateMartialLevelFromTotalExp(oldTotal).level);
    const newBelt = getBeltForLevel(calculateMartialLevelFromTotalExp(oldTotal + gained).level);
    if (newBelt.belt !== oldBelt.belt) {
      promotions.push({ name: artNames[artId] ?? 'Martial art', kind: 'art', from: oldBelt.belt, to: newBelt.belt });
    }
  }
  return promotions;
};

// ─────────────────────────────────────────────
// TUTORIALS (ordered series of notes under a martial art)
// ─────────────────────────────────────────────

export const getTutorials = async (martialArtId: number): Promise<Tutorial[]> => {
  const db = await getDb();
  const tutorials = await db.getAllAsync<Tutorial>(
    `SELECT * FROM tutorials WHERE martial_art_id = ?
      ORDER BY created_at DESC, id DESC`,
    [martialArtId]
  );
  const counts = await db.getAllAsync<{ tutorial_id: number; count: number }>(
    `SELECT tutorial_id, COUNT(*) AS count FROM art_notes
      WHERE tutorial_id IS NOT NULL GROUP BY tutorial_id`
  );
  const byId = new Map(counts.map(c => [c.tutorial_id, c.count]));
  return tutorials.map(t => ({ ...t, note_count: byId.get(t.id!) ?? 0 }));
};

export const getTutorial = async (id: number): Promise<Tutorial | null> => {
  const db = await getDb();
  return db.getFirstAsync<Tutorial>(`SELECT * FROM tutorials WHERE id = ?`, [id]);
};

export const createTutorial = async (
  tutorial: Pick<Tutorial, 'martial_art_id' | 'title' | 'description'>
): Promise<number> => {
  const db = await getDb();
  const result = await db.runAsync(
    `INSERT INTO tutorials (martial_art_id, title, description) VALUES (?, ?, ?)`,
    [tutorial.martial_art_id, tutorial.title, tutorial.description ?? '']
  );
  return result.lastInsertRowId;
};

export const updateTutorial = async (
  id: number,
  updates: Pick<Tutorial, 'title' | 'description'>
): Promise<void> => {
  const db = await getDb();
  await db.runAsync(
    `UPDATE tutorials SET title = ?, description = ?, updated_at = datetime('now')
      WHERE id = ?`,
    [updates.title, updates.description ?? '', id]
  );
};

/** Deletes a tutorial; its notes survive as unassigned (tutorial_id = NULL). */
export const deleteTutorial = async (id: number): Promise<void> => {
  const db = await getDb();
  await db.withTransactionAsync(async () => {
    await db.runAsync(`UPDATE art_notes SET tutorial_id = NULL WHERE tutorial_id = ?`, [id]);
    await db.runAsync(`DELETE FROM tutorials WHERE id = ?`, [id]);
  });
};

// ─────────────────────────────────────────────
// NOTES (entries inside a tutorial, or unassigned)
// ─────────────────────────────────────────────

/** A tutorial's notes in series order (reading order, oldest first). */
export const getTutorialNotes = async (tutorialId: number): Promise<Note[]> => {
  const db = await getDb();
  return db.getAllAsync<Note>(
    `SELECT * FROM art_notes WHERE tutorial_id = ?
      ORDER BY order_index ASC, created_at ASC, id ASC`,
    [tutorialId]
  );
};

/** Legacy notes not yet placed in any tutorial. */
export const getUnassignedNotes = async (martialArtId: number): Promise<Note[]> => {
  const db = await getDb();
  return db.getAllAsync<Note>(
    `SELECT * FROM art_notes WHERE martial_art_id = ? AND tutorial_id IS NULL
      ORDER BY created_at DESC, id DESC`,
    [martialArtId]
  );
};

export const getNote = async (id: number): Promise<Note | null> => {
  const db = await getDb();
  return db.getFirstAsync<Note>(
    `SELECT n.*, t.title AS tutorial_title
       FROM art_notes n LEFT JOIN tutorials t ON n.tutorial_id = t.id
      WHERE n.id = ?`,
    [id]
  );
};

export const createNote = async (
  note: Pick<Note, 'martial_art_id' | 'title' | 'body' | 'media'> &
        Partial<Pick<Note, 'tutorial_id'>>
): Promise<number> => {
  const db = await getDb();
  // New notes append to the end of their tutorial's series.
  const next = note.tutorial_id
    ? await db.getFirstAsync<{ m: number | null }>(
        `SELECT MAX(order_index) AS m FROM art_notes WHERE tutorial_id = ?`,
        [note.tutorial_id]
      )
    : null;
  const orderIndex = (next?.m ?? -1) + 1;
  const result = await db.runAsync(
    `INSERT INTO art_notes (martial_art_id, tutorial_id, order_index, title, body, media)
      VALUES (?, ?, ?, ?, ?, ?)`,
    [note.martial_art_id, note.tutorial_id ?? null, orderIndex,
     note.title, note.body ?? '', note.media ?? '[]']
  );
  return result.lastInsertRowId;
};

export const updateNote = async (
  id: number,
  updates: Pick<Note, 'title' | 'body' | 'media'>
): Promise<void> => {
  const db = await getDb();
  await db.runAsync(
    `UPDATE art_notes SET title = ?, body = ?, media = ?, updated_at = datetime('now')
      WHERE id = ?`,
    [updates.title, updates.body ?? '', updates.media ?? '[]', id]
  );
};

/** Moves a note between tutorials (null = unassign); appends to the end of the target series. */
export const setNoteTutorial = async (id: number, tutorialId: number | null): Promise<void> => {
  const db = await getDb();
  const next = tutorialId
    ? await db.getFirstAsync<{ m: number | null }>(
        `SELECT MAX(order_index) AS m FROM art_notes
          WHERE tutorial_id = ? AND id != ?`,
        [tutorialId, id]
      )
    : null;
  await db.runAsync(
    `UPDATE art_notes SET tutorial_id = ?, order_index = ?, updated_at = datetime('now')
      WHERE id = ?`,
    [tutorialId, (next?.m ?? -1) + 1, id]
  );
};

/** Swaps a note with its up/down neighbour inside the same tutorial's series. */
export const moveNote = async (id: number, direction: 'up' | 'down'): Promise<void> => {
  const db = await getDb();
  const note = await db.getFirstAsync<{ tutorial_id: number | null; order_index: number }>(
    `SELECT tutorial_id, order_index FROM art_notes WHERE id = ?`, [id]
  );
  if (!note?.tutorial_id) return;
  const neighbour = await db.getFirstAsync<{ id: number; order_index: number }>(
    direction === 'up'
      ? `SELECT id, order_index FROM art_notes
          WHERE tutorial_id = ? AND (order_index < ? OR (order_index = ? AND id < ?))
          ORDER BY order_index DESC, id DESC LIMIT 1`
      : `SELECT id, order_index FROM art_notes
          WHERE tutorial_id = ? AND (order_index > ? OR (order_index = ? AND id > ?))
          ORDER BY order_index ASC, id ASC LIMIT 1`,
    [note.tutorial_id, note.order_index, note.order_index, id]
  );
  if (!neighbour) return;
  await db.withTransactionAsync(async () => {
    await db.runAsync(`UPDATE art_notes SET order_index = ? WHERE id = ?`,
      [neighbour.order_index, id]);
    await db.runAsync(`UPDATE art_notes SET order_index = ? WHERE id = ?`,
      [note.order_index, neighbour.id]);
  });
};

/** Deletes a note and returns every attachment URI so the caller can free the files. */
export const deleteNote = async (id: number): Promise<string[]> => {
  const db = await getDb();
  const note = await db.getFirstAsync<{ media: string }>(`SELECT media FROM art_notes WHERE id = ?`, [id]);
  await db.runAsync(`DELETE FROM art_notes WHERE id = ?`, [id]);
  return note ? parseNoteMedia(note.media).map(m => m.uri) : [];
};
