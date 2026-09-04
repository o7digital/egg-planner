import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { clerkMiddleware } from '@clerk/express';
import { auth, canAccessRestaurant, requireRole } from './auth.js';
import { config } from './config.js';
import { pool, query } from './db.js';
import { workflow } from './workflow.js';
import { analytics } from './analytics.js';

const app=express();
const clerkAuthorizedParties=(config.CLERK_AUTHORIZED_PARTIES||config.FRONTEND_URL).split(',').map(value=>value.trim()).filter(Boolean);
app.set('trust proxy',1); if(config.CLERK_SECRET_KEY&&config.CLERK_PUBLISHABLE_KEY)app.use(clerkMiddleware({authorizedParties:clerkAuthorizedParties})); app.use(helmet()); app.use(cors({origin:clerkAuthorizedParties,credentials:true})); app.use(express.json({limit:'1mb'}));
app.use((req,res,next)=>{if(!['GET','HEAD','OPTIONS'].includes(req.method)&&req.headers.origin && !clerkAuthorizedParties.includes(req.headers.origin))return res.status(403).json({error:'Invalid request origin'});next();});

app.get('/api/health',async(_req,res)=>{try{await query('SELECT 1');res.json({status:'ok'});}catch{res.status(503).json({status:'unavailable'});}});
app.get('/api/auth/me',auth,(req,res)=>res.json({user:req.user}));
app.get('/api/restaurants',auth,async(req,res)=>{const all=await query('SELECT id,slug,name,address,latitude,longitude,timezone,delivery_calendar FROM restaurants WHERE active ORDER BY name');res.json(all.rows.filter(r=>canAccessRestaurant(req.user!,String(r.id))).map(r=>({...r,locationStatus:r.latitude===null?'not_configured':'configured'})));});
app.get('/api/restaurants/:id/weather',auth,async(req,res)=>{if(!canAccessRestaurant(req.user!,req.params.id))return res.status(403).json({error:'Forbidden'});const r=await query<{latitude:string|null;longitude:string|null;timezone:string}>('SELECT latitude,longitude,timezone FROM restaurants WHERE id=$1',[req.params.id]);if(!r.rowCount)return res.status(404).json({error:'Restaurant not found'});if(r.rows[0].latitude===null)return res.status(409).json({error:'Location not configured'});if(!config.OPEN_METEO_API_KEY)return res.status(503).json({error:'Commercial weather service not configured'});const url=new URL(`${config.OPEN_METEO_BASE_URL}/forecast`);url.search=new URLSearchParams({latitude:r.rows[0].latitude!,longitude:r.rows[0].longitude!,timezone:r.rows[0].timezone,forecast_days:'16',temperature_unit:'fahrenheit',daily:'weather_code,temperature_2m_max,temperature_2m_min',apikey:config.OPEN_METEO_API_KEY}).toString();try{const response=await fetch(url);if(!response.ok)throw new Error('provider');const data=await response.json() as {daily:{time:string[];weather_code:number[];temperature_2m_max:number[];temperature_2m_min:number[]}};await query('INSERT INTO weather_snapshots(restaurant_id,forecast_date,max_temp_f,weather_code,source,fetched_at,raw) SELECT $1,x.d::date,x.t,x.c,\'open-meteo\',now(),$2 FROM unnest($3::text[],$4::numeric[],$5::int[]) x(d,t,c)',[req.params.id,data,data.daily.time,data.daily.temperature_2m_max,data.daily.weather_code]);res.json({source:'Open-Meteo',fetchedAt:new Date().toISOString(),...data});}catch{const cached=await query('SELECT forecast_date,max_temp_f,weather_code,fetched_at FROM weather_snapshots WHERE restaurant_id=$1 ORDER BY fetched_at DESC LIMIT 16',[req.params.id]);if(cached.rowCount)return res.json({source:'Open-Meteo cached',stale:true,fetchedAt:cached.rows[0].fetched_at,daily:cached.rows});res.status(503).json({error:'Weather unavailable'});}});
app.get('/api/restaurants/:id/sales-history',auth,async(req,res)=>{if(!canAccessRestaurant(req.user!,req.params.id))return res.status(403).json({error:'Forbidden'});const rows=await query('SELECT sales_date,amount,source FROM daily_sales WHERE restaurant_id=$1 ORDER BY sales_date DESC LIMIT 120',[req.params.id]);res.json({sales:rows.rows});});
app.use('/api',workflow);
app.use('/api/analytics',analytics);
app.get('/api/corporate/overview',auth,requireRole('admin','super_admin'),async(_req,res)=>{const rows=await query("SELECT r.id,r.name,count(f.id) FILTER(WHERE f.status='submitted') forecasts_to_review,count(o.id) FILTER(WHERE o.status='submitted') orders_to_review FROM restaurants r LEFT JOIN forecasts f ON f.restaurant_id=r.id LEFT JOIN orders o ON o.restaurant_id=r.id GROUP BY r.id ORDER BY r.name");res.json({restaurants:rows.rows});});
app.get('/api/orders/artimex/export',auth,requireRole('admin','super_admin'),async(_req,res)=>{const rows=await query("SELECT o.delivery_date,r.name restaurant,p.sku,p.name product,oi.retained_quantity,oi.unit FROM orders o JOIN restaurants r ON r.id=o.restaurant_id JOIN suppliers s ON s.id=o.supplier_id JOIN order_items oi ON oi.order_id=o.id JOIN products p ON p.id=oi.product_id WHERE lower(s.name)='artimex' AND o.status='approved' ORDER BY o.delivery_date,r.name,p.name");const esc=(v:unknown)=>`\"${String(v??'').replaceAll('\"','\"\"')}\"`;res.type('text/csv').send([['Delivery date','Restaurant','SKU','Product','Quantity','Unit'],...rows.rows.map(Object.values)].map(row=>row.map(esc).join(',')).join('\r\n'));});
app.get('/api/admin/audit',auth,requireRole('super_admin'),async(_req,res)=>res.json((await query('SELECT * FROM audit_logs ORDER BY created_at DESC LIMIT 200')).rows));
app.use((_req,res)=>res.status(404).json({error:'Not found'}));
app.listen(config.PORT,'0.0.0.0',()=>console.log(`API listening on port ${config.PORT}`));
process.on('SIGTERM',async()=>{await pool.end();process.exit(0);});
