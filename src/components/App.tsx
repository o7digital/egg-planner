import { useEffect, useState, type ReactNode } from 'react';
import {
  Boxes, Building2, CalendarDays, ChartNoAxesCombined, Check, ChevronLeft, ChevronRight,
  BrainCircuit, ClipboardList, CloudSun, Download, History, LayoutDashboard, MapPin, PackageOpen,
  RotateCcw, Settings2, Snowflake, Sun, Truck, X,
} from 'lucide-react';
import { initialState, locations, products } from '../lib/data';
import {
  demandFactor, forecastConsumption, forecastSales, historicalSales, keyFor, manualKeyFor, orderTotal,
  plannedQuantity, replaceOrder, stockOnHand, suggestedQuantity, weatherAdjustment,
} from '../lib/calculations';
import { clearState, loadState, saveState } from '../lib/storage';
import type { DemoOrder, PlannerState, Product, ViewMode } from '../lib/types';
import { api, apiBase, type SessionUser } from '../lib/api';

const pages = [
  ['dashboard', 'Dashboard', LayoutDashboard], ['forecast', 'Sales Forecast', ChartNoAxesCombined],
  ['analytics', 'Analytics', BrainCircuit],
  ['orders', 'Suggested Orders', ClipboardList], ['inventory', 'Inventory', Boxes],
  ['suppliers', 'Suppliers', Truck], ['corporate', 'Corporate Overview', Building2],
  ['consolidation', 'Artimex Consolidation', PackageOpen], ['history', 'Order History', History],
  ['settings', 'Rules & Settings', Settings2],
] as const;
type Route = typeof pages[number][0];

const currency = (value: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(value);
const dateLabel = (date: string) => new Date(`${date}T12:00:00`).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });
const currentRoute = (): Route => {
  const route = window.location.hash.slice(1);
  return pages.some(([id]) => id === route) ? route as Route : 'dashboard';
};

export default function App() {
  const [state, setState] = useState<PlannerState>(initialState);
  const [ready, setReady] = useState(false);
  const [route, setRoute] = useState<Route>('dashboard');
  const [reviewOpen, setReviewOpen] = useState(false);
  const [resetOpen, setResetOpen] = useState(false);
  const [notice, setNotice] = useState('');
  const [session, setSession] = useState<SessionUser|null|undefined>(undefined);

  useEffect(() => {
    setState(loadState());
    setRoute(currentRoute());
    setReady(true);
    const onHashChange = () => { setRoute(currentRoute()); window.scrollTo(0, 0); };
    window.addEventListener('hashchange', onHashChange);
    return () => window.removeEventListener('hashchange', onHashChange);
  }, []);
  useEffect(()=>{if(!apiBase){setSession(null);return;}api<{user:SessionUser}>('/api/auth/me').then(({user})=>setSession(user)).catch(()=>setSession(null));},[]);
  useEffect(() => { if (ready) saveState(state); }, [state, ready]);
  useEffect(() => {
    if (!notice) return;
    const timer = window.setTimeout(() => setNotice(''), 3500);
    return () => window.clearTimeout(timer);
  }, [notice]);

  const update = (patch: Partial<PlannerState>) => setState((current) => ({ ...current, ...patch }));
  const setViewMode = (viewMode: ViewMode) => {
    update({ viewMode });
    window.location.hash = viewMode === 'corporate' ? 'corporate' : 'dashboard';
  };
  const confirmOrder = () => {
    const quantities = Object.fromEntries(products.map((product) => [product.id, plannedQuantity(state, product)]));
    const order: DemoOrder = {
      id: `GG-${Date.now()}`,
      locationId: state.locationId,
      date: state.date,
      quantities,
      amount: orderTotal(state),
      confirmedAt: new Date().toISOString(),
    };
    setState((current) => ({
      ...current,
      orders: replaceOrder(current.orders, order),
      history: [order, ...current.history],
    }));
    setReviewOpen(false);
    setNotice('Demo order confirmed. Corporate totals are updated.');
  };
  const reset = () => {
    clearState();
    setState(initialState);
    setResetOpen(false);
    setNotice('Demo data reset.');
  };

  const content = {
    dashboard: <Dashboard state={state} update={update} openReview={() => setReviewOpen(true)} />,
    forecast: <Forecast state={state} update={update} />,
    analytics: <Analytics state={state} update={update} />,
    orders: <Orders state={state} update={update} openReview={() => setReviewOpen(true)} />,
    inventory: <Inventory state={state} update={update} />,
    suppliers: <Suppliers state={state} />,
    corporate: <Corporate state={state} update={update} />,
    consolidation: <Consolidation state={state} update={update} notify={setNotice} />,
    history: <OrderHistory state={state} />,
    settings: <Rules state={state} update={update} requestReset={() => setResetOpen(true)} notify={setNotice} />,
  }[route];

  if(apiBase&&session===undefined)return <div className="authPage"><p>Loading secure workspace…</p></div>;
  if(apiBase&&!session)return <Login onLogin={setSession}/>;
  return <div className="shell">
    <aside className="sidebar">
      <div className="brandPanel"><a className="brand" href="#dashboard"><img src="/brand/el-gallo-giro-logo.png" alt="El Gallo Giro" /><span>OPERATIONS PLANNER</span></a></div>
      <div className="navlabel">WORKSPACE</div>
      <nav>{pages.map(([id, label, Icon]) => <a key={id} href={`#${id}`} className={route === id ? 'active' : ''} aria-current={route === id ? 'page' : undefined}><Icon />{label}</a>)}</nav>
      <div className="sidebarBottom"><p><i className="live" /> Independent demo workspace</p><span>From forecast to the next delivery.</span><div className="profile"><b>CM</b><span>Charles / Manager<small>Demo mode · no real permissions</small></span></div></div>
    </aside>
    <div className="workspace">
      <header><div className="topPlanning"><label><MapPin /> Restaurant<select aria-label="Restaurant" value={state.locationId} onChange={(event)=>update({locationId:event.target.value})}>{locations.map(location=><option key={location.id} value={location.id}>{location.name}</option>)}</select></label><label><CalendarDays /> Date<input type="date" value={state.date} onChange={(event)=>event.target.value&&update({date:event.target.value})}/></label><label className="periodControl">Period<select aria-label="Planning period"><option>Today</option><option>Next 7 days</option><option>Custom period</option></select></label></div><div className="headright"><span className="demoBadge">{apiBase?'CONNECTED DEMO':'SAMPLE DATA'}</span>{session?<><span className="sessionUser">{session.name}<small>{session.role.replace('_',' ')}</small></span><button className="btn compact" onClick={async()=>{await api('/api/auth/logout',{method:'POST'});setSession(null);}}>Sign out</button></>:<select aria-label="Demo view mode" value={state.viewMode} onChange={(event) => setViewMode(event.target.value as ViewMode)}><option value="manager">Manager demo</option><option value="corporate">Corporate demo</option></select>}<span className="avatar">GG</span></div></header>
      <main>{content}<OliviaOne module={route} state={state} /></main>
      <footer>Interactive demo · Fictional data · Restaurants to confirm · No live weather, POS, supplier connection or real order sending</footer>
    </div>
    {reviewOpen && <OrderReview state={state} close={() => setReviewOpen(false)} confirm={confirmOrder} />}
    {resetOpen && <Modal close={() => setResetOpen(false)}><div className="eyebrow">RESET DEMO</div><h2>Reset all local data?</h2><p>This removes stock edits, manual quantities, settings and demo order history stored in this browser.</p><div className="dialogButtons"><button className="btn" onClick={() => setResetOpen(false)}>Cancel</button><button className="btn danger" onClick={reset}>Reset demo data</button></div></Modal>}
    {notice && <div className="toast" role="status">{notice}</div>}
  </div>;
}

