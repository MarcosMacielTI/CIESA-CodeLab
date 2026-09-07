import { describe, expect, it } from 'vitest';
import request from 'supertest';

import app from './app.js';

describe('api health endpoint', () => {
  it('responds with ok status', async () => {
    const response = await request(app).get('/health');

    expect(response.status).toBe(200);
    expect(response.body.ok).toBe(true);
    expect(response.body.service).toBe('ciesa-api');
  });
});
