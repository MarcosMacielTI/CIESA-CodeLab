import { describe, expect, it, vi } from 'vitest';
import type { ExecutionRuntimeRequest } from '@ciesa/contracts';

import { ConcreteRuntimeAdapter, type ExecutionSandbox } from './index.js';

const request: ExecutionRuntimeRequest = {
  submissionId: 'submission-runtime-test',
  attemptId: 'attempt-runtime-test',
  language: 'PYTHON',
  limits: {
    timeoutMs: 10_000,
    memoryMb: 128,
    pidsLimit: 32,
    networkDisabled: true,
    user: '65532:65532'
  }
};

function createSandbox(overrides: Partial<ExecutionSandbox> = {}): ExecutionSandbox {
  return {
    state: 'NEW',
    create: vi.fn(async () => undefined),
    inspect: vi.fn(async () => ({ id: 'fake-sandbox', name: 'fake-sandbox', state: 'created' })),
    destroy: vi.fn(async () => undefined),
    ...overrides
  };
}

describe('concrete runtime adapter', () => {
  it('orchestrates create, inspect and destroy and returns a controlled result', async () => {
    const sandbox = createSandbox();
    const adapter = new ConcreteRuntimeAdapter(sandbox);

    const result = await adapter.execute(request);

    expect(sandbox.create).toHaveBeenCalledOnce();
    expect(sandbox.inspect).toHaveBeenCalledOnce();
    expect(sandbox.destroy).toHaveBeenCalledOnce();
    expect(result).toEqual({
      contractVersion: '1.0',
      submissionId: request.submissionId,
      attemptId: request.attemptId,
      status: 'FAILED',
      verdict: 'SYSTEM_ERROR',
      stdout: '',
      stderr: '',
      exitCode: null,
      executionTimeMs: null,
      memoryUsedMb: null,
      errorCode: 'RUNTIME_NOT_IMPLEMENTED'
    });
    expect(result).not.toHaveProperty('sourceCode');
  });

  it('preserves lifecycle order', async () => {
    const order: string[] = [];
    const sandbox = createSandbox({
      create: vi.fn(async () => { order.push('create'); }),
      inspect: vi.fn(async () => { order.push('inspect'); return { id: 'id', name: 'name', state: 'created' }; }),
      destroy: vi.fn(async () => { order.push('destroy'); })
    });

    await new ConcreteRuntimeAdapter(sandbox).execute(request);

    expect(order).toEqual(['create', 'inspect', 'destroy']);
  });

  it('does not destroy when create fails', async () => {
    const destroy = vi.fn(async () => undefined);
    const sandbox = createSandbox({
      create: vi.fn(async () => { throw new Error('create failed'); }),
      destroy
    });

    await expect(new ConcreteRuntimeAdapter(sandbox).execute(request)).rejects.toThrow('create failed');
    expect(destroy).not.toHaveBeenCalled();
  });

  it('cleans up when inspect fails and preserves the inspect error', async () => {
    const destroy = vi.fn(async () => undefined);
    const sandbox = createSandbox({
      inspect: vi.fn(async () => { throw new Error('inspect failed'); }),
      destroy
    });

    await expect(new ConcreteRuntimeAdapter(sandbox).execute(request)).rejects.toThrow('inspect failed');
    expect(destroy).toHaveBeenCalledOnce();
  });

  it('reports cleanup failure deterministically without hiding it', async () => {
    const destroy = vi.fn(async () => { throw new Error('destroy failed'); });
    const sandbox = createSandbox({
      destroy
    });

    await expect(new ConcreteRuntimeAdapter(sandbox).execute(request)).rejects.toThrow('destroy failed');
    expect(destroy).toHaveBeenCalledOnce();
  });

  it('does not execute commands or access source code', async () => {
    const sandbox = createSandbox();
    const adapter = new ConcreteRuntimeAdapter(sandbox);

    await adapter.execute(request);

    expect(adapter).not.toHaveProperty('sourceCode');
    expect(adapter).not.toHaveProperty('command');
    expect(adapter).not.toHaveProperty('run');
    expect(adapter).not.toHaveProperty('exec');
  });
});