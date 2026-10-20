/**
 * Tests for the Progress screen's pure weekly aggregation helpers.
 */

import { weeklyExp, weeklyLevels, weightSeries } from '../progress';

// Fixed reference: Wednesday 2026-10-14 (UTC).
const TODAY = '2026-10-14';

describe('weeklyExp', () => {
  it('buckets completed EXP into UTC weeks, oldest first', () => {
    const sessions = [
      { date: '2026-10-14', total_exp: 50,  status: 'completed' }, // this week (Wed)
      { date: '2026-10-12', total_exp: 30,  status: 'completed' }, // this week (Mon)
      { date: '2026-10-11', total_exp: 20,  status: 'completed' }, // last week (Sun)
      { date: '2026-10-13', total_exp: 999, status: 'skipped' },   // ignored
    ];
    const weeks = weeklyExp(sessions, 4, TODAY);
    expect(weeks).toHaveLength(4);
    expect(weeks[3].value).toBe(80);  // current week: 50 + 30
    expect(weeks[2].value).toBe(20);  // previous week
    expect(weeks[1].value).toBe(0);
    expect(weeks[0].value).toBe(0);
  });

  it('handles sessions before the window without throwing', () => {
    const sessions = [{ date: '2020-01-01', total_exp: 100, status: 'completed' }];
    const weeks = weeklyExp(sessions, 2, TODAY);
    expect(weeks.every(w => w.value === 0)).toBe(true);
  });
});

describe('weeklyLevels', () => {
  it('derives the level at the end of each week from cumulative EXP', () => {
    // Lv1 needs 100 EXP; 200 cumulative → past level 1 (100) into level 2.
    const sessions = [
      { date: '2026-10-13', total_exp: 150, status: 'completed' },
      { date: '2026-10-14', total_exp: 50,  status: 'completed' },
    ];
    const weeks = weeklyLevels(sessions, 2, TODAY);
    expect(weeks).toHaveLength(2);
    expect(weeks[1].value).toBeGreaterThanOrEqual(2); // 200 total by this week
    expect(weeks[0].value).toBe(1);                   // nothing earned yet in older week
  });
});

describe('weightSeries', () => {
  it('sorts entries oldest first', () => {
    const points = weightSeries([
      { measured_at: '2026-10-10', weight: 75 },
      { measured_at: '2026-10-01', weight: 77 },
    ]);
    expect(points.map(p => p.value)).toEqual([77, 75]);
  });
});
