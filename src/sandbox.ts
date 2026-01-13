import { nanoid } from 'nanoid';
import * as client from './client';
import { FileSystem } from './filesystem';
import {
  SandboxNotFoundError,
  SandboxNotRunningError,
  TimeoutError,
  NameConflictError,
} from './errors';
import type {
  SandboxOptions,
  SandboxType,
  SandboxState,
  SandboxInfo,
  ListOptions,
  DestroyOptions,
  StopOptions,
  CommandOptions,
  CommandResult,
  CodeOptions,
  CodeResult,
  SnapshotInfo,
} from './types';
import { DEFAULT_CONFIG, LANGUAGE_COMMANDS } from './types';

export class Sandbox {
  readonly name: string;
  readonly type: SandboxType;
  readonly fs: FileSystem;

  constructor(name: string, type: SandboxType) {
    this.name = name;
    this.type = type;
    this.fs = new FileSystem(name);
  }

  async runCommand(command: string, options?: CommandOptions): Promise<CommandResult> {
    const state = await this.getState();
    if (state !== 'running') {
      throw new SandboxNotRunningError(this.name);
    }

    const startTime = Date.now();
    const result = await client.execInInstance(
      this.name,
      ['sh', '-c', command],
      {
        cwd: options?.cwd,
        env: options?.env,
        user: options?.user,
        timeout: options?.timeout ?? 30000,
      }
    );

    return {
      stdout: result.stdout,
      stderr: result.stderr,
      exitCode: result.exitCode,
      durationMs: Date.now() - startTime,
    };
  }

  async runCode(code: string, options: CodeOptions): Promise<CodeResult> {
    const langConfig = LANGUAGE_COMMANDS[options.language];
    const tempFile = `/tmp/code-${nanoid()}.${langConfig.ext}`;

    await this.fs.writeFile(tempFile, code);

    const startTime = Date.now();
    try {
      const cmdParts = langConfig.cmd.split(' ');
      const fullCommand = [...cmdParts, tempFile].join(' ');

      const result = await this.runCommand(fullCommand, {
        timeout: options.timeout ?? 30000,
        env: options.env,
      });

      return {
        output: result.stdout + result.stderr,
        exitCode: result.exitCode,
        language: options.language,
        durationMs: Date.now() - startTime,
      };
    } finally {
      await this.fs.rm(tempFile, { force: true }).catch(() => {});
    }
  }

  async start(): Promise<void> {
    await client.startInstance(this.name);
  }

  async stop(options?: StopOptions): Promise<void> {
    await client.stopInstance(this.name, options?.force, options?.timeout);
  }

  async restart(): Promise<void> {
    await client.restartInstance(this.name);
  }

  async getState(): Promise<SandboxState> {
    const instance = await client.getInstance(this.name);
    if (!instance) {
      throw new SandboxNotFoundError(this.name);
    }
    return instance.state;
  }

  async destroy(options?: DestroyOptions): Promise<void> {
    if (options?.deleteSnapshots !== false) {
      const snapshots = await this.listSnapshots();
      for (const snap of snapshots) {
        await this.deleteSnapshot(snap.name);
      }
    }

    await client.deleteInstance(this.name, options?.force ?? true);
  }

  async snapshot(name: string): Promise<void> {
    await client.createSnapshot(this.name, name);
  }

  async restore(name: string): Promise<void> {
    await client.restoreSnapshot(this.name, name);
  }

  async listSnapshots(): Promise<SnapshotInfo[]> {
    return client.listSnapshots(this.name);
  }

  async deleteSnapshot(name: string): Promise<void> {
    await client.deleteSnapshot(this.name, name);
  }
}

export const sandbox = {
  async create(options?: SandboxOptions): Promise<Sandbox> {
    const config = client.getConfig();
    const name = options?.name ?? `sandbox-${nanoid(8)}`;
    const type = options?.type ?? config.defaultType;
    const image = options?.image ?? config.defaultImage;
    const timeout = options?.timeout ?? 60000;

    const existing = await client.getInstance(name);
    if (existing) {
      throw new NameConflictError(name);
    }

    await client.launchInstance(name, image, type, options?.limits, options?.profiles);

    const startTime = Date.now();
    while (Date.now() - startTime < timeout) {
      const instance = await client.getInstance(name);
      if (instance?.state === 'running') {
        return new Sandbox(name, type);
      }
      await new Promise((resolve) => setTimeout(resolve, 500));
    }

    throw new TimeoutError('sandbox creation', timeout);
  },

  async getByName(name: string): Promise<Sandbox> {
    const instance = await client.getInstance(name);
    if (!instance) {
      throw new SandboxNotFoundError(name);
    }
    return new Sandbox(name, instance.type);
  },

  async list(options?: ListOptions): Promise<SandboxInfo[]> {
    return client.listInstances({
      type: options?.type,
      prefix: options?.prefix,
    });
  },
};