function Login({onLogin}:{onLogin:(user:SessionUser)=>void}){
  const [email,setEmail]=useState(''),[password,setPassword]=useState(''),[error,setError]=useState(''),[busy,setBusy]=useState(false);
  const submit=async(event:{preventDefault:()=>void})=>{event.preventDefault();setBusy(true);setError('');try{await api('/api/auth/login',{method:'POST',body:JSON.stringify({email,password})});onLogin((await api<{user:SessionUser}>('/api/auth/me')).user);}catch(reason){setError(reason instanceof Error?reason.message:'Unable to sign in');}finally{setBusy(false);}};
  return <div className="authPage"><form className="loginCard" onSubmit={submit}><div className="brand loginBrand"><img src="/brand/el-gallo-giro-logo.png" alt="El Gallo Giro" /><span>OPERATIONS PLANNER</span></div><div className="eyebrow">SECURE DEMO</div><h1>Welcome back.</h1><p className="sub">Sign in with your assigned manager or corporate account.</p>{error&&<div className="loginError" role="alert">{error}</div>}<label>Email<input type="email" autoComplete="username" required value={email} onChange={e=>setEmail(e.target.value)}/></label><label>Password<input type="password" autoComplete="current-password" minLength={8} required value={password} onChange={e=>setPassword(e.target.value)}/></label><button className="btn primary" disabled={busy}>{busy?'Signing in…':'Sign in'}</button><p className="tiny">No public registration. Contact a corporate administrator for access.</p></form></div>;
}

type ScreenProps = { state: PlannerState; update: (patch: Partial<PlannerState>) => void };

function ScreenTitle({ state, update, eyebrow = 'RESTAURANT OPERATIONS', title, subtitle, controls = true }: ScreenProps & { eyebrow?: string; title: string; subtitle: string; controls?: boolean }) {
  return <div className="titlebar"><div><div className="eyebrow">{eyebrow}</div><h1>{title}</h1><p className="sub">{subtitle}</p></div>{controls && <PlanningControls state={state} update={update} />}</div>;
}

function PlanningControls({ state, update }: ScreenProps) {
  return <div className="controls"><select aria-label="Restaurant" value={state.locationId} onChange={(event) => update({ locationId: event.target.value })}>{locations.map((location) => <option key={location.id} value={location.id}>{location.name}</option>)}</select><input type="date" aria-label="Planning date" value={state.date} onChange={(event) => event.target.value && update({ date: event.target.value })} /></div>;
}

