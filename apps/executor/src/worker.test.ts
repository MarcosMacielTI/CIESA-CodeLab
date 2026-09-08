import { describe, expect, it } from 'vitest';
import type {
  ExecutionJob,
  ExecutionRuntimeAdapter,
  ExecutionRuntimeRequest,
  ExecutionRuntimeResult
} from '@ciesa/contracts';
import type { ExecutionQueue, ExecutionQueueMessage } from '@ciesa/shared';

import { ExecutionWorker } from './worker.js';

const job: ExecutionJob = {
  contractVersion: '1.0',
  submissionId: 'submission-worker-test',
  attemptId: 'attempt-worker-test',
  language: 'PYTHON'
};

class FakeQueue implements ExecutionQueue {
  readonly acknowledgements: string[] = [];
  readonly retries: string[] = [];
  private messages: ExecutionQueueMessage[];

  constructor(messages: ExecutionQueueMessage[]) {
    this.messages = [...messages];
  }

  async enqueue(): Promise<void> {}

  async consume(): Promise<ExecutionQueueMessage | null> {
    return this.messages.shift() ?? null;
  }

  acknowledge(message: ExecutionQueueMessage): void {
    this.acknowledgements.push(message.id);
  }

  async retry(message: ExecutionQueueMessage): Promise<void> {
    this.retries.push(message.id);
  }

  async disconnect(): Promise<void> {}
}

const message: ExecutionQueueMessage = {
  id: 'submission-worker-test:attempt-worker-test',
  job,
  retryCount: 0
};

function controlledResult(request: ExecutionRuntimeRequest): ExecutionRuntimeResult {
  return {
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
  };
}

function createRuntimeAdapter(
  execute: ExecutionRuntimeAdapter['execute'] = async (request) => controlledResult(request)
): ExecutionRuntimeAdapter {
  return { execute };
}

const logger = { info: () => undefined, warn: () => undefined, error: () => undefined };

describe('execution worker', () => {
  it('calls the adapter with allowed fields and no source code', async () => {
    const queue = new FakeQueue([message]);
    const requests: ExecutionRuntimeRequest[] = [];
    let worker!: ExecutionWorker;
    const runtimeAdapter = createRuntimeAdapter(async (request) => {
      requests.push(request);
      worker.requestShutdown();
      return controlledResult(request);
    });
    worker = new ExecutionWorker({ queue, runtimeAdapter, logger });

    await worker.run();

    expect(requests).toHaveLength(1);
    expect(requests[0]).toEqual({
      submissionId: job.submissionId,
      attemptId: job.attemptId,
      language: job.language,
      limits: {
        timeoutMs: 10_000,
        memoryMb: 128,
        pidsLimit: 32,
        networkDisabled: true,
        user: '65532:65532'
      }
    });
    expect(requests[0]).not.toHaveProperty('sourceCode');
    expect(queue.acknowledgements).toEqual([message.id]);
    expect(queue.retries).toHaveLength(0);
  });

  it('processes jobs serially and calls the adapter once per job', async () => {
    const queue = new FakeQueue([
      message,
      { ...message, id: 'submission-worker-test:attempt-2', job: { ...job, attemptId: 'attempt-2' } }
    ]);
    const calls: string[] = [];
    let active = 0;
    let maximumActive = 0;
    let worker!: ExecutionWorker;
    const runtimeAdapter = createRuntimeAdapter(async (request) => {
      active += 1;
      maximumActive = Math.max(maximumActive, active);
      calls.push(request.attemptId);
      active -= 1;
      if (calls.length === 2) worker.requestShutdown();
      return controlledResult(request);
    });
    worker = new ExecutionWorker({ queue, runtimeAdapter, logger });

    await worker.run();

    expect(calls).toEqual(['attempt-worker-test', 'attempt-2']);
    expect(maximumActive).toBe(1);
    expect(queue.acknowledgements).toHaveLength(2);
  });

  it('processes a controlled adapter result without executing code', async () => {
    const queue = new FakeQueue([message]);
    let worker!: ExecutionWorker;
    const runtimeAdapter = createRuntimeAdapter(async (request) => {
      worker.requestShutdown();
      return controlledResult(request);
    });
    worker = new ExecutionWorker({ queue, runtimeAdapter, logger });

    await worker.run();

    expect(queue.acknowledgements).toEqual([message.id]);
    expect(message.job).not.toHaveProperty('sourceCode');
  });

  it('retries when the adapter fails and does not acknowledge the job', async () => {
    const queue = new FakeQueue([message]);
    let worker!: ExecutionWorker;
    const runtimeAdapter = createRuntimeAdapter(async () => {
      worker.requestShutdown();
      throw new Error('adapter failure');
    });
    worker = new ExecutionWorker({ queue, runtimeAdapter, logger });

    await worker.run();

    expect(queue.acknowledgements).toHaveLength(0);
    expect(queue.retries).toEqual([message.id]);
  });

  it('supports JAVA and PYTHON through the existing contract enum', async () => {
    const languages: string[] = [];
    const queue = new FakeQueue([
      { ...message, job: { ...job, language: 'JAVA' }, id: 'java:attempt' },
      { ...message, id: 'python:attempt' }
    ]);
    let worker!: ExecutionWorker;
    const runtimeAdapter = createRuntimeAdapter(async (request) => {
      languages.push(request.language);
      if (languages.length === 2) worker.requestShutdown();
      return controlledResult(request);
    });
    worker = new ExecutionWorker({ queue, runtimeAdapter, logger });

    await worker.run();

    expect(languages).toEqual(['JAVA', 'PYTHON']);
    expect(queue.acknowledgements).toHaveLength(2);
  });

  it('propagates Redis failures instead of reconnecting aggressively', async () => {
    const queue: ExecutionQueue = {
      enqueue: async () => undefined,
      consume: async () => { throw new Error('redis unavailable'); },
      acknowledge: () => undefined,
      retry: async () => undefined,
      disconnect: async () => undefined
    };
    const worker = new ExecutionWorker({ queue, runtimeAdapter: createRuntimeAdapter() });

    await expect(worker.run()).rejects.toThrow('redis unavailable');
  });
});
