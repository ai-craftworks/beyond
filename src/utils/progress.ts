/**
 * src/utils/progress.ts
 * =====================
 * Pure aggregation helpers for the Progress screen (no React, no DB).
 * All bucketing is UTC so it matches how session dates are stored.
 */

import { calculateLevelFromTotalExp } from './math';

export interface ProgressPoint { label: string; value: number; }

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** 'YYYY-MM-DD' → UTC epoch day number. */
const dayNumber = (isoDate: string): number => {
  const [y, m, d] = isoDate.split('-').map(Number);
  if (!y || !m || !d) return NaN;
  return Math.floor(Date.UTC(y, m - 1, d) / 86_400_000);
};

/** UTC Monday of the week containing the given day number. */
const mondayOf = (dayN: number): number => {
  const dow = new Date(dayN * 86_400_000).getUTCDay(); // 0=Sun … 6=Sat
  return dayN - ((dow + 6) % 7);
};

const fmtDay = (dayN: number): string => {
  const d = new Date(dayN * 86_400_000);
  return `${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]}`;
};

const todayOr = (todayStr?: string): string =>
  todayStr ?? new Date().toISOString().split('T')[0];

interface SessionLike { date: string; total_exp?: number; status: string; }

/** EXP earned per UTC week, oldest → newest (default last 12 weeks). */
export const weeklyExp = (
  sessions: SessionLike[], weeks = 12, todayStr?: string
): ProgressPoint[] => {
  const thisMonday = mondayOf(dayNumber(todayOr(todayStr)));
  const buckets: ProgressPoint[] = [];
  for (let w = weeks - 1; w >= 0; w--) {
    buckets.push({ label: fmtDay(thisMonday - w * 7), value: 0 });
  }
  for (const s of sessions) {
    if (s.status !== 'completed') continue;
    const start = mondayOf(dayNumber(s.date));
    const idx = weeks - 1 - Math.round((thisMonday - start) / 7);
    if (idx >= 0 && idx < weeks) buckets[idx].value += s.total_exp ?? 0;
  }
  return buckets;
};

/** Hunter level at the END of each UTC week, oldest → newest. */
export const weeklyLevels = (
  sessions: SessionLike[], weeks = 12, todayStr?: string
): ProgressPoint[] => {
  const completed = sessions
    .filter(s => s.status === 'completed')
    .slice()
    .sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
  const thisMonday = mondayOf(dayNumber(todayOr(todayStr)));
  const out: ProgressPoint[] = [];
  let cum = 0;
  let i = 0;
  for (let w = weeks - 1; w >= 0; w--) {
    const start = thisMonday - w * 7;
    const end = start + 6;
    while (i < completed.length && dayNumber(completed[i].date) <= end) {
      cum += completed[i].total_exp ?? 0;
      i++;
    }
    out.push({ label: fmtDay(start), value: calculateLevelFromTotalExp(cum).level });
  }
  return out;
};

/** Weight entries oldest → newest as chart points. */
export const weightSeries = (
  metrics: { measured_at: string; weight: number }[]
): ProgressPoint[] =>
  metrics
    .slice()
    .sort((a, b) => (a.measured_at < b.measured_at ? -1 : a.measured_at > b.measured_at ? 1 : 0))
    .map(m => ({ label: fmtDay(dayNumber(m.measured_at)), value: m.weight }));