function Metrics({ state, corporate = false }: { state: PlannerState; corporate?: boolean }) {
  const forecast = corporate ? locations.reduce((sum, location) => sum + forecastSales(state, location.id), 0) : forecastSales(state);
  const history = corporate ? locations.reduce((sum, location) => sum + historicalSales(location.id), 0) : historicalSales(state.locationId);
  const submitted = state.orders.filter((order) => order.date === state.date).length;
  return <div className="metrics">
    <Metric primary label={corporate ? 'All-location forecast' : 'Projected sales'} value={currency(forecast)} note={`${dateLabel(state.date)} · ${corporate ? '10 demo locations' : '1-day horizon'}`} />
    <Metric label="Historical average" value={currency(history)} note="Last 4 matching weekdays · sample" />
    <Metric label="Weather adjustment" value={`${weatherAdjustment(state) > 0 ? '+' : ''}${weatherAdjustment(state)}%`} note={`${state.weather} scenario · simulated`} />
    <Metric label={corporate ? 'Submitted orders' : 'Suggested purchase'} value={corporate ? String(submitted) : currency(orderTotal(state))} note={corporate ? 'Confirmed for selected date' : '6 products · sample prices'} />
  </div>;
}

function Metric({ label, value, note, primary = false }: { label: string; value: string; note: string; primary?: boolean }) {
  return <div className={`metric ${primary ? 'primary' : ''}`}><div className="metricLabel">{label}<span>↗</span></div><div className="metricValue">{value}</div><small>{note}</small></div>;
}

function Dashboard({ state, update, openReview }: ScreenProps & { openReview: () => void }) {
  const location = locations.find((item) => item.id === state.locationId)!;
  return <><ScreenTitle state={state} update={update} title="Daily & Weekly Planner" subtitle={`${location.name} · Operational sales forecast worksheet.`} controls={false} /><WorkflowSteps current={1}/><DemoNotice /><WeatherStrip state={state} update={update}/><PlannerSheet state={state} update={update} /><SupplierOrderGroups state={state} update={update} preview openReview={openReview} /></>;
}

function WorkflowSteps({current}:{current:1|2|3}) {
  return <div className="workflowSteps" aria-label="Planning progress"><span className={current>=1?'current':''}><i>{current>1?<Check/>:'1'}</i>Weather & sales</span><ChevronRight/><span className={current>=2?'current':''}><i>{current>2?<Check/>:'2'}</i>Stock & needs</span><ChevronRight/><span className={current>=3?'current':''}><i>3</i>Review order</span></div>;
}

function WeatherStrip({state,update}:ScreenProps) {
  const pattern:PlannerState['weather'][]=['mild','hot','hot','mild','cold','mild','hot'];
  return <section className="weatherStrip"><div className="stripHeading"><div><span className="eyebrow">7-DAY OUTLOOK</span><h2>Weather & sales impact</h2></div><span>Location to configure · <b>Demo weather</b></span></div><div className="weatherDays">{pattern.map((weather,index)=>{const day=new Date(`${state.date}T12:00:00`);day.setDate(day.getDate()+index);const selected=index===0;const temp=weather==='hot'?95-index:weather==='cold'?54:74+index;const adjustment=weather==='hot'?state.hotAdjustment:weather==='cold'?state.coldAdjustment:0;const Icon=weather==='hot'?Sun:weather==='cold'?Snowflake:CloudSun;return <button key={day.toISOString()} className={`${weather} ${selected?'selected':''}`} onClick={()=>update({date:day.toISOString().slice(0,10),weather})}><span>{day.toLocaleDateString('en-US',{weekday:'short'})}</span><Icon/><strong>{temp}°</strong><small>{weather==='hot'?'Hot':weather==='cold'?'Cold':'Mild'}</small><em>{adjustment>0?'+':''}{adjustment}% sales</em></button>})}</div></section>;
}

function PlannerSheet({ state }: ScreenProps) {
  const [period, setPeriod] = useState<'today'|'7days'>('today');
  const days = period === 'today' ? 1 : 7;
  return <section className="card plannerSheet"><div className="cardHead cocoaHead"><div><h2>Sales forecast worksheet</h2><p>Built from comparable weekdays and the selected weather rule.</p></div><div className="controls"><select aria-label="Planning period" value={period} onChange={(event)=>setPeriod(event.target.value as 'today'|'7days')}><option value="today">Today</option><option value="7days">Next 7 days</option></select><span className="pill amber">DEMO DATA</span></div></div><div className="tableWrap"><table><thead><tr><th>Day</th><th>Weather</th><th>Temperature</th><th>Historical average</th><th>Weather adjustment</th><th>Calculated sales</th><th className="yourForecast">Your forecast</th><th>Status</th></tr></thead><tbody>{Array.from({length:days},(_,index)=>{const date=new Date(`${state.date}T12:00:00`);date.setDate(date.getDate()+index);const calculated=forecastSales(state);return <tr key={date.toISOString()}><td><b>{date.toLocaleDateString('en-US',{weekday:'short',month:'short',day:'numeric'})}</b></td><td className="capitalize">{state.weather}<small>Demo assumption</small></td><td>{state.weather==='hot'?'95°F':state.weather==='cold'?'52°F':'72°F'}<small>Weather unavailable</small></td><td className="numeric">{currency(historicalSales(state.locationId))}<small>4 comparable days</small></td><td className="numeric">{weatherAdjustment(state)}%</td><td className="numeric"><b>{currency(calculated)}</b></td><td className="yourForecast"><input className="forecastInput" type="number" min="0" defaultValue={calculated} aria-label={`Manager forecast ${date.toISOString().slice(0,10)}`} /></td><td><span className="pill">Draft</span></td></tr>})}</tbody></table></div><div className="cardFoot"><span>Location to configure · Forecast uses clearly identified sample data.</span><div className="controls"><button className="btn">Save draft</button><a className="btn primary" href="#orders">Validate & continue <ChevronRight /></a></div></div></section>;
}

