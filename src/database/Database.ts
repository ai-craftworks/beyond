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
import { unitSuffix, calculateMartialLevelFromTotalExp } from '../constants/game';

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
    try { await db.execAsync(sql); } catch (_) {}
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
  body_parts?: string;   // JSON array, populated by getExercises (join table, not a column)
  created_at?: string;
}

export interface Plan {
  id?: number;
  name: string;
  description: string;
  is_active: number;
  repeat_days: string;
  penalty_exp: number;
  created_at?: string;
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

export type SkillMediaType = 'none' | 'image' | 'video';

export interface Skill {
  id?: number;
  martial_art_id: number;
  name: string;
  description: string;
  media_type: SkillMediaType;
  media_uri: string;
  total_exp: number;
  level: number;
  exp: number;
  exp_to_next: number;
  created_at?: string;
  exercise_count?: number;
}

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
  ex: Omit<Exercise, 'id' | 'created_at' | 'body_parts'>,
  bodyParts: string[] = []
): Promise<number> => {
  const db = await getDb();
  let id: number | undefined;
  await db.withTransactionAsync(async () => {
    const result = await db.runAsync(
      `INSERT INTO exercises (name, description, exp_reward, unit_type, exp_per_unit, exp_unit_count, unit_label, exp_per_stat_point, stat_type, stat_reward, category, units, primary_unit)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [ex.name, ex.description, ex.exp_reward, ex.unit_type, ex.exp_per_unit,
       ex.exp_unit_count ?? 1, ex.unit_label, ex.exp_per_stat_point ?? 20,
       ex.stat_type, 0, ex.category, ex.units ?? '[]', ex.primary_unit ?? ex.unit_type]
    );
    id = result.lastInsertRowId;
    for (const bp of bodyParts) {
      await db.runAsync(
        `INSERT INTO exercise_body_parts (exercise_id, body_part) VALUES (?, ?)`,
        [id, bp]
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
  const byExercise = new Map<number, string[]>();
  for (const p of parts) {
    const arr = byExercise.get(p.exercise_id) ?? [];
    arr.push(p.body_part);
    byExercise.set(p.exercise_id, arr);
  }
  return exercises.map(ex => ({ ...ex, body_parts: JSON.stringify(byExercise.get(ex.id!) ?? []) }));
};

export const deleteExercise = async (id: number): Promise<void> => {
  const db = await getDb();
  // FK enforcement is off — clean dependants explicitly.
  await db.runAsync(`DELETE FROM skill_exercises WHERE exercise_id = ?`, [id]);
  await db.runAsync(`DELETE FROM exercises WHERE id = ?`, [id]);
};

export const updateExercise = async (
  id: number,
  updates: Partial<Exercise>,
  bodyParts?: string[]
): Promise<void> => {
  const db = await getDb();
  const { body_parts, ...fields } = updates;
  const keys = Object.keys(fields);
  if (keys.length === 0 && bodyParts === undefined) return;
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
  });
};

// ─────────────────────────────────────────────
// PLANS
// ─────────────────────────────────────────────

export const createPlan = async (plan: Omit<Plan, 'id' | 'created_at'>): Promise<number> => {
  const db = await getDb();
  const result = await db.runAsync(
    `INSERT INTO plans (name, description, is_active, repeat_days, penalty_exp) VALUES (?, ?, ?, ?, ?)`,
    [plan.name, plan.description, plan.is_active, plan.repeat_days, plan.penalty_exp]
  );
  return result.lastInsertRowId;
};

export const getPlans = async (): Promise<Plan[]> => {
  const db = await getDb();
  return db.getAllAsync<Plan>(`SELECT * FROM plans ORDER BY created_at DESC`);
};

export const updatePlan = async (id: number, updates: Partial<Plan>): Promise<void> => {
  const db = await getDb();
  const keys = Object.keys(updates);
  if (keys.length === 0) return;
  const fields = keys.map(k => `${k} = ?`).join(', ');
  await db.runAsync(`UPDATE plans SET ${fields} WHERE id = ?`, [...Object.values(updates), id]);
};

export const deletePlan = async (id: number): Promise<void> => {
  const db = await getDb();
  await db.runAsync(`DELETE FROM plans WHERE id = ?`, [id]);
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
export const completeSessionExercise = async (
  id: number, actualAmount: number, expEarned: number, actualUnits: string = '[]'
): Promise<void> => {
  const db = await getDb();
  await db.runAsync(
    `UPDATE session_exercises SET is_completed = 1, actual_amount = ?, exp_reward = ?, actual_units = ? WHERE id = ?`,
    [actualAmount, expEarned, actualUnits, id]
  );
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
): Promise<void> => {
  const db = await getDb();
  await db.runAsync(
    `UPDATE bonus_exercises SET is_completed = 1, actual_amount = ?, exp_reward = ?, actual_units = ? WHERE id = ?`,
    [actualAmount, expEarned, actualUnits, id]
  );
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
    DELETE FROM skill_exercises;
    DELETE FROM skills;
    DELETE FROM martial_arts;
    DELETE FROM bonus_exercises;
    DELETE FROM session_exercises;
    DELETE FROM sessions;
    DELETE FROM plan_exercises;
    DELETE FROM plans;
    DELETE FROM exercise_body_parts;
    DELETE FROM exercises;
    DELETE FROM titles;
    DELETE FROM player;
  `);
  await db.execAsync(`
    DELETE FROM sqlite_sequence WHERE name IN
      ('player','exercises','exercise_body_parts','plans','plan_exercises','sessions','session_exercises','titles','bonus_exercises','martial_arts','skills','skill_exercises');
  `);
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

/** Deletes an art, its skills and all tags. Returns media URIs to remove from disk. */
export const deleteMartialArt = async (id: number): Promise<string[]> => {
  const db = await getDb();
  const skills = await db.getAllAsync<{ id: number; media_uri: string; media_type: string }>(
    `SELECT id, media_uri, media_type FROM skills WHERE martial_art_id = ?`, [id]
  );
  await db.withTransactionAsync(async () => {
    await db.runAsync(
      `DELETE FROM skill_exercises WHERE skill_id IN (SELECT id FROM skills WHERE martial_art_id = ?)`,
      [id]
    );
    await db.runAsync(`DELETE FROM skills WHERE martial_art_id = ?`, [id]);
    await db.runAsync(`DELETE FROM martial_arts WHERE id = ?`, [id]);
  });
  return skills
    .filter(s => s.media_type !== 'none' && s.media_uri)
    .map(s => s.media_uri);
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
  return skills.map(s => ({ ...s, exercise_count: bySkill[s.id!] ?? 0 }));
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

/** Deletes a skill and its tags. Returns the media URI to remove from disk (if any). */
export const deleteSkill = async (id: number): Promise<string | null> => {
  const db = await getDb();
  const skill = await db.getFirstAsync<{ media_uri: string; media_type: string }>(
    `SELECT media_uri, media_type FROM skills WHERE id = ?`, [id]
  );
  await db.withTransactionAsync(async () => {
    await db.runAsync(`DELETE FROM skill_exercises WHERE skill_id = ?`, [id]);
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

/**
 * Awards proficiency EXP to every skill tagged to the given exercise
 * completions. Each item's EXP is added once per tagged skill. Martial arts
 * have no independent EXP — their proficiency is derived from their skills.
 */
export const awardMartialProficiency = async (
  items: { exercise_id: number; exp: number }[]
): Promise<void> => {
  const valid = items.filter(i => i.exercise_id > 0 && i.exp > 0);
  if (valid.length === 0) return;

  const db = await getDb();
  const ids = [...new Set(valid.map(i => i.exercise_id))];
  const placeholders = ids.map(() => '?').join(', ');
  const tags = await db.getAllAsync<{ exercise_id: number; skill_id: number }>(
    `SELECT exercise_id, skill_id FROM skill_exercises WHERE exercise_id IN (${placeholders})`,
    ids
  );
  if (tags.length === 0) return;

  const skillExp: Record<number, number> = {};
  for (const item of valid) {
    for (const t of tags) {
      if (t.exercise_id !== item.exercise_id) continue;
      skillExp[t.skill_id] = (skillExp[t.skill_id] ?? 0) + item.exp;
    }
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
};
