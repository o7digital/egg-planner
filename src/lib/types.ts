export type Weather = 'hot' | 'cold' | 'mild';
export type ViewMode = 'manager' | 'corporate';

export interface Product {
  id: string;
  name: string;
  supplier: string;
  unit: string;
  packSize: number;
  historicalUse: number;
  defaultStock: number;
  safetyStock: number;
  price: number;
}

export interface DemoOrder {
  id: string;
  locationId: string;
  date: string;
  quantities: Record<string, number>;
  amount: number;
  confirmedAt: string;
}

export interface PlannerState {
  locationId: string;
  date: string;
  weather: Weather;
  hotAdjustment: number;
  coldAdjustment: number;
  trendAdjustment: number;
  manualQuantities: Record<string, number>;
  stocks: Record<string, number>;
  orders: DemoOrder[];
  history: DemoOrder[];
  consolidationFilter: 'all' | 'submitted';
  viewMode: ViewMode;
}
