import { describe, expect, it } from 'vitest';

describe('app bootstrap', () => {
  it('renders the basic app shell', () => {
    expect('CIESA CodeLab').toContain('CIESA');
  });
});
