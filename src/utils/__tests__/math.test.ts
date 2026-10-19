/**
 * Unit tests for src/utils/math.ts — the balance/calculation core.
 * Any change to EXP formulas should be caught here.
 */

import {
  expForAmount, fullClearBonus, statGainForExp, statDeltasFromItems,
  cappedStat, percentOf, expToNextRemaining, sumExp,
  effectiveUnitValue, expForUnits,
  expRequiredForLevel, calculateLevelFromTotalExp,
  UnitSpec, UnitValue,
  STAT_CAP, FULL_CLEAR_BONUS_RATE,
} from '../math';

describe('expForAmount', () => {
  it('awards amount × rate, floored', () => {
    expect(expForAmount(10, 2)).toBe(20);
    expect(expForAmount(3, 2.5)).toBe(7); // 7.5 floored
  });

  it('divides by expUnitCount when given', () => {
    expect(expForAmount(20, 2, 5)).toBe(8); // 20/5 × 2
  });

  it('falls back to denominator 1 when expUnitCount is 0 or negative', () => {
    expect(expForAmount(10, 2, 0)).toBe(20);
    expect(expForAmount(10, 2, -3)).toBe(20);
  });

  it('never returns negative EXP', () => {
    expect(expForAmount(-10, 2)).toBe(0);
  });
});

describe('fullClearBonus', () => {
  it('is 10% floored', () => {
    expect(FULL_CLEAR_BONUS_RATE).toBe(0.10);
    expect(fullClearBonus(100)).toBe(10);
    expect(fullClearBonus(95)).toBe(9);
    expect(fullClearBonus(0)).toBe(0);
  });
});

describe('statGainForExp', () => {
  it('divides by the per-point cost, floored', () => {
    expect(statGainForExp(45, 20)).toBe(2);
    expect(statGainForExp(20, 20)).toBe(1);
    expect(statGainForExp(19, 20)).toBe(0);
  });

  it('defaults the cost to 20 and guards against 0/negative cost', () => {
    expect(statGainForExp(40)).toBe(2);
    expect(statGainForExp(40, 0)).toBe(2);
    expect(statGainForExp(40, -5)).toBe(2);
  });

  it('never returns negative points', () => {
    expect(statGainForExp(-40, 20)).toBe(0);
  });
});

describe('statDeltasFromItems', () => {
  it('aggregates points per stat and skips zero gains', () => {
    const deltas = statDeltasFromItems([
      { stat_type: 'strength', exp_reward: 45, exp_per_stat_point: 20 }, // 2
      { stat_type: 'strength', exp_reward: 19, exp_per_stat_point: 20 }, // 0 → skipped
      { stat_type: 'agility',  exp_reward: 60, exp_per_stat_point: 20 }, // 3
    ]);
    expect(deltas).toEqual({ strength: 2, agility: 3 });
  });

  it('returns an empty object when nothing earns a point', () => {
    expect(statDeltasFromItems([{ stat_type: 'strength', exp_reward: 5 }])).toEqual({});
  });
});

describe('cappedStat', () => {
  it('adds normally below the cap', () => {
    expect(cappedStat(10, 5)).toBe(15);
  });
  it('clamps at STAT_CAP', () => {
    expect(cappedStat(STAT_CAP - 2, 10)).toBe(STAT_CAP);
    expect(cappedStat(STAT_CAP, 1)).toBe(STAT_CAP);
  });
});

describe('percentOf', () => {
  it('computes a clamped percentage', () => {
    expect(percentOf(50, 100)).toBe(50);
    expect(percentOf(150, 100)).toBe(100); // upper clamp
    expect(percentOf(-10, 100)).toBe(-10); // no lower clamp below 0 in this helper
  });
  it('returns 0 when max is 0 or negative', () => {
    expect(percentOf(5, 0)).toBe(0);
    expect(percentOf(5, -1)).toBe(0);
  });
});

