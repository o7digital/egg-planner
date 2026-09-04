import { demoRestaurant365Feed } from './data';
import type { Restaurant365InventoryItem } from './types';

export interface InventoryProvider {
  getInventoryByLocation(locationId: string): Promise<Restaurant365InventoryItem[]>;
  getInventoryByProduct(locationId: string, sku: string): Promise<Restaurant365InventoryItem | undefined>;
  getIncomingDeliveries(locationId: string): Promise<Restaurant365InventoryItem[]>;
  getWaste(locationId: string): Promise<Restaurant365InventoryItem[]>;
  getPhysicalCounts(locationId: string): Promise<Restaurant365InventoryItem[]>;
  getTransfers(locationId: string): Promise<Restaurant365InventoryItem[]>;
}

export class DemoRestaurant365Provider implements InventoryProvider {
  async getInventoryByLocation(locationId: string) { return demoRestaurant365Feed.filter((item) => item.locationId === locationId); }
  async getInventoryByProduct(locationId: string, sku: string) { return (await this.getInventoryByLocation(locationId)).find((item) => item.sku === sku); }
  async getIncomingDeliveries(locationId: string) { return (await this.getInventoryByLocation(locationId)).filter((item) => item.received > 0); }
  async getWaste(locationId: string) { return (await this.getInventoryByLocation(locationId)).filter((item) => item.waste > 0); }
  async getPhysicalCounts(locationId: string) { return this.getInventoryByLocation(locationId); }
  async getTransfers(locationId: string) { return (await this.getInventoryByLocation(locationId)).filter((item) => item.transferIn > 0 || item.transferOut > 0); }
}

export const restaurant365DemoProvider = new DemoRestaurant365Provider();
