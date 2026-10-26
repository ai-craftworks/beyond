/**
 * src/utils/dates.ts
 * ==================
 * The one place dates are formatted. Every screen shows dates through these
 * helpers so history, notes, titles and dashboards never drift apart.
 *
 * Session/plan dates are stored as UTC 'YYYY-MM-DD' (from
 * `new Date().toISOString().split('T')[0]`), so date-only strings are parsed
 * as UTC and rendered in UTC to avoid the classic off-by-one-day bug in
 * negative-offset timezones. Timestamps (created_at / earned_at / ISO
 * datetimes) are rendered in local time.
 */

const MONTHS_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const DAYS_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const DAYS_LONG = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const MONTHS_LONG = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

interface Parts { y: number; m: number; d: number; }

const dateOnlyParts = (s: string): Parts | null => {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(s);
  if (!m) return null;
  return { y: +m[1], m: +m[2], d: +m[3] };
};

const toDate = (value: string | Date, utcDateOnly: boolean): Date | null => {
  if (value instanceof Date) return value;
  if (!value) return null;
  const p = dateOnlyParts(value);
  if (p) return utcDateOnly ? new Date(Date.UTC(p.y, p.m - 1, p.d)) : new Date(p.y, p.m - 1, p.d);
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
};

/** 'Mar 5, 2026' — default for history rows, titles, notes. */
export const fmtShortDate = (value: string | Date): string => {
  const d = toDate(value, true);
  if (!d) return '';
  const [y, m, dd] = utcParts(d);
  return `${MONTHS_SHORT[m - 1]} ${dd}, ${y}`;
};

/** 'Mar 5, 2026' for local timestamps (earned_at / created_at). */
export const fmtLocalShortDate = (value: string | Date): string => {
  const d = toDate(value, false);
  if (!d) return '';
  return `${MONTHS_SHORT[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}`;
};

/** 'Wed, Mar 5' — compact day + date (dashboard quests, session meta). */
export const fmtDayAndDate = (value: string | Date): string => {
  const d = toDate(value, true);
  if (!d) return '';
  const [, m, dd] = utcParts(d);
  const dow = d.getUTCDay();
  return `${DAYS_SHORT[dow]}, ${MONTHS_SHORT[m - 1]} ${dd}`;
};

/** 'Wednesday, March 5' — the big dashboard header. */
export const fmtLongDay = (value: string | Date): string => {
  const d = toDate(value, true);
  if (!d) return '';
  const [, m, dd] = utcParts(d);
  const dow = d.getUTCDay();
  return `${DAYS_LONG[dow]}, ${MONTHS_LONG[m - 1]} ${dd}`;
};

/** Relative label: 'Today' / 'Yesterday' / 'Mar 5'. */
export const fmtRelativeDay = (value: string | Date, today?: Date): string => {
  const d = toDate(value, true);
  if (!d) return '';
  const t = today ?? new Date();
  const dayMs = 86_400_000;
  const dDay = Math.floor(d.getTime() / dayMs);
  const tDay = Math.floor(Date.UTC(t.getUTCFullYear(), t.getUTCMonth(), t.getUTCDate()) / dayMs);
  if (dDay === tDay) return 'Today';
  if (dDay === tDay - 1) return 'Yesterday';
  return fmtShortDate(d);
};

/** Extract UTC calendar parts regardless of local timezone. */
const utcParts = (d: Date): [number, number, number] =>
  [d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate()];

/** Today's UTC date-only string — matches how sessions are keyed. */
export const todayDateStr = (): string => new Date().toISOString().split('T')[0];

const dayMs = 86_400_000;

/** Shift a UTC date-only string by whole days (DST-proof). */
export const addDaysUTC = (value: string, days: number): string => {
  const p = dateOnlyParts(value);
  if (!p) return value;
  const d = new Date(Date.UTC(p.y, p.m - 1, p.d) + Math.round(days) * dayMs);
  const [y, m, dd] = utcParts(d);
  return `${y}-${String(m).padStart(2, '0')}-${String(dd).padStart(2, '0')}`;
};

/** Whole days from `a` to `b` (b - a), both UTC date-only strings. */
export const diffDaysUTC = (a: string, b: string): number => {
  const pa = dateOnlyParts(a);
  const pb = dateOnlyParts(b);
  if (!pa || !pb) return 0;
  return Math.round(
    (Date.UTC(pb.y, pb.m - 1, pb.d) - Date.UTC(pa.y, pa.m - 1, pa.d)) / dayMs
  );
};

/** 'October 2026' — calendar sheet header. */
export const fmtMonthYear = (value: string | Date): string => {
  const d = toDate(value, true);
  if (!d) return '';
  const [y, m] = utcParts(d);
  return `${MONTHS_LONG[m - 1]} ${y}`;
};

/** Strict check for a real UTC date-only string ('2026-02-30' is invalid). */
export const isDateOnly = (value: string): boolean => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const p = dateOnlyParts(value);
  if (!p) return false;
  const [y, m, d] = utcParts(new Date(Date.UTC(p.y, p.m - 1, p.d)));
  return y === p.y && m === p.m && d === p.d;
};

/** The 42 UTC dates (6 weeks, Sunday-first) covering the month of `value`. */
export const monthGrid = (value: string): string[] => {
  const p = dateOnlyParts(value);
  if (!p) return [];
  const first = `${p.y}-${String(p.m).padStart(2, '0')}-01`;
  const firstDow = new Date(Date.UTC(p.y, p.m - 1, 1)).getUTCDay();
  const start = addDaysUTC(first, -firstDow);
  return Array.from({ length: 42 }, (_, i) => addDaysUTC(start, i));
};
