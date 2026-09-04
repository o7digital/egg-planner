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
}
