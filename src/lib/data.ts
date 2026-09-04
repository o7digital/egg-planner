import type { DemoOrder, FrozenInventory, FrozenProduct, InventoryMapping, Location, PlannerState, Product, Restaurant365InventoryItem, ThawBatch, Weather } from './types';

export const locations: Location[] = [
  { id: 'canoga-park', name: 'Canoga Park' },
  { id: 'panorama-city', name: 'Panorama City' },
  { id: 'santa-ana', name: 'Santa Ana' },
  { id: 'van-nuys', name: 'Van Nuys' },
  { id: 'reseda', name: 'Reseda' }, { id: 'north-hollywood', name: 'North Hollywood' }, { id: 'pacoima', name: 'Pacoima' },
  { id: 'sylmar', name: 'Sylmar' }, { id: 'chatsworth', name: 'Chatsworth' }, { id: 'northridge', name: 'Northridge' },
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

export const frozenProducts: FrozenProduct[] = [
  { id: 'bolillo-frozen', name: 'Bolillo', sku: 'BOL-FRZ-48', supplier: 'Artimex', unitsPerCase: 48, thawHours: 8, consumptionRatio: 49, safetyStockPercent: 10, pricePerCase: 32 },
  { id: 'telera-frozen', name: 'Telera', sku: 'TEL-FRZ-48', supplier: 'Artimex', unitsPerCase: 48, thawHours: 8, consumptionRatio: 34, safetyStockPercent: 10, pricePerCase: 34 },
  { id: 'baguette-frozen', name: 'Baguette', sku: 'BAG-FRZ-30', supplier: 'Artimex', unitsPerCase: 30, thawHours: 8, consumptionRatio: 18, safetyStockPercent: 8, pricePerCase: 31 },
  { id: 'concha-frozen', name: 'Concha', sku: 'CON-FRZ-36', supplier: 'Artimex', unitsPerCase: 36, thawHours: 8, consumptionRatio: 14, safetyStockPercent: 10, pricePerCase: 28 },
  { id: 'cuernito-frozen', name: 'Cuernito', sku: 'CUE-FRZ-36', supplier: 'Artimex', unitsPerCase: 36, thawHours: 8, consumptionRatio: 12, safetyStockPercent: 10, pricePerCase: 29 },
  { id: 'pan-dulce-frozen', name: 'Pan Dulce Assorted', sku: 'PDA-FRZ-36', supplier: 'Artimex', unitsPerCase: 36, thawHours: 8, consumptionRatio: 22, safetyStockPercent: 10, pricePerCase: 38 },
];

const frozenSeed = (locationId: string, index: number): FrozenInventory[] => frozenProducts.map((product, productIndex) => {
  const base = [380, 190, 120, 45, 90, 150][productIndex] + index * [9, 6, 4, 3, 5, 7][productIndex];
  return { locationId, productId: product.id, frozenQty: base, thawingQty: [160, 144, 60, 72, 48, 84][productIndex], readyQty: [96, 48, 30, 30, 24, 48][productIndex], incomingQty: productIndex === 0 ? 480 : 0, incomingEta: productIndex === 0 ? '2026-09-08T08:00:00' : '2026-09-08T20:00:00' };
});
export const demoFrozenInventories: FrozenInventory[] = locations.flatMap((location, index) => frozenSeed(location.id, index));
export const demoThawBatches: ThawBatch[] = [
  { id: 'thaw-bolillo-1', locationId: 'canoga-park', productId: 'bolillo-frozen', quantity: 240, thawStart: '2026-09-08T04:00:00', readyAt: '2026-09-08T12:00:00', status: 'planned' },
  { id: 'thaw-bolillo-2', locationId: 'canoga-park', productId: 'bolillo-frozen', quantity: 144, thawStart: '2026-09-08T08:00:00', readyAt: '2026-09-08T16:00:00', status: 'planned' },
  { id: 'thaw-telera-1', locationId: 'canoga-park', productId: 'telera-frozen', quantity: 144, thawStart: '2026-09-08T03:30:00', readyAt: '2026-09-08T11:30:00', status: 'planned' },
  { id: 'thaw-concha-1', locationId: 'canoga-park', productId: 'concha-frozen', quantity: 72, thawStart: '2026-09-08T02:00:00', readyAt: '2026-09-08T10:00:00', status: 'planned' },
];
export const inventoryMappings: InventoryMapping[] = frozenProducts.map((product) => ({ r365Sku: product.sku, r365Name: `${product.name} Frozen ${product.unitsPerCase}ct`, frozenProductId: product.id, artimexProductName: `Artimex ${product.name} ${product.unitsPerCase}ct` }));
export const demoRestaurant365Feed: Restaurant365InventoryItem[] = demoFrozenInventories.map((inventory) => { const product = frozenProducts.find((item) => item.id === inventory.productId)!; return { locationId: inventory.locationId, sku: product.sku, productName: `${product.name} Frozen ${product.unitsPerCase}ct`, onHand: inventory.frozenQty, lastCount: inventory.frozenQty + 20, received: inventory.incomingQty, waste: Math.round(inventory.frozenQty * .04), transferIn: 0, transferOut: 0, lastUpdated: '10:42 AM' }; });

const seededArtimexCases: Record<string, [number, number, number]> = {
  'panorama-city': [31, 21, 15],
  'santa-ana': [22, 16, 10],
  reseda: [29, 20, 14],
  'north-hollywood': [27, 19, 13],
  pacoima: [25, 17, 12],
  sylmar: [26, 18, 13],
  chatsworth: [24, 16, 11],
  'van-nuys': [23, 15, 10],
  northridge: [20, 13, 9],
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
  frozenInventories: Object.fromEntries(demoFrozenInventories.map((item) => [`${item.locationId}:${item.productId}`, item])),
  thawBatches: demoThawBatches,
  frozenManualQuantities: {},
  frozenOrders: [],
};