describe('expToNextRemaining / sumExp', () => {
  it('reports remaining EXP with a floor of 0', () => {
    expect(expToNextRemaining(30, 100)).toBe(70);
    expect(expToNextRemaining(150, 100)).toBe(0);
  });

  it('sums session EXP, treating missing values as 0', () => {
    expect(sumExp([{ total_exp: 10 }, { total_exp: 5 }, {}, { total_exp: 0 }])).toBe(15);
  });
});

describe('effectiveUnitValue', () => {
  it('multiplies per-set units by sets', () => {
    expect(effectiveUnitValue(10, true, 3)).toBe(30);
    expect(effectiveUnitValue(10, false, 3)).toBe(10);
  });
  it('treats sets ≤ 0 as 1 and non-finite values as 0', () => {
    expect(effectiveUnitValue(10, true, 0)).toBe(10);
    expect(effectiveUnitValue(NaN, true, 3)).toBe(0);
  });
});

describe('expForUnits', () => {
  const specs: UnitSpec[] = [
    { type: 'reps', default: 10, perSet: false },
    { type: 'weight_kg', default: 20, perSet: false },
  ];
  const v = (reps: number, kg: number): UnitValue[] =>
    [{ type: 'reps', value: reps }, { type: 'weight_kg', value: kg }];

  it('uses only the primary when modifiers are 0', () => {
    // 10 reps / 1 × 2 EXP, modifier skipped → 20
    expect(expForUnits(v(10, 0), specs, 'reps', 2)).toBe(20);
  });

  it('scales by the modifier ratio (value / default)', () => {
    // 10 reps × 2 EXP × (40/20 = 2) → 40
    expect(expForUnits(v(10, 40), specs, 'reps', 2)).toBe(40);
  });

  it('clamps the modifier ratio to UNIT_RATIO_MAX (10)', () => {
    // ratio 1000/20 = 50 → clamped to 10 → 10 × 2 × 10 = 200
    expect(expForUnits(v(10, 1000), specs, 'reps', 2)).toBe(200);
  });

  it('divides by expUnitCount', () => {
    expect(expForUnits(v(10, 0), specs, 'reps', 2, 5)).toBe(4); // 10/5 × 2
  });

  it('multiplies per-set primaries by sets', () => {
    const perSetSpecs: UnitSpec[] = [{ type: 'reps', default: 10, perSet: true }];
    expect(expForUnits([{ type: 'reps', value: 10 }], perSetSpecs, 'reps', 2, 1, 3)).toBe(60);
  });

  it('returns 0 for empty specs', () => {
    expect(expForUnits([], [], 'reps', 2)).toBe(0);
  });

  it('floors fractional results', () => {
    expect(expForUnits([{ type: 'reps', value: 3 }], [{ type: 'reps', default: 0, perSet: false }], 'reps', 0.5)).toBe(1);
  });
});

describe('level curve (re-exported from game.ts)', () => {
  it('expRequiredForLevel follows 100 × level^1.5, floored', () => {
    expect(expRequiredForLevel(1)).toBe(100);
    expect(expRequiredForLevel(4)).toBe(800);
    expect(expRequiredForLevel(0)).toBe(0);
  });

  it('calculateLevelFromTotalExp starts at level 1 with 0 EXP', () => {
    expect(calculateLevelFromTotalExp(0)).toEqual({ level: 1, expInCurrentLevel: 0, expToNext: 100 });
  });

  it('consumes each level threshold exactly at the boundary', () => {
    // Level 1 costs 100: 99 stays level 1, 100 advances to 2.
    expect(calculateLevelFromTotalExp(99).level).toBe(1);
    const atBoundary = calculateLevelFromTotalExp(100);
    expect(atBoundary.level).toBe(2);
    expect(atBoundary.expInCurrentLevel).toBe(0);
    expect(atBoundary.expToNext).toBe(expRequiredForLevel(2));
  });

  it('accumulates across multiple levels', () => {
    const cost1to2 = expRequiredForLevel(1);
    const r = calculateLevelFromTotalExp(cost1to2 + 50);
    expect(r.level).toBe(2);
    expect(r.expInCurrentLevel).toBe(50);
  });
});
