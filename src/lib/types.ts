export type Weather = 'very-hot' | 'hot' | 'mild' | 'cold';
export type ViewMode = 'manager' | 'corporate';
export type SalesForecastStatus = 'draft' | 'validated' | 'needs-review';
export type ProductNeedsStatus = 'waiting-for-sales' | 'calculated' | 'recalculation-required';
export type SupplierOrderStatus = 'not-prepared' | 'draft' | 'ready' | 'validated';

export interface Location {
  id: string;
  name: string;
}

export interface Product {
  id: string;
  name: string;
  supplier: string;
  unitLabel: string;
  unitsPerCase: number;
  consumptionRatio: number;
  defaultOnHandUnits: number;
  incomingUnits: number;
  safetyStockPercent: number;
  pricePerCase: number;
}

export interface ForecastDay {
  date: string;
  weather: Weather;
  temperature: number;
  historicalSales: number;
  weatherAdjustment: number;
  suggestedSales: number;
  managerForecast: number;
}

export interface RequirementHorizon {
  startDate: string;
  endDate: string;
  source: 'supplier-schedule' | 'unconfigured-demo';
  label: string;
}

export interface ProductNeed {
  productId: string;
  validatedSales: number;
  expectedConsumption: number;
  safetyStockUnits: number;
  grossRequirement: number;
  onHandUnits: number;
  incomingUnits: number;
  netRequirement: number;
  unitsPerCase: number;
  suggestedCases: number;
}

export interface DemoOrder {
  id: string;
  locationId: string;
  date: string;
  quantities: Record<string, number>;
  amount: number;
  confirmedAt: string;
  status: 'validated';
}

export type FrozenInventoryStatus = 'ok' | 'low' | 'shortage' | 'overstock';
export type ThawBatchStatus = 'planned' | 'thawing' | 'ready' | 'completed';
export type FrozenOrderStatus = 'not-required' | 'suggested' | 'draft' | 'validated' | 'included-in-consolidation';

export interface FrozenProduct {
  id: string; name: string; supplier: 'Artimex'; sku: string; unitsPerCase: number;
  thawHours: number; consumptionRatio: number; safetyStockPercent: number; pricePerCase: number;
}
export interface FrozenInventory { locationId: string; productId: string; frozenQty: number; thawingQty: number; readyQty: number; incomingQty: number; incomingEta: string; }
export interface ThawBatch { id: string; locationId: string; productId: string; quantity: number; thawStart: string; readyAt: string; status: ThawBatchStatus; }
export interface DemandWindow { productId: string; requiredQty: number; requiredAt: string; }
export interface FrozenBreadNeed { productId: string; expectedNeed: number; safetyStock: number; frozenUsable: number; thawingUsable: number; readyQty: number; incomingUsable: number; projectedAvailable: number; shortage: number; suggestedCases: number; status: FrozenInventoryStatus; }
export interface FrozenReplenishment { locationId: string; date: string; quantities: Record<string, number>; status: FrozenOrderStatus; confirmedAt?: string; }
export interface Restaurant365InventoryItem { locationId: string; sku: string; productName: string; onHand: number; lastCount: number; received: number; waste: number; transferIn: number; transferOut: number; lastUpdated: string; }
export interface InventoryMapping { r365Sku: string; r365Name: string; frozenProductId: string; artimexProductName: string; }

export interface PlannerState {
  locationId: string;
  date: string;
  veryHotAdjustment: number;
  hotAdjustment: number;
  coldAdjustment: number;
  managerForecasts: Record<string, number>;
  forecastStatuses: Record<string, SalesForecastStatus>;
  productNeedsStatuses: Record<string, ProductNeedsStatus>;
  supplierOrderStatuses: Record<string, SupplierOrderStatus>;
  manualQuantities: Record<string, number>;
  stocks: Record<string, number>;
  orders: DemoOrder[];
  history: DemoOrder[];
  consolidationFilter: 'validated';
  viewMode: ViewMode;
  frozenInventories: Record<string, FrozenInventory>;
  thawBatches: ThawBatch[];
  frozenManualQuantities: Record<string, number>;
  frozenOrders: FrozenReplenishment[];
}
