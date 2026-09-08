import type { ExecutionJob } from '@ciesa/contracts';
export type { ExecutionJob } from '@ciesa/contracts';
import { Redis } from 'ioredis';
import { z } from 'zod';

export * from './sandbox.js';
export * from './runtime-adapter.js';

export const projectInfo = {
  name: 'CIESA CodeLab',
  version: '0.1.0',
  phase: 'Fundação'
};

export const statusMessage = 'Sistema em preparação para as próximas fases.';

export const executionJobSchema = z.object({
  contractVersion: z.literal('1.0'),
  submissionId: z.string().min(1),
  attemptId: z.string().min(1),
  language: z.enum(['JAVA', 'PYTHON'])
}).strict();

export type ExecutionJobValidator = typeof executionJobSchema;

export interface ExecutionQueue {
  enqueue(job: ExecutionJob): Promise<void>;
  consume(timeoutSeconds?: number): Promise<ExecutionQueueMessage | null>;
  acknowledge(message: ExecutionQueueMessage): void;
  retry(message: ExecutionQueueMessage): Promise<void>;
  disconnect(): Promise<void>;
}

export type ExecutionQueueMessage = {
  id: string;
  job: ExecutionJob;
  retryCount: number;
};

export type RedisExecutionQueueOptions = {
  redisUrl: string;
  queueName?: string;
  maxRetries?: number;
  redisClient?: RedisClient;
};

export interface RedisClient {
  readonly status: string;
  connect(): Promise<void>;
  rpush(key: string, value: string): Promise<number>;
  brpop(key: string, timeoutSeconds: number): Promise<[string, string] | null>;
  quit(): Promise<'OK'>;
  on(event: 'error', listener: (error: Error) => void): this;
}

export class RedisExecutionQueue implements ExecutionQueue {
  private readonly redis: RedisClient;
  private readonly queueName: string;
  private readonly maxRetries: number;
  private readonly pending = new Map<string, ExecutionQueueMessage>();

  constructor(options: RedisExecutionQueueOptions) {
    this.redis = options.redisClient ?? new Redis(options.redisUrl, {
      lazyConnect: true,
      connectTimeout: 1_000,
      maxRetriesPerRequest: 1,
      retryStrategy: () => null
    });
    this.redis.on('error', () => undefined);
    this.queueName = options.queueName ?? 'ciesa:execution:jobs';
    this.maxRetries = options.maxRetries ?? 1;
  }

  private async ensureConnected(): Promise<void> {
    if (this.redis.status === 'wait') await this.redis.connect();
  }

  async enqueue(job: ExecutionJob): Promise<void> {
    const validatedJob = executionJobSchema.parse(job);
    const message: ExecutionQueueMessage = {
      id: `${validatedJob.submissionId}:${validatedJob.attemptId}`,
      job: validatedJob,
      retryCount: 0
    };

    await this.ensureConnected();
    await this.redis.rpush(this.queueName, JSON.stringify(message));
  }

  async consume(timeoutSeconds = 0): Promise<ExecutionQueueMessage | null> {
    await this.ensureConnected();
    const result = await this.redis.brpop(this.queueName, timeoutSeconds);
    if (!result) return null;

    const parsed: unknown = JSON.parse(result[1]);
    const message = z.object({
      id: z.string().min(1),
      job: executionJobSchema,
      retryCount: z.number().int().min(0)
    }).strict().parse(parsed);

    this.pending.set(message.id, message);
    return message;
  }

  acknowledge(message: ExecutionQueueMessage): void {
    this.pending.delete(message.id);
  }

  async retry(message: ExecutionQueueMessage): Promise<void> {
    if (!this.pending.has(message.id)) return;

    this.pending.delete(message.id);
    if (message.retryCount >= this.maxRetries) return;

    await this.redis.rpush(this.queueName, JSON.stringify({
      ...message,
      retryCount: message.retryCount + 1
    }));
  }

  async disconnect(): Promise<void> {
    this.pending.clear();
    if (this.redis.status !== 'end') await this.redis.quit();
  }
}
