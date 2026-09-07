import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import {
  RedisExecutionQueue,
  executionJobSchema,
  type RedisClient,
  type ExecutionJob
} from './index.js';

const redisUrl = process.env.REDIS_URL ?? 'redis://localhost:6379';
const queueName = `test:execution:${randomUUID()}`;
let queue: RedisExecutionQueue;

class MemoryRedis implements RedisClient {
  readonly status = 'ready';
  private readonly values: string[] = [];

  async connect(): Promise<void> {}

  async rpush(_key: string, value: string): Promise<number> {
    this.values.push(value);
    return this.values.length;
  }

  async brpop(_key: string, _timeoutSeconds: number): Promise<[string, string] | null> {
    const value = this.values.pop();
    return value ? [_key, value] : null;
  }

  async quit(): Promise<'OK'> {
    return 'OK';
  }

  on(_event: 'error', _listener: (error: Error) => void): this {
    return this;
  }
}

const job: ExecutionJob = {
  contractVersion: '1.0',
  submissionId: 'submission-queue-test',
  attemptId: 'attempt-queue-test',
  language: 'PYTHON'
};

describe('Redis execution queue', () => {
  beforeAll(() => {
    queue = new RedisExecutionQueue({ redisUrl, queueName, maxRetries: 1, redisClient: new MemoryRedis() });
  });

  afterAll(async () => {
    await queue.disconnect();
  });

  it('validates and round-trips a minimal ExecutionJob', async () => {
    await queue.enqueue(job);
    const message = await queue.consume(1);

    expect(message?.job).toEqual(job);
    expect(message).not.toHaveProperty('sourceCode');
    expect(message).not.toHaveProperty('JWT_SECRET');
    expect(message).not.toHaveProperty('DATABASE_URL');

    if (message) queue.acknowledge(message);
  });

  it('rejects invalid jobs before contacting Redis', async () => {
    const invalidJob: unknown = {
      ...job,
      language: 'RUST',
      sourceCode: 'must-not-be-accepted'
    };

    expect(() => executionJobSchema.parse(invalidJob)).toThrow();
  });

  it('retries a consumed message once and then acknowledges it', async () => {
    await queue.enqueue(job);
    const first = await queue.consume(1);
    expect(first).not.toBeNull();

    if (!first) return;
    await queue.retry(first);

    const retried = await queue.consume(1);
    expect(retried?.retryCount).toBe(1);
    if (retried) await queue.retry(retried);

    const exhausted = await queue.consume(1);
    expect(exhausted).toBeNull();
  });

  it('exposes the same runtime validator used by the queue', () => {
    expect(executionJobSchema.safeParse(job).success).toBe(true);
    expect(executionJobSchema.safeParse({ ...job, contractVersion: '2.0' }).success).toBe(false);
  });

  it('surfaces Redis unavailability instead of treating it as a validation error', async () => {
    const unavailable = new RedisExecutionQueue({
      redisUrl: 'redis://127.0.0.1:6399',
      queueName: `${queueName}:unavailable`
    });

    await expect(unavailable.enqueue(job)).rejects.toThrow();
    await unavailable.disconnect();
  });
});