type Insight={summary:string;alerts:string[];opportunities:string[];recommended_actions:string[];confidence_note:string};
function Analytics({state,update}:ScreenProps){
  const [insight,setInsight]=useState<Insight|null>(null),[loading,setLoading]=useState(false),[error,setError]=useState('');
  const restaurantData=locations.map(location=>({label:location.name,value:forecastSales(state,location.id)}));
  const productData=products.map(product=>({label:product.name.split(' · ')[0],value:plannedQuantity(state,product)}));
  const supplierData=[...new Set(products.map(product=>product.supplier))].map(supplier=>({label:supplier,value:products.filter(product=>product.supplier===supplier).reduce((sum,product)=>sum+plannedQuantity(state,product),0)}));
  const analyze=async()=>{setLoading(true);setError('');try{const response=await api<{insight:Insight}>('/api/analytics/insights',{method:'POST',body:JSON.stringify({period:{from:state.date,to:state.date},metrics:{restaurants:restaurantData,products:productData,suppliers:supplierData,weather:state.weather}})});setInsight(response.insight);}catch(reason){setError(reason instanceof Error?reason.message:'Analysis unavailable');}finally{setLoading(false);}};
  return <><ScreenTitle state={state} update={update} eyebrow="OPERATIONS INTELLIGENCE" title="Performance Analytics" subtitle="Sales outlook, product needs and supplier demand in one view." controls={false}/><DemoNotice/><div className="analyticsGrid"><BarPanel title="Forecast by restaurant" subtitle="Projected sales · USD" data={restaurantData.slice(0,6)} money/><BarPanel title="Needs by product" subtitle="Planned whole cases" data={productData}/><BarPanel title="Demand by supplier" subtitle="Planned whole cases" data={supplierData}/></div><section className="card aiPanel"><div className="aiPanelHead"><div className="aiIcon"><BrainCircuit/></div><div><span className="eyebrow">OLIVIA ONE · NETWORK ANALYSIS</span><h2>Operations briefing</h2><p>Decision support across restaurants, products and suppliers.</p></div><button className="btn primary" onClick={analyze} disabled={loading||!apiBase}>{loading?'Olivia is analyzing…':'Ask Olivia One'}</button></div>{!apiBase&&<div className="aiEmpty"><b>Suggested focus:</b> compare the highest restaurant forecast with Artimex volume, then review products with low stock before confirming orders.</div>}{error&&<div className="loginError" role="alert">{error}</div>}{insight&&<div className="insightBody"><div className="insightSummary">{insight.summary}</div><InsightList title="Alerts" items={insight.alerts}/><InsightList title="Opportunities" items={insight.opportunities}/><InsightList title="Recommended actions" items={insight.recommended_actions}/><small>{insight.confidence_note}</small></div>}</section></>;
}
function BarPanel({title,subtitle,data,money=false}:{title:string;subtitle:string;data:{label:string;value:number}[];money?:boolean}){const max=Math.max(...data.map(item=>item.value),1);return <section className="card barPanel"><div className="cardHead"><div><h2>{title}</h2><p>{subtitle}</p></div><span className="pill">SAMPLE</span></div><div className="barList">{data.map(item=><div className="barRow" key={item.label}><span title={item.label}>{item.label}</span><i><b style={{width:`${Math.max(3,item.value/max*100)}%`}}/></i><strong>{money?currency(item.value):item.value}</strong></div>)}</div></section>}
function InsightList({title,items}:{title:string;items:string[]}){return <div><h3>{title}</h3>{items.length?<ul>{items.map((item,index)=><li key={index}>{item}</li>)}</ul>:<p>No items identified.</p>}</div>}

