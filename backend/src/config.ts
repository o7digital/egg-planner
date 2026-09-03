import { z } from 'zod';
import 'dotenv/config';

const schema = z.object({
  DATABASE_URL: z.string().min(1),
  FRONTEND_URL: z.string().url(),
  SESSION_COOKIE_NAME: z.string().default('gg_session'),
  SESSION_TTL_HOURS: z.coerce.number().positive().default(12),
  OPEN_METEO_BASE_URL: z.string().url().default('https://customer-api.open-meteo.com/v1'),
  OPEN_METEO_API_KEY: z.string().optional(),
  PORT: z.coerce.number().positive().default(3000),
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
});

export const config = schema.parse(process.env);
