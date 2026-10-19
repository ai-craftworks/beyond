/**
 * Unit tests for src/utils/stats.ts — streak maths (UTC day numbers).
 * All dates are explicit so the tests are timezone-independent.
 */

import { computeStreaks } from '../stats';

describe('computeStreaks', () => {
  const today = '2026-10-19';

  it('returns 0/0 for no history', () => {
    expect(computeStreaks([], today)).toEqual({ current: 0, best: 0 });
  });

  it('counts a single session today as a 1-day streak', () => {
    expect(computeStreaks(['2026-10-19'], today)).toEqual({ current: 1, best: 1 });
  });

  it('counts consecutive days ending today', () => {
    const dates = ['2026-10-19', '2026-10-18', '2026-10-17'];
    expect(computeStreaks(dates, today)).toEqual({ current: 3, best: 3 });
  });

  it('grants a grace day when only yesterday is trained', () => {
    // Trained yesterday but not yet today → streak survives (2 days).
    const dates = ['2026-10-18', '2026-10-17'];
    expect(computeStreaks(dates, today)).toEqual({ current: 2, best: 2 });
  });

  it('breaks the current streak when the last session is 3+ days ago', () => {
    const dates = ['2026-10-16', '2026-10-15', '2026-10-14'];
    expect(computeStreaks(dates, today)).toEqual({ current: 0, best: 3 });
  });

  it('keeps an older best run even when the current streak is shorter', () => {
    const dates = [
      // current: today + yesterday
      '2026-10-19', '2026-10-18',
      // older 5-day run (gapped)
      '2026-10-05', '2026-10-04', '2026-10-03', '2026-10-02', '2026-10-01',
    ];
    expect(computeStreaks(dates, today)).toEqual({ current: 2, best: 5 });
  });

  it('treats the current run as best when it is the longest', () => {
    const dates = ['2026-10-19', '2026-10-18', '2026-10-17', '2026-10-16', '2026-10-15'];
    const r = computeStreaks(dates, today);
    expect(r.current).toBe(5);
    expect(r.best).toBe(5);
  });

  it('deduplicates dates', () => {
    expect(computeStreaks(['2026-10-19', '2026-10-19', '2026-10-19'], today))
      .toEqual({ current: 1, best: 1 });
  });

  it('ignores malformed dates', () => {
    expect(computeStreaks(['nonsense', '', '2026-10-19'], today))
      .toEqual({ current: 1, best: 1 });
  });

  it('works across a month boundary', () => {
    const dates = ['2026-11-01', '2026-10-31', '2026-10-30'];
    expect(computeStreaks(dates, '2026-11-01')).toEqual({ current: 3, best: 3 });
  });

  it('works across a year boundary', () => {
    const dates = ['2027-01-01', '2026-12-31'];
    expect(computeStreaks(dates, '2027-01-01')).toEqual({ current: 2, best: 2 });
  });

  it('does not count future dates as a streak', () => {
    // A future-dated session must not anchor the streak to "today".
    const dates = ['2026-10-25'];
    expect(computeStreaks(dates, today).current).toBe(0);
  });
});
