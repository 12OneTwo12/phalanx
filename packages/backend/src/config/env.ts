import { config } from 'dotenv';
import { z } from 'zod';

// Load environment variables
config();

// Environment variable schema
const envSchema = z.object({
  // Server
  PORT: z.string().default('3001').transform(Number),
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  
  // Database
  DATABASE_URL: z.string().url().or(z.string().startsWith('mongodb')),
  
  // JWT
  JWT_SECRET: z.string().min(32),
  JWT_ACCESS_TOKEN_EXPIRES_IN: z.string().default('15m'),
  JWT_REFRESH_TOKEN_EXPIRES_IN: z.string().default('7d'),
  JWT_ISSUER: z.string().default('auth-service'),
  // Keep JWT_EXPIRES_IN for backward compatibility
  JWT_EXPIRES_IN: z.string().default('7d'),
  
  // CORS
  ALLOWED_ORIGINS: z.string().default('http://localhost:3000').transform((val) => val.split(',')),
  
  // Rate Limiting
  RATE_LIMIT_WINDOW_MS: z.string().default('900000').transform(Number),
  RATE_LIMIT_MAX_REQUESTS: z.string().default('100').transform(Number),
});

// Parse and validate environment variables
const parsedEnv = envSchema.safeParse(process.env);

if (!parsedEnv.success) {
  console.error('❌ Invalid environment variables:', parsedEnv.error.format());
  process.exit(1);
}

export const env = parsedEnv.data;

// Type for the environment variables
export type Env = typeof env;