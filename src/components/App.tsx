import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { ClerkProvider, SignIn, UserButton, useAuth, useUser } from '@clerk/react';
import {
  ArrowDown, ArrowRight, ArrowUp, Boxes, BrainCircuit, Building2, CalendarDays,
  Check, ChevronLeft, ChevronRight, ClipboardCheck, ClipboardList, CloudSun,
  Download, History, Info, LayoutDashboard, LockKeyhole, MapPin, PackageOpen,
  RotateCcw, Settings2, Snowflake, Sun, Truck, X,
} from 'lucide-react';
import { artimexProductionInputs, demoRestaurant365Feed, frozenProducts, initialState, inventoryMappings, locations, products } from '../lib/data';
import {
  artimexConsolidation, calculateArtimexProduction, calculateRestaurantOrder, forecastKey,
  keyFor, manualKeyFor, orderTotal, planKey, plannedQuantity,
  calculateFrozenBreadNeed, frozenInventoryFor, frozenKeyFor, frozenManualKeyFor, frozenPlannedCases, frozenDemandTime, productNeed, replaceOrder, restaurantOrderValidation, stockOnHand, weeklyForecast,
} from '../lib/calculations';
import { clearState, loadState, saveState } from '../lib/storage';
import type {
  DemoOrder, FrozenProduct, PlannerState, Product, ProductNeedsStatus, SalesForecastStatus,
  SupplierOrderStatus, ViewMode, Weather,
} from '../lib/types';
import { api, apiBase, setAuthTokenProvider, type SessionUser } from '../lib/api';

const pages = [
  ['dashboard', 'Dashboard', LayoutDashboard],
  ['forecast', 'Sales Forecast', ClipboardCheck],
  ['analytics', 'Analytics', BrainCircuit],
  ['orders', 'Supplier Orders', ClipboardList],
  ['inventory', 'Inventory', Boxes],
  ['frozen-bread', 'Frozen Bread', Snowflake],
  ['suppliers', 'Suppliers', Truck],
  ['corporate', 'Corporate Overview', Building2],
  ['consolidation', 'Artimex Consolidation', PackageOpen],
  ['history', 'Order History', History],
  ['settings', 'Rules & Settings', Settings2],
] as const;
type Route = typeof pages[number][0];
type ScreenProps = { state: PlannerState; update: (patch: Partial<PlannerState>) => void };
type Language = 'en' | 'es';
const clerkPublishableKey = import.meta.env.PUBLIC_CLERK_PUBLISHABLE_KEY as string | undefined;

