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
// MARTIAL ARTS PROFICIENCY
// Faster curve than the player: starts low and grows gently so arts
// progress visibly as the hunter trains. Tune base/exponent here.
// ─────────────────────────────────────────────

export const MARTIAL_EXP_BASE = 60;
export const MARTIAL_EXP_EXPONENT = 1.35;

/** Total EXP required to advance a martial art/skill from this level to the next */
export const expRequiredForMartialLevel = (level: number): number =>
  Math.floor(MARTIAL_EXP_BASE * Math.pow(level, MARTIAL_EXP_EXPONENT));

/**
 * Given accumulated proficiency EXP, returns the martial-art level and progress.
 * Mirrors {@link calculateLevelFromTotalExp} but on the faster martial curve.
 */
export const calculateMartialLevelFromTotalExp = (totalExp: number) => {
  let level = 1;
  let remaining = totalExp;
  while (level < 100) {
    const needed = expRequiredForMartialLevel(level);
    if (remaining < needed) break;
    remaining -= needed;
    level++;
  }
  return { level, expInCurrentLevel: remaining, expToNext: expRequiredForMartialLevel(level) };
};

/** Belt ladder mapped to proficiency level. Colours are UI-only, tune freely. */
export const MARTIAL_BELTS = [
  { belt: 'White',  minLevel: 1,  color: '#E8F4FD' },
  { belt: 'Yellow', minLevel: 5,  color: '#FFD700' },
  { belt: 'Orange', minLevel: 10, color: '#FF9800' },
  { belt: 'Green',  minLevel: 16, color: '#4CAF50' },
  { belt: 'Blue',   minLevel: 24, color: '#2196F3' },
  { belt: 'Purple', minLevel: 34, color: '#9C27B0' },
  { belt: 'Brown',  minLevel: 46, color: '#8D6E63' },
  { belt: 'Red',    minLevel: 60, color: '#FF4757' },
  { belt: 'Black',  minLevel: 75, color: '#5A6B85' },
] as const;

export const getBeltForLevel = (level: number) => {
  for (let i = MARTIAL_BELTS.length - 1; i >= 0; i--) {
    if (level >= MARTIAL_BELTS[i].minLevel) return MARTIAL_BELTS[i];
  }
  return MARTIAL_BELTS[0];
};

// ─────────────────────────────────────────────
// STAT SYSTEM
// ─────────────────────────────────────────────

export const STATS = [
  { key: 'strength',     label: 'Strength',     icon: 'fitness',      color: '#FF6B6B' },
  { key: 'agility',      label: 'Agility',      icon: 'speedometer',  color: '#00BCD4' },
  { key: 'endurance',    label: 'Endurance',    icon: 'shield',       color: '#4CAF50' },
  { key: 'intelligence', label: 'Intelligence', icon: 'bulb',        color: '#AB47BC' },
  { key: 'vitality',     label: 'Vitality',     icon: 'heart',        color: '#FF9800' },
] as const;

export type StatKey = typeof STATS[number]['key'];

export const UNIT_TYPES = [
  { value: 'reps',        label: 'Reps',         suffix: 'reps',  icon: 'repeat',      perSet: true,  description: 'Push-ups, Pull-ups' },
  { value: 'weight_kg',   label: 'Weight (kg)',  suffix: 'kg',    icon: 'barbell',     perSet: false, description: 'Dumbbells, Barbells' },
  { value: 'weight_lb',   label: 'Weight (lb)',  suffix: 'lb',    icon: 'barbell',     perSet: false, description: 'Imperial weights' },
  { value: 'distance_km', label: 'Distance km',  suffix: 'km',    icon: 'walk',        perSet: true,  description: 'Running, Cycling' },
  { value: 'distance_m',  label: 'Distance m',   suffix: 'm',     icon: 'walk',        perSet: true,  description: 'Sprints, Swimming' },
  { value: 'time_min',    label: 'Minutes',      suffix: 'min',   icon: 'time',        perSet: true,  description: 'Plank, Yoga' },
  { value: 'time_sec',    label: 'Seconds',      suffix: 'sec',   icon: 'time',        perSet: true,  description: 'Holds, Bursts' },
  { value: 'speed_kmh',   label: 'Speed km/h',   suffix: 'km/h',  icon: 'speedometer', perSet: false, description: 'Running pace' },
  { value: 'speed_mph',   label: 'Speed mph',    suffix: 'mph',   icon: 'speedometer', perSet: false, description: 'Imperial pace' },
  { value: 'calories',    label: 'Calories',     suffix: 'cal',   icon: 'flame',       perSet: false, description: 'Energy burned' },
] as const;

