/**
 * src/constants/game.ts
 * ======================
 * Central game balance constants: ranks, EXP formula, stats, titles, UI colours.
 * Change numbers here to tune difficulty — no other files need editing.
 */

// ─────────────────────────────────────────────
// RANK SYSTEM  (E → D → C → B → A → S → SS → National)
// ─────────────────────────────────────────────

export const RANKS = [
  { rank: 'E',        label: 'E-Rank Hunter',          minLevel: 1,  color: '#9E9E9E' },
  { rank: 'D',        label: 'D-Rank Hunter',          minLevel: 10, color: '#4CAF50' },
  { rank: 'C',        label: 'C-Rank Hunter',          minLevel: 20, color: '#2196F3' },
  { rank: 'B',        label: 'B-Rank Hunter',          minLevel: 35, color: '#9C27B0' },
  { rank: 'A',        label: 'A-Rank Hunter',          minLevel: 50, color: '#FF9800' },
  { rank: 'S',        label: 'S-Rank Hunter',          minLevel: 70, color: '#FFD700' },
  { rank: 'SS',       label: 'SS-Rank Hunter',         minLevel: 90, color: '#FF6B6B' },
  { rank: 'N', label: 'National Level Hunter',  minLevel: 99, color: '#00F5FF' },
] as const;

export const getRankForLevel = (level: number) => {
  for (let i = RANKS.length - 1; i >= 0; i--) {
    if (level >= RANKS[i].minLevel) return RANKS[i];
  }
  return RANKS[0];
};

// ─────────────────────────────────────────────
// EXP / LEVELLING  (escalating curve: 100 × level^1.5)
// ─────────────────────────────────────────────

/** Total EXP required to advance from this level to the next */
export const expRequiredForLevel = (level: number): number =>
  Math.floor(100 * Math.pow(level, 1.5));

/**
 * Given accumulated total EXP ever earned, returns:
 *   level            – current level
 *   expInCurrentLevel – EXP into the current level
 *   expToNext        – EXP needed to complete current level
 */
export const calculateLevelFromTotalExp = (totalExp: number) => {
  let level = 1;
  let remaining = totalExp;
  while (level < 100) {
    const needed = expRequiredForLevel(level);
    if (remaining < needed) break;
    remaining -= needed;
    level++;
  }
  return { level, expInCurrentLevel: remaining, expToNext: expRequiredForLevel(level) };
};

// ─────────────────────────────────────────────
// STAT SYSTEM
// ─────────────────────────────────────────────

export const STATS = [
  { key: 'strength',     label: 'Strength',     icon: '⚔️',  color: '#FF6B6B' },
  { key: 'agility',      label: 'Agility',      icon: '💨',  color: '#00BCD4' },
  { key: 'endurance',    label: 'Endurance',    icon: '🛡️',  color: '#4CAF50' },
  { key: 'intelligence', label: 'Intelligence', icon: '🧠',  color: '#AB47BC' },
  { key: 'vitality',     label: 'Vitality',     icon: '❤️',  color: '#FF9800' },
] as const;

export type StatKey = typeof STATS[number]['key'];

export const UNIT_TYPES = [
  { value: 'reps',        label: 'Reps',    suffix: 'reps', description: 'Push-ups, Pull-ups' },
  { value: 'distance_km', label: 'Km',      suffix: 'km',   description: 'Running, Cycling' },
  { value: 'distance_m',  label: 'Metres',  suffix: 'm',    description: 'Sprints, Swimming' },
  { value: 'time_min',    label: 'Minutes', suffix: 'min',  description: 'Plank, Yoga' },
  { value: 'time_sec',    label: 'Seconds', suffix: 'sec',  description: 'Holds, Bursts' },
] as const;

export type UnitTypeValue = typeof UNIT_TYPES[number]['value'];

export const EXERCISE_CATEGORIES = [
  { value: 'strength',    label: 'Strength',    stat: 'strength'     },
  { value: 'cardio',      label: 'Cardio',      stat: 'endurance'    },
  { value: 'agility',     label: 'Agility',     stat: 'agility'      },
  { value: 'flexibility', label: 'Flexibility', stat: 'vitality'     },
  { value: 'mental',      label: 'Mental',      stat: 'intelligence' },
];

// ─────────────────────────────────────────────
// TITLE CONDITIONS
// ─────────────────────────────────────────────

export interface PlayerSnapshot {
  level: number;
  strength: number;
  agility: number;
  endurance: number;
  intelligence: number;
  vitality: number;
}

export const TITLE_CONDITIONS: {
  title: string;
  description: string;
  check: (p: PlayerSnapshot) => boolean;
}[] = [
  { title: 'Iron Will',          description: 'Completed your very first workout.',         check: p => p.level >= 1  },
  { title: 'Arise',              description: 'Reached Level 5. Growth acknowledged.',      check: p => p.level >= 5  },
  { title: 'Shadow Soldier',     description: 'Reached Level 10. No longer a bystander.',  check: p => p.level >= 10 },
  { title: 'Double Dungeon',     description: 'Reached Level 20. You survived.',            check: p => p.level >= 20 },
  { title: 'Monarch\'s Gaze',   description: 'Reached Level 35. Lesser hunters step aside.', check: p => p.level >= 35 },
  { title: 'Shadow Monarch',     description: 'Reached Level 50. You stand alone.',         check: p => p.level >= 50 },
  { title: 'Absolute Being',     description: 'Reached Level 70. The system bows.',         check: p => p.level >= 70 },
  { title: 'Strength Apostle',   description: 'Strength reached 50.',                       check: p => p.strength >= 50 },
  { title: 'Wind Dancer',        description: 'Agility reached 50.',                        check: p => p.agility >= 50 },
  { title: 'Iron Body',          description: 'Endurance reached 50.',                      check: p => p.endurance >= 50 },
  { title: 'Brilliant Mind',     description: 'Intelligence reached 50.',                   check: p => p.intelligence >= 50 },
  { title: 'Undying',            description: 'Vitality reached 50.',                       check: p => p.vitality >= 50 },
];

// ─────────────────────────────────────────────
// COLOUR PALETTE  (Solo Leveling dark navy / cyan)
// ─────────────────────────────────────────────

export const COLORS = {
  bgPrimary:    '#0A0E1A',
  bgSecondary:  '#0D1526',
  bgTertiary:   '#111D35',
  bgPanel:      '#0E1929',

  accentCyan:   '#00D4FF',
  accentBlue:   '#1A7FD4',
  accentPurple: '#7B2FBE',
  accentGold:   '#FFD700',
  accentGreen:  '#00FF87',
  accentRed:    '#FF4757',

  textPrimary:   '#E8F4FD',
  textSecondary: '#8BAECF',
  textMuted:     '#4A6A8A',

  borderGlow: '#00D4FF33',
  borderMain: '#1A3A5C',
  borderDim:  '#0F2540',
} as const;
