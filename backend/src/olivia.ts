import { z } from 'zod';
import { config } from './config.js';
import { query } from './db.js';
import type { AuthUser } from './auth.js';

// Strict format for Olivia One responses
const findingSchema = z.object({
  title: z.string().min(1).max(200),
  evidence: z.string().min(1).max(500),
  impact: z.string().min(1).max(300),
  severity: z.enum(['info', 'warning', 'critical']),
});

const actionSchema = z.object({
  label: z.string().min(1).max(200),
  reason: z.string().min(1).max(300),
  module: z.string().min(1).max(50),
  restaurantId: z.string().uuid().nullable(),
  productId: z.string().uuid().nullable(),
  supplierId: z.string().uuid().nullable(),
});

export const oliviaResponseSchema = z.object({
  summary: z.string().min(10).max(500),
  priority: z.enum(['low', 'medium', 'high', 'critical']),
  confidence: z.number().min(0).max(1),
  findings: z.array(findingSchema).min(1).max(20),
  actions: z.array(actionSchema).min(0).max(15),
  warnings: z.array(z.string()).default([]),
  dataQuality: z.object({
    isDemo: z.boolean(),
    missingData: z.array(z.string()),
    limitations: z.array(z.string()),
  }),
});

export type OliviaResponse = z.infer<typeof oliviaResponseSchema>;

interface AnalysisContext {
  module: string;
  restaurantId?: string;
  userId: string;
  role: string;
  period: { from: string; to: string };
  metrics: Record<string, unknown>;
}

/**
 * Call Hugging Face Inference API with structured response format
 */