export type UnitTypeValue = typeof UNIT_TYPES[number]['value'];

/** Unit catalog entry for a stored unit type, or undefined when unknown. */
export const findUnitType = (value: string | null | undefined) =>
  UNIT_TYPES.find(u => u.value === value);

/** Display suffix for a unit type, falling back to the raw value. */
export const unitSuffix = (value: string): string =>
  findUnitType(value)?.suffix ?? value;

/** Display label for a unit type, falling back to the raw value. */
export const unitLabel = (value: string): string =>
  findUnitType(value)?.label ?? value;

/** Whether a unit type scales with the number of sets (work units only). */
export const unitPerSet = (value: string): boolean =>
  findUnitType(value)?.perSet ?? false;

/** Stored shape of one configured unit on an exercise. */
export interface StoredUnit {
  type: string;
  label: string;
  default: number;
}

/** Stored shape of one value entry on a plan/session. */
export interface StoredUnitValue {
  type: string;
  value: number;
}

/** Parse a stored JSON unit-spec array (exercise.units). Safe, always returns an array. */
export const parseUnits = (json: string | null | undefined): StoredUnit[] => {
  try {
    const arr = JSON.parse(json || '[]');
    if (!Array.isArray(arr)) return [];
    return arr
      .filter(u => u && typeof u.type === 'string')
      .map(u => ({
        type: u.type as string,
        label: typeof u.label === 'string' ? u.label : unitSuffix(u.type as string),
        default: Number.isFinite(Number(u.default)) ? Number(u.default) : 0,
      }));
  } catch {
    return [];
  }
};

/** Parse a stored JSON unit-value array (plan/session unit_values, actual_units). Safe. */
export const parseUnitValues = (json: string | null | undefined): StoredUnitValue[] => {
  try {
    const arr = JSON.parse(json || '[]');
    if (!Array.isArray(arr)) return [];
    return arr
      .filter(u => u && typeof u.type === 'string')
      .map(u => ({
        type: u.type as string,
        value: Number.isFinite(Number(u.value)) ? Number(u.value) : 0,
      }));
  } catch {
    return [];
  }
};

/** Human-readable summary of unit values, e.g. "7.5 kg × 100 reps". */
export const formatUnitValues = (values: StoredUnitValue[]): string =>
  values
    .filter(u => u.value > 0)
    .map(u => `${u.value} ${unitSuffix(u.type)}`)
    .join(' × ');

export const EXERCISE_CATEGORIES = [
  { value: 'strength',    label: 'Strength',    stat: 'strength'     },
  { value: 'cardio',      label: 'Cardio',      stat: 'endurance'    },
  { value: 'agility',     label: 'Agility',     stat: 'agility'      },
  { value: 'flexibility', label: 'Flexibility', stat: 'vitality'     },
  { value: 'mental',      label: 'Mental',      stat: 'intelligence' },
];

// ─────────────────────────────────────────────
// BODY PARTS  (muscle groups an exercise can hit)
// ─────────────────────────────────────────────

export const BODY_PARTS = [
  { value: 'chest',      label: 'Chest' },
  { value: 'back',       label: 'Back' },
  { value: 'shoulders',  label: 'Shoulders' },
  { value: 'biceps',     label: 'Biceps' },
  { value: 'triceps',    label: 'Triceps' },
  { value: 'forearms',   label: 'Forearms' },
  { value: 'abs',        label: 'Abs' },
  { value: 'obliques',   label: 'Obliques' },
  { value: 'quads',      label: 'Quads' },
  { value: 'hamstrings', label: 'Hamstrings' },
  { value: 'glutes',     label: 'Glutes' },
  { value: 'calves',     label: 'Calves' },
  { value: 'traps',      label: 'Traps' },
  { value: 'neck',       label: 'Neck' },
  { value: 'full_body',  label: 'Full Body' },
] as const;

export type BodyPartKey = typeof BODY_PARTS[number]['value'];

/** Parse a stored JSON body-part array (e.g. from Exercise.body_parts). Safe, always returns an array. */
export const parseBodyParts = (json: string | null | undefined): string[] => {
  try {
    const arr = JSON.parse(json || '[]');
    return Array.isArray(arr) ? arr.filter(p => typeof p === 'string') : [];
  } catch {
    return [];
  }
};

