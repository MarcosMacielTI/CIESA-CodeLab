import { describe, expect, it } from 'vitest';
import { appConfig, environmentSchema } from './index.js';

describe('app config', () => {
  it('exposes default runtime config', () => {
    expect(appConfig.nodeEnv).toBeDefined();
    expect(appConfig.apiPort).toBeGreaterThan(0);
  });

  it('rejects invalid required ports', () => {
    const result = environmentSchema.safeParse({
      API_PORT: 'not-a-port',
      POSTGRES_PORT: '5433',
      REDIS_PORT: '6379'
    });

    expect(result.success).toBe(false);
  });

  it('validates JWT configuration when provided', () => {
    const result = environmentSchema.safeParse({ JWT_SECRET: 'too-short' });

    expect(result.success).toBe(false);
  });
});
