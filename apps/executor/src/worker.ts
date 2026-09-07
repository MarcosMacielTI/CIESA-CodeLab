import 'dotenv/config';
import { fileURLToPath } from 'node:url';
import { appConfig } from '@ciesa/config';
import type { ExecutionJob } from '@ciesa/contracts';
import { RedisExecutionQueue, type ExecutionQueue, type ExecutionQueueMessage } from '@ciesa/shared';

type WorkerLogger = {
  info(message: string, metadata?: unknown): void;
  warn(message: string, metadata?: unknown): void;
  error(message: string, metadata?: unknown): void;
};
export type ExecutionJobHandler = (job: ExecutionJob) => Promise<void>;

export type ExecutionWorkerOptions = {
  queue: ExecutionQueue;
  handler?: ExecutionJobHandler;
  logger?: WorkerLogger;
  pollTimeoutSeconds?: number;
};

const defaultHandler: ExecutionJobHandler = async (job) => {
  console.info('Execution job received; execution is not implemented', {
    submissionId: job.submissionId,
    attemptId: job.attemptId,
    language: job.language
  });
};

export class ExecutionWorker {
  private acceptingJobs = true;
  private readonly queue: ExecutionQueue;
  private readonly handler: ExecutionJobHandler;
  private readonly logger: WorkerLogger;
  private readonly pollTimeoutSeconds: number;

  constructor(options: ExecutionWorkerOptions) {
    this.queue = options.queue;
    this.handler = options.handler ?? defaultHandler;
    this.logger = options.logger ?? console;
    this.pollTimeoutSeconds = options.pollTimeoutSeconds ?? 1;
  }

  requestShutdown(): void {
    this.acceptingJobs = false;
  }

  async run(): Promise<void> {
    while (this.acceptingJobs) {
      const message = await this.queue.consume(this.pollTimeoutSeconds);
      if (!message) continue;
      await this.process(message);
    }
  }

  private async process(message: ExecutionQueueMessage): Promise<void> {
    const startedAt = Date.now();
    this.logger.info('Execution job started', {
      submissionId: message.job.submissionId,
      attemptId: message.job.attemptId,
      language: message.job.language
    });

    try {
      await this.handler(message.job);
      this.queue.acknowledge(message);
      this.logger.info('Execution job acknowledged', {
        submissionId: message.job.submissionId,
        attemptId: message.job.attemptId,
        durationMs: Date.now() - startedAt
      });
    } catch (error) {
      this.logger.error('Execution job handler failed', {
        submissionId: message.job.submissionId,
        attemptId: message.job.attemptId,
        error
      });
      await this.queue.retry(message);
    }
  }
}

export async function startWorker(): Promise<void> {
  const queue = new RedisExecutionQueue({ redisUrl: appConfig.redisUrl });
  const worker = new ExecutionWorker({ queue });

  const shutdown = () => worker.requestShutdown();
  process.once('SIGINT', shutdown);
  process.once('SIGTERM', shutdown);

  try {
    await worker.run();
  } finally {
    process.removeListener('SIGINT', shutdown);
    process.removeListener('SIGTERM', shutdown);
    await queue.disconnect();
  }
}

const isMainModule = process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1];
if (isMainModule) {
  startWorker().catch((error: unknown) => {
    console.error('Execution worker stopped', error);
    process.exitCode = 1;
  });
}
