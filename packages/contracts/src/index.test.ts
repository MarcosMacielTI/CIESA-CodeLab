import { describe, expect, it } from 'vitest';
import { defaultHealthStatus } from './index.js';

describe('contracts', () => {
  it('exposes the health contract', () => {
    expect(defaultHealthStatus.ok).toBe(true);
    expect(defaultHealthStatus.service).toBe('ciesa-contracts');
  });
});
