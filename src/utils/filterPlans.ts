/**
 * src/utils/filterPlans.ts
 * =========================
 * In-memory plan search/filter for the Plans list. Purely organizational —
 * search matches name/description and the group filter OR-matches group ids.
 */

import { Plan } from '../database/Database';
import { parseGroupIds } from '../constants/game';

export interface PlanFilter {
  search?: string;
  groups?: number[];   // empty = no group filter; non-empty = OR match on group ids
}

export const filterPlans = (
  plans: Plan[],
  { search = '', groups = [] }: PlanFilter
): Plan[] => {
  const q = search.trim().toLowerCase();
  return plans.filter(plan => {
    if (q) {
      const haystack = `${plan.name} ${plan.description ?? ''}`.toLowerCase();
      if (!haystack.includes(q)) return false;
    }
    if (groups.length > 0) {
      const ids = parseGroupIds(plan.groups);
      if (!groups.some(g => ids.includes(g))) return false;
    }
    return true;
  });
};
