/**
 * Unit tests for src/utils/units.ts — spec derivation & legacy fallbacks.
 */

import { specsOf, primarySpecOf, plannedOf, recordFor } from '../units';
import { parseUnits } from '../../constants/game';

describe('specsOf', () => {
  it('parses stored unit JSON with per-set flags from the catalog', () => {
    const json = JSON.stringify([
      { type: 'reps', label: 'Reps', default: 10 },
      { type: 'weight_kg', label: 'kg', default: 20 },
    ]);
    const specs = specsOf(json, 'reps');
    expect(specs).toEqual([
      { type: 'reps', label: 'Reps', default: 10, perSet: true },
      { type: 'weight_kg', label: 'kg', default: 20, perSet: false },
    ]);
  });

  it('falls back to a single legacy unit when JSON is empty/corrupt', () => {
    for (const bad of [null, undefined, '', 'not json', '{"nope":1}']) {
      const specs = specsOf(bad as any, 'time_sec');
      expect(specs).toHaveLength(1);
      expect(specs[0].type).toBe('time_sec');
      expect(specs[0].default).toBe(0);
      expect(specs[0].perSet).toBe(true); // time_sec is per-set in the catalog
    }
  });

  it('labels unknown legacy types with the raw type', () => {
    expect(specsOf(null, 'bananas')[0].label).toBe('bananas');
  });
});

describe('primarySpecOf', () => {
  const json = JSON.stringify([
    { type: 'reps', default: 10 },
    { type: 'weight_kg', default: 20 },
  ]);

  it('keeps the stored primary when it exists in the specs', () => {
    expect(primarySpecOf(json, 'weight_kg', 'reps')).toBe('weight_kg');
  });

  it('falls back to the first spec when the stored primary is missing', () => {
    expect(primarySpecOf(json, 'distance_km', 'reps')).toBe('reps');
  });

  it('falls back to the first spec when primary is null', () => {
    expect(primarySpecOf(json, null, 'reps')).toBe('reps');
  });

  it('uses the legacy fallback type when there is no stored units JSON', () => {
    expect(primarySpecOf(null, null, 'time_min')).toBe('time_min');
  });
});

describe('plannedOf', () => {
  it('parses stored planned values', () => {
    const json = JSON.stringify([{ type: 'reps', value: 12 }]);
    expect(plannedOf(json, 99, 'reps')).toEqual([{ type: 'reps', value: 12 }]);
  });

  it('falls back to the legacy target when nothing is stored', () => {
    expect(plannedOf(null, 25, 'reps')).toEqual([{ type: 'reps', value: 25 }]);
    expect(plannedOf('garbage', 25, 'reps')).toEqual([{ type: 'reps', value: 25 }]);
  });
});

describe('recordFor', () => {
  const specs = specsOf(JSON.stringify([
    { type: 'reps', default: 10 },
    { type: 'weight_kg', default: 20 },
  ]), 'reps');

  it('prefers the planned value for each spec', () => {
    expect(recordFor(specs, [{ type: 'reps', value: 15 }])).toEqual({
      reps: '15',
      weight_kg: '20', // default
    });
  });

  it('uses the spec default when unplanned, or empty when no default', () => {
    const noDefaults = specsOf(JSON.stringify([{ type: 'reps', default: 0 }]), 'reps');
    expect(recordFor(noDefaults, [])).toEqual({ reps: '' });
  });
});

describe('parseUnits (re-exported behaviour used by specsOf)', () => {
  it('drops malformed entries without throwing', () => {
    // Missing label falls back to the catalog *suffix* ('reps'), not the display label.
    expect(parseUnits('[{"type":"reps"},{"label":"x"},null]')).toEqual([
      { type: 'reps', label: 'reps', default: 0 },
    ]);
  });
});
