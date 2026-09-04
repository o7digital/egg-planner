import { initialState } from './data';
import type { PlannerState } from './types';

export const STORAGE_KEY = 'gallo-giro-ops-planner:v2';

export function loadState(): PlannerState {
  if (typeof window === 'undefined') return initialState;
  try {
    const saved = window.localStorage.getItem(STORAGE_KEY);
    if (!saved) return initialState;
    const parsed = JSON.parse(saved) as Partial<PlannerState>;
    return {
      ...initialState,
      ...parsed,
      managerForecasts: { ...initialState.managerForecasts, ...parsed.managerForecasts },
      forecastStatuses: { ...initialState.forecastStatuses, ...parsed.forecastStatuses },
      productNeedsStatuses: { ...initialState.productNeedsStatuses, ...parsed.productNeedsStatuses },
      supplierOrderStatuses: { ...initialState.supplierOrderStatuses, ...parsed.supplierOrderStatuses },
      manualQuantities: { ...initialState.manualQuantities, ...parsed.manualQuantities },
      stocks: { ...initialState.stocks, ...parsed.stocks },
      orders: parsed.orders ?? initialState.orders,
      history: parsed.history ?? [],
    };
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