const moduleGuidance:Record<Route,string>={dashboard:'Review today’s weather adjustment and validate the sales forecast before moving to stock needs.',forecast:'Compare the manager forecast with the calculated baseline and document any meaningful override.',analytics:'Prioritize the largest variance, then verify whether stock and supplier capacity can support it.',orders:'Review zero suggestions, manual overrides and delivery timing before submitting supplier orders.',inventory:'Count products with the highest forecast need first and investigate any projected shortage.',suppliers:'Confirm delivery calendars, cutoff times and minimum quantities before relying on the plan.',corporate:'Focus on restaurants with missing forecasts, unavailable weather or submitted orders awaiting review.',consolidation:'Export only approved quantities and verify the delivery date before sharing the Artimex plan.',history:'Review repeated overrides and returned orders to identify rules that need adjustment.',settings:'Change provisional rules only with evidence and remember that validated orders keep their original snapshot.'};
function OliviaOne({module,state}:{module:Route;state:PlannerState}){
  const [open,setOpen]=useState(false),[loading,setLoading]=useState(false),[insight,setInsight]=useState<Insight|null>(null),[error,setError]=useState('');
  const ask=async()=>{setLoading(true);setError('');try{const response=await api<{insight:Insight}>('/api/analytics/insights',{method:'POST',body:JSON.stringify({module,period:{from:state.date,to:state.date},metrics:{restaurant:locations.find(location=>location.id===state.locationId)?.name,forecastSales:forecastSales(state),historicalSales:historicalSales(state.locationId),weather:state.weather,weatherAdjustment:weatherAdjustment(state),suggestedPurchase:orderTotal(state),submittedOrders:state.orders.filter(order=>order.date===state.date).length}})});setInsight(response.insight);}catch(reason){setError(reason instanceof Error?reason.message:'Olivia One is temporarily unavailable');}finally{setLoading(false)}};
  return <section className={`oliviaOne ${open?'open':''}`}><button className="oliviaToggle" onClick={()=>setOpen(!open)} aria-expanded={open}><span><BrainCircuit/></span><b>Olivia One</b><small>Decision assistant</small><ChevronRight/></button>{open&&<div className="oliviaBody"><div><span className="eyebrow">CONTEXT · {module.toUpperCase()}</span><h2>What needs your attention</h2></div><p>{moduleGuidance[module]}</p>{insight&&<><div className="insightSummary">{insight.summary}</div><InsightList title="Recommended actions" items={insight.recommended_actions}/></>}{error&&<div className="loginError" role="alert">{error}</div>}<button className="btn primary" onClick={ask} disabled={loading||!apiBase}>{loading?'Analyzing…':apiBase?'Analyze this section':'Live analysis unavailable'}</button><small>Olivia One advises. You remain responsible for every validation and order.</small></div>}</section>;
}

function Forecast({ state, update }: ScreenProps) {
  return <><ScreenTitle state={state} update={update} title="See what drives the forecast." subtitle="Test the weather assumptions before planning the next order." /><DemoNotice /><Metrics state={state} /><div className="split"><SalesChart state={state} /><WeatherCard state={state} update={update} /></div><section className="card padded"><h2>A transparent forecast</h2><div className="formula">{currency(historicalSales(state.locationId))} historical average × {(1 + weatherAdjustment(state) / 100).toFixed(2)} weather factor × {(1 + state.trendAdjustment / 100).toFixed(2)} trend factor = <b>{currency(forecastSales(state))} projected sales</b><br />Product consumption uses the same demand factor, rounded up to whole cases.</div><p className="sub">Illustrative baseline from four matching weekdays. Confidence is not scored until real sales history is validated.</p></section></>;
}

function Orders({ state, update, openReview }: ScreenProps & { openReview: () => void }) {
  return <><ScreenTitle state={state} update={update} title="Stock & supplier needs" subtitle="Adjust each supplier quantity, then review your order." controls={false}/><WorkflowSteps current={2}/><DemoNotice /><SupplierOrderGroups state={state} update={update} openReview={openReview}/></>;
}

function SupplierOrderGroups({state,update,openReview,preview=false}:ScreenProps&{openReview:()=>void;preview?:boolean}) {
  const suppliers=[...new Set(products.map(product=>product.supplier))];
  const shown=preview?suppliers.slice(0,1):suppliers;
  return <div className="supplierOrders">{shown.map(supplier=><section className={`supplierGroup ${supplier==='Artimex'?'artimex':''}`} key={supplier}><div className="supplierBanner"><div><span>{supplier==='Artimex'?'FROZEN BAKERY':'SUPPLIER ORDER'}</span><h2>{supplier}</h2></div><div><b>{products.filter(product=>product.supplier===supplier).length}</b> products · Delivery schedule to configure</div></div><ProductTable state={state} update={update} productsToShow={products.filter(product=>product.supplier===supplier)} openReview={openReview}/></section>)}{preview&&<a className="allSuppliers" href="#orders">Continue to all supplier needs <ChevronRight/></a>}</div>;
}

function WeatherCard({ state, update }: ScreenProps) {
  const temp = state.weather === 'hot' ? 95 : state.weather === 'cold' ? 52 : 72;
  const adjustment = weatherAdjustment(state);
  return <section className="card weather"><div className="cardHead"><h2>Plan for the weather</h2><span className="pill">SIMULATOR</span></div><div className="weatherHero"><div><strong>{temp}°<small>F</small></strong><p>{locations.find((location) => location.id === state.locationId)?.name} · {dateLabel(state.date)}</p></div><CloudSun /></div><div className="weatherInfo"><b>{adjustment === 0 ? 'A regular day ahead' : adjustment > 0 ? 'Cooler day. More demand.' : 'Hotter day. Lighter demand.'}</b><br />Weather applies {adjustment}% before the {state.trendAdjustment}% trend.</div><select aria-label="Weather scenario" value={state.weather} onChange={(event) => update({ weather: event.target.value as PlannerState['weather'] })}><option value="mild">Mild · 72°F · 0% impact</option><option value="hot">Hot · 95°F · {state.hotAdjustment}% impact</option><option value="cold">Cold · 52°F · +{state.coldAdjustment}% impact</option></select><p className="tiny">Illustrative rules · not a live forecast.</p></section>;
}

