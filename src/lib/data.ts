import type { PlannerState, Product } from './types';

export const locations = [
  { id: 'canoga-park', name: 'Canoga Park', confirmed: false },
  { id: 'panorama-city', name: 'Panorama City', confirmed: false },
  { id: 'downtown-la', name: 'Downtown L.A.', confirmed: false },
  { id: 'huntington-park', name: 'Huntington Park', confirmed: false },
  { id: 'lynwood', name: 'Lynwood', confirmed: false },
  { id: 'east-los-angeles', name: 'East Los Angeles', confirmed: false },
  { id: 'santa-ana', name: 'Santa Ana', confirmed: false },
  { id: 'fontana', name: 'Fontana', confirmed: false },
  { id: 'van-nuys', name: 'Van Nuys', confirmed: false },
  { id: 'bellflower', name: 'Bellflower', confirmed: false },
];

export const products: Product[] = [
  { id: 'bolillo', name: 'Bolillo · Frozen', supplier: 'Artimex', unit: 'case · 48 pcs', packSize: 48, historicalUse: 28, defaultStock: 9, safetyStock: 2, price: 32 },
  { id: 'telera', name: 'Telera · Frozen', supplier: 'Artimex', unit: 'case · 48 pcs', packSize: 48, historicalUse: 22, defaultStock: 7, safetyStock: 2, price: 34 },
  { id: 'pan-dulce', name: 'Pan Dulce · Assorted', supplier: 'Artimex', unit: 'case · 36 pcs', packSize: 36, historicalUse: 16, defaultStock: 5, safetyStock: 2, price: 38 },
  { id: 'tortillas', name: 'Corn Tortillas', supplier: 'Food supplier (demo)', unit: 'case · 500 pcs', packSize: 500, historicalUse: 18, defaultStock: 8, safetyStock: 2, price: 25 },
  { id: 'tomatoes', name: 'Roma Tomatoes', supplier: 'Produce supplier (demo)', unit: 'case · 25 lb', packSize: 25, historicalUse: 12, defaultStock: 4, safetyStock: 1, price: 24 },
  { id: 'avocados', name: 'Avocados', supplier: 'Produce supplier (demo)', unit: 'case · 48 pcs', packSize: 48, historicalUse: 10, defaultStock: 3, safetyStock: 1, price: 49 },
];

export const initialState: PlannerState = {
  locationId: locations[0].id,
  date: '2026-09-04',
  weather: 'mild',
  hotAdjustment: -30,
  coldAdjustment: 40,
  trendAdjustment: 0,
  manualQuantities: {},
  stocks: {},
  orders: [],
  history: [],
  consolidationFilter: 'all',
  viewMode: 'manager',
};
