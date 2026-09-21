/**
 * src/utils/math.ts
 * ==========================
 * Single source of truth for every calculation and tunable balance constant.
 * All screens/components import their math from here — never inline the formulas.
 * Level-curve helpers defined in game.ts are re-exported below.
 */

import { expRequiredForLevel, calculateLevelFromTotalExp } from '../constants/game';

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

/** Lower/upper bound for a non-primary unit's multiplier. */
export const UNIT_RATIO_MIN = 0.1;
export const UNIT_RATIO_MAX = 10;

// ─────────────────────────────────────────────
// MULTI-UNIT MODEL
// ─────────────────────────────────────────────

/** A configured unit on an exercise. `perSet` is derived from the catalog. */
export interface UnitSpec {
  type: string;
  label?: string;
  default: number;
  perSet: boolean;
}

/** A user-entered value for a single unit. */
export interface UnitValue {
  type: string;
  value: number;
}

const clampRatio = (ratio: number): number =>
  Math.min(Math.max(ratio, UNIT_RATIO_MIN), UNIT_RATIO_MAX);

/** Value contributed by one unit, scaling per-set work units by `sets`. */
export const effectiveUnitValue = (
  value: number,
  perSet: boolean,
  sets: number
): number => {
  const v = Number.isFinite(value) ? value : 0;
  const s = sets > 0 ? sets : 1;
  return perSet ? v * s : v;
};

/**
 * EXP for a multi-unit exercise following the "primary × modifier ratios" model.
 *
 *   effective(spec) = perSet ? value × sets : value
 *   base            = (effectivePrimary / expUnitCount) × expPerUnit
 *   factor          = Π over modifiers: clamp(effective / default, 0.1, 10)
 *   EXP             = max(0, floor(base × factor))
 *
 * Modifiers with a value ≤ 0 or a default ≤ 0 are skipped (ratio 1).
 */
export const expForUnits = (
  actual: UnitValue[],
  specs: UnitSpec[],
  primaryType: string,
  expPerUnit: number,
  expUnitCount: number = DEFAULT_EXP_UNIT_COUNT,
  sets: number = 1
): number => {
  if (!specs || specs.length === 0) return 0;
  const primary = specs.find(s => s.type === primaryType) ?? specs[0];

  const valueFor = (type: string): number => {
    const found = actual.find(u => u.type === type);
    return found && Number.isFinite(found.value) ? found.value : 0;
  };

  const effective = (spec: UnitSpec): number =>
    effectiveUnitValue(valueFor(spec.type), spec.perSet, sets);

  const primaryAmount = effective(primary);
  const denom = expUnitCount > 0 ? expUnitCount : DEFAULT_EXP_UNIT_COUNT;
  const rate = expPerUnit ?? DEFAULT_EXP_PER_UNIT;

  let factor = 1;
  for (const spec of specs) {
    if (spec.type === primary.type) continue;
    if (!(spec.default > 0)) continue;
    const value = effective(spec);
    if (!(value > 0)) continue;
    factor *= clampRatio(value / spec.default);
  }

  return Math.max(0, Math.floor((primaryAmount / denom) * rate * factor));
};

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