const LANGUAGE_STORAGE_KEY = 'gallo-giro-ops-planner:language';
const spanishText: Record<string, string> = {
  'Dashboard': 'Panel', 'Sales Forecast': 'Pronóstico de ventas', 'Analytics': 'Análisis', 'Supplier Orders': 'Pedidos a proveedores',
  'Inventory': 'Inventario', 'Suppliers': 'Proveedores', 'Corporate Overview': 'Vista corporativa', 'Artimex Consolidation': 'Consolidación Artimex',
  'Order History': 'Historial de pedidos', 'Rules & Settings': 'Reglas y configuración', 'WORKSPACE': 'ESPACIO DE TRABAJO',
  'Frozen Bread': 'Pan congelado', 'Frozen Bread Planner': 'Planificador de pan congelado', 'FROZEN BREAD · DEMO MODULE': 'PAN CONGELADO · MÓDULO DEMO',
  'Plan thawing, protect service availability and prepare Artimex replenishment.': 'Planifica la descongelación, protege la disponibilidad de servicio y prepara la reposición de Artimex.',
  'Sales forecast validation required': 'Se requiere validar el pronóstico de ventas', 'Sales forecast must be validated before frozen bread planning can be calculated.': 'El pronóstico de ventas debe validarse antes de calcular la planificación de pan congelado.',
  'Go to Sales Forecast': 'Ir al pronóstico de ventas',
  'Frozen Stock': 'Stock congelado', 'Currently Thawing': 'En descongelación', 'Tomorrow Expected Need': 'Necesidad esperada mañana', 'Shortage Risk': 'Riesgo de falta',
  'Frozen inventory and usable supply': 'Inventario congelado y suministro utilizable', 'TOMORROW THAW PLAN': 'PLAN DE DESCONGELACIÓN DE MAÑANA', 'Move product at the right time': 'Mueve producto en el momento correcto', 'Mark as Thawing': 'Marcar como descongelando',
  'ARTIMEX REPLENISHMENT': 'REPOSICIÓN ARTIMEX', 'Suggested replenishment order': 'Pedido de reposición sugerido', 'Validate Artimex Order': 'Validar pedido Artimex', 'Restaurant365': 'Restaurant365', 'DEMO MODE': 'MODO DEMO',
  'Independent demo workspace': 'Espacio de demostración independiente', 'From forecast to the next delivery.': 'Del pronóstico a la próxima entrega.',
  'Demo mode · no real permissions': 'Modo demo · sin permisos reales', 'Restaurant': 'Restaurante', 'RESTAURANT': 'RESTAURANTE', 'Week starting': 'Semana que inicia',
  '7-day planning window': 'Ventana de planificación de 7 días', 'SAMPLE DATA': 'DATOS DE MUESTRA', 'CONNECTED DEMO': 'DEMO CONECTADA',
  'Manager demo': 'Demo gerente', 'Corporate demo': 'Demo corporativa', 'Sign out': 'Cerrar sesión',
  'Interactive demo · Fictional data · No live weather, POS, inventory sync, supplier connection or real order sending': 'Demo interactiva · Datos ficticios · Sin clima, POS, inventario, proveedores ni envío de pedidos en tiempo real',
  'Weather & Sales': 'Clima y ventas', 'Validate Sales': 'Validar ventas', 'Product Needs': 'Necesidades de producto', 'Artimex Production': 'Producción Artimex',
  'completed': 'completado', 'current': 'actual', 'pending': 'pendiente', 'draft': 'borrador', 'validated': 'validado', 'needs review': 'requiere revisión',
  'waiting for sales': 'esperando ventas', 'calculated': 'calculado', 'recalculation required': 'requiere recálculo', 'not prepared': 'no preparado',
  'included in consolidation': 'incluido en consolidación', 'not included': 'no incluido', 'production planned': 'producción planificada',
  'RESTAURANT OPERATIONS': 'OPERACIONES DEL RESTAURANTE', 'Weekly Planning — ': 'Planificación semanal — ',
  'Turn weather and sales expectations into the quantities needed for the next deliveries.': 'Convierte las expectativas de clima y ventas en las cantidades necesarias para las próximas entregas.',
  '7-day sales forecast': 'Pronóstico de ventas de 7 días', 'Weather effect': 'Efecto del clima', 'Forecast status': 'Estado del pronóstico',
  'Products requiring action': 'Productos que requieren acción', 'Orders ready': 'Pedidos listos',
  'Demo assumptions:': 'Supuestos de demo:', 'sample weather, comparable sales, inventory, ratios and schedules. Current rules are not machine-learning predictions.': 'clima, ventas comparables, inventario, ratios y calendarios de muestra. Las reglas actuales no son predicciones de aprendizaje automático.',
  'STEP 1 · FORECAST INPUT': 'PASO 1 · INSUMO DEL PRONÓSTICO', 'Weather and expected sales impact': 'Clima e impacto esperado en ventas',
  'Demo weather': 'Clima de demostración', 'Current business rules': 'Reglas de negocio actuales', 'Very hot': 'Muy caluroso', 'Hot': 'Caluroso', 'Mild': 'Templado', 'Cold': 'Frío',
  'No adjustment': 'Sin ajuste', 'expected sales': 'ventas esperadas', 'STEP 2 · MANAGER DECISION': 'PASO 2 · DECISIÓN DEL GERENTE',
  'Validate expected sales': 'Validar ventas esperadas', 'Review the system suggestion, override it when needed, then validate the seven-day forecast.': 'Revisa la sugerencia del sistema, ajústala si es necesario y valida el pronóstico de siete días.',
  'Day': 'Día', 'Weather': 'Clima', 'Historical sales': 'Ventas históricas', 'Weather impact': 'Impacto del clima', 'Suggested sales': 'Ventas sugeridas',
  'Manager forecast': 'Pronóstico del gerente', 'Status / details': 'Estado / detalles', 'Current business rule': 'Regla de negocio actual',
  'How calculated': 'Cómo se calculó', 'Historical average': 'Promedio histórico', 'Weather adjustment': 'Ajuste por clima', 'Calculated forecast': 'Pronóstico calculado',
  'Average of 4 comparable weekdays · demo data': 'Promedio de 4 días de semana comparables · datos de demo', 'Manager forecasts are saved locally as demo data.': 'Los pronósticos del gerente se guardan localmente como datos de demo.', 'Save Draft': 'Guardar borrador',
  'Validate Sales Forecast': 'Validar pronóstico de ventas', 'Edit forecast': 'Editar pronóstico',
  'Sales forecast validated. Product requirements can now be calculated.': 'Pronóstico de ventas validado. Ahora se pueden calcular las necesidades de producto.',
  'STEP 3 · PENDING': 'PASO 3 · PENDIENTE', 'STEP 4 · PENDING': 'PASO 4 · PENDIENTE', 'STEP 5 · PENDING': 'PASO 5 · PENDIENTE',
  'Calculate product needs': 'Calcular necesidades de producto', 'Validate the manager sales forecast to unlock consumption, safety stock and inventory calculations.': 'Valida el pronóstico del gerente para desbloquear los cálculos de consumo, stock de seguridad e inventario.',
  'Prepare supplier orders': 'Preparar pedidos a proveedores', 'Product needs must be calculated from a validated forecast before order quantities are shown.': 'Las necesidades de producto deben calcularse desde un pronóstico validado antes de mostrar cantidades de pedido.',
  'Artimex production': 'Producción Artimex', 'Only validated restaurant orders enter the separate corporate production plan.': 'Solo los pedidos validados de restaurantes entran al plan corporativo de producción.',
  'Order included in Artimex consolidation': 'Pedido incluido en la consolidación Artimex', 'The restaurant orders product. Artimex separately plans production from all validated restaurant orders.': 'El restaurante pide producto. Artimex planifica la producción por separado con todos los pedidos validados.',
  'View consolidation': 'Ver consolidación', 'STEP 3 · PRODUCT CONSUMPTION': 'PASO 3 · CONSUMO DE PRODUCTO',
  'Validated sales → expected use → safety stock → inventory → net requirement → full cases.': 'Ventas validadas → uso esperado → stock de seguridad → inventario → necesidad neta → cajas completas.',
  'Requirement horizon: selected day only (demo)': 'Horizonte de requerimiento: solo el día seleccionado (demo)',
  'Delivery schedule to configure. The architecture can replace this with current date → next confirmed supplier delivery.': 'Calendario de entregas por configurar. La arquitectura puede reemplazarlo con fecha actual → próxima entrega confirmada.',
  'validated sales': 'ventas validadas', 'Ready to apply each product’s consumption ratio and inventory position.': 'Listo para aplicar el ratio de consumo y posición de inventario de cada producto.',
  'Calculate Product Needs': 'Calcular necesidades de producto', 'Product': 'Producto', 'Validated sales × ratio': 'Ventas validadas × ratio', 'Expected + safety': 'Esperado + seguridad',
  'Inventory position': 'Posición de inventario', 'Net requirement': 'Necesidad neta', 'Case conversion': 'Conversión a cajas', 'Never below zero': 'Nunca menor que cero',
  'Why ': 'Por qué ', 'Validated sales': 'Ventas validadas', 'Consumption ratio': 'Ratio de consumo', 'Expected use': 'Uso esperado', 'Safety stock': 'Stock de seguridad', 'On hand': 'En existencia', 'Incoming': 'En tránsito', 'Net need': 'Necesidad neta', 'Case size': 'Tamaño de caja', 'ORDER': 'PEDIDO',
  'STEP 4 · RESTAURANT ORDER': 'PASO 4 · PEDIDO DEL RESTAURANTE',
  'Edit final whole-case quantities. No order will be sent in this demo.': 'Edita las cantidades finales de cajas completas. No se enviará ningún pedido en esta demo.',
  'FROZEN BAKERY SUPPLIER': 'PROVEEDOR DE PANADERÍA CONGELADA', 'DEMO SUPPLIER': 'PROVEEDOR DEMO', 'Next delivery: to configure': 'Próxima entrega: por configurar',
  'products · schedule not assumed': 'productos · calendario no asumido', 'Need': 'Necesidad', 'Packaging': 'Empaque', 'Suggested': 'Sugerido', 'Manager order': 'Pedido del gerente', 'Adjustment': 'Ajuste',
  'Order prepared': 'Pedido preparado', 'estimated demo value · ready for approval, not sending': 'valor estimado demo · listo para aprobación, sin envío', 'Validate Supplier Order': 'Validar pedido al proveedor',
  'Sales Forecast — ': 'Pronóstico de ventas — ', 'Understand the weather rule, set manager expectations and validate before calculating product needs.': 'Entiende la regla de clima, define las expectativas del gerente y valida antes de calcular necesidades.',
  'Product Needs & Supplier Orders': 'Necesidades de producto y pedidos a proveedores', 'Restaurant demand only: validated sales become product needs, then manager-approved supplier quantities.': 'Solo demanda del restaurante: las ventas validadas se convierten en necesidades y luego en cantidades aprobadas por el gerente.',
  'Waiting for validated sales': 'Esperando ventas validadas', 'Return to Sales Forecast and validate the manager forecast. No final supplier quantities have been created.': 'Regresa al pronóstico de ventas y valida el pronóstico del gerente. No se han creado cantidades finales.',
  'Supplier orders are not prepared': 'Los pedidos a proveedores no están preparados', 'Calculate product needs first. Suggestions remain hidden until the required validation is complete.': 'Primero calcula las necesidades. Las sugerencias permanecen ocultas hasta completar la validación.',
  'Inventory Inputs': 'Entradas de inventario', 'Count stock in product units; the validated workflow converts the resulting need into full supplier cases.': 'Cuenta inventario en unidades; el flujo validado convierte la necesidad resultante en cajas completas.',
  'Stock on hand': 'Inventario disponible', 'Changing inventory after calculation requires product needs to be recalculated.': 'Cambiar el inventario después del cálculo requiere recalcular las necesidades.',
  'SAVED LOCALLY': 'GUARDADO LOCALMENTE', 'Supplier': 'Proveedor', 'Confirmed incoming': 'Entradas confirmadas', 'Planning status': 'Estado de planificación',
  'Your Supply Network': 'Tu red de suministro', 'Supplier packaging is configured; delivery calendars still require confirmation.': 'El empaque de proveedores está configurado; los calendarios de entrega aún requieren confirmación.',
  'demo products': 'productos demo', 'Delivery schedule and cutoff: to configure.': 'Calendario de entrega y hora límite: por configurar.', 'View planning': 'Ver planificación',
  'OPERATIONS INTELLIGENCE': 'INTELIGENCIA OPERATIVA', 'Forecast Analytics': 'Análisis del pronóstico', 'A focused view of expected sales; downstream quantities appear only after validation.': 'Una vista enfocada de las ventas esperadas; las cantidades posteriores aparecen solo tras la validación.',
  'Seven-day manager forecast': 'Pronóstico del gerente de siete días', 'Demo sales · USD': 'Ventas demo · USD', 'WORKFLOW HEALTH': 'ESTADO DEL FLUJO', 'Sales are validated': 'Las ventas están validadas',
  'Validation required': 'Se requiere validación', 'The forecast can support product calculations.': 'El pronóstico puede respaldar los cálculos de producto.', 'Product needs and supplier quantities remain intentionally unavailable.': 'Las necesidades de producto y cantidades de proveedor permanecen intencionalmente no disponibles.', 'Open sales forecast': 'Abrir pronóstico de ventas',
  'CORPORATE WORKSPACE': 'ESPACIO CORPORATIVO', 'Every Location. One Clear View.': 'Cada ubicación. Una vista clara.', 'Validated restaurant orders are distinct from Artimex production planning.': 'Los pedidos validados de restaurantes son distintos de la planificación de producción Artimex.',
  'Restaurant workflow overview': 'Resumen del flujo por restaurante', 'Open Artimex consolidation': 'Abrir consolidación Artimex', 'Restaurant order': 'Pedido del restaurante', 'Artimex cases': 'Cajas Artimex', 'Artimex status': 'Estado Artimex', 'Open →': 'Abrir →',
  'STEP 5 · CORPORATE WORKSPACE': 'PASO 5 · ESPACIO CORPORATIVO', 'Artimex Production Consolidation': 'Consolidación de producción Artimex', 'Validated restaurant orders are aggregated first; Artimex inventory and safety margin then determine production.': 'Primero se agregan los pedidos validados; después el inventario y margen de Artimex determinan la producción.',
  'RESTAURANTS ORDER PRODUCT': 'LOS RESTAURANTES PIDEN PRODUCTO', 'ARTIMEX PLANS PRODUCTION': 'ARTIMEX PLANIFICA PRODUCCIÓN', 'Sales → consumption → net need → supplier cases': 'Ventas → consumo → necesidad neta → cajas del proveedor', 'Validated network demand → inventory → production': 'Demanda validada de la red → inventario → producción',
  'Validated restaurant demand': 'Demanda validada de restaurantes', 'only validated orders · no draft estimates': 'solo pedidos validados · sin estimaciones de borrador', 'Export validated CSV': 'Exportar CSV validado', 'Total': 'Total', 'Status': 'Estado', 'TOTAL VALIDATED': 'TOTAL VALIDADO',
  'ARTIMEX PRODUCTION': 'PRODUCCIÓN ARTIMEX', 'Safety margin': 'Margen de seguridad', 'Frozen stock available': 'Inventario congelado disponible', 'Already planned production': 'Producción ya planificada', 'Production required': 'Producción requerida',
  'Production results are demo planning figures. No factory system or Global Bake integration is connected.': 'Los resultados de producción son cifras de planificación demo. No hay conexión con fábrica ni Global Bake.',
  'Decision History': 'Historial de decisiones', 'Validated demo supplier orders saved in this browser.': 'Pedidos demo validados guardados en este navegador.', 'Order': 'Pedido', 'Planning date': 'Fecha de planificación', 'Estimated total': 'Total estimado',
  'No manager orders validated yet': 'Aún no hay pedidos del gerente validados', 'Complete the restaurant workflow to create a demo order.': 'Completa el flujo del restaurante para crear un pedido demo.', 'Open weekly planning': 'Abrir planificación semanal',
  'Configure Charles’s provisional weather assumptions. These are business rules, not trained predictions.': 'Configura los supuestos provisionales de clima de Charles. Son reglas de negocio, no predicciones entrenadas.',
  'CURRENT BUSINESS RULE': 'REGLA DE NEGOCIO ACTUAL', 'Replace these sample rules when real restaurant weather elasticity is available.': 'Reemplaza estas reglas de muestra cuando exista elasticidad climática real del restaurante.',
  'Very hot adjustment (%)': 'Ajuste por muy caluroso (%)', 'Hot adjustment (%)': 'Ajuste por caluroso (%)', 'Cold adjustment (%)': 'Ajuste por frío (%)',
  'Forecast Sales': 'Pronóstico de ventas', 'Product Need': 'Necesidad de producto', 'Cases': 'Cajas', 'Mild weather remains 0% · demo configuration': 'El clima templado se mantiene en 0% · configuración demo', 'Save business rules': 'Guardar reglas de negocio',
  'Local demo data': 'Datos demo locales', 'Clear manager forecasts, stock edits, order adjustments and history.': 'Borra pronósticos del gerente, ajustes de inventario, pedidos e historial.', 'Reset demo data': 'Restablecer datos demo',
  'ORDER READY FOR APPROVAL': 'PEDIDO LISTO PARA APROBACIÓN', 'Validate these restaurant supplier quantities for ': 'Valida estas cantidades del proveedor para ', 'This action does not send an order.': 'Esta acción no envía un pedido.',
  'adjustment': 'ajuste', 'Estimated demo total': 'Total estimado demo', 'Validation includes the Artimex items in corporate consolidation. No supplier integration exists and nothing is transmitted.': 'La validación incluye artículos Artimex en la consolidación corporativa. No existe integración de proveedor ni se transmite nada.', 'Back': 'Volver',
  'Olivia One': 'Olivia One', 'Decision assistant': 'Asistente de decisiones', 'What needs your attention': 'Qué requiere tu atención', 'Olivia One advises. You remain responsible for every validation and order.': 'Olivia One asesora. Tú sigues siendo responsable de cada validación y pedido.',
  'Cancel': 'Cancelar', 'RESET DEMO': 'RESTABLECER DEMO', 'Reset all local data?': '¿Restablecer todos los datos locales?', 'This removes manager forecasts, stock edits, order adjustments and demo history stored in this browser.': 'Esto elimina pronósticos del gerente, ajustes de inventario, pedidos e historial demo guardados en este navegador.',
  'Language': 'Idioma', 'MON': 'LUN', 'TUE': 'MAR', 'WED': 'MIÉ', 'THU': 'JUE', 'FRI': 'VIE', 'SAT': 'SÁB', 'SUN': 'DOM',
  'OLIVIA ONE · DECISION SUPPORT': 'OLIVIA ONE · APOYO A LA DECISIÓN', 'Olivia One operational briefing': 'Informe operativo de Olivia One', 'Olivia’s recommended next move': 'Próximo paso recomendado por Olivia',
  'Decision support from the current planning data': 'Apoyo a la decisión con los datos actuales de planificación', 'Live Hugging Face analysis · based on the current workspace inputs': 'Análisis de Hugging Face en vivo · basado en los datos actuales',
  'Refresh AI analysis': 'Actualizar análisis de IA', 'Analyzing…': 'Analizando…', 'Watch': 'Atención', 'Opportunity': 'Oportunidad', 'Recommended action': 'Acción recomendada',
  'Live Hugging Face analysis is unavailable; showing transparent demo reasoning.': 'El análisis en vivo de Hugging Face no está disponible; se muestra razonamiento demo transparente.',
  'Monday': 'Lunes', 'Tuesday': 'Martes', 'Wednesday': 'Miércoles', 'Thursday': 'Jueves', 'Friday': 'Viernes', 'Saturday': 'Sábado', 'Sunday': 'Domingo',
};

