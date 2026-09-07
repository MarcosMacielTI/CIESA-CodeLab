import { describe, expect, it } from 'vitest';
import type {
  ExecutionJob,
  ExecutionJobStatus,
  ExecutionResult,
  ExecutionVerdict
} from './index.js';
import {
  isExecutionRuntimeRequest,
  isExecutionRuntimeResult,
  parseExecutionRuntimeRequest,
  parseExecutionRuntimeResult,
  type ExecutionRuntimeAdapter,
  type ExecutionRuntimeRequest,
  type ExecutionRuntimeResult
} from './index.js';

describe('execution contracts', () => {
  it('models the minimal Java job without source code or secrets', () => {
    const job: ExecutionJob = {
      contractVersion: '1.0',
      submissionId: 'submission-1',
      attemptId: 'attempt-1',
      language: 'JAVA'
    };

    expect(job.language).toBe('JAVA');
    expect(job).not.toHaveProperty('sourceCode');
    expect(job).not.toHaveProperty('JWT_SECRET');
    expect(job).not.toHaveProperty('DATABASE_URL');
  });

  it('models both supported languages and lifecycle values', () => {
    const pythonJob: ExecutionJob = {
      contractVersion: '1.0',
      submissionId: 'submission-2',
      attemptId: 'attempt-2',
      language: 'PYTHON'
    };
    const statuses: ExecutionJobStatus[] = ['QUEUED', 'RUNNING', 'COMPLETED', 'FAILED', 'TIMEOUT', 'CANCELLED'];
    const verdicts: ExecutionVerdict[] = [
      'ACCEPTED',
      'WRONG_ANSWER',
      'COMPILE_ERROR',
      'RUNTIME_ERROR',
      'TIME_LIMIT',
      'MEMORY_LIMIT',
      'OUTPUT_LIMIT',
      'SYSTEM_ERROR'
    ];

    expect(pythonJob.language).toBe('PYTHON');
    expect(statuses).toHaveLength(6);
    expect(verdicts).toHaveLength(8);
  });

  it('defines a result contract without persistence or execution behavior', () => {
    const result: ExecutionResult = {
      contractVersion: '1.0',
      submissionId: 'submission-1',
      attemptId: 'attempt-1',
      status: 'COMPLETED',
      verdict: 'ACCEPTED',
      exitCode: 0,
      stdout: '',
      stderr: '',
      compilationOutput: '',
      executionTimeMs: 10,
      memoryUsedBytes: 1024,
      failureReason: null
    };

    expect(result.status).toBe('COMPLETED');
    expect(result.verdict).toBe('ACCEPTED');
  });

  it('validates a runtime request with controlled sandbox limits', () => {
    const request: ExecutionRuntimeRequest = {
      submissionId: 'submission-1',
      attemptId: 'attempt-1',
      language: 'JAVA',
      limits: {
        timeoutMs: 10_000,
        memoryMb: 128,
        pidsLimit: 32,
        networkDisabled: true,
        user: '65532:65532'
      }
    };

    expect(isExecutionRuntimeRequest(request)).toBe(true);
    expect(parseExecutionRuntimeRequest(request)).toEqual(request);
  });

  it('rejects source code, secrets and unsafe runtime limits', () => {
    const request = {
      submissionId: 'submission-1',
      attemptId: 'attempt-1',
      language: 'PYTHON',
      sourceCode: 'print(1)',
      limits: {
        timeoutMs: 10_000,
        memoryMb: 128,
        pidsLimit: 32,
        networkDisabled: false,
        user: 'root',
        secret: 'not-allowed'
      }
    };

    expect(isExecutionRuntimeRequest(request)).toBe(false);
    expect(() => parseExecutionRuntimeRequest(request)).toThrow('Invalid ExecutionRuntimeRequest');
  });

  it('validates a runtime result without source code', () => {
    const result: ExecutionRuntimeResult = {
      contractVersion: '1.0',
      submissionId: 'submission-1',
      attemptId: 'attempt-1',
      status: 'SUCCEEDED',
      verdict: 'ACCEPTED',
      stdout: '',
      stderr: '',
      exitCode: 0,
      executionTimeMs: 12,
      memoryUsedMb: 4,
      errorCode: null
    };

    expect(isExecutionRuntimeResult(result)).toBe(true);
    expect(parseExecutionRuntimeResult(result)).toEqual(result);
    expect(result).not.toHaveProperty('sourceCode');
  });

  it('rejects invalid runtime results', () => {
    const result = {
      contractVersion: '1.0',
      submissionId: 'submission-1',
      attemptId: 'attempt-1',
      status: 'COMPLETED',
      verdict: 'ACCEPTED',
      stdout: '',
      stderr: '',
      sourceCode: 'must-not-be-accepted',
      exitCode: 0,
      executionTimeMs: -1,
      memoryUsedMb: null,
      errorCode: null
    };

    expect(isExecutionRuntimeResult(result)).toBe(false);
    expect(() => parseExecutionRuntimeResult(result)).toThrow('Invalid ExecutionRuntimeResult');
  });

  it('supports the adapter boundary without executing code', async () => {
    const request: ExecutionRuntimeRequest = {
      submissionId: 'submission-1',
      attemptId: 'attempt-1',
      language: 'PYTHON',
      limits: {
        timeoutMs: 10_000,
        memoryMb: 128,
        pidsLimit: 32,
        networkDisabled: true,
        user: '65532:65532'
      }
    };
    const result: ExecutionRuntimeResult = {
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
    const adapter: ExecutionRuntimeAdapter = {
      execute: async (receivedRequest) => {
        expect(receivedRequest).toEqual(request);
        return result;
      }
    };

    await expect(adapter.execute(request)).resolves.toEqual(result);
  });
});
