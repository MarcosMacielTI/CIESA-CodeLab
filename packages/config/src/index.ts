import { z } from 'zod';

const positivePort = z.coerce.number().int().min(1).max(65535);

export const environmentSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  LOG_LEVEL: z.enum(['debug', 'info', 'warn', 'error']).default('info'),
  DATABASE_URL: z.string().url().optional(),
  JWT_SECRET: z.string().min(32).optional(),
  JWT_EXPIRES_IN: z.string().min(1).default('15m'),
  API_PORT: positivePort.default(3001),
  WEB_PORT: positivePort.default(5173),
  EXECUTOR_PORT: positivePort.default(4001),
  POSTGRES_PORT: positivePort.default(5433),
  REDIS_PORT: positivePort.default(6379),
  REDIS_URL: z.string().url().default('redis://localhost:6379')
});

export const environment = environmentSchema.parse(process.env);

if (environment.NODE_ENV === 'production' && !environment.JWT_SECRET) {
  throw new Error('JWT_SECRET is required in production');
}

export const appConfig = {
  nodeEnv: environment.NODE_ENV,
  logLevel: environment.LOG_LEVEL,
  databaseUrl: environment.DATABASE_URL,
  jwtSecret: environment.JWT_SECRET,
  jwtExpiresIn: environment.JWT_EXPIRES_IN,
  apiPort: environment.API_PORT,
  webPort: environment.WEB_PORT,
  executorPort: environment.EXECUTOR_PORT,
  postgresPort: environment.POSTGRES_PORT,
  redisPort: environment.REDIS_PORT,
  redisUrl: environment.REDIS_URL
};

export type AppConfig = typeof appConfig;
