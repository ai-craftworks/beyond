/**
 * src/utils/celebrations.ts
 * =========================
 * One-shot celebration slots consumed by screens on focus. Session finish
 * queues flashes (level-up, rank-up, new best streak, belt promotion); the
 * Dashboard and Dojo each drain their own queue when they next come into
 * focus, so the moment lands on the screen the hunter actually sees.
 */

export interface Celebration {
  kind: 'level' | 'rank' | 'streak' | 'belt';
  title: string;
  subtitle?: string;
  color?: string;
}

const dashQueue: Celebration[] = [];
const dojoQueue: Celebration[] = [];

export const queueDashCelebration = (c: Celebration): void => { dashQueue.push(c); };
export const consumeDashCelebrations = (): Celebration[] => dashQueue.splice(0, dashQueue.length);

export const queueDojoCelebration = (c: Celebration): void => { dojoQueue.push(c); };
export const consumeDojoCelebrations = (): Celebration[] => dojoQueue.splice(0, dojoQueue.length);
