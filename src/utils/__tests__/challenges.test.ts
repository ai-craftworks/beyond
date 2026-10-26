/**
 * Tests for the Challenge progress helpers (pure, no DB).
 */

import { buildChallengeProgress, effectiveUnits, fmtQty } from '../challenges';
import type { ChallengeActivityLike } from '../challenges';

const challenge = { start_date: '2026-10-01', end_date: '2026-10-31' };

const row = (over: Partial<ChallengeActivityLike> = {}): ChallengeActivityLike => ({
  date: '2026-10-10',
  exercise_id: 1,
  sets: 3,
  actual_amount: 20,
  primary_unit: 'reps',
  unit_type: 'reps',
  actual_units: '[]',
  ...over,
});

const goal = (over: Partial<{ id: number; exercise_id: number; unit_type: string; target: number }> = {}) => ({
  id: 1,
  exercise_id: 1,
  unit_type: 'reps',
  target: 100,
  ...over,
});

describe('effectiveUnits', () => {
  it('multiplies per-set units by the set count', () => {
    expect(effectiveUnits(row({ sets: 4, actual_amount: 20 }), 'reps')).toBe(80);
  });

  it('does not multiply non-per-set units (working weight)', () => {
    const r = row({
      sets: 4,
      actual_amount: 20,
      unit_type: 'weight_kg',
      primary_unit: 'weight_kg',
    });
    expect(effectiveUnits(r, 'weight_kg')).toBe(20);
  });

  it('reads secondary units from actual_units JSON', () => {
    const r = row({
      sets: 3,
      actual_units: JSON.stringify([{ type: 'reps', value: 12 }, { type: 'weight_kg', value: 30 }]),
    });
    expect(effectiveUnits(r, 'reps')).toBe(36);
    expect(effectiveUnits(r, 'weight_kg')).toBe(30);
  });

  it('falls back to actual_amount for the primary unit only', () => {
    const r = row({ actual_units: '[]', primary_unit: 'reps', actual_amount: 15, sets: 2 });
    expect(effectiveUnits(r, 'reps')).toBe(30);
    expect(effectiveUnits(r, 'weight_kg')).toBe(0);
  });

  it('treats a malformed actual_units string as empty', () => {
    const r = row({ actual_units: 'not-json', actual_amount: 10, sets: 2 });
    expect(effectiveUnits(r, 'reps')).toBe(20);
  });

  it('never returns negative volume', () => {
    expect(effectiveUnits(row({ actual_amount: -50 }), 'reps')).toBe(0);
  });
});

describe('buildChallengeProgress', () => {
  it('sums only rows inside the inclusive window', () => {
    const activity = [
      row({ date: '2026-09-30', actual_amount: 999 }), // before
      row({ date: '2026-10-01', actual_amount: 10, sets: 1 }),
      row({ date: '2026-10-31', actual_amount: 5, sets: 1 }),
      row({ date: '2026-11-01', actual_amount: 999 }), // after
    ];
    const p = buildChallengeProgress(challenge, [goal({ target: 100 })], activity, '2026-10-15');
    expect(p.goals[0].achieved).toBe(15);
  });

  it('computes achieved, remaining, over and percent per goal', () => {
    const p = buildChallengeProgress(
      challenge,
      [goal({ target: 100 }), goal({ id: 2, exercise_id: 2, target: 50 })],
      [
        row({ exercise_id: 1, actual_amount: 20, sets: 3 }), // 60
        row({ exercise_id: 2, actual_amount: 10, sets: 3 }), // 30
      ],
      '2026-10-15'
    );

    expect(p.goals[0].achieved).toBe(60);
    expect(p.goals[0].remaining).toBe(40);
    expect(p.goals[0].over).toBe(0);
    expect(p.goals[0].percent).toBe(60);
    expect(p.goals[0].met).toBe(false);

    expect(p.goals[1].achieved).toBe(30);
    expect(p.goals[1].remaining).toBe(20);
    expect(p.goals[1].met).toBe(false);
    expect(p.goalsMet).toBe(0);
    expect(p.goalsTotal).toBe(2);
    expect(p.overallPercent).toBe(60);
  });

  it('caps percent at 100 and reports overage once a goal is beaten', () => {
    const p = buildChallengeProgress(
      challenge,
      [goal({ target: 50 })],
      [row({ actual_amount: 20, sets: 3 })], // 60
      '2026-10-15'
    );
    expect(p.goals[0].over).toBe(10);
    expect(p.goals[0].remaining).toBe(0);
    expect(p.goals[0].percent).toBe(100);
    expect(p.goals[0].met).toBe(true);
    expect(p.overallPercent).toBe(100);
  });

  it('counts bonus rows as a single set', () => {
    const p = buildChallengeProgress(
      challenge,
      [goal({ target: 10 })],
      [row({ sets: 1, actual_amount: 12 })],
      '2026-10-15'
    );
    expect(p.goals[0].achieved).toBe(12);
    expect(p.goals[0].met).toBe(true);
  });

  it('ignores rows for exercises without a goal', () => {
    const p = buildChallengeProgress(
      challenge,
      [goal({ exercise_id: 1 })],
      [row({ exercise_id: 9, actual_amount: 1000 })],
      '2026-10-15'
    );
    expect(p.goals[0].achieved).toBe(0);
  });

  it('reports daysLeft and distinct training days', () => {
    const p = buildChallengeProgress(
      challenge,
      [goal()],
      [
        row({ date: '2026-10-10' }),
        row({ date: '2026-10-10', exercise_id: 2 }),
        row({ date: '2026-10-12' }),
      ],
      '2026-10-20'
    );
    expect(p.daysLeft).toBe(11);
    expect(p.daysTrained).toBe(2);
    expect(p.ended).toBe(false);
  });
});

