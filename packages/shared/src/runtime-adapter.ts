import type {
  ExecutionRuntimeAdapter,
  ExecutionRuntimeRequest,
  ExecutionRuntimeResult
} from '@ciesa/contracts';
import { parseExecutionRuntimeRequest } from '@ciesa/contracts';

import type { ExecutionSandbox } from './sandbox.js';

export class ConcreteRuntimeAdapter implements ExecutionRuntimeAdapter {
  constructor(private readonly sandbox: ExecutionSandbox) {}

  async execute(request: ExecutionRuntimeRequest): Promise<ExecutionRuntimeResult> {
    const validatedRequest = parseExecutionRuntimeRequest(request);
    let sandboxCreated = false;

    try {
      await this.sandbox.create();
      sandboxCreated = true;
      await this.sandbox.inspect();
      sandboxCreated = false;
      await this.sandbox.destroy();

      return {
        contractVersion: '1.0',
        submissionId: validatedRequest.submissionId,
        attemptId: validatedRequest.attemptId,
        status: 'FAILED',
        verdict: 'SYSTEM_ERROR',
        stdout: '',
        stderr: '',
        exitCode: null,
        executionTimeMs: null,
        memoryUsedMb: null,
        errorCode: 'RUNTIME_NOT_IMPLEMENTED'
      };
    } catch (error) {
      if (!sandboxCreated) throw error;

      try {
        await this.sandbox.destroy();
      } catch (cleanupError) {
        throw new AggregateError([error, cleanupError], 'Sandbox cleanup failed');
      }

      throw error;
    }
  }
}