function SalesChart({ state }: { state: PlannerState }) {
  const points = [0.77, 0.85, 0.8, 0.91, 0.94, 1.12, 1.03];
  return <section className="card"><div className="cardHead"><div><h2>Sales outlook</h2><p>Seven-day illustration · sample data</p></div><div className="legend"><span><i />Average</span><span><i className="red" />Forecast</span></div></div><div className="chart" role="img" aria-label="Seven-day comparison of historical average and forecast">{points.map((point, index) => { const average = Math.round(55 * point); const forecast = Math.round(average * demandFactor(state)); return <div className="chartColumn" key={index}><div className="bars"><i style={{ height: `${average}%` }} /><i className="red" style={{ height: `${forecast}%` }} /></div><span>{new Date(new Date(`${state.date}T12:00:00`).getTime() + (index - 1) * 86400000).toLocaleDateString('en-US', { weekday: 'short' })}</span></div>; })}</div></section>;
}

function ProductTable({ state, update, productsToShow, openReview }: ScreenProps & { productsToShow: Product[]; openReview: () => void }) {
  const setQuantity = (product: Product, quantity: number) => update({ manualQuantities: { ...state.manualQuantities, [manualKeyFor(state.date, state.locationId, product.id)]: Math.max(0, Math.min(9999, Math.round(quantity || 0))) } });
  return <section className="card"><div className="cardHead"><div><h2>Suggested quantities</h2><p>{dateLabel(state.date)} · forecast need + safety stock − on hand</p></div><span className="pill amber">MANAGER REVIEW</span></div><div className="tableWrap"><table><thead><tr><th>Product / Supplier</th><th>Avg. use</th><th>On hand</th><th>Forecast need</th><th>Suggested</th><th>Your order</th></tr></thead><tbody>{productsToShow.map((product) => { const quantity = plannedQuantity(state, product); return <tr key={product.id}><td><div className="product"><span className="productIcon"><PackageOpen /></span><span><b>{product.name}</b><small>{product.supplier} · {product.unit}</small></span></div></td><td>{Math.round(product.historicalUse)}<small>cases / day</small></td><td>{stockOnHand(state, product)}</td><td>{forecastConsumption(state, product)}</td><td><b>{suggestedQuantity(state, product)}</b><small>incl. {product.safetyStock} safety</small></td><td><div className="quantity"><button aria-label={`Decrease ${product.name}`} onClick={() => setQuantity(product, quantity - 1)}>−</button><input aria-label={`Order quantity ${product.name}`} type="number" min="0" max="9999" value={quantity} onChange={(event) => setQuantity(product, Number(event.target.value))} /><button aria-label={`Increase ${product.name}`} onClick={() => setQuantity(product, quantity + 1)}>+</button></div></td></tr>; })}</tbody></table></div><div className="cardFoot"><span>Whole cases · {currency(orderTotal(state))} estimated total</span><button className="btn primary" onClick={openReview}>Review order <ChevronRight /></button></div></section>;
}

function Inventory({ state, update }: ScreenProps) {
  const setStock = (product: Product, value: number) => update({ stocks: { ...state.stocks, [keyFor(state.locationId, product.id)]: Math.max(0, Math.min(9999, Math.floor(value || 0))) } });
  return <><ScreenTitle state={state} update={update} title="Count today. Plan tomorrow." subtitle="Update on-hand stock to recalculate the suggested order." /><DemoNotice /><section className="card"><div className="cardHead"><h2>Stock on hand</h2><span className="pill">SAVED LOCALLY</span></div><div className="tableWrap"><table><thead><tr><th>Product</th><th>Supplier</th><th>On hand · cases</th><th>Safety stock</th><th>Suggested order</th></tr></thead><tbody>{products.map((product) => <tr key={product.id}><td><b>{product.name}</b><small>{product.unit}</small></td><td>{product.supplier}</td><td><input className="numberInput" type="number" min="0" max="9999" value={stockOnHand(state, product)} onChange={(event) => setStock(product, Number(event.target.value))} /></td><td>{product.safetyStock} cases</td><td><b>{suggestedQuantity(state, product)} cases</b></td></tr>)}</tbody></table></div><div className="cardFoot"><span>High stock correctly reduces a suggestion to zero. Manual order overrides are preserved.</span><a className="btn primary" href="#orders">View suggested order <ChevronRight /></a></div></section></>;
}