describe('challenge status', () => {
  const goals = [goal({ target: 100 })];
  const partial = [row({ actual_amount: 10, sets: 1 })];
  const complete = [row({ actual_amount: 50, sets: 2 })];

  it('is upcoming before the start date', () => {
    const p = buildChallengeProgress(challenge, goals, [], '2026-09-20');
    expect(p.status).toBe('upcoming');
    expect(p.daysLeft).toBe(41);
  });

  it('is active inside the window with unfinished goals', () => {
    expect(buildChallengeProgress(challenge, goals, partial, '2026-10-15').status).toBe('active');
  });

  it('is active on the last day', () => {
    expect(buildChallengeProgress(challenge, goals, partial, '2026-10-31').status).toBe('active');
    expect(buildChallengeProgress(challenge, goals, partial, '2026-10-31').daysLeft).toBe(0);
  });

  it('locks success as soon as every goal is met, before the deadline', () => {
    const p = buildChallengeProgress(challenge, goals, complete, '2026-10-15');
    expect(p.status).toBe('success');
    expect(p.ended).toBe(false);
    expect(p.daysLeft).toBe(16);
  });

  it('fails after the deadline when any goal is short', () => {
    expect(buildChallengeProgress(challenge, goals, partial, '2026-11-01').status).toBe('failed');
  });

  it('stays successful after the deadline', () => {
    expect(buildChallengeProgress(challenge, goals, complete, '2026-11-01').status).toBe('success');
  });

  it('never succeeds without goals', () => {
    expect(buildChallengeProgress(challenge, [], complete, '2026-10-15').status).toBe('active');
    expect(buildChallengeProgress(challenge, [], complete, '2026-11-01').status).toBe('failed');
    expect(buildChallengeProgress(challenge, [], complete, '2026-10-15').overallPercent).toBe(0);
  });

  it('requires every goal to be met for success', () => {
    const p = buildChallengeProgress(
      challenge,
      [goal({ target: 10 }), goal({ id: 2, exercise_id: 2, target: 10 })],
      [row({ actual_amount: 10, sets: 1 })],
      '2026-10-15'
    );
    expect(p.goalsMet).toBe(1);
    expect(p.status).toBe('active');
  });
});

describe('fmtQty', () => {
  it('groups thousands and keeps one decimal for fractions', () => {
    expect(fmtQty(1000)).toBe('1,000');
    expect(fmtQty(7.5)).toBe('7.5');
    expect(fmtQty(0)).toBe('0');
    expect(fmtQty(Number.NaN)).toBe('0');
  });
});
