import { describe, expect, it } from 'vitest';
import { frozenProducts, initialState, products } from './data';
import {
  artimexConsolidation, calculateArtimexProduction, calculateCasesRequired,
  calculateForecastSales, calculateFrozenBreadNeed, calculateProductNeed, forecastKey, manualKeyFor,
  planKey, plannedQuantity, replaceOrder, requirementHorizon, weeklyForecast,
} from './calculations';
import type { DemoOrder, PlannerState } from './types';

describe('transparent planning calculations', () => {
  it('excludes frozen inventory when it cannot complete the eight-hour thaw before demand', () => {
    const state = { ...initialState, forecastStatuses: { ...initialState.forecastStatuses, [planKey(initialState.date, 'canoga-park')]: 'validated' as const } };
    const result = calculateFrozenBreadNeed(state, frozenProducts[0]);
    expect(result.frozenUsable).toBe(0);
    expect(result.projectedAvailable).toBe(result.readyQty + result.thawingUsable + result.incomingUsable);
  });
  it('applies each explicit weather rule without negative sales', () => {
    expect(calculateForecastSales(18_000, -30)).toBe(12_600);
    expect(calculateForecastSales(18_000, -15)).toBe(15_300);
    expect(calculateForecastSales(18_000, 0)).toBe(18_000);
    expect(calculateForecastSales(18_000, 40)).toBe(25_200);
    expect(calculateForecastSales(18_000, -200)).toBe(0);
  });

  it('builds seven distinct day forecasts and preserves manager overrides', () => {
    const firstDate = initialState.date;
    const state: PlannerState = { ...initialState, managerForecasts: { [forecastKey(firstDate, initialState.locationId)]: 14_000 } };
    const days = weeklyForecast(state);
    expect(new Set(days.map((day) => day.date)).size).toBe(7);
    expect(days[0].managerForecast).toBe(14_000);
    expect(days.map((day) => day.weatherAdjustment)).toEqual([-30, -15, 0, 0, 40, 0, -15]);
  });

  it('reproduces the Bolillo example in units and rounds cases up', () => {
    const need = calculateProductNeed(12_600, products[0], 480, 0);
    expect(need).toMatchObject({ expectedConsumption: 1512, safetyStockUnits: 151, grossRequirement: 1663, netRequirement: 1183, suggestedCases: 25 });
  });

  it('rounds only complete supplier cases and never orders below zero', () => {
    expect([0, 1, 48, 49, 1183].map((units) => calculateCasesRequired(units, 48))).toEqual([0, 1, 1, 2, 25]);
    expect(calculateProductNeed(1_000, products[0], 9_999).suggestedCases).toBe(0);
    expect(() => calculateCasesRequired(10, 0)).toThrow();
  });

  it('does not invent a delivery date when the supplier schedule is missing', () => {
    expect(requirementHorizon(initialState.date)).toMatchObject({
      startDate: initialState.date,
      endDate: initialState.date,
      source: 'unconfigured-demo',
    });
    expect(requirementHorizon(initialState.date, '2026-09-09').source).toBe('supplier-schedule');
  });

  it('keeps manager case overrides scoped by date and restaurant', () => {
    const product = products[0];
    const state = { ...initialState, manualQuantities: { [manualKeyFor(initialState.date, initialState.locationId, product.id)]: 28 } };
    expect(plannedQuantity(state, product)).toBe(28);
    expect(plannedQuantity({ ...state, date: '2026-09-05' }, product)).not.toBe(28);
  });

  it('consolidates validated restaurant orders only', () => {
    const validated: DemoOrder = { id: 'one', locationId: 'canoga-park', date: initialState.date, quantities: { bolillo: 25 }, amount: 1, confirmedAt: 'now', status: 'validated' };
    const otherDate = { ...validated, id: 'other', locationId: 'santa-ana', date: '2026-09-05' };
    const result = artimexConsolidation([validated, otherDate], initialState.date);
    expect(result.totals.bolillo).toBe(25);
    expect(result.rows.find((row) => row.location.id === 'santa-ana')?.included).toBe(false);
  });

  it('calculates Artimex production with a floor at zero', () => {
    expect(calculateArtimexProduction(252, 10, 35, 20)).toMatchObject({ safetyMargin: 26, productionRequired: 223 });
    expect(calculateArtimexProduction(10, 10, 100, 20).productionRequired).toBe(0);
  });

  it('replaces only the active order for the same restaurant and date', () => {
    const base: DemoOrder = { id: 'one', locationId: 'canoga-park', date: '2026-09-04', quantities: {}, amount: 1, confirmedAt: 'now', status: 'validated' };
    const replacement = { ...base, id: 'two', amount: 2 };
    const other = { ...base, id: 'other', locationId: 'santa-ana' };
    expect(replaceOrder([base, other], replacement)).toEqual([other, replacement]);
    expect(planKey(base.date, base.locationId)).not.toBe(planKey(other.date, other.locationId));
  });
});
