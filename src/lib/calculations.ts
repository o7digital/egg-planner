import { demoWeatherPattern, locations, products } from './data';
import type { DemoOrder, ForecastDay, PlannerState, Product, ProductNeed, RequirementHorizon, Weather } from './types';

const DAY_MS = 86_400_000;

export const planKey = (date: string, locationId: string) => `${date}:${locationId}`;
export const forecastKey = (date: string, locationId: string) => `${date}:${locationId}`;
export const keyFor = (locationId: string, productId: string) => `${locationId}:${productId}`;
export const manualKeyFor = (date: string, locationId: string, productId: string) => `${date}:${locationId}:${productId}`;

export const locationMultiplier = (locationId: string) =>
  1 + Math.max(0, locations.findIndex((location) => location.id === locationId)) * 0.075;

export function weatherAdjustment(state: PlannerState, weather: Weather = 'mild') {
  if (weather === 'very-hot') return state.veryHotAdjustment;
  if (weather === 'hot') return state.hotAdjustment;
  if (weather === 'cold') return state.coldAdjustment;
  return 0;
}

export function historicalComparableSales(locationId: string, date: string) {
  const weekday = new Date(`${date}T12:00:00`).getDay();
  const weekdayFactors = [1.08, 1, 0.92, 0.96, 1.04, 1.2, 1.27];
  return Math.round(18_000 * locationMultiplier(locationId) * weekdayFactors[weekday]);
}

export const historicalSales = (locationId: string, date = '2026-09-04') => historicalComparableSales(locationId, date);

export function requirementHorizon(startDate: string, nextConfirmedDelivery?: string): RequirementHorizon {
  return nextConfirmedDelivery
    ? { startDate, endDate: nextConfirmedDelivery, source: 'supplier-schedule', label: `${startDate} → ${nextConfirmedDelivery}` }
    : { startDate, endDate: startDate, source: 'unconfigured-demo', label: 'Selected day only · delivery schedule to configure' };
}

export function calculateForecastSales(historicalSalesAmount: number, adjustmentPercent: number) {
  return Math.max(0, Math.round(historicalSalesAmount * (1 + adjustmentPercent / 100)));
}

export function weeklyForecast(state: PlannerState, locationId = state.locationId): ForecastDay[] {
  return demoWeatherPattern.map((scenario, index) => {
    const date = new Date(new Date(`${state.date}T12:00:00`).getTime() + index * DAY_MS).toISOString().slice(0, 10);
    const historical = historicalComparableSales(locationId, date);
    const adjustment = weatherAdjustment(state, scenario.weather);
    const suggested = calculateForecastSales(historical, adjustment);
    return {
      date,
      weather: scenario.weather,
      temperature: scenario.temperature,
      historicalSales: historical,
      weatherAdjustment: adjustment,
      suggestedSales: suggested,
      managerForecast: state.managerForecasts[forecastKey(date, locationId)] ?? suggested,
    };
  });
}

export const forecastSales = (state: PlannerState, locationId = state.locationId) => weeklyForecast(state, locationId)[0].managerForecast;

export const stockOnHand = (state: PlannerState, product: Product, locationId = state.locationId) =>
  state.stocks[keyFor(locationId, product.id)] ?? Math.round(product.defaultOnHandUnits * locationMultiplier(locationId));

export function calculateCasesRequired(netRequirement: number, unitsPerCase: number) {
  if (!Number.isFinite(unitsPerCase) || unitsPerCase <= 0) throw new Error('Units per case must be greater than zero.');
  return Math.ceil(Math.max(0, netRequirement) / unitsPerCase);
}

export function calculateProductNeed(
  validatedSales: number,
  product: Product,
  onHandUnits: number,
  incomingUnits = product.incomingUnits,
): ProductNeed {
  const safeSales = Math.max(0, validatedSales);
  const expectedConsumption = Math.round((safeSales / 1_000) * product.consumptionRatio);
  const safetyStockUnits = Math.round(expectedConsumption * product.safetyStockPercent / 100);
  const grossRequirement = expectedConsumption + safetyStockUnits;
  const netRequirement = Math.max(0, grossRequirement - Math.max(0, onHandUnits) - Math.max(0, incomingUnits));
  return {
    productId: product.id,
    validatedSales: safeSales,
    expectedConsumption,
    safetyStockUnits,
    grossRequirement,
    onHandUnits: Math.max(0, onHandUnits),
    incomingUnits: Math.max(0, incomingUnits),
    netRequirement,
    unitsPerCase: product.unitsPerCase,
    suggestedCases: calculateCasesRequired(netRequirement, product.unitsPerCase),
  };
}

export function productNeed(state: PlannerState, product: Product, locationId = state.locationId) {
  const sales = weeklyForecast(state, locationId)[0].managerForecast;
  return calculateProductNeed(sales, product, stockOnHand(state, product, locationId));
}

export const suggestedQuantity = (state: PlannerState, product: Product, locationId = state.locationId) =>
  productNeed(state, product, locationId).suggestedCases;

export const plannedQuantity = (state: PlannerState, product: Product, locationId = state.locationId) =>
  state.manualQuantities[manualKeyFor(state.date, locationId, product.id)] ?? suggestedQuantity(state, product, locationId);

export function calculateRestaurantOrder(state: PlannerState, locationId = state.locationId) {
  return Object.fromEntries(products.map((product) => [product.id, plannedQuantity(state, product, locationId)]));
}

export const orderTotal = (state: PlannerState, locationId = state.locationId) =>
  products.reduce((sum, product) => sum + plannedQuantity(state, product, locationId) * product.pricePerCase, 0);

export function restaurantOrderValidation(state: PlannerState, locationId = state.locationId) {
  const key = planKey(state.date, locationId);
  return state.forecastStatuses[key] === 'validated' && state.productNeedsStatuses[key] === 'calculated';
}

export const replaceOrder = (orders: DemoOrder[], next: DemoOrder) => [
  ...orders.filter((order) => !(order.locationId === next.locationId && order.date === next.date)),
  next,
];

export function artimexConsolidation(orders: DemoOrder[], date: string) {
  const artimexProducts = products.filter((product) => product.supplier === 'Artimex');
  const rows = locations.map((location) => {
    const order = orders.find((item) => item.locationId === location.id && item.date === date && item.status === 'validated');
    return {
      location,
      included: Boolean(order),
      quantities: Object.fromEntries(artimexProducts.map((product) => [product.id, order?.quantities[product.id] ?? 0])),
    };
  });
  const totals = Object.fromEntries(artimexProducts.map((product) => [
    product.id,
    rows.reduce((sum, row) => sum + row.quantities[product.id], 0),
  ]));
  return { rows, totals };
}

export function calculateArtimexProduction(
  validatedRestaurantDemand: number,
  safetyMarginPercent: number,
  frozenInventory: number,
  alreadyPlannedProduction: number,
) {
  const restaurantDemand = Math.max(0, validatedRestaurantDemand);
  const safetyMargin = Math.ceil(restaurantDemand * Math.max(0, safetyMarginPercent) / 100);
  const productionRequired = Math.max(0, restaurantDemand + safetyMargin - Math.max(0, frozenInventory) - Math.max(0, alreadyPlannedProduction));
  return { restaurantDemand, safetyMargin, frozenInventory: Math.max(0, frozenInventory), alreadyPlannedProduction: Math.max(0, alreadyPlannedProduction), productionRequired };
}
