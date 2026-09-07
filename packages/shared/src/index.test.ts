import { describe, expect, it } from 'vitest';
import { projectInfo, statusMessage } from './index.js';

describe('shared package', () => {
  it('exports project metadata', () => {
    expect(projectInfo.name).toBe('CIESA CodeLab');
    expect(statusMessage).toContain('preparação');
  });
});
