export type HealthStatus = {
  ok: boolean;
  service: string;
  status?: string;
  timestamp?: string;
};

export type UserRole = 'STUDENT' | 'TEACHER' | 'ADMIN';

export const defaultHealthStatus: HealthStatus = {
  ok: true,
  service: 'ciesa-contracts',
  status: 'ready'
};

export type PublicUser = {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  createdAt: string;
  updatedAt: string;
};

export type AuthResponse = {
  user: PublicUser;
  token: string;
};

export type ExecutionLanguage = 'JAVA' | 'PYTHON';

export type ExecutionJobStatus = 'QUEUED' | 'RUNNING' | 'COMPLETED' | 'FAILED' | 'TIMEOUT' | 'CANCELLED';

export type ExecutionVerdict =
  | 'ACCEPTED'
  | 'WRONG_ANSWER'
  | 'COMPILE_ERROR'
  | 'RUNTIME_ERROR'
  | 'TIME_LIMIT'
  | 'MEMORY_LIMIT'
  | 'OUTPUT_LIMIT'
  | 'SYSTEM_ERROR';

export type ExecutionJob = {
  contractVersion: '1.0';
  submissionId: string;
  attemptId: string;
  language: ExecutionLanguage;
};

export type ExecutionResult = {
  contractVersion: '1.0';
  submissionId: string;
  attemptId: string;
  status: ExecutionJobStatus;
  verdict: ExecutionVerdict | null;
  exitCode: number | null;
  stdout: string;
  stderr: string;
  compilationOutput: string | null;
  executionTimeMs: number | null;
  memoryUsedBytes: number | null;
  failureReason: string | null;
};

export type ExecutionRuntimeStatus =
  | 'QUEUED'
  | 'INITIALIZING'
  | 'RUNNING'
  | 'SUCCEEDED'
  | 'FAILED'
  | 'TIMEOUT'
  | 'CANCELLED';

export type ExecutionRuntimeLimits = {
  timeoutMs: number;
  memoryMb: number;
  pidsLimit: number;
  networkDisabled: true;
  user: string;
};

export type ExecutionRuntimeRequest = {
  submissionId: string;
  attemptId: string;
  language: ExecutionLanguage;
  limits: ExecutionRuntimeLimits;
};

export type ExecutionRuntimeResult = {
  contractVersion: '1.0';
  submissionId: string;
  attemptId: string;
  status: ExecutionRuntimeStatus;
  verdict: ExecutionVerdict | null;
  stdout: string;
  stderr: string;
  exitCode: number | null;
  executionTimeMs: number | null;
  memoryUsedMb: number | null;
  errorCode: string | null;
};

export interface ExecutionRuntimeAdapter {
  execute(request: ExecutionRuntimeRequest): Promise<ExecutionRuntimeResult>;
}

const executionRuntimeStatuses: readonly ExecutionRuntimeStatus[] = [
  'QUEUED',
  'INITIALIZING',
  'RUNNING',
  'SUCCEEDED',
  'FAILED',
  'TIMEOUT',
  'CANCELLED'
];

const executionLanguages: readonly ExecutionLanguage[] = ['JAVA', 'PYTHON'];

const executionVerdicts: readonly ExecutionVerdict[] = [
  'ACCEPTED',
  'WRONG_ANSWER',
  'COMPILE_ERROR',
  'RUNTIME_ERROR',
  'TIME_LIMIT',
  'MEMORY_LIMIT',
  'OUTPUT_LIMIT',
  'SYSTEM_ERROR'
];

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function hasOnlyKeys(value: Record<string, unknown>, keys: readonly string[]): boolean {
  return Object.keys(value).every((key) => keys.includes(key));
}

function isPositiveFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value > 0;
}

function isNonNegativeFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0;
}

function isExecutionRuntimeLimits(value: unknown): value is ExecutionRuntimeLimits {
  if (!isRecord(value) || !hasOnlyKeys(value, ['timeoutMs', 'memoryMb', 'pidsLimit', 'networkDisabled', 'user'])) {
    return false;
  }

  return (
    isPositiveFiniteNumber(value.timeoutMs) &&
    isPositiveFiniteNumber(value.memoryMb) &&
    Number.isInteger(value.pidsLimit) &&
    value.pidsLimit > 0 &&
    value.networkDisabled === true &&
    typeof value.user === 'string' &&
    value.user.trim().length > 0 &&
    value.user !== 'root' &&
    value.user !== '0' &&
    value.user !== '0:0'
  );
}

export function isExecutionRuntimeRequest(value: unknown): value is ExecutionRuntimeRequest {
  if (!isRecord(value) || !hasOnlyKeys(value, ['submissionId', 'attemptId', 'language', 'limits'])) {
    return false;
  }

  return (
    typeof value.submissionId === 'string' &&
    value.submissionId.length > 0 &&
    typeof value.attemptId === 'string' &&
    value.attemptId.length > 0 &&
    typeof value.language === 'string' &&
    executionLanguages.includes(value.language as ExecutionLanguage) &&
    isExecutionRuntimeLimits(value.limits)
  );
}

export function parseExecutionRuntimeRequest(value: unknown): ExecutionRuntimeRequest {
  if (!isExecutionRuntimeRequest(value)) {
    throw new Error('Invalid ExecutionRuntimeRequest');
  }

  return value;
}

export function isExecutionRuntimeResult(value: unknown): value is ExecutionRuntimeResult {
  if (
    !isRecord(value) ||
    !hasOnlyKeys(value, [
      'contractVersion',
      'submissionId',
      'attemptId',
      'status',
      'verdict',
      'stdout',
      'stderr',
      'exitCode',
      'executionTimeMs',
      'memoryUsedMb',
      'errorCode'
    ])
  ) {
    return false;
  }

  return (
    value.contractVersion === '1.0' &&
    typeof value.submissionId === 'string' &&
    value.submissionId.length > 0 &&
    typeof value.attemptId === 'string' &&
    value.attemptId.length > 0 &&
    typeof value.status === 'string' &&
    executionRuntimeStatuses.includes(value.status as ExecutionRuntimeStatus) &&
    (value.verdict === null || (typeof value.verdict === 'string' && executionVerdicts.includes(value.verdict as ExecutionVerdict))) &&
    typeof value.stdout === 'string' &&
    typeof value.stderr === 'string' &&
    (value.exitCode === null || Number.isInteger(value.exitCode)) &&
    (value.executionTimeMs === null || isNonNegativeFiniteNumber(value.executionTimeMs)) &&
    (value.memoryUsedMb === null || isNonNegativeFiniteNumber(value.memoryUsedMb)) &&
    (value.errorCode === null || (typeof value.errorCode === 'string' && value.errorCode.length > 0))
  );
}

export function parseExecutionRuntimeResult(value: unknown): ExecutionRuntimeResult {
  if (!isExecutionRuntimeResult(value)) {
    throw new Error('Invalid ExecutionRuntimeResult');
  }

  return value;
}
