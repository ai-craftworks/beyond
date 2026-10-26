/**
 * src/utils/challenges.ts
 * ========================
 * Pure challenge math: turns logged activity rows into per-goal progress and
 * a challenge verdict. No React, no SQL - both Challenge screens call this,
 * and src/utils/__tests__/challenges.test.ts covers it.
 *
 * A goal's `target` is TOTAL effective volume across the whole window. Units
 * flagged `perSet` in UNIT_TYPES (reps, distance, time...) count every set;
 * working weights are not multiplied (matching the EXP rules).
 */

import { COLORS, parseUnitValues, unitPerSet } from '../constants/game';
import { diffDaysUTC } from './dates';

export type ChallengeStatus = 'upcoming' | 'active' | 'success' | 'failed';

export const CHALLENGE_STATUS_META: Record<ChallengeStatus, { label: string; color: string }> = {
  upcoming: { label: 'UPCOMING', color: COLORS.accentGold },
  active:   { label: 'ACTIVE',   color: COLORS.accentCyan },
  success:  { label: 'SUCCESS',  color: COLORS.accentGreen },
  failed:   { label: 'FAILED',   color: COLORS.accentRed },
};

/** Minimal shapes so this module stays free of the expo-sqlite database layer. */
export interface ChallengeLike {
  start_date: string;
  end_date: string;
}

export interface ChallengeGoalLike {
  id?: number;
  exercise_id: number;
  unit_type: string;
  target: number;
  exercise_name?: string;
  exercise_exists?: number;
}

export interface ChallengeActivityLike {
  date: string;
  exercise_id: number;
  sets: number;
  actual_amount: number;
  primary_unit: string;
  unit_type: string;
  actual_units: string;
}

export interface GoalProgress {
  goal: ChallengeGoalLike;
  achieved: number;
  remaining: number;
  over: number;
  percent: number;   // 0..100 (not rounded)
  met: boolean;
}

export interface ChallengeProgress {
  status: ChallengeStatus;
  goals: GoalProgress[];
  goalsMet: number;
  goalsTotal: number;
  overallPercent: number;  // 0..100, average of per-goal percentages
  daysLeft: number;        // whole days after today; 0 on the last day / once ended
  daysTrained: number;     // distinct dates with a completed exercise in the window
  ended: boolean;
}

/** The logged value for one unit on one activity row. */
export const activityValue = (row: ChallengeActivityLike, unit: string): number => {
  const found = parseUnitValues(row.actual_units).find(u => u.type === unit);
  if (found) return Math.max(0, found.value);
  const primary = row.primary_unit || row.unit_type || 'reps';
  return unit === primary ? Math.max(0, row.actual_amount) : 0;
};

/** Volume contributed by one row, applying sets for per-set units. */
export const effectiveUnits = (row: ChallengeActivityLike, unit: string): number => {
  const value = activityValue(row, unit);
  if (!unitPerSet(unit)) return value;
  return value * Math.max(1, row.sets || 1);
};

export const buildChallengeProgress = (
  challenge: ChallengeLike,
  goals: readonly ChallengeGoalLike[],
  activity: readonly ChallengeActivityLike[],
  today: string
): ChallengeProgress => {
  const inWindow = activity.filter(
    r => r.date >= challenge.start_date && r.date <= challenge.end_date
  );

  const rowsByExercise = new Map<number, ChallengeActivityLike[]>();
  for (const row of inWindow) {
    const list = rowsByExercise.get(row.exercise_id) ?? [];
    list.push(row);
    rowsByExercise.set(row.exercise_id, list);
  }

  const goalProgress: GoalProgress[] = goals.map(goal => {
    const rows = rowsByExercise.get(goal.exercise_id) ?? [];
    const achieved = rows.reduce((sum, r) => sum + effectiveUnits(r, goal.unit_type), 0);
    const target = Math.max(0, goal.target);
    const remaining = Math.max(0, target - achieved);
    const over = Math.max(0, achieved - target);
    const percent = target > 0 ? Math.min(100, (achieved / target) * 100) : 0;
    return {
      goal,
      achieved,
      remaining,
      over,
      percent,
      met: target > 0 && achieved >= target,
    };
  });

  const goalsMet = goalProgress.filter(g => g.met).length;
  const goalsTotal = goalProgress.length;
  const overallPercent = goalsTotal > 0
    ? goalProgress.reduce((sum, g) => sum + g.percent, 0) / goalsTotal
    : 0;

  const ended = today > challenge.end_date;
  let status: ChallengeStatus;
  if (today < challenge.start_date) status = 'upcoming';
  else if (goalsTotal > 0 && goalsMet === goalsTotal) status = 'success';
  else if (ended) status = 'failed';
  else status = 'active';

  return {
    status,
    goals: goalProgress,
    goalsMet,
    goalsTotal,
    overallPercent,
    daysLeft: Math.max(0, diffDaysUTC(today, challenge.end_date)),
    daysTrained: new Set(inWindow.map(r => r.date)).size,
    ended,
  };
};

/** '1,000' for whole volumes, '7.5' for fractional ones. */
export const fmtQty = (value: number): string => {
  if (!Number.isFinite(value)) return '0';
  const rounded = Math.round(value * 10) / 10;
  if (Number.isInteger(rounded)) return rounded.toLocaleString('en-US');
  return rounded.toLocaleString('en-US', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
};

/** Short human countdown used on the list cards and the detail action bar. */
export const challengeCountdown = (
  challenge: ChallengeLike,
  progress: Pick<ChallengeProgress, 'status' | 'ended' | 'daysLeft'>,
  today: string
): string => {
  if (progress.status === 'upcoming') {
    const d = diffDaysUTC(today, challenge.start_date);
    return d === 1 ? 'Starts tomorrow' : `Starts in ${d} days`;
  }
  if (progress.status === 'success') {
    return progress.ended ? 'Challenge cleared' : 'All goals met';
  }
  if (progress.status === 'failed') return 'Window closed';
  if (progress.daysLeft === 0) return 'Last day';
  return `${progress.daysLeft} day${progress.daysLeft === 1 ? '' : 's'} left`;
};