const currency = (value: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(value);
const number = (value: number) => new Intl.NumberFormat('en-US').format(value);
const dateLabel = (date: string) => new Date(`${date}T12:00:00`).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });
const weatherLabel: Record<Weather, string> = { 'very-hot': 'Very hot', hot: 'Hot', mild: 'Mild', cold: 'Cold' };
const currentRoute = (): Route => {
  const route = window.location.hash.slice(1);
  return pages.some(([id]) => id === route) ? route as Route : 'dashboard';
};

const sourceText = new WeakMap<Text, string>();
const sourceAttributes = new WeakMap<Element, Record<string, string>>();

function translateSpanish(source: string) {
  const exact = spanishText[source] ?? spanishText[source.trim()];
  if (exact) return source.trim() === source ? exact : source.replace(source.trim(), exact);
  return source
    .replace(/^Weekly Planning — /, 'Planificación semanal — ')
    .replace(/^Sales Forecast — /, 'Pronóstico de ventas — ')
    .replace(/\bcases\b/gi, 'cajas')
    .replace(/\bcase\b/gi, 'caja')
    .replace(/\bunits\b/gi, 'unidades')
    .replace(/\bon hand\b/gi, 'en existencia')
    .replace(/\bexpected sales\b/gi, 'ventas esperadas')
    .replace(/\bCurrent business rules\b/g, 'Reglas de negocio actuales')
    .replace(/\bPENDING\b/g, 'PENDIENTE')
    .replace(/\bMon\b/g, 'Lun')
    .replace(/\bTue\b/g, 'Mar')
    .replace(/\bWed\b/g, 'Mié')
    .replace(/\bThu\b/g, 'Jue')
    .replace(/\bFri\b/g, 'Vie')
    .replace(/\bSat\b/g, 'Sáb')
    .replace(/\bSun\b/g, 'Dom')
    .replace(/\bCurrent business rule\b/g, 'Regla de negocio actual')
    .replace(/\bManager forecast\b/g, 'Pronóstico del gerente')
    .replace(/\bSystem suggestion\b/g, 'Sugerencia del sistema')
    .replace(/\bHow calculated\b/g, 'Cómo se calculó');
}

function useLocalizedInterface(language: Language) {
  useEffect(() => {
    document.documentElement.lang = language;
    document.documentElement.dir = 'ltr';
    document.title = language === 'es' ? 'Gallo Giro | Planificador Operativo' : 'Gallo Giro | Ops Planner';
    const localize = () => {
      const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
      let node = walker.nextNode();
      while (node) {
        const text = node as Text;
        const parent = text.parentElement;
        if (parent && !['SCRIPT', 'STYLE'].includes(parent.tagName)) {
          const previous = sourceText.get(text);
          const current = text.nodeValue ?? '';
          const expected = previous === undefined ? undefined : language === 'es' ? translateSpanish(previous) : previous;
          const original = previous === undefined || current !== expected ? current : previous;
          sourceText.set(text, original);
          text.nodeValue = language === 'es' ? translateSpanish(original) : original;
        }
        node = walker.nextNode();
      }
      document.querySelectorAll<HTMLElement>('[aria-label], [title], [placeholder]').forEach((element) => {
        const original = sourceAttributes.get(element) ?? {};
        ['aria-label', 'title', 'placeholder'].forEach((attribute) => {
          const value = element.getAttribute(attribute);
          if (value !== null && original[attribute] === undefined) original[attribute] = value;
          if (original[attribute] !== undefined) element.setAttribute(attribute, language === 'es' ? translateSpanish(original[attribute]) : original[attribute]);
        });
        sourceAttributes.set(element, original);
      });
    };
    localize();
    const observer = new MutationObserver((mutations) => {
      if (mutations.some((mutation) => mutation.type === 'childList' && mutation.addedNodes.length)) localize();
    });
    observer.observe(document.body, { childList: true, subtree: true });
    return () => observer.disconnect();
  });
}

export default function App() {
  if (!clerkPublishableKey) return apiBase ? <div className="authPage"><div className="loginCard"><div className="eyebrow">CLERK SETUP REQUIRED</div><h1>Authentication is being configured.</h1><p className="sub">Add PUBLIC_CLERK_PUBLISHABLE_KEY in Vercel to enable secure sign-in.</p></div></div> : <PlannerApp />;
  return <ClerkProvider publishableKey={clerkPublishableKey} afterSignOutUrl="/"><ClerkGate /></ClerkProvider>;
}

function ClerkGate() {
  const { isLoaded, isSignedIn, getToken } = useAuth();
  const { user } = useUser();
  useEffect(() => { setAuthTokenProvider(isSignedIn ? getToken : undefined); return () => setAuthTokenProvider(undefined); }, [getToken, isSignedIn]);
  if (!isLoaded) return <div className="authPage"><p>Loading secure workspace…</p></div>;
  if (!isSignedIn || !user) return <div className="authPage"><div className="clerkLogin"><div className="brand loginBrand"><img src="/brand/el-gallo-giro-logo.png" alt="El Gallo Giro" /><span>OPERATIONS PLANNER</span></div><SignIn routing="hash" /></div></div>;
  const email = user.primaryEmailAddress?.emailAddress ?? '';
  const role = (user.publicMetadata.role === 'manager' || user.publicMetadata.role === 'admin' || user.publicMetadata.role === 'super_admin') ? user.publicMetadata.role : 'manager';
  return <PlannerApp clerkSession={{ user: { id: user.id, email, name: user.fullName ?? email, role, restaurants: [] } }} />;
}

function PlannerApp({ clerkSession }: { clerkSession?: { user: SessionUser } }) {
  const [state, setState] = useState<PlannerState>(initialState);
  const [ready, setReady] = useState(false);
  const [route, setRoute] = useState<Route>('dashboard');
  const [reviewOpen, setReviewOpen] = useState(false);
  const [resetOpen, setResetOpen] = useState(false);
  const [notice, setNotice] = useState('');
  const session = clerkSession?.user ?? null;
  const [language, setLanguage] = useState<Language>('en');
  useLocalizedInterface(language);

  useEffect(() => {
    setState(loadState());
    setRoute(currentRoute());
    const requestedLanguage = new URLSearchParams(window.location.search).get('lang');
    const savedLanguage = window.localStorage.getItem(LANGUAGE_STORAGE_KEY);
    if (requestedLanguage === 'es' || savedLanguage === 'es') setLanguage('es');
    setReady(true);
    const onHashChange = () => { setRoute(currentRoute()); window.scrollTo(0, 0); };
    window.addEventListener('hashchange', onHashChange);
    return () => window.removeEventListener('hashchange', onHashChange);
  }, []);
  useEffect(() => { if (ready) window.localStorage.setItem(LANGUAGE_STORAGE_KEY, language); }, [language, ready]);
  useEffect(() => { if (ready) saveState(state); }, [state, ready]);
  useEffect(() => {
    if (!notice) return;
    const timer = window.setTimeout(() => setNotice(''), 4000);
    return () => window.clearTimeout(timer);
  }, [notice]);

  const update = (patch: Partial<PlannerState>) => setState((current) => ({ ...current, ...patch }));
  const setViewMode = (viewMode: ViewMode) => {
    update({ viewMode });
    window.location.hash = viewMode === 'corporate' ? 'corporate' : 'dashboard';
  };
  const confirmOrder = () => {
    if (!restaurantOrderValidation(state)) {
      setReviewOpen(false);
      setNotice('Validate sales and calculate product needs before preparing an order.');
      return;
    }
    const quantities = calculateRestaurantOrder(state);
    const order: DemoOrder = {
      id: `GG-${Date.now()}`,
      locationId: state.locationId,
      date: state.date,
      quantities,
      amount: orderTotal(state),
      confirmedAt: new Date().toISOString(),
      status: 'validated',
    };
    const key = planKey(state.date, state.locationId);
    setState((current) => ({
      ...current,
      orders: replaceOrder(current.orders, order),
      history: [order, ...current.history],
      supplierOrderStatuses: { ...current.supplierOrderStatuses, [key]: 'validated' },
    }));
    setReviewOpen(false);
    setNotice('Supplier order validated and included in Artimex consolidation. Nothing was sent.');
  };
  const reset = () => {
    clearState();
    setState(initialState);
    setResetOpen(false);
    setNotice('Demo data reset.');
  };

  const shared = { state, update, notify: setNotice };
  const content: Record<Route, ReactNode> = {
    dashboard: <Dashboard {...shared} openReview={() => setReviewOpen(true)} />,
    forecast: <Forecast {...shared} />,
    analytics: <Analytics state={state} update={update} />,
    orders: <Orders {...shared} openReview={() => setReviewOpen(true)} />,
    inventory: <Inventory state={state} update={update} />,
    'frozen-bread': <FrozenBreadPlanner {...shared} />,
    suppliers: <Suppliers state={state} />,
    corporate: <Corporate state={state} update={update} />,
    consolidation: <Consolidation {...shared} />,
    history: <OrderHistory state={state} />,
    settings: <Rules {...shared} requestReset={() => setResetOpen(true)} />,
  };

  return <div className="shell" data-language={language}>
    <aside className="sidebar">
      <div className="brandPanel"><a className="brand" href="#dashboard"><img src="/brand/el-gallo-giro-logo.png" alt="El Gallo Giro" /><span>OPERATIONS PLANNER</span></a></div>
      <div className="navlabel">WORKSPACE</div>
      <nav>{pages.map(([id, label, Icon]) => <a key={id} href={`#${id}`} className={route === id ? 'active' : ''} aria-current={route === id ? 'page' : undefined}><Icon />{label}</a>)}</nav>
      <div className="sidebarBottom"><p><i className="live" /> Independent demo workspace</p><span>From forecast to the next delivery.</span><div className="profile"><b>CM</b><span>Charles / Manager<small>Demo mode · no real permissions</small></span></div></div>
    </aside>
    <div className="workspace">
      <header>
        <div className="topPlanning">
          <label><MapPin /> Restaurant<select aria-label="Restaurant" value={state.locationId} onChange={(event) => update({ locationId: event.target.value })}>{locations.map((location) => <option key={location.id} value={location.id}>{location.name}</option>)}</select></label>
          <label><CalendarDays /> Week starting<input type="date" value={state.date} onChange={(event) => event.target.value && update({ date: event.target.value })} /></label>
          <span className="weekHorizon">7-day planning window</span>
        </div>
        <div className="headright"><span className="demoBadge">{apiBase ? 'CONNECTED DEMO' : 'SAMPLE DATA'}</span><select className="languageSelect" aria-label="Language" value={language} onChange={(event) => setLanguage(event.target.value as Language)}><option value="en">EN</option><option value="es">ES</option></select>{session ? <><span className="sessionUser">{session.name}<small>{session.role.replace('_', ' ')}</small></span><UserButton /></> : <select aria-label="Demo view mode" value={state.viewMode} onChange={(event) => setViewMode(event.target.value as ViewMode)}><option value="manager">Manager demo</option><option value="corporate">Corporate demo</option></select>}<span className="avatar">GG</span></div>
      </header>
      <main>{content[route]}</main>
      <footer>Interactive demo · Fictional data · No live weather, POS, inventory sync, supplier connection or real order sending</footer>
    </div>
    {reviewOpen && <OrderReview state={state} close={() => setReviewOpen(false)} confirm={confirmOrder} />}
    {resetOpen && <Modal close={() => setResetOpen(false)}><div className="eyebrow">RESET DEMO</div><h2>Reset all local data?</h2><p>This removes manager forecasts, stock edits, order adjustments and demo history stored in this browser.</p><div className="dialogButtons"><button className="btn" onClick={() => setResetOpen(false)}>Cancel</button><button className="btn danger" onClick={reset}>Reset demo data</button></div></Modal>}
    {notice && <div className="toast" role="status">{notice}</div>}
  </div>;
}