function Suppliers({ state }: { state: PlannerState }) {
  const groups = [{ name: 'Artimex', text: 'Frozen bolillo, telera and pan dulce.', count: 3 }, { name: 'Food supplier (demo)', text: 'Corn tortillas and restaurant essentials.', count: 1 }, { name: 'Produce supplier (demo)', text: 'Fresh tomatoes and avocados.', count: 2 }];
  return <><ScreenTitle state={state} update={() => undefined} title="Your supply network." subtitle="Bakery, everyday essentials and fresh produce." controls={false} /><DemoNotice /><div className="supplierGrid">{groups.map((group) => <section className="card supplierCard" key={group.name}><span className="productIcon"><Truck /></span><h2>{group.name}</h2><p>{group.text}</p><span className="pill">{group.count} products in demo</span><p className="tiny">Delivery schedule and order cutoff: to confirm.</p><a className="btn" href={group.name === 'Artimex' ? '#consolidation' : '#orders'}>View planning <ChevronRight /></a></section>)}</div></>;
}

function Corporate({ state, update }: ScreenProps) {
  return <><ScreenTitle state={state} update={update} eyebrow="CORPORATE WORKSPACE" title="Every location. One clear view." subtitle="Review restaurant forecasts and today’s order preparation." controls={false} /><DemoNotice /><Metrics state={state} corporate /><section className="card"><div className="cardHead"><h2>Location overview</h2><span>{dateLabel(state.date)}</span></div><div className="tableWrap"><table><thead><tr><th>Restaurant</th><th>Projected sales</th><th>Order value</th><th>Artimex cases</th><th>Status</th><th /></tr></thead><tbody>{locations.map((location) => { const order = state.orders.find((item) => item.locationId === location.id && item.date === state.date); const bakeryCases = products.slice(0, 3).reduce((sum, product) => sum + (order?.quantities[product.id] ?? plannedQuantity(state, product, location.id)), 0); return <tr key={location.id}><td><b>{location.name}</b><small>{location.id.startsWith('demo') ? 'Placeholder location' : 'Location to confirm'}</small></td><td>{currency(forecastSales(state, location.id))}</td><td>{currency(order?.amount ?? orderTotal(state, location.id))}</td><td>{bakeryCases}</td><td><span className={`pill ${order ? 'green' : 'amber'}`}>{order ? 'Submitted' : 'Draft estimate'}</span></td><td><a className="textLink" href="#orders" onClick={() => update({ locationId: location.id })}>Open →</a></td></tr>; })}</tbody></table></div></section></>;
}

function Consolidation({ state, update, notify }: ScreenProps & { notify: (text: string) => void }) {
  const rows = locations.map((location) => { const order = state.orders.find((item) => item.locationId === location.id && item.date === state.date); return { location, order, quantities: products.slice(0, 3).map((product) => state.consolidationFilter === 'submitted' ? (order?.quantities[product.id] ?? 0) : (order?.quantities[product.id] ?? plannedQuantity(state, product, location.id))) }; });
  const totals = products.slice(0, 3).map((_, index) => rows.reduce((sum, row) => sum + row.quantities[index], 0));
  const exportCsv = () => {
    const quote = (value: string | number) => `"${String(value).replaceAll('"', '""')}"`;
    const lines = [['Date', 'Location', 'Bolillo cases', 'Telera cases', 'Pan Dulce cases', 'Status'], ...rows.map((row) => [state.date, row.location.name, ...row.quantities, row.order ? 'Submitted' : 'Draft estimate'])];
    const url = URL.createObjectURL(new Blob([lines.map((line) => line.map(quote).join(',')).join('\r\n')], { type: 'text/csv;charset=utf-8' }));
    const anchor = document.createElement('a'); anchor.href = url; anchor.download = `artimex-demo-plan-${state.date}.csv`; anchor.click(); URL.revokeObjectURL(url); notify('Planning CSV exported for review.');
  };
  return <><ScreenTitle state={state} update={update} eyebrow="CORPORATE WORKSPACE" title="Artimex delivery plan" subtitle="Frozen bakery demand consolidated across the demo network." controls={false} /><DemoNotice /><div className="metrics"><Metric primary label="Total bakery cases" value={String(totals.reduce((sum, value) => sum + value, 0))} note={state.consolidationFilter === 'submitted' ? 'Submitted quantities only' : 'Submitted orders + draft estimates'} />{products.slice(0, 3).map((product, index) => <Metric key={product.id} label={product.name} value={String(totals[index])} note={`cases · ${product.packSize} each`} />)}</div><section className="card"><div className="cardHead"><div><h2>Restaurant allocation</h2><p>{dateLabel(state.date)} · {state.orders.filter((order) => order.date === state.date).length} submitted</p></div><div className="controls"><select value={state.consolidationFilter} onChange={(event) => update({ consolidationFilter: event.target.value as PlannerState['consolidationFilter'] })}><option value="all">All planned demand</option><option value="submitted">Submitted only</option></select><button className="btn" onClick={exportCsv}><Download /> Export CSV</button></div></div><div className="tableWrap"><table><thead><tr><th>Location</th><th>Bolillo</th><th>Telera</th><th>Pan Dulce</th><th>Total cases</th><th>Status</th></tr></thead><tbody>{rows.map((row) => <tr key={row.location.id}><td><b>{row.location.name}</b></td>{row.quantities.map((quantity, index) => <td key={index}>{quantity}</td>)}<td><b>{row.quantities.reduce((sum, value) => sum + value, 0)}</b></td><td><span className={`pill ${row.order ? 'green' : 'amber'}`}>{row.order ? 'Submitted' : state.consolidationFilter === 'submitted' ? 'Not submitted' : 'Draft estimate'}</span></td></tr>)}<tr><td><b>Total</b></td>{totals.map((total, index) => <td key={index}><b>{total}</b></td>)}<td><b>{totals.reduce((sum, value) => sum + value, 0)}</b></td><td /></tr></tbody></table></div></section><div className="bottomNote">Global Bake is not connected. This CSV is for planning review only and is not a validated Global Bake import format.</div></>;
}

