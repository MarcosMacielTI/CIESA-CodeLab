import { describe, expect, it, vi } from 'vitest';

import {
  defaultSandboxLimits,
  defaultSandboxSecurityRequirements,
  DockerSandbox,
  FakeSandbox
} from './sandbox.js';

describe('sandbox abstraction', () => {
  it('creates and destroys the fake sandbox without external infrastructure', async () => {
    const sandbox = new FakeSandbox();

    expect(sandbox.state).toBe('NEW');
    await sandbox.create();
    expect(sandbox.state).toBe('CREATED');
    await sandbox.destroy();
    expect(sandbox.state).toBe('DESTROYED');
  });

  it('makes destroy safe after a failed creation', async () => {
    const sandbox = new FakeSandbox({ failCreate: true });

    await expect(sandbox.create()).rejects.toThrow('Fake sandbox creation failed');
    await expect(sandbox.destroy()).resolves.toBeUndefined();
    expect(sandbox.state).toBe('DESTROYED');
  });

  it('exposes the contractual initial resource limits', () => {
    expect(defaultSandboxLimits).toEqual({
      memoryMb: 128,
      cpuCores: 0.5,
      maxPids: 32,
      temporaryStorageMb: 16,
      maxStdoutBytes: 64 * 1024,
      maxStderrBytes: 64 * 1024,
      javaCompileTimeoutMs: 5_000,
      javaExecutionTimeoutMs: 2_000,
      pythonExecutionTimeoutMs: 2_000,
      totalJobTimeoutMs: 10_000
    });
  });

  it('requires the future sandbox to deny privileged capabilities and secrets', () => {
    expect(defaultSandboxSecurityRequirements).toEqual({
      nonRoot: true,
      readOnlyRootFilesystem: true,
      networkDisabled: true,
      noNewPrivileges: true,
      capabilitiesDropped: true,
      hostFilesystemMounts: false,
      dockerSocket: false,
      privileged: false,
      secrets: false,
      databaseCredentials: false,
      redisCredentials: false,
      apiCredentials: false
    });
  });

  it('does not expose an operation for commands or source code', () => {
    const sandbox = new FakeSandbox();

    expect(sandbox).not.toHaveProperty('run');
    expect(sandbox).not.toHaveProperty('execute');
    expect(sandbox).not.toHaveProperty('sourceCode');
  });

  it('creates, inspects and destroys a docker container without executing user code', async () => {
    const createContainer = vi.fn(async (options: unknown) => {
      expect(options).toMatchObject({
        Image: 'busybox:latest',
        Labels: expect.objectContaining({
          project: 'ciesa-codebench',
          component: 'executor',
          sandbox: 'true',
          'managed-by': 'ciesa'
        }),
        HostConfig: expect.objectContaining({
          NetworkMode: 'none',
          NoNewPrivileges: true,
          Privileged: false,
          ReadonlyRootfs: true,
          CapDrop: ['ALL'],
          Binds: [],
          PidsLimit: 32,
          Memory: 128 * 1024 * 1024,
          NanoCPUs: 500_000_000,
          Tmpfs: { '/tmp': 'rw,nosuid,nodev,noexec,size=16m' }
        }),
        User: '65532:65532'
      });

      return { id: 'container-123' };
    });

    const inspectContainer = vi.fn(async (id: string) => ({
      Id: id,
      Name: '/ciesa-sandbox-container-123',
      State: { Status: 'running' }
    }));

    const removeContainer = vi.fn(async () => undefined);

    const sandbox = new DockerSandbox({
      image: 'busybox:latest',
      dockerClient: {
        createContainer,
        inspectContainer,
        removeContainer
      } as any
    });

    await sandbox.create();
    expect(sandbox.state).toBe('CREATED');

    const info = await sandbox.inspect();
    expect(info.id).toBe('container-123');
    expect(info.state).toBe('running');
    expect(sandbox).not.toHaveProperty('run');
    expect(sandbox).not.toHaveProperty('execute');
    expect(sandbox).not.toHaveProperty('sourceCode');

    await sandbox.destroy();
    expect(sandbox.state).toBe('DESTROYED');
    expect(removeContainer).toHaveBeenCalledWith('container-123', expect.any(Object));
  });

  it('does not leave docker sandbox creation in a half-created state and handles failed creation', async () => {
    const sandbox = new DockerSandbox({
      image: 'busybox:latest',
      dockerClient: {
        createContainer: vi.fn(async () => {
          throw new Error('docker create failed');
        }),
        inspectContainer: vi.fn(),
        removeContainer: vi.fn(async () => undefined)
      } as any
    });

    await expect(sandbox.create()).rejects.toThrow('docker create failed');
    expect(sandbox.state).toBe('FAILED');
    await expect(sandbox.destroy()).resolves.toBeUndefined();
    expect(sandbox.state).toBe('DESTROYED');
  });

  it('supports idempotent destroy on a created sandbox', async () => {
    const removeContainer = vi.fn(async () => undefined);
    const sandbox = new DockerSandbox({
      image: 'busybox:latest',
      dockerClient: {
        createContainer: vi.fn(async () => ({ id: 'abc-1' })),
        inspectContainer: vi.fn(async () => ({ Id: 'abc-1', State: { Status: 'exited' } })),
        removeContainer
      } as any
    });

    await sandbox.create();
    await sandbox.destroy();
    await sandbox.destroy();

    expect(removeContainer).toHaveBeenCalledTimes(1);
    expect(sandbox.state).toBe('DESTROYED');
  });
});
