/**
 * src/utils/units.ts
 * ==================
 * Shared unit-spec helpers for exercises, session exercises and plan exercises.
 * Derives the configured unit list and the primary (EXP-driving) unit, with a
 * legacy single-unit fallback for rows saved before multi-unit support.
 */

import { parseUnits, parseUnitValues, unitPerSet, unitSuffix } from '../constants/game';
import { UnitSpec, UnitValue } from './math';

/** Unit specs for a stored units JSON, falling back to a single legacy unit. */
export const specsOf = (unitsJson: string | null | undefined, fallbackType: string): UnitSpec[] => {
  const parsed = parseUnits(unitsJson);
  const list = parsed.length > 0
    ? parsed
    : [{ type: fallbackType, label: unitSuffix(fallbackType), default: 0 }];
  return list.map(u => ({ type: u.type, label: u.label, default: u.default, perSet: unitPerSet(u.type) }));
};

/** The primary (EXP-driving) unit type for a stored exercise. */
export const primarySpecOf = (
  unitsJson: string | null | undefined,
  primaryUnit: string | null | undefined,
  fallbackType: string,
): string => {
  const specs = specsOf(unitsJson, fallbackType);
  return primaryUnit && specs.some(s => s.type === primaryUnit) ? primaryUnit : specs[0].type;
};

/** Planned values for a stored exercise, falling back to the legacy target. */
export const plannedOf = (
  unitsJson: string | null | undefined,
  target: number,
  fallbackType: string,
): UnitValue[] => {
  const parsed = parseUnitValues(unitsJson);
  if (parsed.length > 0) return parsed;
  return [{ type: fallbackType, value: target }];
};

/** Prefill record for an amount input, one entry per configured unit. */
export const recordFor = (specs: UnitSpec[], planned: UnitValue[]): Record<string, string> => {
  const rec: Record<string, string> = {};
  for (const s of specs) {
    const p = planned.find(v => v.type === s.type);
    rec[s.type] = p ? String(p.value) : (s.default ? String(s.default) : '');
  }
  return rec;
};
