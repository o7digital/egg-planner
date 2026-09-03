import {describe,expect,it} from 'vitest';
import {calculateProductNeed} from './planning.js';
const base={forecastSales:[1000],unitsPer1000Sales:48,usableStock:0,expectedReceipts:0,safetyStock:0,unitsPerCase:48,orderMultipleCases:1,minimumCases:0,consumptionBeforeDelivery:0};
describe('supplier planning',()=>{
  it('converts coherent units to cases',()=>expect(calculateProductNeed(base).suggestedCases).toBe(1));
  it('covers several days and respects case multiples',()=>expect(calculateProductNeed({...base,forecastSales:[1000,1000,1000],orderMultipleCases:2}).suggestedCases).toBe(4));
  it('returns zero with sufficient usable stock',()=>expect(calculateProductNeed({...base,usableStock:100}).suggestedCases).toBe(0));
  it('reports a missing consumption ratio without inventing a suggestion',()=>expect(calculateProductNeed({...base,unitsPer1000Sales:null}).status).toBe('ratio_missing'));
  it('flags a shortage occurring before delivery',()=>expect(calculateProductNeed({...base,usableStock:10,consumptionBeforeDelivery:20}).shortageBeforeDelivery).toBe(true));
});
