import type { DemoOrder, Location, PlannerState, Product, Weather } from './types';

export const locations: Location[] = [
  { id: 'canoga-park', name: 'Canoga Park' },
  { id: 'panorama-city', name: 'Panorama City' },
  { id: 'downtown-la', name: 'Downtown L.A.' },
  { id: 'huntington-park', name: 'Huntington Park' },
  { id: 'lynwood', name: 'Lynwood' },
  { id: 'east-los-angeles', name: 'East Los Angeles' },
  { id: 'santa-ana', name: 'Santa Ana' },
  { id: 'fontana', name: 'Fontana' },
  { id: 'van-nuys', name: 'Van Nuys' },
  { id: 'bellflower', name: 'Bellflower' },
];

export const products: Product[] = [
  { id: 'bolillo', name: 'Bolillo · Frozen', supplier: 'Artimex', unitLabel: 'units', unitsPerCase: 48, consumptionRatio: 120, defaultOnHandUnits: 480, incomingUnits: 0, safetyStockPercent: 10, pricePerCase: 32 },
  { id: 'telera', name: 'Telera · Frozen', supplier: 'Artimex', unitLabel: 'units', unitsPerCase: 48, consumptionRatio: 86, defaultOnHandUnits: 336, incomingUnits: 0, safetyStockPercent: 10, pricePerCase: 34 },
  { id: 'pan-dulce', name: 'Pan Dulce · Assorted', supplier: 'Artimex', unitLabel: 'units', unitsPerCase: 36, consumptionRatio: 54, defaultOnHandUnits: 180, incomingUnits: 0, safetyStockPercent: 10, pricePerCase: 38 },
  { id: 'tortillas', name: 'Corn Tortillas', supplier: 'Food supplier (demo)', unitLabel: 'units', unitsPerCase: 500, consumptionRatio: 190, defaultOnHandUnits: 1_000, incomingUnits: 0, safetyStockPercent: 10, pricePerCase: 25 },
  { id: 'tomatoes', name: 'Roma Tomatoes', supplier: 'Produce supplier (demo)', unitLabel: 'lb', unitsPerCase: 25, consumptionRatio: 15, defaultOnHandUnits: 75, incomingUnits: 0, safetyStockPercent: 8, pricePerCase: 24 },
  { id: 'avocados', name: 'Avocados', supplier: 'Produce supplier (demo)', unitLabel: 'units', unitsPerCase: 48, consumptionRatio: 32, defaultOnHandUnits: 144, incomingUnits: 0, safetyStockPercent: 12, pricePerCase: 49 },
];

export const demoWeatherPattern: { weather: Weather; temperature: number }[] = [
  { weather: 'very-hot', temperature: 95 },
  { weather: 'hot', temperature: 88 },
  { weather: 'mild', temperature: 72 },
  { weather: 'mild', temperature: 75 },
  { weather: 'cold', temperature: 54 },
  { weather: 'mild', temperature: 70 },
  { weather: 'hot', temperature: 86 },
];

export const artimexProductionInputs: Record<string, { safetyMarginPercent: number; frozenInventoryCases: number; alreadyPlannedCases: number }> = {
  bolillo: { safetyMarginPercent: 10, frozenInventoryCases: 35, alreadyPlannedCases: 20 },
  telera: { safetyMarginPercent: 10, frozenInventoryCases: 24, alreadyPlannedCases: 14 },
  'pan-dulce': { safetyMarginPercent: 10, frozenInventoryCases: 18, alreadyPlannedCases: 10 },
};

const seededArtimexCases: Record<string, [number, number, number]> = {
  'panorama-city': [31, 21, 15],
  'santa-ana': [22, 16, 10],
  'downtown-la': [29, 20, 14],
  'huntington-park': [27, 19, 13],
  lynwood: [25, 17, 12],
  'east-los-angeles': [26, 18, 13],
  fontana: [24, 16, 11],
  'van-nuys': [23, 15, 10],
  bellflower: [20, 13, 9],
};

const seededOrders: DemoOrder[] = Object.entries(seededArtimexCases).map(([locationId, values], index) => ({
  id: `DEMO-${String(index + 1).padStart(2, '0')}`,
  locationId,
  date: '2026-09-07',
  quantities: { bolillo: values[0], telera: values[1], 'pan-dulce': values[2], tortillas: 0, tomatoes: 0, avocados: 0 },
  amount: values[0] * 32 + values[1] * 34 + values[2] * 38,
  confirmedAt: '2026-09-03T15:00:00.000Z',
  status: 'validated',
}));

const seededForecastStatuses = Object.fromEntries(seededOrders.map((order) => [`${order.date}:${order.locationId}`, 'validated' as const]));
const seededNeedsStatuses = Object.fromEntries(seededOrders.map((order) => [`${order.date}:${order.locationId}`, 'calculated' as const]));
const seededSupplierStatuses = Object.fromEntries(seededOrders.map((order) => [`${order.date}:${order.locationId}`, 'validated' as const]));
const seededManualQuantities = Object.fromEntries(seededOrders.flatMap((order) =>
  Object.entries(order.quantities).map(([productId, quantity]) => [`${order.date}:${order.locationId}:${productId}`, quantity]),
));

export const initialState: PlannerState = {
  locationId: locations[0].id,
  date: '2026-09-07',
  veryHotAdjustment: -30,
  hotAdjustment: -15,
  coldAdjustment: 40,
  managerForecasts: {},
  forecastStatuses: seededForecastStatuses,
  productNeedsStatuses: seededNeedsStatuses,
  supplierOrderStatuses: seededSupplierStatuses,
  manualQuantities: seededManualQuantities,
  stocks: {},
  orders: seededOrders,
  history: [],
  consolidationFilter: 'validated',
  viewMode: 'manager',
};