function ScreenTitle({ state, update, eyebrow = 'RESTAURANT OPERATIONS', title, subtitle, controls = true }: ScreenProps & { eyebrow?: string; title: string; subtitle: string; controls?: boolean }) {
  return <div className="titlebar"><div><div className="eyebrow">{eyebrow}</div><h1>{title}</h1><p className="sub">{subtitle}</p></div>{controls && <PlanningControls state={state} update={update} />}</div>;
}

function PlanningControls({ state, update }: ScreenProps) {
  return <div className="controls"><select aria-label="Restaurant" value={state.locationId} onChange={(event) => update({ locationId: event.target.value })}>{locations.map((location) => <option key={location.id} value={location.id}>{location.name}</option>)}</select><input type="date" aria-label="Week starting" value={state.date} onChange={(event) => event.target.value && update({ date: event.target.value })} /></div>;
}

function DemoNotice() {
  return <div className="notice subtleNotice"><b>Demo assumptions:</b> sample weather, comparable sales, inventory, ratios and schedules. Current rules are not machine-learning predictions.</div>;
}

function getStatuses(state: PlannerState) {
  const key = planKey(state.date, state.locationId);
  return {
    key,
    forecast: state.forecastStatuses[key] ?? 'draft' as SalesForecastStatus,
    needs: state.productNeedsStatuses[key] ?? 'waiting-for-sales' as ProductNeedsStatus,
    order: state.supplierOrderStatuses[key] ?? 'not-prepared' as SupplierOrderStatus,
  };
}

function WorkflowSteps({ state }: { state: PlannerState }) {
  const { forecast, needs, order } = getStatuses(state);
  const current = forecast !== 'validated' ? 2 : needs !== 'calculated' ? 3 : order !== 'validated' ? 4 : 5;
  const steps = ['Weather & Sales', 'Validate Sales', 'Product Needs', 'Supplier Orders', 'Artimex Production'];
  return <div className="workflowSteps fiveSteps" aria-label="Planning progress">{steps.map((label, index) => {
    const step = index + 1;
    const status = step < current ? 'completed' : step === current ? 'current' : 'pending';
    return <div className="stepPair" key={label}><span className={status} aria-current={status === 'current' ? 'step' : undefined} aria-disabled={status === 'pending'}><i>{status === 'completed' ? <Check /> : step}</i><b>{label}</b><small>{status}</small></span>{step < 5 && <ChevronRight />}</div>;
  })}</div>;
}

function StatusBadge({ status }: { status: string }) {
  const className = status === 'validated' || status === 'calculated' || status === 'included in consolidation' ? 'green' : status.includes('review') || status === 'recalculation required' ? 'red' : 'amber';
  return <span className={`statusBadge ${className}`}>{status}</span>;
}

function Dashboard({ state, update, notify, openReview }: ScreenProps & { notify: (text: string) => void; openReview: () => void }) {
  const location = locations.find((item) => item.id === state.locationId)!;
  const statuses = getStatuses(state);
  return <>
    <ScreenTitle state={state} update={update} title={`Weekly Planning — ${location.name}`} subtitle="Turn weather and sales expectations into the quantities needed for the next deliveries." controls={false} />
    <WorkflowSteps state={state} />
    <PlanningSummary state={state} />
    <DemoNotice />
    <FrozenBreadDashboardCard state={state} />
    <OliviaBrief module="dashboard" state={state} compact />
    <WeatherStrip state={state} />
    <ForecastPanel state={state} update={update} notify={notify} />
    {statuses.forecast === 'validated' ? <ProductNeedsPanel state={state} update={update} notify={notify} /> : <LockedStep number={3} title="Calculate product needs" text="Validate the manager sales forecast to unlock consumption, safety stock and inventory calculations." />}
    {statuses.needs === 'calculated' && statuses.forecast === 'validated' ? <SupplierOrderGroups state={state} update={update} openReview={openReview} /> : <LockedStep number={4} title="Prepare supplier orders" text="Product needs must be calculated from a validated forecast before order quantities are shown." />}
    {statuses.order === 'validated' ? <section className="workflowSuccess"><Check /><div><b>Order included in Artimex consolidation</b><span>The restaurant orders product. Artimex separately plans production from all validated restaurant orders.</span></div><a className="btn" href="#consolidation">View consolidation <ArrowRight /></a></section> : <LockedStep number={5} title="Artimex production" text="Only validated restaurant orders enter the separate corporate production plan." compact />}
  </>;
}

function FrozenBreadDashboardCard({ state }: { state: PlannerState }) {
  const validated = state.forecastStatuses[planKey(state.date, state.locationId)] === 'validated';
  const needs = frozenProducts.map((product) => calculateFrozenBreadNeed(state, product));
  const need = needs.reduce((sum, item) => sum + item.expectedNeed, 0); const shortage = needs.reduce((sum, item) => sum + item.shortage, 0);
  const thaw = frozenProducts.reduce((sum, product) => sum + frozenInventoryFor(state, product.id).thawingQty, 0); const cases = needs.reduce((sum, item) => sum + item.suggestedCases, 0);
  return <section className="frozenDashboardCard"><div><span className="eyebrow">FROZEN BREAD · DEMO</span><h2>Tomorrow’s thaw and replenishment</h2><p>{validated ? 'Connected to the validated sales forecast.' : 'Validate sales to calculate the frozen bread plan.'}</p></div><div><span>Tomorrow need<b>{validated ? `${number(need)} units` : 'Locked'}</b></span><span>To thaw<b>{validated ? `${number(thaw)} units` : '—'}</b></span><span>Shortage<b className={shortage ? 'impactNegative' : ''}>{validated ? `${number(shortage)} units` : '—'}</b></span><span>Artimex suggested<b>{validated ? `${cases} cases` : '—'}</b></span></div><a className="btn primary" href="#frozen-bread">Open Frozen Bread Plan <ChevronRight /></a></section>;
}

function PlanningSummary({ state }: { state: PlannerState }) {
  const days = weeklyForecast(state);
  const statuses = getStatuses(state);
  const sales = days.reduce((sum, day) => sum + day.managerForecast, 0);
  const historical = days.reduce((sum, day) => sum + day.historicalSales, 0);
  const actionCount = statuses.needs === 'calculated' ? products.filter((product) => productNeed(state, product).netRequirement > 0).length : null;
  const readySuppliers = statuses.needs === 'calculated' ? new Set(products.filter((product) => plannedQuantity(state, product) > 0).map((product) => product.supplier)).size : null;
  return <div className="summaryStrip">
    <SummaryItem label="7-day sales forecast" value={currency(sales)} />
    <SummaryItem label="Weather effect" value={`${sales - historical >= 0 ? '+' : ''}${currency(sales - historical)}`} tone={sales - historical < 0 ? 'negative' : 'positive'} />
    <SummaryItem label="Forecast status" value={statuses.forecast.replace('-', ' ')} status />
    <SummaryItem label="Products requiring action" value={actionCount === null ? '—' : String(actionCount)} />
    <SummaryItem label="Orders ready" value={readySuppliers === null ? '—' : String(readySuppliers)} />
  </div>;
}

function SummaryItem({ label, value, tone = '', status = false }: { label: string; value: string; tone?: string; status?: boolean }) {
  return <div className={tone}><span>{label}</span>{status ? <StatusBadge status={value} /> : <b>{value}</b>}</div>;
}

function WeatherStrip({ state }: { state: PlannerState }) {
  return <section className="weatherStrip"><div className="stripHeading"><div><span className="eyebrow">STEP 1 · FORECAST INPUT</span><h2>Weather and expected sales impact</h2></div><span><b>Demo weather</b> · Current business rules</span></div><div className="weatherDays">{weeklyForecast(state).map((day) => {
    const Icon = day.weather === 'cold' ? Snowflake : day.weather === 'mild' ? CloudSun : Sun;
    const ImpactIcon = day.weatherAdjustment > 0 ? ArrowUp : day.weatherAdjustment < 0 ? ArrowDown : ArrowRight;
    return <div key={day.date} className={day.weather}><span>{new Date(`${day.date}T12:00:00`).toLocaleDateString('en-US', { weekday: 'short' })}</span><Icon /><strong>{day.temperature}°F</strong><small>{weatherLabel[day.weather]}</small><em className={day.weatherAdjustment > 0 ? 'impactPositive' : day.weatherAdjustment < 0 ? 'impactNegative' : ''}><ImpactIcon />{day.weatherAdjustment === 0 ? 'No adjustment' : `${Math.abs(day.weatherAdjustment)}% expected sales`}</em></div>;
  })}</div></section>;
}

