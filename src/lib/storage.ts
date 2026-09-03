import { initialState } from './data';
import type { PlannerState } from './types';

export const STORAGE_KEY = 'gallo-giro-ops-planner:v1';

export function loadState(): PlannerState {
  if (typeof window === 'undefined') return initialState;
  try {
    const saved = window.localStorage.getItem(STORAGE_KEY);
    return saved ? { ...initialState, ...JSON.parse(saved) } : initialState;
  } catch {
    return initialState;
  }
}

export function saveState(state: PlannerState) {
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

export function clearState() {
  window.localStorage.removeItem(STORAGE_KEY);
}
