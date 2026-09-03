import { Router } from 'express';
import { z } from 'zod';
import { auth, canAccessRestaurant, requireRole } from './auth.js';
import { query } from './db.js';
import {
  callOliviaOne,
  buildDashboardContext,
  buildForecastContext,
  buildOrdersContext,
  buildInventoryContext,
  createFallbackResponse,
  oliviaResponseSchema,
} from './olivia.js';

export const analytics = Router();
analytics.use(auth);

// Rate limit cache (user_id -> {count, resetTime})
const rateLimits = new Map<string, { count: number; resetTime: number }>();
const RATE_LIMIT = 10; // per minute
const RATE_WINDOW = 60000; // 1 minute

function checkRateLimit(userId: string): boolean {
  const now = Date.now();
  const limit = rateLimits.get(userId);

  if (!limit || now > limit.resetTime) {
    rateLimits.set(userId, { count: 1, resetTime: now + RATE_WINDOW });
    return true;
  }

  limit.count++;
  if (limit.count > RATE_LIMIT) {
    return false;
  }

  return true;
}

/**
 * GET /api/analytics/summary
 * Aggregated metrics by restaurant, product, supplier
 */
analytics.get('/summary', async (req, res) => {
  const restaurantId = typeof req.query.restaurantId === 'string' ? req.query.restaurantId : undefined;

  if (restaurantId && !canAccessRestaurant(req.user!, restaurantId)) {
    return res.status(403).json({ error: 'Forbidden' });
  }

  if (!restaurantId && req.user!.role === 'manager') {
    return res.status(403).json({ error: 'A restaurant is required' });
  }

  const values = restaurantId ? [restaurantId] : [];
  const where = restaurantId ? 'WHERE r.id=$1' : '';

  const restaurants = await query(
    `SELECT r.id, r.name, 
      coalesce(sum(f.manager_forecast), 0)::float as forecast_sales,
      coalesce(count(o.id) FILTER(WHERE o.status='approved'), 0)::int as approved_orders
    FROM restaurants r
    LEFT JOIN forecasts f ON f.restaurant_id=r.id
    LEFT JOIN orders o ON o.restaurant_id=r.id
    ${where}
    GROUP BY r.id ORDER BY forecast_sales DESC`,
    values,
  );

  const products = await query(
    `SELECT p.id, p.name, p.sku,
      coalesce(sum(oi.retained_quantity), 0)::float as total_quantity,
      coalesce(count(DISTINCT o.restaurant_id), 0)::int as restaurants_ordered
    FROM products p
    LEFT JOIN order_items oi ON oi.product_id=p.id
    LEFT JOIN orders o ON o.id=oi.order_id
    LEFT JOIN restaurants r ON r.id=o.restaurant_id
    ${where}
    GROUP BY p.id ORDER BY total_quantity DESC LIMIT 50`,
    values,
  );

  const suppliers = await query(
    `SELECT s.id, s.name,
      coalesce(sum(oi.retained_quantity), 0)::float as total_quantity,
      coalesce(count(DISTINCT o.id), 0)::int as orders,
      coalesce(count(DISTINCT o.restaurant_id), 0)::int as restaurants
    FROM suppliers s
    LEFT JOIN orders o ON o.supplier_id=s.id
    LEFT JOIN restaurants r ON r.id=o.restaurant_id
    LEFT JOIN order_items oi ON oi.order_id=o.id
    ${where}
    GROUP BY s.id ORDER BY total_quantity DESC LIMIT 50`,
    values,
  );

  res.json({
    generatedAt: new Date().toISOString(),
    restaurants: restaurants.rows,
    products: products.rows,
    suppliers: suppliers.rows,
  });
});

/**
 * POST /api/analytics/insights (Olivia One analysis)
 * Context-aware decision support across modules
 */
const insightRequestSchema = z.object({
  module: z.enum([
    'dashboard',
    'forecast',
    'analytics',
    'orders',
    'inventory',
    'suppliers',
    'corporate',
    'consolidation',
    'history',
    'settings',
  ]),
  restaurantId: z.string().uuid().optional(),
  period: z.object({
    from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  }),
});

analytics.post('/insights', async (req, res) => {
  // Rate limiting
  if (!checkRateLimit(req.user!.id)) {
    return res.status(429).json({ error: 'Too many requests' });
  }

  // Validate input
  const parsed = insightRequestSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: 'Invalid request', details: parsed.error.issues });
  }

  const { module, restaurantId, period } = parsed.data;

  // Check access control
  if (restaurantId && !canAccessRestaurant(req.user!, restaurantId)) {
    return res.status(403).json({ error: 'Forbidden' });
  }

  if (!restaurantId && req.user!.role === 'manager') {
    return res.status(403).json({ error: 'Managers must specify a restaurant' });
  }

  // Corporate/admin modules require admin role
  if (['corporate', 'consolidation'].includes(module)) {
    if (!['admin', 'super_admin'].includes(req.user!.role)) {
      return res.status(403).json({ error: 'Admin access required' });
    }
  }

  try {
    // Build context based on module
    let context;
    switch (module) {
      case 'dashboard':
        context = await buildDashboardContext(restaurantId, req.user!, period);
        break;
      case 'forecast':
        if (!restaurantId) return res.status(400).json({ error: 'Restaurant required for forecast module' });
        context = await buildForecastContext(restaurantId, req.user!, period);
        break;
      case 'orders':
        context = await buildOrdersContext(restaurantId, req.user!, period);
        break;
      case 'inventory':
        if (!restaurantId) return res.status(400).json({ error: 'Restaurant required for inventory module' });
        context = await buildInventoryContext(restaurantId, req.user!, period);
        break;
      default:
        return res.status(400).json({ error: 'Module not yet implemented' });
    }

    // Call Olivia One
    let insight;
    try {
      insight = await callOliviaOne(context);
    } catch (error) {
      console.error('Olivia One error:', error);
      // Fallback: return data summary without AI
      insight = createFallbackResponse(
        context,
        'AI analysis service temporarily unavailable. Review data above.',
      );
    }

    // Validate response format
    const validated = oliviaResponseSchema.parse(insight);

    // Log to audit (without token or sensitive data)
    await query(
      "INSERT INTO audit_logs(actor_id,action,target_type,metadata) VALUES($1,'analysis_requested','analytics',$2)",
      [req.user!.id, { module, restaurantId: restaurantId || null, period }],
    );

    res.json({
      generatedAt: new Date().toISOString(),
      insight: validated,
    });
  } catch (error) {
    console.error('Analytics error:', error);
    res.status(500).json({ error: 'Analysis failed' });
  }
});

