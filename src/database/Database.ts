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
import { calculateLevelFromTotalExp } from '../constants/formulas';

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

  // Create bonus_exercises table if it doesn't exist
  await db.execAsync(`
    CREATE TABLE IF NOT EXISTS bonus_exercises (
      id            INTEGER PRIMARY KEY AUTOINCREMENT,
      session_id    INTEGER NOT NULL,
      exercise_id   INTEGER NOT NULL,
      exercise_name TEXT    DEFAULT '',
      target        REAL    DEFAULT 0,
      unit_type     TEXT    DEFAULT 'reps',
      unit_label    TEXT    DEFAULT 'reps',
      exp_per_unit  REAL    DEFAULT 2,
      actual_amount REAL    DEFAULT 0,
      is_completed  INTEGER DEFAULT 0,
      exp_reward    REAL    DEFAULT 0,
      stat_type     TEXT    DEFAULT 'strength',
      stat_reward   INTEGER DEFAULT 1,
      FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE CASCADE
    );
  `);
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
      `INSERT INTO exercises (name, description, exp_reward, unit_type, exp_per_unit, exp_unit_count, unit_label, exp_per_stat_point, stat_type, stat_reward, category)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [ex.name, ex.description, ex.exp_reward, ex.unit_type, ex.exp_per_unit,
       ex.exp_unit_count ?? 1, ex.unit_label, ex.exp_per_stat_point ?? 20,
       ex.stat_type, 0, ex.category]
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
    `INSERT INTO plan_exercises (plan_id, exercise_id, sets, target, order_index)
     VALUES (?, ?, ?, ?, ?)`,
    [pe.plan_id, pe.exercise_id, pe.sets, pe.target, pe.order_index]
  );
};

export const getPlanExercises = async (planId: number): Promise<PlanExercise[]> => {
  const db = await getDb();
  return db.getAllAsync<PlanExercise>(
    `SELECT pe.*, e.name as exercise_name, e.exp_per_unit, e.exp_unit_count, e.exp_per_stat_point, e.unit_type, e.unit_label, e.stat_type
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
         (session_id, exercise_id, exercise_name, sets_total, target, unit_type, unit_label, exp_per_unit, exp_unit_count, exp_per_stat_point, stat_type, is_bonus)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0)`,
      [sessionId, pe.exercise_id, pe.exercise_name ?? '', pe.sets, pe.target,
       pe.unit_type ?? 'reps', pe.unit_label ?? 'reps',
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
  id: number, actualAmount: number, expEarned: number
): Promise<void> => {
  const db = await getDb();
  await db.runAsync(
    `UPDATE session_exercises SET is_completed = 1, actual_amount = ?, exp_reward = ? WHERE id = ?`,
    [actualAmount, expEarned, id]
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
  sessionId: number, exercise: Exercise, target: number
): Promise<void> => {
  const db = await getDb();
  await db.runAsync(
    `INSERT INTO bonus_exercises
       (session_id, exercise_id, exercise_name, target, unit_type, unit_label, exp_per_unit, exp_unit_count, exp_per_stat_point, stat_type)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [sessionId, exercise.id!, exercise.name, target,
     exercise.unit_type ?? 'reps', exercise.unit_label ?? 'reps',
     exercise.exp_per_unit ?? 2, exercise.exp_unit_count ?? 1,
     exercise.exp_per_stat_point ?? 20, exercise.stat_type ?? 'strength']
  );
};

export const completeBonusExercise = async (
  id: number, actualAmount: number, expEarned: number
): Promise<void> => {
  const db = await getDb();
  await db.runAsync(
    `UPDATE bonus_exercises SET is_completed = 1, actual_amount = ?, exp_reward = ? WHERE id = ?`,
    [actualAmount, expEarned, id]
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
      ('player','exercises','exercise_body_parts','plans','plan_exercises','sessions','session_exercises','titles','bonus_exercises');
  `);
};

export const getSessionSummary = async (sessionId: number): Promise<{
  exercises: { name: string; actual_amount: number; unit_label: string; exp_reward: number; is_completed: number }[];
  bonuses:   { name: string; actual_amount: number; unit_label: string; exp_reward: number; is_completed: number }[];
}> => {
  const db = await getDb();
  const exercises = await db.getAllAsync<any>(
    `SELECT exercise_name as name, actual_amount, COALESCE(unit_label, 'reps') as unit_label, exp_reward, is_completed
     FROM session_exercises WHERE session_id = ? ORDER BY id`,
    [sessionId]
  );
  const bonuses = await db.getAllAsync<any>(
    `SELECT exercise_name as name, actual_amount, COALESCE(unit_label, 'reps') as unit_label, exp_reward, is_completed
     FROM bonus_exercises WHERE session_id = ? ORDER BY id`,
    [sessionId]
  );
  return { exercises, bonuses };
};