export async function callOliviaOne(context: AnalysisContext): Promise<OliviaResponse> {
  if (!config.HF_TOKEN) {
    throw new Error('HF_TOKEN not configured');
  }

  const systemPrompt = `You are Olivia One, a decision support assistant for restaurant supply chain operations.
Your role is to analyze operational data and provide concrete, actionable recommendations.
- Analyze only the data provided; never invent sales, stock, or orders.
- Identify anomalies: high stock leading to zero orders, probable ruptures, unusual forecast variations, excessive supplier dependency.
- Detect missing data and explain limitations clearly.
- Prioritize findings by business impact.
- Return ONLY valid JSON matching the schema exactly.
- Never mention "Hugging Face" or technical details.
- Be concise: summary ≤ 500 chars, each finding ≤ 500 chars.`;

  const userPrompt = `Analyze this ${context.module} data and return actionable insights:\n${JSON.stringify(context.metrics, null, 2)}`;

  try {
    const response = await fetch(config.HF_API_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${config.HF_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: config.HF_MODEL,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        temperature: 0.3,
        max_tokens: 1500,
        response_format: {
          type: 'json_object',
        },
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      console.error('HF API error:', response.status, error);
      throw new Error(`HF API error: ${response.status}`);
    }

    const payload = (await response.json()) as any;
    const content = payload.choices?.[0]?.message?.content;

    if (!content) {
      throw new Error('No content in HF response');
    }

    const parsed = typeof content === 'string' ? JSON.parse(content) : content;
    
    // Enrich with data quality info
    const enriched: OliviaResponse = {
      ...parsed,
      dataQuality: {
        isDemo: false,
        missingData: [],
        limitations: [],
      },
    };

    // Validate against schema
    const validated = oliviaResponseSchema.parse(enriched);
    return validated;
  } catch (error) {
    console.error('Olivia One error:', error);
    throw error;
  }
}

/**
 * Build analysis context for dashboard module
 */
export async function buildDashboardContext(
  restaurantId: string | undefined,
  user: AuthUser,
  period: { from: string; to: string },
) {
  const values = restaurantId ? [restaurantId] : [];
  const where = restaurantId ? 'WHERE r.id=$1' : '';

  const restaurantData = await query(
    `SELECT r.id, r.name, 
      coalesce(sum(f.manager_forecast), 0)::float as forecast_sales,
      coalesce(count(o.id) FILTER(WHERE o.status='approved'), 0)::int as approved_orders,
      coalesce(count(o.id) FILTER(WHERE o.status='submitted'), 0)::int as pending_reviews
    FROM restaurants r
    LEFT JOIN forecasts f ON f.restaurant_id=r.id AND f.forecast_date BETWEEN $${restaurantId ? 3 : 1}::date AND $${restaurantId ? 4 : 2}::date
    LEFT JOIN orders o ON o.restaurant_id=r.id
    ${where}
    GROUP BY r.id ORDER BY forecast_sales DESC`,
    restaurantId ? [restaurantId, period.from, period.to] : [period.from, period.to],
  );

  return {
    module: 'dashboard',
    restaurantId,
    userId: user.id,
    role: user.role,
    period,
    metrics: {
      restaurants: restaurantData.rows,
      totalForecasted: restaurantData.rows.reduce((sum: number, r: any) => sum + r.forecast_sales, 0),
      pendingApprovals: restaurantData.rows.reduce((sum: number, r: any) => sum + r.pending_reviews, 0),
    },
  };
}

/**
 * Build analysis context for forecast module
 */
export async function buildForecastContext(
  restaurantId: string,
  user: AuthUser,
  period: { from: string; to: string },
) {
  const forecastData = await query(
    `SELECT f.forecast_date, f.manager_forecast, f.historical_average, 
      w.max_temp_f, w.weather_code,
      coalesce(ds.amount, 0) as actual_sales
    FROM forecasts f
    LEFT JOIN weather_snapshots w ON w.restaurant_id=f.restaurant_id AND w.forecast_date=f.forecast_date
    LEFT JOIN daily_sales ds ON ds.restaurant_id=f.restaurant_id AND ds.sales_date=f.forecast_date
    WHERE f.restaurant_id=$1 AND f.forecast_date BETWEEN $2::date AND $3::date
    ORDER BY f.forecast_date DESC LIMIT 30`,
    [restaurantId, period.from, period.to],
  );

  return {
    module: 'forecast',
    restaurantId,
    userId: user.id,
    role: user.role,
    period,
    metrics: {
      forecasts: forecastData.rows,
      avgVariance: forecastData.rows.length > 0
        ? Math.round(
          forecastData.rows.reduce((sum: number, f: any) => {
            if (!f.historical_average) return sum;
            return sum + Math.abs(f.manager_forecast - f.historical_average);
          }, 0) / forecastData.rows.length,
        )
        : 0,
    },
  };
}

/**
 * Build analysis context for orders module
 */
export async function buildOrdersContext(
  restaurantId: string | undefined,
  user: AuthUser,
  period: { from: string; to: string },
) {
  const values = restaurantId ? [restaurantId, period.from, period.to] : [period.from, period.to];
  const where = restaurantId
    ? 'WHERE o.restaurant_id=$1 AND o.delivery_date BETWEEN $2::date AND $3::date'
    : 'WHERE o.delivery_date BETWEEN $1::date AND $2::date';

  const orderData = await query(
    `SELECT o.id, o.restaurant_id, o.supplier_id, r.name as restaurant_name, 
      s.name as supplier_name, o.delivery_date, o.status, o.submitted_at,
      coalesce(sum(oi.retained_quantity), 0) as total_quantity,
      coalesce(count(oi.id), 0) as item_count
    FROM orders o
    JOIN restaurants r ON r.id=o.restaurant_id
    JOIN suppliers s ON s.id=o.supplier_id
    LEFT JOIN order_items oi ON oi.order_id=o.id
    ${where}
    GROUP BY o.id, r.name, s.name
    ORDER BY o.delivery_date DESC LIMIT 100`,
    values,
  );

  // Detect replacements (multiple orders for same restaurant/supplier/date)
  const replacements = await query(
    `SELECT COUNT(*) FILTER(WHERE status IN ('draft','submitted','approved')) as active_count,
      restaurant_id, supplier_id, delivery_date
    FROM orders
    GROUP BY restaurant_id, supplier_id, delivery_date
    HAVING COUNT(*) > 1`,
  );

  return {
    module: 'orders',
    restaurantId,
    userId: user.id,
    role: user.role,
    period,
    metrics: {
      orders: orderData.rows,
      statusDistribution: {
        draft: orderData.rows.filter((o: any) => o.status === 'draft').length,
        submitted: orderData.rows.filter((o: any) => o.status === 'submitted').length,
        approved: orderData.rows.filter((o: any) => o.status === 'approved').length,
      },
      replacementDetected: replacements.rows.length > 0,
      replacements: replacements.rows,
    },
  };
}

/**
 * Build analysis context for inventory module
 */
export async function buildInventoryContext(
  restaurantId: string,
  user: AuthUser,
  period: { from: string; to: string },
) {
  const inventoryData = await query(
    `SELECT il.product_id, p.name, p.base_unit, il.usable_quantity,
      coalesce(cr.units_per_1000_sales, 0) as consumption_ratio,
      coalesce(sum(ds.amount), 0)::float as recent_sales_1000
    FROM inventory_levels il
    JOIN products p ON p.id=il.product_id
    LEFT JOIN consumption_ratios cr ON cr.product_id=p.id AND cr.restaurant_id=$1
    LEFT JOIN daily_sales ds ON ds.restaurant_id=$1 AND ds.sales_date BETWEEN $2::date AND $3::date
    WHERE il.restaurant_id=$1
    GROUP BY il.product_id, p.name, p.base_unit, il.usable_quantity, cr.units_per_1000_sales
    ORDER BY il.usable_quantity DESC`,
    [restaurantId, period.from, period.to],
  );

  return {
    module: 'inventory',
    restaurantId,
    userId: user.id,
    role: user.role,
    period,
    metrics: {
      inventory: inventoryData.rows,
      criticalStock: inventoryData.rows.filter((i: any) => i.usable_quantity < 50).length,
      deadStock: inventoryData.rows.filter((i: any) => i.consumption_ratio === 0 && i.usable_quantity > 0)
        .length,
    },
  };
}

/**
 * Fallback response when HF is unavailable
 */
export function createFallbackResponse(
  context: AnalysisContext,
  reason: string,
): OliviaResponse {
  return {
    summary: `Analysis of ${context.module} module for the requested period.`,
    priority: 'medium',
    confidence: 0,
    findings: [
      {
        title: 'Data Summary',
        evidence: JSON.stringify(context.metrics).substring(0, 200),
        impact: 'Review the data above for operational decisions.',
        severity: 'info',
      },
    ],
    actions: [],
    warnings: [reason, 'Detailed AI analysis is temporarily unavailable.'],
    dataQuality: {
      isDemo: true,
      missingData: [],
      limitations: [reason],
    },
  };
}