function ForecastPanel({ state, update, notify }: ScreenProps & { notify: (text: string) => void }) {
  const [editing, setEditing] = useState(false);
  const statuses = getStatuses(state);
  const days = weeklyForecast(state);
  const locked = statuses.forecast === 'validated' && !editing;
  const changeForecast = (date: string, value: number) => {
    const safeValue = Math.max(0, Math.round(Number.isFinite(value) ? value : 0));
    const wasValidated = statuses.forecast === 'validated';
    update({
      managerForecasts: { ...state.managerForecasts, [forecastKey(date, state.locationId)]: safeValue },
      forecastStatuses: { ...state.forecastStatuses, [statuses.key]: wasValidated ? 'needs-review' : statuses.forecast },
      productNeedsStatuses: { ...state.productNeedsStatuses, [statuses.key]: wasValidated ? 'recalculation-required' : statuses.needs },
      supplierOrderStatuses: { ...state.supplierOrderStatuses, [statuses.key]: wasValidated ? 'not-prepared' : statuses.order },
      orders: wasValidated ? state.orders.filter((order) => !(order.locationId === state.locationId && order.date === state.date)) : state.orders,
    });
    if (wasValidated) notify('Forecast changed. Product needs must be recalculated and the previous order was removed from consolidation.');
  };
  const validate = () => {
    const defaults = Object.fromEntries(days.map((day) => [forecastKey(day.date, state.locationId), day.managerForecast]));
    update({
      managerForecasts: { ...state.managerForecasts, ...defaults },
      forecastStatuses: { ...state.forecastStatuses, [statuses.key]: 'validated' },
      productNeedsStatuses: { ...state.productNeedsStatuses, [statuses.key]: 'waiting-for-sales' },
      supplierOrderStatuses: { ...state.supplierOrderStatuses, [statuses.key]: 'not-prepared' },
    });
    setEditing(false);
    notify('Sales forecast validated. Product requirements can now be calculated.');
  };
  const edit = () => setEditing(true);
  return <section className="card plannerSheet workflowPanel">
    <div className="cardHead cocoaHead"><div><span className="eyebrow light">STEP 2 · MANAGER DECISION</span><h2>Validate expected sales</h2><p>Review the system suggestion, override it when needed, then validate the seven-day forecast.</p></div><StatusBadge status={statuses.forecast.replace('-', ' ')} /></div>
    <div className="tableWrap"><table className="responsiveTable"><thead><tr><th>Day</th><th>Weather</th><th>Historical sales</th><th>Weather impact</th><th>Suggested sales</th><th className="yourForecast">Manager forecast</th><th>Status / details</th></tr></thead><tbody>{days.map((day) => {
      const changed = day.managerForecast !== day.suggestedSales;
      return <tr key={day.date}>
        <td data-label="Day"><b>{new Date(`${day.date}T12:00:00`).toLocaleDateString('en-US', { weekday: 'long' })}</b><small>{day.date}</small></td>
        <td data-label="Weather"><b>{day.temperature}°F</b><small>{weatherLabel[day.weather]} · demo</small></td>
        <td data-label="Historical sales" className="numeric"><b>{currency(day.historicalSales)}</b><small>4 comparable {new Date(`${day.date}T12:00:00`).toLocaleDateString('en-US', { weekday: 'long' })}s</small></td>
        <td data-label="Weather impact" className={`numeric ${day.weatherAdjustment > 0 ? 'impactPositive' : day.weatherAdjustment < 0 ? 'impactNegative' : ''}`}><b>{day.weatherAdjustment > 0 ? '+' : ''}{day.weatherAdjustment}%</b><small>Current business rule</small></td>
        <td data-label="Suggested sales" className="numeric"><b>{currency(day.suggestedSales)}</b><small>{currency(day.historicalSales)} × {(1 + day.weatherAdjustment / 100).toFixed(2)}</small></td>
        <td data-label="Manager forecast" className="yourForecast"><input className="forecastInput" type="number" min="0" value={day.managerForecast} disabled={locked} onChange={(event) => changeForecast(day.date, Number(event.target.value))} aria-label={`Manager forecast ${day.date}`} />{changed && <small>System suggestion: {currency(day.suggestedSales)}</small>}</td>
        <td data-label="Status / details"><StatusBadge status={statuses.forecast.replace('-', ' ')} /><details className="calcDetails"><summary><Info /> How calculated</summary><div><span>Historical average <b>{currency(day.historicalSales)}</b></span><span>Weather adjustment <b>{day.weatherAdjustment}%</b></span><span>Calculated forecast <b>{currency(day.suggestedSales)}</b></span><small>Average of 4 comparable weekdays · demo data</small></div></details></td>
      </tr>;
    })}</tbody></table></div>
    <div className="cardFoot"><span>Manager forecasts are saved locally as demo data.</span><div className="controls">{locked ? <button className="btn" onClick={edit}>Edit forecast</button> : <><button className="btn" onClick={() => notify('Draft saved locally.')}>Save Draft</button><button className="btn primary" onClick={validate}>Validate Sales Forecast <ChevronRight /></button></>}</div></div>
    {locked && <div className="successLine"><Check /> Sales forecast validated. Product requirements can now be calculated.</div>}
  </section>;
}

function LockedStep({ number: step, title, text, compact = false }: { number: number; title: string; text: string; compact?: boolean }) {
  return <section className={`lockedStep ${compact ? 'compactLocked' : ''}`} aria-disabled="true"><span><LockKeyhole /></span><div><small>STEP {step} · PENDING</small><h2>{title}</h2><p>{text}</p></div></section>;
}

function ProductNeedsPanel({ state, update, notify }: ScreenProps & { notify: (text: string) => void }) {
  const statuses = getStatuses(state);
  const calculated = statuses.needs === 'calculated';
  const validatedSales = weeklyForecast(state)[0].managerForecast;
  const calculate = () => {
    update({
      productNeedsStatuses: { ...state.productNeedsStatuses, [statuses.key]: 'calculated' },
      supplierOrderStatuses: { ...state.supplierOrderStatuses, [statuses.key]: 'draft' },
      manualQuantities: {
        ...state.manualQuantities,
        ...Object.fromEntries(products.map((product) => [manualKeyFor(state.date, state.locationId, product.id), productNeed(state, product).suggestedCases])),
      },
    });
    notify('Product needs calculated from the validated sales forecast. Supplier orders are ready for manager review.');
  };
  return <section className="card workflowPanel needsPanel">
    <div className="cardHead"><div><span className="eyebrow">STEP 3 · PRODUCT CONSUMPTION</span><h2>Calculate product needs</h2><p>Validated sales → expected use → safety stock → inventory → net requirement → full cases.</p></div><StatusBadge status={calculated ? 'calculated' : statuses.needs.replaceAll('-', ' ')} /></div>
    <div className="horizonNotice"><CalendarDays /><div><b>Requirement horizon: selected day only (demo)</b><span>Delivery schedule to configure. The architecture can replace this with current date → next confirmed supplier delivery.</span></div></div>
    {!calculated ? <div className="calculateGate"><div><b>{currency(validatedSales)} validated sales</b><span>Ready to apply each product’s consumption ratio and inventory position.</span></div><button className="btn primary" onClick={calculate}>Calculate Product Needs <ArrowRight /></button></div> : <div className="tableWrap"><table className="responsiveTable needsTable"><thead><tr><th>Product</th><th>Validated sales × ratio</th><th>Expected + safety</th><th>Inventory position</th><th>Net requirement</th><th>Case conversion</th></tr></thead><tbody>{products.map((product) => {
      const need = productNeed(state, product);
      return <tr key={product.id}>
        <td data-label="Product"><div className="product"><span className="productIcon"><PackageOpen /></span><span><b>{product.name}</b><small>{product.supplier}</small></span></div></td>
        <td data-label="Validated sales × ratio"><b>{currency(need.validatedSales)}</b><small>{product.consumptionRatio} {product.unitLabel} / $1,000</small></td>
        <td data-label="Expected + safety"><b>{number(need.expectedConsumption)} {product.unitLabel}</b><small>+{number(need.safetyStockUnits)} safety ({product.safetyStockPercent}%)</small></td>
        <td data-label="Inventory position"><b>−{number(need.onHandUnits)} on hand</b><small>−{number(need.incomingUnits)} confirmed incoming</small></td>
        <td data-label="Net requirement"><b>{number(need.netRequirement)} {product.unitLabel}</b><small>Never below zero</small></td>
        <td data-label="Case conversion"><b>{need.suggestedCases} cases</b><small>{number(need.netRequirement)} ÷ {need.unitsPerCase}, rounded up</small><details className="calcDetails whyCases"><summary><Info /> Why {need.suggestedCases} cases?</summary><div><span>Validated sales <b>{currency(need.validatedSales)}</b></span><span>Consumption ratio <b>{product.consumptionRatio} / $1,000</b></span><span>Expected use <b>{number(need.expectedConsumption)}</b></span><span>Safety stock <b>+{number(need.safetyStockUnits)}</b></span><span>On hand <b>−{number(need.onHandUnits)}</b></span><span>Incoming <b>−{number(need.incomingUnits)}</b></span><span className="calcTotal">Net need <b>{number(need.netRequirement)}</b></span><span>Case size <b>{need.unitsPerCase}</b></span><span className="calcOrder">ORDER <b>{need.suggestedCases} CASES</b></span></div></details></td>
      </tr>;
    })}</tbody></table></div>}
  </section>;
}

function SupplierOrderGroups({ state, update, openReview }: ScreenProps & { openReview: () => void }) {
  const suppliers = [...new Set(products.map((product) => product.supplier))];
  const statuses = getStatuses(state);
  const setQuantity = (product: Product, quantity: number) => update({
    manualQuantities: { ...state.manualQuantities, [manualKeyFor(state.date, state.locationId, product.id)]: Math.max(0, Math.min(9999, Math.round(quantity || 0))) },
    supplierOrderStatuses: { ...state.supplierOrderStatuses, [statuses.key]: 'draft' },
  });
  return <section className="workflowPanel supplierWorkflow"><div className="sectionHeading"><div><span className="eyebrow">STEP 4 · RESTAURANT ORDER</span><h2>Prepare supplier orders</h2><p>Edit final whole-case quantities. No order will be sent in this demo.</p></div><StatusBadge status={statuses.order.replaceAll('-', ' ')} /></div><div className="supplierOrders">{suppliers.map((supplier) => {
    const items = products.filter((product) => product.supplier === supplier);
    return <section className={`supplierGroup ${supplier === 'Artimex' ? 'artimex' : ''}`} key={supplier}><div className="supplierBanner"><div><span>{supplier === 'Artimex' ? 'FROZEN BAKERY SUPPLIER' : 'DEMO SUPPLIER'}</span><h2>{supplier}</h2></div><div><b>Next delivery: to configure</b><small>{items.length} products · schedule not assumed</small></div></div><div className="card"><div className="tableWrap"><table className="responsiveTable orderTable"><thead><tr><th>Product</th><th>Need</th><th>Packaging</th><th>Suggested</th><th>Manager order</th><th>Adjustment</th></tr></thead><tbody>{items.map((product) => {
      const need = productNeed(state, product);
      const quantity = plannedQuantity(state, product);
      const difference = quantity - need.suggestedCases;
      return <tr key={product.id}><td data-label="Product"><b>{product.name}</b></td><td data-label="Need">{number(need.netRequirement)} {product.unitLabel}</td><td data-label="Packaging">{product.unitsPerCase} {product.unitLabel}/case</td><td data-label="Suggested"><b>{need.suggestedCases} cases</b></td><td data-label="Manager order"><div className="quantity"><button aria-label={`Decrease ${product.name}`} onClick={() => setQuantity(product, quantity - 1)}>−</button><input aria-label={`Order quantity ${product.name}`} type="number" min="0" max="9999" value={quantity} onChange={(event) => setQuantity(product, Number(event.target.value))} /><button aria-label={`Increase ${product.name}`} onClick={() => setQuantity(product, quantity + 1)}>+</button></div></td><td data-label="Adjustment"><span className={difference === 0 ? 'muted' : difference > 0 ? 'impactPositive' : 'impactNegative'}>{difference > 0 ? '+' : ''}{difference} cases</span></td></tr>;
    })}</tbody></table></div></div></section>;
  })}</div><div className="orderActionBar"><div><b>Order prepared</b><span>{currency(orderTotal(state))} estimated demo value · ready for approval, not sending</span></div><button className="btn primary" onClick={openReview}>Validate Supplier Order <ChevronRight /></button></div></section>;
}

function Forecast({ state, update, notify }: ScreenProps & { notify: (text: string) => void }) {
  const location = locations.find((item) => item.id === state.locationId)!;
  return <><ScreenTitle state={state} update={update} title={`Sales Forecast — ${location.name}`} subtitle="Understand the weather rule, set manager expectations and validate before calculating product needs." controls={false} /><WorkflowSteps state={state} /><DemoNotice /><OliviaBrief module="forecast" state={state} compact /><WeatherStrip state={state} /><ForecastPanel state={state} update={update} notify={notify} /></>;
}

