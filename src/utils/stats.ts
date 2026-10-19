/**
 * src/utils/stats.ts
 * ==================
 * Pure stat helpers derived from session history (no React, no DB).
 * Kept dependency-free so they are trivially unit-testable.
 */

/** 'YYYY-MM-DD' → UTC epoch day number (avoids local-timezone drift). */
const dayNumber = (isoDate: string): number => {
  const [y, m, d] = isoDate.split('-').map(Number);
  if (!y || !m || !d) return NaN;
  return Math.floor(Date.UTC(y, m - 1, d) / 86_400_000);
};

export interface Streaks {
  /**
   * Consecutive days ending today (or yesterday, if today has no session yet
   * — a streak isn't broken just because you haven't trained this morning).
   */
  current: number;
  /** Longest run of consecutive days anywhere in the history. */
  best: number;
}

/**
 * @param dates distinct 'YYYY-MM-DD' dates (order does not matter)
 * @param today 'YYYY-MM-DD' reference day; defaults to UTC today (the app
 *              stores session dates from `new Date().toISOString()`).
 */
export const computeStreaks = (dates: string[], today?: string): Streaks => {
  const todayStr = today ?? new Date().toISOString().split('T')[0];
  const days = [...new Set(dates.map(dayNumber).filter(n => !Number.isNaN(n)))].sort((a, b) => b - a);
  if (days.length === 0) return { current: 0, best: 0 };

  const todayN = dayNumber(todayStr);
  // Anchor: today if trained today, otherwise yesterday (grace day).
  let anchor = todayN;
  if (days[0] === todayN) anchor = todayN;
  else if (days[0] === todayN - 1) anchor = todayN - 1;
  else return { current: 0, best: bestRun(days) };

  let current = 0;
  for (const d of days) {
    if (d === anchor - current) current++;
    else if (d < anchor - current) break;
  }
  return { current, best: Math.max(bestRun(days), current) };
};

/** days sorted desc → length of the longest consecutive run. */
const bestRun = (daysDesc: number[]): number => {
  let best = 1;
  let run = 1;
  for (let i = 1; i < daysDesc.length; i++) {
    run = daysDesc[i] === daysDesc[i - 1] - 1 ? run + 1 : 1;
    if (run > best) best = run;
  }
  return best;
};
