import { locations, products } from './data';
import type { DemoOrder, PlannerState, Product } from './types';

export const locationMultiplier = (locationId: string) =>
  1 + Math.max(0, locations.findIndex((location) => location.id === locationId)) * 0.075;

export const weatherAdjustment = (state: PlannerState) =>
  state.weather === 'hot' ? state.hotAdjustment : state.weather === 'cold' ? state.coldAdjustment : 0;

export const demandFactor = (state: PlannerState) =>
  (1 + weatherAdjustment(state) / 100) * (1 + state.trendAdjustment / 100);

export const historicalSales = (locationId: string) => Math.round(15_980 * locationMultiplier(locationId));
export const forecastSales = (state: PlannerState, locationId = state.locationId) =>
  Math.round(historicalSales(locationId) * demandFactor(state));

export const keyFor = (locationId: string, productId: string) => `${locationId}:${productId}`;
export const manualKeyFor = (date: string, locationId: string, productId: string) => `${date}:${locationId}:${productId}`;

export const stockOnHand = (state: PlannerState, product: Product, locationId = state.locationId) =>
  state.stocks[keyFor(locationId, product.id)] ?? Math.round(product.defaultStock * locationMultiplier(locationId));

export const forecastConsumption = (state: PlannerState, product: Product, locationId = state.locationId) =>
  Math.ceil(product.historicalUse * locationMultiplier(locationId) * demandFactor(state));

export const suggestedQuantity = (state: PlannerState, product: Product, locationId = state.locationId) =>
  Math.max(0, forecastConsumption(state, product, locationId) + product.safetyStock - stockOnHand(state, product, locationId));

export const plannedQuantity = (state: PlannerState, product: Product, locationId = state.locationId) =>
  state.manualQuantities[manualKeyFor(state.date, locationId, product.id)] ?? suggestedQuantity(state, product, locationId);

export const orderTotal = (state: PlannerState, locationId = state.locationId) =>
  products.reduce((sum, product) => sum + plannedQuantity(state, product, locationId) * product.price, 0);

export const replaceOrder = (orders: DemoOrder[], next: DemoOrder) => [
  ...orders.filter((order) => !(order.locationId === next.locationId && order.date === next.date)),
  next,
];
