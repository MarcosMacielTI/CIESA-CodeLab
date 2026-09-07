import { describe, expect, it } from 'vitest';

import app from './app.js';

describe('api foundation', () => {
  it('creates the application without binding a server port', () => {
    expect(app).toBeDefined();
    expect(typeof app.listen).toBe('function');
  });
});