function OrderHistory({ state }: { state: PlannerState }) {
  return <><ScreenTitle state={state} update={() => undefined} title="A record of every decision." subtitle="Demo confirmations saved in this browser." controls={false} /><DemoNotice /><section className="card">{state.history.length ? <div className="tableWrap"><table><thead><tr><th>Order</th><th>Restaurant</th><th>Planning date</th><th>Cases</th><th>Estimated total</th><th>Confirmed</th></tr></thead><tbody>{state.history.map((order, index) => <tr key={`${order.id}-${index}`}><td>{order.id}</td><td>{locations.find((location) => location.id === order.locationId)?.name}</td><td>{order.date}</td><td>{Object.values(order.quantities).reduce((sum, value) => sum + value, 0)}</td><td>{currency(order.amount)}</td><td>{new Date(order.confirmedAt).toLocaleString('en-US')}<small>Demo confirmation</small></td></tr>)}</tbody></table></div> : <div className="empty"><History /><h2>No orders confirmed yet</h2><p>Review a suggested order to start the demo workflow.</p><a className="btn primary" href="#orders">Create a demo order <ChevronRight /></a></div>}</section></>;
}

function Rules({ state, update, requestReset, notify }: ScreenProps & { requestReset: () => void; notify: (text: string) => void }) {
  const [draft, setDraft] = useState({ hot: state.hotAdjustment, cold: state.coldAdjustment, trend: state.trendAdjustment });
  const submit = (event: { preventDefault: () => void }) => { event.preventDefault(); update({ hotAdjustment: draft.hot, coldAdjustment: draft.cold, trendAdjustment: draft.trend }); notify('Demo rules saved and calculations updated.'); };
  return <><ScreenTitle state={state} update={update} title="Your experience. Your rules." subtitle="Configure the assumptions behind each recommendation." controls={false} /><DemoNotice /><form className="card padded" onSubmit={submit}><h2>Demand adjustments</h2><p className="sub">Starting assumptions require validation with real sales history.</p><div className="formGrid"><label>Hot weather adjustment (%)<input type="number" min="-90" max="0" required value={draft.hot} onChange={(event) => setDraft({ ...draft, hot: Number(event.target.value) })} /></label><label>Cold weather adjustment (%)<input type="number" min="0" max="100" required value={draft.cold} onChange={(event) => setDraft({ ...draft, cold: Number(event.target.value) })} /></label><label>Recent sales trend (%)<input type="number" min="-50" max="50" required value={draft.trend} onChange={(event) => setDraft({ ...draft, trend: Number(event.target.value) })} /></label></div><div className="formula"><b>Sales forecast</b> = weekday average × weather factor × recent trend factor<br /><b>Suggested cases</b> = max(0, rounded-up consumption + safety stock − stock on hand)</div><div className="cardFoot"><span>One-day horizon · safety stock configured per product</span><button className="btn primary" type="submit">Save demo rules</button></div></form><section className="card resetCard"><div><h2>Local demo data</h2><p>Clear saved inventory, manual adjustments, rules and confirmation history.</p></div><button className="btn dangerOutline" onClick={requestReset}><RotateCcw /> Reset demo data</button></section><div className="bottomNote">Temperature thresholds, delivery calendars, pack sizes and file imports will be defined using real restaurant data. They are not integrated here.</div></>;
}

function OrderReview({ state, close, confirm }: { state: PlannerState; close: () => void; confirm: () => void }) {
  return <Modal close={close}><div className="eyebrow">ORDER REVIEW</div><h2>{locations.find((location) => location.id === state.locationId)?.name}</h2><p>Delivery plan for {dateLabel(state.date)}. Confirm it to update corporate and supplier views.</p>{products.map((product) => <div className="reviewLine" key={product.id}><span>{product.name}</span><b>{plannedQuantity(state, product)} cases</b></div>)}<div className="reviewLine"><strong>Estimated total</strong><strong>{currency(orderTotal(state))}</strong></div><p className="tiny">No order is sent. A new confirmation replaces the current order for this restaurant and date; the full confirmation log remains in history.</p><div className="dialogButtons"><button className="btn" onClick={close}><ChevronLeft /> Back</button><button className="btn primary" onClick={confirm}>Confirm demo order</button></div></Modal>;
}

function Modal({ close, children }: { close: () => void; children: ReactNode }) {
  return <div className="modalBackdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && close()}><section className="modal" role="dialog" aria-modal="true"><button className="modalClose" aria-label="Close" onClick={close}><X /></button>{children}</section></div>;
}

function DemoNotice() {
  return <div className="notice"><b>Demo:</b> All figures are fictional. Restaurant names and operational assumptions must be confirmed.</div>;
}
