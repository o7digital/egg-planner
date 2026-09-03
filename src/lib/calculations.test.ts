import { describe, expect, it } from 'vitest';
import { initialState, products } from './data';
import { forecastConsumption, forecastSales, keyFor, manualKeyFor, plannedQuantity, replaceOrder, suggestedQuantity } from './calculations';
import type { DemoOrder } from './types';

describe('planning calculations', () => {
  it('applies hot, cold and mild weather factors with trend', () => {
    expect(forecastSales({ ...initialState, weather: 'hot', trendAdjustment: 0 })).toBe(Math.round(15980 * 0.7));
    expect(forecastSales({ ...initialState, weather: 'cold', trendAdjustment: 0 })).toBe(Math.round(15980 * 1.4));
    expect(forecastSales({ ...initialState, weather: 'mild', trendAdjustment: 0 })).toBe(15980);
  });

  it('rounds forecast consumption up to a whole case', () => {
    const product = { ...products[0], historicalUse: 10 };
    expect(forecastConsumption({ ...initialState, trendAdjustment: 1 }, product)).toBe(11);
  });

  it('never suggests a negative quantity when stock is high', () => {
    const product = products[0];
    const state = { ...initialState, stocks: { [keyFor(initialState.locationId, product.id)]: 999 } };
    expect(suggestedQuantity(state, product)).toBe(0);
  });

  it('uses a manual quantity only for its restaurant and planning date', () => {
    const product = products[0];
    const state = { ...initialState, manualQuantities: { [manualKeyFor(initialState.date, initialState.locationId, product.id)]: 77 } };
    expect(plannedQuantity(state, product)).toBe(77);
    expect(plannedQuantity({ ...state, date: '2026-09-05' }, product)).not.toBe(77);
  });

  it('replaces an order for the same restaurant and date only', () => {
    const base: DemoOrder = { id: 'one', locationId: 'canoga-park', date: '2026-09-04', quantities: {}, amount: 1, confirmedAt: 'now' };
    const replacement = { ...base, id: 'two', amount: 2 };
    const other = { ...base, id: 'other', locationId: 'santa-ana' };
    expect(replaceOrder([base, other], replacement)).toEqual([other, replacement]);
  });
});