/** Body-part value → display label, falling back to the raw value for unknown entries. */
export const bodyPartLabel = (value: string): string =>
  BODY_PARTS.find(b => b.value === value)?.label ?? value;

// ─────────────────────────────────────────────
// WORKOUT LISTING  (shared display helpers for every workout list surface)
// ─────────────────────────────────────────────

/** Accent colour for an exercise category (resolved through its underlying stat). */
export const statAccent = (category: string | null | undefined): string => {
  const stat = EXERCISE_CATEGORIES.find(c => c.value === category)?.stat;
  return STATS.find(s => s.key === stat)?.color ?? COLORS.textSecondary;
};

/** Accent colour for a bare stat key (rows whose join lacks `category`). */
export const statColor = (stat: string | null | undefined): string =>
  STATS.find(s => s.key === stat)?.color ?? COLORS.textSecondary;

export interface ExpBadgeSource {
  exp_per_unit?: number | null;
  exp_reward?: number | null;
  exp_unit_count?: number | null;
  primary_unit?: string | null;
  unit_type?: string | null;
}

/** Canonical EXP badge text — `+2 EXP / 1 reps`. */
export const expBadgeLabel = (ex: ExpBadgeSource): string =>
  `+${ex.exp_per_unit ?? ex.exp_reward ?? 0} EXP / ${ex.exp_unit_count ?? 1} ${unitSuffix(ex.primary_unit ?? ex.unit_type ?? 'reps')}`;

/** Personal-record source (a full Exercise row carries these). */
export interface PrSource {
  pr_value?: number | null;
  pr_unit?: string | null;
}

/** Canonical PR label — `PR 12 reps`, or null when the exercise has no PR. */
export const prLabel = (ex: PrSource): string | null => {
  const v = ex.pr_value ?? 0;
  if (!(v > 0)) return null;
  const value = parseFloat(v.toFixed(2));
  return `PR ${value} ${unitSuffix(ex.pr_unit || 'reps')}`;
};

export interface MetaLineSource {
  stat_type?: string | null;
  body_parts?: string | null;
}

/** Canonical row-2 meta line — `STRENGTH · Chest, Triceps` (max 3 parts, then `+n`). */
export const workoutMetaLine = (ex: MetaLineSource): string => {
  const parts = parseBodyParts(ex.body_parts);
  const shown = parts.slice(0, 3).map(bodyPartLabel);
  if (parts.length > 3) shown.push(`+${parts.length - 3}`);
  const tail = shown.join(', ');
  const stat = ex.stat_type ? ex.stat_type.toUpperCase() : '';
  return stat && tail ? `${stat} · ${tail}` : stat || tail;
};

// ─────────────────────────────────────────────
// GROUPS  (purely organizational buckets for workouts & plans)
// ─────────────────────────────────────────────

export type GroupKind = 'exercise' | 'plan';

/** Auto-assigned palette for new groups (cycled by group count). */
export const GROUP_COLORS = [
  '#00D4FF', // cyan
  '#1A7FD4', // blue
  '#7B2FBE', // purple
  '#FFD700', // gold
  '#00FF87', // green
  '#FF4757', // red
  '#FF9F1C', // orange
  '#2EC4B6', // teal
] as const;

/** Pick a palette colour for the group at `index` (wraps around). */
export const groupColorForIndex = (index: number): string =>
  GROUP_COLORS[((index % GROUP_COLORS.length) + GROUP_COLORS.length) % GROUP_COLORS.length];

/** Parse a stored JSON array of group ids (from Exercise.groups / Plan.groups). Safe, always returns a number[]. */
export const parseGroupIds = (json: string | null | undefined): number[] => {
  try {
    const arr = JSON.parse(json || '[]');
    return Array.isArray(arr) ? arr.filter((n): n is number => typeof n === 'number') : [];
  } catch {
    return [];
  }
};

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
  // Was #4A6A8A (~3.4:1 — fails WCAG AA). #6288AD is ~5.1:1 on bgPrimary,
  // ~4.5:1 on bgTertiary, while staying clearly below textSecondary.
  textMuted:     '#6288AD',

  borderGlow: '#00D4FF33',
  borderMain: '#1A3A5C',
  borderDim:  '#0F2540',
} as const;