function Orders({ state, update, notify, openReview }: ScreenProps & { notify: (text: string) => void; openReview: () => void }) {
  const statuses = getStatuses(state);
  return <><ScreenTitle state={state} update={update} title="Product Needs & Supplier Orders" subtitle="Restaurant demand only: validated sales become product needs, then manager-approved supplier quantities." controls={false} /><WorkflowSteps state={state} /><DemoNotice /><OliviaBrief module="orders" state={state} />{statuses.forecast === 'validated' ? <ProductNeedsPanel state={state} update={update} notify={notify} /> : <LockedStep number={3} title="Waiting for validated sales" text="Return to Sales Forecast and validate the manager forecast. No final supplier quantities have been created." />}{statuses.needs === 'calculated' && statuses.forecast === 'validated' ? <SupplierOrderGroups state={state} update={update} openReview={openReview} /> : <LockedStep number={4} title="Supplier orders are not prepared" text="Calculate product needs first. Suggestions remain hidden until the required validation is complete." />}</>;
}

function Inventory({ state, update }: ScreenProps) {
  const statuses = getStatuses(state);
  const setStock = (product: Product, value: number) => {
    const nextStatuses = statuses.forecast === 'validated' && statuses.needs === 'calculated' ? { ...state.productNeedsStatuses, [statuses.key]: 'recalculation-required' as ProductNeedsStatus } : state.productNeedsStatuses;
    update({ stocks: { ...state.stocks, [keyFor(state.locationId, product.id)]: Math.max(0, Math.floor(value || 0)) }, productNeedsStatuses: nextStatuses, supplierOrderStatuses: { ...state.supplierOrderStatuses, [statuses.key]: 'not-prepared' } });
  };
  return <><ScreenTitle state={state} update={update} title="Inventory Inputs" subtitle="Count stock in product units; the validated workflow converts the resulting need into full supplier cases." /><DemoNotice /><OliviaBrief module="inventory" state={state} compact /><section className="card"><div className="cardHead"><div><h2>Stock on hand</h2><p>Changing inventory after calculation requires product needs to be recalculated.</p></div><span className="pill">SAVED LOCALLY</span></div><div className="tableWrap"><table className="responsiveTable"><thead><tr><th>Product</th><th>Supplier</th><th>On hand</th><th>Confirmed incoming</th><th>Planning status</th></tr></thead><tbody>{products.map((product) => <tr key={product.id}><td data-label="Product"><b>{product.name}</b><small>{product.unitsPerCase} {product.unitLabel}/case</small></td><td data-label="Supplier">{product.supplier}</td><td data-label="On hand"><input className="numberInput" type="number" min="0" value={stockOnHand(state, product)} onChange={(event) => setStock(product, Number(event.target.value))} /> {product.unitLabel}</td><td data-label="Confirmed incoming">{product.incomingUnits} {product.unitLabel}</td><td data-label="Planning status"><StatusBadge status={statuses.needs.replaceAll('-', ' ')} /></td></tr>)}</tbody></table></div></section></>;
}

function FrozenBreadPlanner({ state, update, notify }: ScreenProps & { notify: (text: string) => void }) {
  const validated = state.forecastStatuses[planKey(state.date, state.locationId)] === 'validated';
  const rows = frozenProducts.map((product) => ({ product, inventory: frozenInventoryFor(state, product.id), need: calculateFrozenBreadNeed(state, product) }));
  const total = (field: 'frozenQty' | 'thawingQty' | 'readyQty') => rows.reduce((sum, row) => sum + row.inventory[field], 0);
  const expected = rows.reduce((sum, row) => sum + row.need.expectedNeed, 0);
  const shortage = rows.reduce((sum, row) => sum + row.need.shortage, 0);
  const plannedBatches = state.thawBatches.filter((batch) => batch.locationId === state.locationId && batch.status === 'planned');
  const markThawing = (id: string) => {
    const batch = state.thawBatches.find((item) => item.id === id); if (!batch) return;
    const key = frozenKeyFor(batch.locationId, batch.productId); const inventory = state.frozenInventories[key];
    const moved = Math.min(batch.quantity, inventory.frozenQty);
    update({ frozenInventories: { ...state.frozenInventories, [key]: { ...inventory, frozenQty: inventory.frozenQty - moved, thawingQty: inventory.thawingQty + moved } }, thawBatches: state.thawBatches.map((item) => item.id === id ? { ...item, quantity: moved, status: 'thawing' } : item) });
    notify(`${moved} units moved from Frozen to Thawing. Olivia One updated the readiness timing.`);
  };
  const setOrder = (product: FrozenProduct, quantity: number) => update({ frozenManualQuantities: { ...state.frozenManualQuantities, [frozenManualKeyFor(state.date, state.locationId, product.id)]: Math.max(0, Math.round(quantity || 0)) } });
  const validateOrder = () => {
    const quantities = Object.fromEntries(frozenProducts.map((product) => [product.id, frozenPlannedCases(state, product)]));
    update({ frozenOrders: [...state.frozenOrders.filter((order) => !(order.locationId === state.locationId && order.date === state.date)), { locationId: state.locationId, date: state.date, quantities, status: 'validated', confirmedAt: new Date().toISOString() }] });
    notify('Artimex replenishment validated and included in the Frozen Bread demo consolidation. Nothing was transmitted.');
  };
  return <><ScreenTitle state={state} update={update} eyebrow="FROZEN BREAD · DEMO MODULE" title="Frozen Bread Planner" subtitle="Plan thawing, protect service availability and prepare Artimex replenishment." /><DemoNotice />
    {!validated ? <section className="lockedStep" aria-disabled="true"><span><LockKeyhole /></span><div><small>STEP 1 · PENDING</small><h2>Sales forecast validation required</h2><p>Sales forecast must be validated before frozen bread planning can be calculated.</p><a className="btn primary" href="#forecast">Go to Sales Forecast <ChevronRight /></a></div></section> : <>
      <div className="frozenKpis"><SummaryItem label="Frozen Stock" value={`${number(total('frozenQty'))} units`} /><SummaryItem label="Currently Thawing" value={`${number(total('thawingQty'))} units`} /><SummaryItem label="Tomorrow Expected Need" value={`${number(expected)} units`} /><SummaryItem label="Shortage Risk" value={`${number(shortage)} units`} tone={shortage > 0 ? 'negative' : 'positive'} /></div>
      <OliviaBrief module="frozen-bread" state={state} compact />
      <section className="card frozenTable"><div className="cardHead"><div><span className="eyebrow">RESTAURANT365 DEMO FEED</span><h2>Frozen inventory and usable supply</h2><p>Frozen units are excluded when there is not enough time to complete the 8-hour thaw before demand.</p></div><span className="pill amber">DEMO DATA</span></div><div className="tableWrap"><table className="responsiveTable"><thead><tr><th>Product</th><th>Frozen</th><th>Thawing</th><th>Ready</th><th>Incoming</th><th>Expected need</th><th>Projected available</th><th>Shortage / surplus</th><th>Status</th></tr></thead><tbody>{rows.map(({ product, inventory, need }) => <tr key={product.id}><td data-label="Product"><b>{product.name}</b><small>{product.thawHours}-hour thaw · {product.unitsPerCase}/case</small></td><td data-label="Frozen">{number(inventory.frozenQty)}</td><td data-label="Thawing">{number(inventory.thawingQty)}</td><td data-label="Ready">{number(inventory.readyQty)}</td><td data-label="Incoming">{number(inventory.incomingQty)}</td><td data-label="Expected need"><b>{number(need.expectedNeed)}</b><small>{new Date(frozenDemandTime(state.date, product)).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}</small></td><td data-label="Projected available">{number(need.projectedAvailable)}<small>Frozen usable: {need.frozenUsable}</small></td><td data-label="Shortage / surplus" className={need.shortage ? 'impactNegative' : 'impactPositive'}><b>{need.shortage ? `−${number(need.shortage)}` : `+${number(need.projectedAvailable - need.expectedNeed - need.safetyStock)}`}</b></td><td data-label="Status"><StatusBadge status={need.status} /></td></tr>)}</tbody></table></div></section>
      <section className="card thawPlan"><div className="cardHead"><div><span className="eyebrow">TOMORROW THAW PLAN</span><h2>Move product at the right time</h2><p>Each batch becomes usable only after its product-specific thaw duration.</p></div><span className="pill">8-HOUR RULE</span></div>{plannedBatches.map((batch) => { const product = frozenProducts.find((item) => item.id === batch.productId)!; return <div className="thawLine" key={batch.id}><b>{new Date(batch.thawStart).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}</b><span><strong>{product.name}</strong><small>Move {batch.quantity} units Frozen → Thawing · ready {new Date(batch.readyAt).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}</small></span><button className="btn primary" onClick={() => markThawing(batch.id)}>Mark as Thawing</button></div>; })}{!plannedBatches.length && <p className="emptyInline">All demo thaw batches have been started.</p>}</section>
      <section className="card replenishment"><div className="cardHead"><div><span className="eyebrow">ARTIMEX REPLENISHMENT</span><h2>Suggested replenishment order</h2><p>Manager quantities round shortages up to complete Artimex cases. No order is sent in this demo.</p></div><StatusBadge status={state.frozenOrders.some((order) => order.locationId === state.locationId && order.date === state.date) ? 'validated' : 'suggested'} /></div><div className="tableWrap"><table className="responsiveTable"><thead><tr><th>Product</th><th>Shortage</th><th>Case size</th><th>Suggested</th><th>Manager order</th><th>Why?</th></tr></thead><tbody>{rows.filter(({ need }) => need.shortage > 0).map(({ product, need }) => { const manager = frozenPlannedCases(state, product); return <tr key={product.id}><td data-label="Product"><b>{product.name}</b></td><td data-label="Shortage">{number(need.shortage)} units</td><td data-label="Case size">{product.unitsPerCase} units</td><td data-label="Suggested"><b>{need.suggestedCases} cases</b></td><td data-label="Manager order"><input className="numberInput" aria-label={`Frozen order quantity ${product.name}`} type="number" min="0" value={manager} onChange={(event) => setOrder(product, Number(event.target.value))} /> cases</td><td data-label="Why?"><details className="calcDetails"><summary><Info /> Why {need.suggestedCases} cases?</summary><div><span>Tomorrow demand <b>{need.expectedNeed}</b></span><span>Safety stock <b>+{need.safetyStock}</b></span><span>Ready <b>−{need.readyQty}</b></span><span>Thawing ready in time <b>−{need.thawingUsable}</b></span><span>Frozen usable in time <b>−{need.frozenUsable}</b></span><span>Incoming in time <b>−{need.incomingUsable}</b></span><span className="calcTotal">Shortage <b>{need.shortage}</b></span><span>Case size <b>{product.unitsPerCase}</b></span><span className="calcOrder">ORDER <b>{need.suggestedCases} CASES</b></span></div></details></td></tr>; })}</tbody></table></div><div className="cardFoot"><span>Validated replenishment is included in Artimex production planning as a Frozen Planner source.</span><button className="btn primary" onClick={validateOrder}>Validate Artimex Order <ChevronRight /></button></div></section>
      <section className="card r365Feed"><div className="cardHead"><div><span className="eyebrow">RESTAURANT365 INVENTORY FEED</span><h2>Demo adapter and product mapping</h2><p>Simulated external data, structured for a future provider replacement.</p></div><span className="pill amber">DEMO MODE</span></div><div className="tableWrap"><table className="responsiveTable"><thead><tr><th>SKU</th><th>Product</th><th>On hand</th><th>Last count</th><th>Received</th><th>Waste</th><th>Last updated</th></tr></thead><tbody>{demoRestaurant365Feed.filter((item) => item.locationId === state.locationId).map((item) => <tr key={item.sku}><td data-label="SKU">{item.sku}</td><td data-label="Product">{item.productName}</td><td data-label="On hand">{item.onHand}</td><td data-label="Last count">{item.lastCount}</td><td data-label="Received">{item.received}</td><td data-label="Waste">{item.waste}</td><td data-label="Last updated">{item.lastUpdated}</td></tr>)}</tbody></table></div><div className="mappingList">{inventoryMappings.map((mapping) => <span key={mapping.r365Sku}><b>{mapping.r365Sku}</b> → {frozenProducts.find((product) => product.id === mapping.frozenProductId)?.name} → {mapping.artimexProductName}</span>)}</div></section>
    </>}</>;
}

