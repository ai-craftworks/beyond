/**
 * src/constants/formulas.ts
 * ==========================
 * Single source of truth for every calculation and tunable balance constant.
 * All screens/components import their math from here — never inline the formulas.
 * Level-curve helpers defined in game.ts are re-exported below.
 */

import { expRequiredForLevel, calculateLevelFromTotalExp } from './game';

export { expRequiredForLevel, calculateLevelFromTotalExp };

// ─────────────────────────────────────────────
// BALANCE CONSTANTS
// ─────────────────────────────────────────────

/** Flat bonus applied to main-exercise EXP for a full-clear session. */
export const FULL_CLEAR_BONUS_RATE = 0.10;

/** Hard ceiling for any single stat. */
export const STAT_CAP = 9999;

/** Fallback EXP awarded per unit if an exercise has no explicit rate. */
export const DEFAULT_EXP_PER_UNIT = 2;

/** Fallback unit-count denominator if an exercise has none. */
export const DEFAULT_EXP_UNIT_COUNT = 1;

/** Fallback EXP cost of a single stat point if an exercise has none. */
export const DEFAULT_EXP_PER_STAT_POINT = 20;

// ─────────────────────────────────────────────
// EXP / STAT / SESSION FORMULAS
// ─────────────────────────────────────────────

/**
 * Raw EXP earned for completing `actualAmount` units of an exercise whose
 * per-unit rate is `expPerUnit`, over a `expUnitCount` grouping denominator.
 *   EXP = floor(actualAmount / unitCount × expPerUnit)
 */
export const expForAmount = (
  actualAmount: number,
  expPerUnit: number,
  expUnitCount: number = DEFAULT_EXP_UNIT_COUNT
): number =>
  Math.max(0, Math.floor(
    (actualAmount / (expUnitCount > 0 ? expUnitCount : DEFAULT_EXP_UNIT_COUNT))
    * (expPerUnit ?? DEFAULT_EXP_PER_UNIT)
  ));

/**
 * EXP preview for a target amount repeated across `sets` sets —
 * i.e. `expForAmount(target × sets, ...)`.
 */
export const expForTargetSets = (
  target: number,
  sets: number,
  expPerUnit: number,
  expUnitCount: number
): number => expForAmount(target * sets, expPerUnit, expUnitCount);

/**
 * Stat points earned from a chunk of EXP, divided by the EXP cost of one point.
 *   points = floor(exp / expPerStatPoint)
 */
export const statGainForExp = (
  exp: number,
  expPerStatPoint: number = DEFAULT_EXP_PER_STAT_POINT
): number =>
  Math.max(0, Math.floor(
    exp / (expPerStatPoint > 0 ? expPerStatPoint : DEFAULT_EXP_PER_STAT_POINT)
  ));

/**
 * Aggregates stat-point deltas across awardable items (main + bonus exercises).
 * Returns a map of `stat_type → total points gained`.
 */
export const statDeltasFromItems = <T extends {
  stat_type: string;
  exp_reward: number;
  exp_per_stat_point?: number;
}>(items: T[]): Record<string, number> => {
  const deltas: Record<string, number> = {};
  for (const item of items) {
    const gain = statGainForExp(item.exp_reward, item.exp_per_stat_point);
    if (gain > 0) {
      deltas[item.stat_type] = (deltas[item.stat_type] ?? 0) + gain;
    }
  }
  return deltas;
};

/** Adds a delta to a stat, clamped to the stat ceiling. */
export const cappedStat = (base: number, delta: number): number =>
  Math.min(base + delta, STAT_CAP);

/** 10% flat bonus applied to main-exercise EXP on a full clear. */
export const fullClearBonus = (rawMainExp: number): number =>
  Math.floor(rawMainExp * FULL_CLEAR_BONUS_RATE);

// ─────────────────────────────────────────────
// PROGRESS / PERCENT HELPERS
// ─────────────────────────────────────────────

/** Percentage of `value` over `max`, clamped to 0–100. */
export const percentOf = (value: number, max: number): number =>
  Math.min(max > 0 ? (value / max) * 100 : 0, 100);

/** EXP still required to finish the current level. */
export const expToNextRemaining = (exp: number, expToNext: number): number =>
  Math.max(0, expToNext - exp);

/** Total EXP earned across a list of sessions. */
export const sumExp = (sessions: { total_exp?: number }[]): number =>
  sessions.reduce((sum, s) => sum + (s.total_exp || 0), 0);
