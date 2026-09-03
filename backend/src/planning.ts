export interface ProductNeedInput { forecastSales:number[]; unitsPer1000Sales:number|null; usableStock:number; expectedReceipts:number; safetyStock:number; unitsPerCase:number; orderMultipleCases:number; minimumCases:number; consumptionBeforeDelivery:number }
export interface ProductNeed { status:'ready'|'ratio_missing'; requiredUnits:number|null; projectedStockAtDelivery:number; shortageBeforeDelivery:boolean; suggestedCases:number|null }
export function calculateProductNeed(input:ProductNeedInput):ProductNeed {
  const projectedStockAtDelivery=input.usableStock-input.consumptionBeforeDelivery;
  if(input.unitsPer1000Sales===null)return{status:'ratio_missing',requiredUnits:null,projectedStockAtDelivery,shortageBeforeDelivery:projectedStockAtDelivery<0,suggestedCases:null};
  const requiredUnits=input.forecastSales.reduce((sum,sales)=>sum+sales*input.unitsPer1000Sales!/1000,0);
  const netUnits=Math.max(0,requiredUnits+input.safetyStock-Math.max(0,projectedStockAtDelivery)-input.expectedReceipts);
  const rawCases=Math.ceil(netUnits/input.unitsPerCase);
  let suggestedCases=Math.ceil(rawCases/input.orderMultipleCases)*input.orderMultipleCases;
  if(suggestedCases>0)suggestedCases=Math.max(suggestedCases,input.minimumCases);
  return{status:'ready',requiredUnits,projectedStockAtDelivery,shortageBeforeDelivery:projectedStockAtDelivery<0,suggestedCases};
}
