import 'dotenv/config';
import { fileURLToPath } from 'node:url';
import { appConfig } from '@ciesa/config';
import type { ExecutionRuntimeAdapter } from '@ciesa/contracts';
import {
  ConcreteRuntimeAdapter,
  DockerSandbox,
  RedisExecutionQueue,
  defaultSandboxLimits,
  type ExecutionQueue,
  type ExecutionQueueMessage
} from '@ciesa/shared';

type WorkerLogger = {
  info(message: string, metadata?: unknown): void;
  warn(message: string, metadata?: unknown): void;
  error(message: string, metadata?: unknown): void;
};
export type ExecutionWorkerOptions = {
  queue: ExecutionQueue;
  runtimeAdapter: ExecutionRuntimeAdapter;
  logger?: WorkerLogger;
  pollTimeoutSeconds?: number;
};

export class ExecutionWorker {
  private acceptingJobs = true;
  private readonly queue: ExecutionQueue;
  private readonly runtimeAdapter: ExecutionRuntimeAdapter;
  private readonly logger: WorkerLogger;
  private readonly pollTimeoutSeconds: number;

  constructor(options: ExecutionWorkerOptions) {
    this.queue = options.queue;
    this.runtimeAdapter = options.runtimeAdapter;
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
      const result = await this.runtimeAdapter.execute({
        submissionId: message.job.submissionId,
        attemptId: message.job.attemptId,
        language: message.job.language,
        limits: {
          timeoutMs: defaultSandboxLimits.totalJobTimeoutMs,
          memoryMb: defaultSandboxLimits.memoryMb,
          pidsLimit: defaultSandboxLimits.maxPids,
          networkDisabled: true,
          user: '65532:65532'
        }
      });
      this.queue.acknowledge(message);
      this.logger.info('Execution job acknowledged', {
        submissionId: message.job.submissionId,
        attemptId: message.job.attemptId,
        status: result.status,
        verdict: result.verdict,
        errorCode: result.errorCode,
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
  const runtimeAdapter = new ConcreteRuntimeAdapter(new DockerSandbox());
  const worker = new ExecutionWorker({ queue, runtimeAdapter });

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