function Suppliers({ state }: { state: PlannerState }) {
  const groups = [...new Set(products.map((product) => product.supplier))];
  return <><ScreenTitle state={state} update={() => undefined} title="Your Supply Network" subtitle="Supplier packaging is configured; delivery calendars still require confirmation." controls={false} /><DemoNotice /><div className="supplierGrid">{groups.map((supplier) => <section className="card supplierCard" key={supplier}><span className="productIcon"><Truck /></span><h2>{supplier}</h2><p>{products.filter((product) => product.supplier === supplier).map((product) => product.name.split(' · ')[0]).join(', ')}.</p><span className="pill">{products.filter((product) => product.supplier === supplier).length} demo products</span><p className="tiny">Delivery schedule and cutoff: to configure.</p><a className="btn" href={supplier === 'Artimex' ? '#consolidation' : '#orders'}>View planning <ChevronRight /></a></section>)}</div></>;
}

function Analytics({ state, update }: ScreenProps) {
  const rows = weeklyForecast(state);
  const statuses = getStatuses(state);
  const max = Math.max(...rows.map((day) => day.managerForecast));
  return <><ScreenTitle state={state} update={update} eyebrow="OPERATIONS INTELLIGENCE" title="Forecast Analytics" subtitle="A focused view of expected sales; downstream quantities appear only after validation." controls={false} /><DemoNotice /><OliviaBrief module="analytics" state={state} /><div className="analyticsGrid"><section className="card barPanel"><div className="cardHead"><div><h2>Seven-day manager forecast</h2><p>Demo sales · USD</p></div><StatusBadge status={statuses.forecast.replace('-', ' ')} /></div><div className="barList">{rows.map((day) => <div className="barRow" key={day.date}><span>{new Date(`${day.date}T12:00:00`).toLocaleDateString('en-US', { weekday: 'short' })}</span><i><b style={{ width: `${day.managerForecast / max * 100}%` }} /></i><strong>{currency(day.managerForecast)}</strong></div>)}</div></section><section className="card padded workflowHealth"><span className="eyebrow">WORKFLOW HEALTH</span><h2>{statuses.forecast === 'validated' ? 'Sales are validated' : 'Validation required'}</h2><p>{statuses.forecast === 'validated' ? 'The forecast can support product calculations.' : 'Product needs and supplier quantities remain intentionally unavailable.'}</p><a className="btn primary" href="#forecast">Open sales forecast <ArrowRight /></a></section></div></>;
}

function Corporate({ state, update }: ScreenProps) {
  return <><ScreenTitle state={state} update={update} eyebrow="CORPORATE WORKSPACE" title="Every Location. One Clear View." subtitle="Validated restaurant orders are distinct from Artimex production planning." controls={false} /><DemoNotice /><section className="card"><div className="cardHead"><div><h2>Restaurant workflow overview</h2><p>{dateLabel(state.date)}</p></div><a className="btn" href="#consolidation">Open Artimex consolidation <ArrowRight /></a></div><div className="tableWrap"><table className="responsiveTable"><thead><tr><th>Restaurant</th><th>Sales forecast</th><th>Restaurant order</th><th>Artimex cases</th><th>Artimex status</th><th /></tr></thead><tbody>{locations.map((location) => {
    const order = state.orders.find((item) => item.locationId === location.id && item.date === state.date && item.status === 'validated');
    const artimexCases = products.filter((product) => product.supplier === 'Artimex').reduce((sum, product) => sum + (order?.quantities[product.id] ?? 0), 0);
    const forecastStatus = state.forecastStatuses[planKey(state.date, location.id)] ?? (order ? 'validated' : 'draft');
    return <tr key={location.id}><td data-label="Restaurant"><b>{location.name}</b></td><td data-label="Sales forecast"><StatusBadge status={forecastStatus.replace('-', ' ')} /></td><td data-label="Restaurant order"><StatusBadge status={order ? 'validated' : 'not prepared'} /></td><td data-label="Artimex cases"><b>{order ? artimexCases : '—'}</b></td><td data-label="Artimex status"><StatusBadge status={order ? 'included in consolidation' : 'not included'} /></td><td><a className="textLink" href="#dashboard" onClick={() => update({ locationId: location.id })}>Open →</a></td></tr>;
  })}</tbody></table></div></section></>;
}

function Consolidation({ state, update, notify }: ScreenProps & { notify: (text: string) => void }) {
  const artimexProducts = products.filter((product) => product.supplier === 'Artimex');
  const consolidation = artimexConsolidation(state.orders, state.date);
  const includedRows = consolidation.rows.filter((row) => row.included);
  const exportCsv = () => {
    const quote = (value: string | number) => `"${String(value).replaceAll('"', '""')}"`;
    const lines = [['Date', 'Location', ...artimexProducts.map((product) => `${product.name} cases`), 'Status'], ...includedRows.map((row) => [state.date, row.location.name, ...artimexProducts.map((product) => row.quantities[product.id]), 'Validated'])];
    const url = URL.createObjectURL(new Blob([lines.map((line) => line.map(quote).join(',')).join('\r\n')], { type: 'text/csv;charset=utf-8' }));
    const anchor = document.createElement('a'); anchor.href = url; anchor.download = `artimex-validated-plan-${state.date}.csv`; anchor.click(); URL.revokeObjectURL(url); notify('Validated Artimex planning CSV exported for review.');
  };
  return <><ScreenTitle state={state} update={update} eyebrow="STEP 5 · CORPORATE WORKSPACE" title="Artimex Production Consolidation" subtitle="Validated restaurant orders are aggregated first; Artimex inventory and safety margin then determine production." controls={false} /><WorkflowSteps state={state} /><DemoNotice /><section className="separationCallout"><div><b>RESTAURANTS ORDER PRODUCT</b><span>Sales → consumption → net need → supplier cases</span></div><ArrowRight /><div><b>ARTIMEX PLANS PRODUCTION</b><span>Validated network demand → inventory → production</span></div></section><section className="card consolidationCard"><div className="cardHead"><div><h2>Validated restaurant demand</h2><p>{dateLabel(state.date)} · only validated orders · no draft estimates</p></div><button className="btn" onClick={exportCsv}><Download /> Export validated CSV</button></div><div className="tableWrap"><table className="responsiveTable"><thead><tr><th>Restaurant</th>{artimexProducts.map((product) => <th key={product.id}>{product.name.split(' · ')[0]}</th>)}<th>Total</th><th>Status</th></tr></thead><tbody>{consolidation.rows.map((row) => <tr key={row.location.id}><td data-label="Restaurant"><b>{row.location.name}</b></td>{artimexProducts.map((product) => <td data-label={product.name} key={product.id}>{row.included ? row.quantities[product.id] : '—'}</td>)}<td data-label="Total"><b>{row.included ? artimexProducts.reduce((sum, product) => sum + row.quantities[product.id], 0) : '—'}</b></td><td data-label="Status"><StatusBadge status={row.included ? 'included in consolidation' : 'not included'} /></td></tr>)}<tr className="totalRow"><td data-label="Restaurant"><b>TOTAL VALIDATED</b></td>{artimexProducts.map((product) => <td data-label={product.name} key={product.id}><b>{consolidation.totals[product.id]}</b></td>)}<td data-label="Total"><b>{Object.values(consolidation.totals).reduce((sum, value) => sum + value, 0)}</b></td><td /></tr></tbody></table></div></section><div className="productionGrid">{artimexProducts.map((product) => {
    const inputs = artimexProductionInputs[product.id];
    const result = calculateArtimexProduction(consolidation.totals[product.id], inputs.safetyMarginPercent, inputs.frozenInventoryCases, inputs.alreadyPlannedCases);
    return <section className="card productionCard" key={product.id}><div><span className="eyebrow">ARTIMEX PRODUCTION</span><h2>{product.name.split(' · ')[0]}</h2><StatusBadge status="production planned" /></div><div className="productionFormula"><span>Validated restaurant demand <b>{result.restaurantDemand}</b></span><span>Safety margin ({inputs.safetyMarginPercent}%) <b>+{result.safetyMargin}</b></span><span>Frozen stock available <b>−{result.frozenInventory}</b></span><span>Already planned production <b>−{result.alreadyPlannedProduction}</b></span><span className="productionTotal">Production required <b>{result.productionRequired} cases</b></span></div></section>;
  })}</div><div className="bottomNote">Production results are demo planning figures. No factory system or Global Bake integration is connected.</div></>;
}

function OrderHistory({ state }: { state: PlannerState }) {
  return <><ScreenTitle state={state} update={() => undefined} title="Decision History" subtitle="Validated demo supplier orders saved in this browser." controls={false} /><DemoNotice /><section className="card">{state.history.length ? <div className="tableWrap"><table className="responsiveTable"><thead><tr><th>Order</th><th>Restaurant</th><th>Planning date</th><th>Cases</th><th>Estimated total</th><th>Status</th></tr></thead><tbody>{state.history.map((order, index) => <tr key={`${order.id}-${index}`}><td data-label="Order">{order.id}</td><td data-label="Restaurant">{locations.find((location) => location.id === order.locationId)?.name}</td><td data-label="Planning date">{order.date}</td><td data-label="Cases">{Object.values(order.quantities).reduce((sum, value) => sum + value, 0)}</td><td data-label="Estimated total">{currency(order.amount)}</td><td data-label="Status"><StatusBadge status="validated" /></td></tr>)}</tbody></table></div> : <div className="empty"><History /><h2>No manager orders validated yet</h2><p>Complete the restaurant workflow to create a demo order.</p><a className="btn primary" href="#dashboard">Open weekly planning <ChevronRight /></a></div>}</section></>;
}

