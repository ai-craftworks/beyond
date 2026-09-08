/**
 * src/utils/filterExercises.ts
 * =============================
 * Shared in-memory exercise search/filter used by the Exercise Library and
 * the Add-to-Plan exercise picker so both lists behave identically.
 */

import { Exercise } from '../database/Database';
import { parseBodyParts } from '../constants/game';

export interface ExerciseFilter {
  search?: string;
  category?: string;      // 'all' = no category filter
  bodyParts?: string[];   // empty = no body-part filter; non-empty = OR match
}

export const filterExercises = (
  exercises: Exercise[],
  { search = '', category = 'all', bodyParts = [] }: ExerciseFilter
): Exercise[] => {
  const q = search.trim().toLowerCase();
  return exercises.filter(ex => {
    if (q) {
      const haystack = `${ex.name} ${ex.description ?? ''}`.toLowerCase();
      if (!haystack.includes(q)) return false;
    }
    if (category !== 'all' && ex.category !== category) return false;
    if (bodyParts.length > 0) {
      const parts = parseBodyParts(ex.body_parts);
      if (!bodyParts.some(bp => parts.includes(bp))) return false;
    }
    return true;
  });
};