import { describe, expect, it } from 'vitest';
import type { ExecutionJob } from '@ciesa/contracts';
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

describe('execution worker', () => {
  it('handles a valid job without source code and acknowledges it', async () => {
    const queue = new FakeQueue([message]);
    const received: ExecutionJob[] = [];
    const worker = new ExecutionWorker({
      queue,
      handler: async (receivedJob) => {
        received.push(receivedJob);
        worker.requestShutdown();
      },
      logger: { info: () => undefined, warn: () => undefined, error: () => undefined }
    });

    await worker.run();

    expect(received).toEqual([job]);
    expect(received[0]).not.toHaveProperty('sourceCode');
    expect(queue.acknowledgements).toEqual([message.id]);
    expect(queue.retries).toHaveLength(0);
  });

  it('supports JAVA and PYTHON through the existing contract enum', async () => {
    const languages: string[] = [];
    const queue = new FakeQueue([
      { ...message, job: { ...job, language: 'JAVA' }, id: 'java:attempt' },
      { ...message, id: 'python:attempt' }
    ]);
    const worker = new ExecutionWorker({
      queue,
      handler: async (receivedJob) => {
        languages.push(receivedJob.language);
        if (languages.length === 2) worker.requestShutdown();
      },
      logger: { info: () => undefined, warn: () => undefined, error: () => undefined }
    });

    await worker.run();

    expect(languages).toEqual(['JAVA', 'PYTHON']);
    expect(queue.acknowledgements).toHaveLength(2);
  });

  it('retries when the handler fails and does not acknowledge the failed job', async () => {
    const queue = new FakeQueue([message]);
    const worker = new ExecutionWorker({
      queue,
      handler: async () => {
        worker.requestShutdown();
        throw new Error('handler failure');
      },
      logger: { info: () => undefined, warn: () => undefined, error: () => undefined }
    });

    await worker.run();

    expect(queue.acknowledgements).toHaveLength(0);
    expect(queue.retries).toEqual([message.id]);
  });

  it('propagates Redis failures instead of reconnecting aggressively', async () => {
    const queue: ExecutionQueue = {
      enqueue: async () => undefined,
      consume: async () => {
        throw new Error('redis unavailable');
      },
      acknowledge: () => undefined,
      retry: async () => undefined,
      disconnect: async () => undefined
    };
    const worker = new ExecutionWorker({ queue });

    await expect(worker.run()).rejects.toThrow('redis unavailable');
  });
});
