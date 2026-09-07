import Docker from 'dockerode';

export type SandboxLimits = {
  memoryMb: 128;
  cpuCores: 0.5;
  maxPids: 32;
  temporaryStorageMb: 16;
  maxStdoutBytes: number;
  maxStderrBytes: number;
  javaCompileTimeoutMs: 5_000;
  javaExecutionTimeoutMs: 2_000;
  pythonExecutionTimeoutMs: 2_000;
  totalJobTimeoutMs: 10_000;
};

export type SandboxSecurityRequirements = {
  nonRoot: true;
  readOnlyRootFilesystem: true;
  networkDisabled: true;
  noNewPrivileges: true;
  capabilitiesDropped: true;
  hostFilesystemMounts: false;
  dockerSocket: false;
  privileged: false;
  secrets: false;
  databaseCredentials: false;
  redisCredentials: false;
  apiCredentials: false;
};

export const defaultSandboxLimits: SandboxLimits = {
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
};

export const defaultSandboxSecurityRequirements: SandboxSecurityRequirements = {
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
};

export type SandboxState = 'NEW' | 'CREATING' | 'CREATED' | 'DESTROYING' | 'DESTROYED' | 'FAILED';

export type SandboxInspection = {
  id: string;
  name: string;
  state: string;
};

export interface ExecutionSandbox {
  readonly state: SandboxState;
  create(): Promise<void>;
  inspect(): Promise<SandboxInspection>;
  destroy(): Promise<void>;
}

export type DockerSandboxClient = {
  createContainer(options: Record<string, unknown>): Promise<{ id: string }>;
  inspectContainer(id: string): Promise<{ Id?: string; Name?: string; State?: { Status?: string } }>;
  removeContainer(id: string, options?: Record<string, unknown>): Promise<void>;
};

export type DockerSandboxOptions = {
  image?: string;
  name?: string;
  dockerClient?: DockerSandboxClient;
};

class DockerDefaultClient implements DockerSandboxClient {
  private readonly docker: Docker;

  constructor() {
    this.docker = new Docker();
  }

  async createContainer(options: Record<string, unknown>): Promise<{ id: string }> {
    const container = await this.docker.createContainer(options);
    return { id: container.id };
  }

  async inspectContainer(id: string): Promise<{ Id?: string; Name?: string; State?: { Status?: string } }> {
    return this.docker.getContainer(id).inspect();
  }

  async removeContainer(id: string, options: Record<string, unknown> = {}): Promise<void> {
    const container = this.docker.getContainer(id);
    await container.remove(options);
  }
}

export class DockerSandbox implements ExecutionSandbox {
  private currentState: SandboxState = 'NEW';
  private readonly image: string;
  private readonly name: string;
  private readonly dockerClient: DockerSandboxClient;
  private containerId: string | null = null;

  constructor(options: DockerSandboxOptions = {}) {
    this.image = options.image ?? 'busybox:latest';
    this.name = options.name ?? `ciesa-sandbox-${Date.now()}`;
    this.dockerClient = options.dockerClient ?? new DockerDefaultClient();
  }

  get state(): SandboxState {
    return this.currentState;
  }

  async create(): Promise<void> {
    if (this.currentState === 'DESTROYED') {
      throw new Error('Sandbox cannot be created after destruction');
    }

    if (this.currentState === 'CREATED') {
      return;
    }

    this.currentState = 'CREATING';

    try {
      const created = await this.dockerClient.createContainer({
        Image: this.image,
        Name: this.name,
        Labels: {
          project: 'ciesa-codebench',
          component: 'executor',
          sandbox: 'true',
          'managed-by': 'ciesa'
        },
        Hostname: this.name,
        Tty: false,
        OpenStdin: false,
        User: '65532:65532',
        NetworkDisabled: true,
        HostConfig: {
          NetworkMode: 'none',
          NoNewPrivileges: true,
          Privileged: false,
          ReadonlyRootfs: true,
          CapDrop: ['ALL'],
          Binds: [],
          Mounts: [],
          PidsLimit: 32,
          Memory: 128 * 1024 * 1024,
          NanoCPUs: 500_000_000,
          Tmpfs: {
            '/tmp': 'rw,nosuid,nodev,noexec,size=16m'
          }
        },
        SecurityOpt: ['no-new-privileges'],
        Volumes: {},
        NetworkingConfig: {
          EndpointsConfig: {}
        }
      });

      this.containerId = created.id;
      this.currentState = 'CREATED';
    } catch (error) {
      this.containerId = null;
      this.currentState = 'FAILED';
      throw error;
    }
  }

  async inspect(): Promise<SandboxInspection> {
    if (!this.containerId) {
      throw new Error('Sandbox container has not been created');
    }

    const inspected = await this.dockerClient.inspectContainer(this.containerId);
    return {
      id: inspected.Id ?? this.containerId,
      name: inspected.Name ? inspected.Name.replace(/^\//, '') : this.name,
      state: inspected.State?.Status ?? 'unknown'
    };
  }

  async destroy(): Promise<void> {
    if (this.currentState === 'DESTROYED') {
      return;
    }

    if (!this.containerId) {
      this.currentState = 'DESTROYED';
      return;
    }

    this.currentState = 'DESTROYING';

    try {
      await this.dockerClient.removeContainer(this.containerId, {
        force: true,
        removeVolumes: false,
        v: false
      });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      if (!message.includes('No such container')) {
        throw error;
      }
    } finally {
      this.containerId = null;
      this.currentState = 'DESTROYED';
    }
  }
}

export type FakeSandboxOptions = {
  failCreate?: boolean;
};

export class FakeSandbox implements ExecutionSandbox {
  private currentState: SandboxState = 'NEW';
  private readonly failCreate: boolean;

  constructor(options: FakeSandboxOptions = {}) {
    this.failCreate = options.failCreate ?? false;
  }

  get state(): SandboxState {
    return this.currentState;
  }

  async create(): Promise<void> {
    if (this.currentState === 'DESTROYED') {
      throw new Error('Sandbox cannot be created after destruction');
    }

    if (this.failCreate) {
      this.currentState = 'FAILED';
      throw new Error('Fake sandbox creation failed');
    }

    this.currentState = 'CREATED';
  }

  async inspect(): Promise<SandboxInspection> {
    return {
      id: 'fake-sandbox',
      name: 'fake-sandbox',
      state: this.currentState === 'CREATED' ? 'created' : this.currentState === 'FAILED' ? 'failed' : 'new'
    };
  }

  async destroy(): Promise<void> {
    this.currentState = 'DESTROYED';
  }
}