function Rules({ state, update, requestReset, notify }: ScreenProps & { requestReset: () => void; notify: (text: string) => void }) {
  const [draft, setDraft] = useState({ veryHot: state.veryHotAdjustment, hot: state.hotAdjustment, cold: state.coldAdjustment });
  const submit = (event: { preventDefault: () => void }) => {
    event.preventDefault();
    update({ veryHotAdjustment: draft.veryHot, hotAdjustment: draft.hot, coldAdjustment: draft.cold });
    notify('Current business rules saved. Unvalidated demo forecasts now use the new adjustments.');
  };
  return <><ScreenTitle state={state} update={update} title="Rules & Settings" subtitle="Configure Charles’s provisional weather assumptions. These are business rules, not trained predictions." controls={false} /><DemoNotice /><form className="card padded" onSubmit={submit}><span className="eyebrow">CURRENT BUSINESS RULE</span><h2>Weather adjustment</h2><p className="sub">Replace these sample rules when real restaurant weather elasticity is available.</p><div className="formGrid"><label>Very hot adjustment (%)<input type="number" min="-90" max="0" required value={draft.veryHot} onChange={(event) => setDraft({ ...draft, veryHot: Number(event.target.value) })} /></label><label>Hot adjustment (%)<input type="number" min="-90" max="0" required value={draft.hot} onChange={(event) => setDraft({ ...draft, hot: Number(event.target.value) })} /></label><label>Cold adjustment (%)<input type="number" min="0" max="100" required value={draft.cold} onChange={(event) => setDraft({ ...draft, cold: Number(event.target.value) })} /></label></div><div className="formula"><b>Forecast Sales</b> = Historical Comparable Sales × (1 + Weather Adjustment)<br /><b>Product Need</b> = max(0, Expected Consumption + Safety Stock − On Hand − Confirmed Incoming)<br /><b>Cases</b> = ceil(Net Requirement ÷ Units Per Case)</div><div className="cardFoot"><span>Mild weather remains 0% · demo configuration</span><button className="btn primary" type="submit">Save business rules</button></div></form><section className="card integrationCard"><div><span className="eyebrow">INTEGRATIONS</span><h2>Restaurant365</h2><p>Connection: <b>DEMO MODE</b> · Simulated inventory feed · Last sync: 10:42 AM</p><small>10 locations · 6 mapped frozen bread products · no live Restaurant365 connection</small></div><a className="btn" href="#frozen-bread">View Integration <ChevronRight /></a></section><section className="card resetCard"><div><h2>Local demo data</h2><p>Clear manager forecasts, stock edits, order adjustments and history.</p></div><button className="btn dangerOutline" onClick={requestReset}><RotateCcw /> Reset demo data</button></section></>;
}

function OrderReview({ state, close, confirm }: { state: PlannerState; close: () => void; confirm: () => void }) {
  return <Modal close={close}><div className="eyebrow">ORDER READY FOR APPROVAL</div><h2>{locations.find((location) => location.id === state.locationId)?.name}</h2><p>Validate these restaurant supplier quantities for {dateLabel(state.date)}. This action does not send an order.</p>{products.map((product) => { const need = productNeed(state, product); const manager = plannedQuantity(state, product); return <div className="reviewLine" key={product.id}><span>{product.name}<small>Suggested {need.suggestedCases} · adjustment {manager - need.suggestedCases >= 0 ? '+' : ''}{manager - need.suggestedCases}</small></span><b>{manager} cases</b></div>; })}<div className="reviewLine"><strong>Estimated demo total</strong><strong>{currency(orderTotal(state))}</strong></div><p className="tiny">Validation includes the Artimex items in corporate consolidation. No supplier integration exists and nothing is transmitted.</p><div className="dialogButtons"><button className="btn" onClick={close}><ChevronLeft /> Back</button><button className="btn primary" onClick={confirm}>Validate Supplier Order</button></div></Modal>;
}

const moduleGuidance: Record<Route, string> = {
  dashboard: 'Start with expected sales. Product and supplier quantities remain locked until manager validation.',
  forecast: 'Compare equivalent weekdays, review the current weather rule and validate the manager forecast.',
  analytics: 'Use the forecast pattern as context; downstream operational quantities still require validation.',
  orders: 'Check every units-to-cases explanation before approving supplier quantities.',
  inventory: 'Record stock in product units so case conversion remains transparent.',
  'frozen-bread': 'Prioritize the batches that need an eight-hour thaw before the next service window, then validate only the replenishment cases still required.',
  suppliers: 'Configure delivery calendars before expanding the requirement horizon beyond the selected day.',
  corporate: 'Restaurant orders and Artimex production are separate decisions.',
  consolidation: 'Only validated restaurant orders belong in Artimex demand.',
  history: 'Use overrides to identify business rules that need future calibration.',
  settings: 'These weather adjustments are explicit provisional business rules, not AI predictions.',
};

type OliviaInsight = { summary: string; alerts: string[]; opportunities: string[]; recommended_actions: string[]; confidence_note: string };

function localOliviaInsight(module: Route, state: PlannerState): OliviaInsight {
  const days = weeklyForecast(state);
  const statuses = getStatuses(state);
  const sales = days.reduce((sum, day) => sum + day.managerForecast, 0);
  const historical = days.reduce((sum, day) => sum + day.historicalSales, 0);
  const peak = days.reduce((highest, day) => day.managerForecast > highest.managerForecast ? day : highest, days[0]);
  const needs = products.map((product) => productNeed(state, product));
  const artimexCases = products.filter((product) => product.supplier === 'Artimex').reduce((sum, product) => sum + plannedQuantity(state, product), 0);
  if (module === 'forecast' || module === 'dashboard') return {
    summary: `${currency(sales)} is expected for the week. Weather changes the comparable-sales baseline by ${sales - historical >= 0 ? '+' : '−'}${currency(Math.abs(sales - historical))}.`,
    alerts: statuses.forecast === 'validated' ? ['Sales are validated; a change will require downstream needs and orders to be reviewed.'] : ['Sales forecast is still a draft. Product quantities intentionally remain locked.'],
    opportunities: [`${new Date(`${peak.date}T12:00:00`).toLocaleDateString('en-US', { weekday: 'long' })} is the peak forecast day at ${currency(peak.managerForecast)}; confirm staffing and availability before validation.`],
    recommended_actions: [statuses.forecast === 'validated' ? 'Calculate product needs using the validated sales forecast.' : 'Review manager overrides, then validate the seven-day sales forecast.'],
    confidence_note: 'Demo reasoning uses displayed comparable sales and provisional weather rules; it is not a live POS or weather prediction.',
  };
  if (module === 'orders') return {
    summary: statuses.needs === 'calculated' ? `${needs.filter((need) => need.netRequirement > 0).length} products require replenishment. Artimex represents ${artimexCases} planned cases for this restaurant.` : 'Supplier quantities are intentionally unavailable until sales are validated and product needs are calculated.',
    alerts: statuses.needs === 'calculated' ? needs.map((need, index) => ({ need, product: products[index] })).filter(({ need }) => need.netRequirement > 0).slice(0, 2).map(({ need, product }) => `${product.name.split(' · ')[0]}: ${number(need.netRequirement)} units converts to ${need.suggestedCases} complete cases.`) : ['Validate sales first; this prevents orders from being treated as decided too early.'],
    opportunities: ['Use each “Why cases?” explanation to confirm inventory, safety stock, and packaging before approval.'],
    recommended_actions: [statuses.needs === 'calculated' ? 'Review manager case adjustments, then prepare the supplier order for approval.' : 'Return to Sales Forecast to unlock the calculation chain.'],
    confidence_note: 'Demo reasoning follows the visible units, safety stock, inventory, and case-conversion formulas.',
  };
  if (module === 'inventory') return {
    summary: `${products.length} inventory positions are available for review. Stock is held in product units so the supplier case conversion remains auditable.`,
    alerts: statuses.needs === 'calculated' ? ['Changing on-hand inventory now will mark product requirements for recalculation.'] : ['Inventory can be updated now; no calculated order is being changed.'],
    opportunities: [`Prioritize a physical count for ${products[0].name.split(' · ')[0]} before the next supplier approval.`],
    recommended_actions: ['Confirm on-hand counts, then recalculate product needs if the sales forecast has already been validated.'],
    confidence_note: 'Demo reasoning uses locally entered inventory; it is not an inventory-system synchronization.',
  };
  if (module === 'analytics') return {
    summary: `The weekly manager forecast is ${currency(sales)}. ${new Date(`${peak.date}T12:00:00`).toLocaleDateString('en-US', { weekday: 'long' })} is the highest expected-sales day at ${currency(peak.managerForecast)}.`,
    alerts: [`Weather accounts for ${sales - historical >= 0 ? '+' : '−'}${currency(Math.abs(sales - historical))} versus comparable weekday sales.`],
    opportunities: ['Use the peak-day pattern to review labor, production capacity, and fresh inventory before the week starts.'],
    recommended_actions: [statuses.forecast === 'validated' ? 'Use this validated pattern to calculate product needs.' : 'Validate manager sales before treating this pattern as an operational input.'],
    confidence_note: 'Demo reasoning is based only on the displayed forecast and business rules.',
  };
  return {
    summary: moduleGuidance[module], alerts: [], opportunities: [], recommended_actions: ['Review the visible operational inputs before making a manager decision.'],
    confidence_note: 'Demo reasoning is based only on the information shown in this workspace.',
  };
}

function OliviaBrief({ module, state, compact = false }: { module: Route; state: PlannerState; compact?: boolean }) {
  const fallback = useMemo(() => localOliviaInsight(module, state), [module, state]);
  const [insight, setInsight] = useState<OliviaInsight | null>(null);
  const [status, setStatus] = useState<'idle' | 'loading' | 'live-error'>('idle');
  const days = weeklyForecast(state);
  const analyze = async () => {
    if (!apiBase) return;
    setStatus('loading');
    try {
      const response = await api<{ insight: OliviaInsight }>('/api/analytics/insights', { method: 'POST', body: JSON.stringify({ module, restaurantSlug: state.locationId, period: { from: state.date, to: days[days.length - 1].date }, metrics: { forecastSales: days.reduce((sum, day) => sum + day.managerForecast, 0), forecastStatus: getStatuses(state).forecast, products: products.map((product) => ({ name: product.name, onHand: stockOnHand(state, product), suggestedCases: productNeed(state, product).suggestedCases })) } }) });
      setInsight(response.insight); setStatus('idle');
    } catch { setStatus('live-error'); }
  };
  const current = insight ?? fallback;
  return <section className={`aiPanel ${compact ? 'aiCompact' : ''}`} aria-label="Olivia One recommendations"><div className="aiPanelHead"><span className="aiIcon"><BrainCircuit /></span><div><span className="eyebrow">OLIVIA ONE · DECISION SUPPORT</span><h2>{compact ? 'Olivia’s recommended next move' : 'Olivia One operational briefing'}</h2><p>{insight ? 'Live Hugging Face analysis · based on the current workspace inputs' : 'Decision support from the current planning data'}</p></div>{apiBase && <button className="btn" onClick={analyze} disabled={status === 'loading'}>{status === 'loading' ? 'Analyzing…' : 'Refresh AI analysis'}</button>}</div><div className="insightBody"><p className="insightSummary">{current.summary}</p>{current.alerts.length > 0 && <div><h3>Watch</h3><ul>{current.alerts.map((item) => <li key={item}>{item}</li>)}</ul></div>}{!compact && <div><h3>Opportunity</h3><ul>{current.opportunities.map((item) => <li key={item}>{item}</li>)}</ul></div>}<div><h3>Recommended action</h3><ul>{current.recommended_actions.map((item) => <li key={item}>{item}</li>)}</ul></div><small>{status === 'live-error' ? 'Live Hugging Face analysis is unavailable; showing transparent demo reasoning.' : current.confidence_note}</small></div></section>;
}

function Modal({ close, children }: { close: () => void; children: ReactNode }) {
  return <div className="modalBackdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && close()}><section className="modal" role="dialog" aria-modal="true"><button className="modalClose" aria-label="Close" onClick={close}><X /></button>{children}</section></div>;
}
