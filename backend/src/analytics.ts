import { Router } from 'express';
import { z } from 'zod';
import { auth, canAccessRestaurant } from './auth.js';
import { config } from './config.js';
import { query } from './db.js';

export const analytics=Router();
analytics.use(auth);

analytics.get('/summary',async(req,res)=>{
  const restaurantId=typeof req.query.restaurantId==='string'?req.query.restaurantId:undefined;
  if(restaurantId&&!canAccessRestaurant(req.user!,restaurantId))return res.status(403).json({error:'Forbidden'});
  if(!restaurantId&&req.user!.role==='manager')return res.status(403).json({error:'A restaurant is required'});
  const values=restaurantId?[restaurantId]:[];const where=restaurantId?'WHERE r.id=$1':'';
  const restaurants=await query(`SELECT r.id,r.name,coalesce(sum(f.manager_forecast),0)::float forecast_sales,count(o.id) FILTER(WHERE o.status='approved')::int approved_orders FROM restaurants r LEFT JOIN forecasts f ON f.restaurant_id=r.id LEFT JOIN orders o ON o.restaurant_id=r.id ${where} GROUP BY r.id ORDER BY forecast_sales DESC`,values);
  const products=await query(`SELECT p.id,p.name,coalesce(sum(oi.retained_quantity),0)::float quantity FROM products p LEFT JOIN order_items oi ON oi.product_id=p.id LEFT JOIN orders o ON o.id=oi.order_id LEFT JOIN restaurants r ON r.id=o.restaurant_id ${where} GROUP BY p.id ORDER BY quantity DESC`,values);
  const suppliers=await query(`SELECT s.id,s.name,coalesce(sum(oi.retained_quantity),0)::float quantity,count(DISTINCT o.id)::int orders FROM suppliers s LEFT JOIN orders o ON o.supplier_id=s.id LEFT JOIN restaurants r ON r.id=o.restaurant_id LEFT JOIN order_items oi ON oi.order_id=o.id ${where} GROUP BY s.id ORDER BY quantity DESC`,values);
  res.json({generatedAt:new Date().toISOString(),restaurants:restaurants.rows,products:products.rows,suppliers:suppliers.rows});
});

const requestSchema=z.object({module:z.enum(['dashboard','forecast','analytics','orders','inventory','suppliers','corporate','consolidation','history','settings']).default('analytics'),restaurantId:z.string().uuid().optional(),restaurantSlug:z.string().regex(/^[a-z0-9-]+$/).optional(),period:z.object({from:z.iso.date(),to:z.iso.date()}),metrics:z.record(z.string(),z.unknown())});
analytics.post('/insights',async(req,res)=>{
  const parsed=requestSchema.safeParse(req.body);if(!parsed.success)return res.status(400).json({error:'Invalid analytics request'});let restaurantId=parsed.data.restaurantId;if(!restaurantId&&parsed.data.restaurantSlug){const restaurant=await query<{id:string}>('SELECT id FROM restaurants WHERE slug=$1 AND active',[parsed.data.restaurantSlug]);if(!restaurant.rowCount)return res.status(404).json({error:'Restaurant not found'});restaurantId=restaurant.rows[0].id;}if(restaurantId&&!canAccessRestaurant(req.user!,restaurantId))return res.status(403).json({error:'Forbidden'});if(!restaurantId&&req.user!.role==='manager')return res.status(403).json({error:'A restaurant is required'});if(!config.HF_TOKEN)return res.status(503).json({error:'AI analysis is not configured'});
  const response=await fetch(config.HF_API_URL,{method:'POST',headers:{Authorization:`Bearer ${config.HF_TOKEN}`,'Content-Type':'application/json'},body:JSON.stringify({model:config.HF_MODEL,temperature:0.2,max_tokens:700,messages:[{role:'system',content:`You are Olivia One, a decision assistant for restaurant operators. Analyze the ${parsed.data.module} module. Return concise operational insights based only on supplied metrics. Never invent data. Prioritize concrete decisions for the current user. Distinguish observations from recommendations. Output valid JSON.`},{role:'user',content:JSON.stringify(parsed.data)}],response_format:{type:'json_schema',json_schema:{name:'operations_insights',strict:true,schema:{type:'object',additionalProperties:false,properties:{summary:{type:'string'},alerts:{type:'array',items:{type:'string'}},opportunities:{type:'array',items:{type:'string'}},recommended_actions:{type:'array',items:{type:'string'}},confidence_note:{type:'string'}},required:['summary','alerts','opportunities','recommended_actions','confidence_note']}}}})});
  if(!response.ok)return res.status(502).json({error:'AI analysis unavailable'});const payload=await response.json() as any;const content=payload.choices?.[0]?.message?.content;try{const insight=typeof content==='string'?JSON.parse(content):content;await query("INSERT INTO audit_logs(actor_id,action,target_type,metadata) VALUES($1,'analytics_generated','analytics',$2)",[req.user!.id,{model:config.HF_MODEL,period:parsed.data.period,restaurantId:restaurantId||null}]);res.json({model:config.HF_MODEL,generatedAt:new Date().toISOString(),insight});}catch{return res.status(502).json({error:'Invalid AI analysis response'});}
});
