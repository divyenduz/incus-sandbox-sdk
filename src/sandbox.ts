import { nanoid } from 'nanoid';
import * as client from './client';
import { FileSystem } from './filesystem';
import {
  SandboxNotFoundError,
  SandboxNotRunningError,
  TimeoutError,
  NameConflictError,
  MountError,
  PathNotFoundError,
  MountNotFoundError,
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
  MountOptions,
  MountInfo,
  MountMode,
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

  async mount(options: MountOptions): Promise<MountInfo> {
    const mode: MountMode = options.mode ?? 'overlay';
    const shift = options.shift === true;
    const deviceName = `mount-${nanoid(6)}`;

    const fs = await import('fs/promises');
    try {
      await fs.access(options.source);
    } catch {
      throw new PathNotFoundError(options.source);
    }

    const state = await this.getState();
    if (state !== 'running') {
      throw new SandboxNotRunningError(this.name);
    }

    if (mode === 'overlay') {
      if (this.type === 'vm') {
        throw new MountError('Overlay mode is not supported for VMs, use readonly or readwrite mode');
      }

      const basePath = `/.overlay-base/${deviceName}`;
      const workDir = `/.overlay-work/${deviceName}`;

      const currentIntercept = await client.getInstanceConfig(this.name, 'security.syscalls.intercept.mount');
      if (currentIntercept !== 'true') {
        await client.setInstanceConfig(this.name, 'security.syscalls.intercept.mount', 'true');
        await client.setInstanceConfig(this.name, 'security.syscalls.intercept.mount.allowed', 'overlay');
        await client.restartInstance(this.name);
        const startTime = Date.now();
        while (Date.now() - startTime < 30000) {
          const state = await this.getState();
          if (state === 'running') break;
          await new Promise((r) => setTimeout(r, 500));
        }
      }

      await client.addDiskDevice(this.name, deviceName, options.source, basePath, {
        readonly: true,
        shift,
      });

      const mkdirResult = await client.execInInstance(this.name, [
        'mkdir',
        '-p',
        `${workDir}/upper`,
        `${workDir}/work`,
        options.target,
      ]);
      if (mkdirResult.exitCode !== 0) {
        await client.removeDiskDevice(this.name, deviceName).catch(() => {});
        throw new MountError(`Failed to create overlay directories: ${mkdirResult.stderr}`);
      }

      const mountResult = await client.execInInstance(this.name, [
        'mount',
        '-t',
        'overlay',
        'overlay',
        '-o',
        `lowerdir=${basePath},upperdir=${workDir}/upper,workdir=${workDir}/work`,
        options.target,
      ]);
      if (mountResult.exitCode !== 0) {
        await client.removeDiskDevice(this.name, deviceName).catch(() => {});
        throw new MountError(`Failed to mount overlay: ${mountResult.stderr}`);
      }
    } else if (mode === 'readonly') {
      await client.addDiskDevice(this.name, deviceName, options.source, options.target, {
        readonly: true,
        shift,
      });
    } else {
      await client.addDiskDevice(this.name, deviceName, options.source, options.target, {
        readonly: false,
        shift,
      });
    }

    return {
      source: options.source,
      target: options.target,
      mode,
      device: deviceName,
    };
  }

  async unmount(target: string): Promise<void> {
    const mounts = await this.listMounts();
    const mount = mounts.find((m) => m.target === target);

    if (!mount) {
      throw new MountNotFoundError(target);
    }

    if (mount.mode === 'overlay') {
      await client.execInInstance(this.name, ['umount', target]).catch(() => {});
      await client.execInInstance(this.name, ['rm', '-rf', `/.overlay-work/${mount.device}`]).catch(() => {});
    }

    await client.removeDiskDevice(this.name, mount.device);
  }

  async listMounts(): Promise<MountInfo[]> {
    const devices = await client.listDevices(this.name);
    const mounts: MountInfo[] = [];

    for (const [deviceName, device] of Object.entries(devices)) {
      if (device.type !== 'disk' || !deviceName.startsWith('mount-')) {
        continue;
      }

      let mode: MountMode = 'readwrite';
      let target = device.path || '';

      if (device.path?.startsWith('/.overlay-base/')) {
        mode = 'overlay';
        const overlayDevice = device.path.replace('/.overlay-base/', '');
        const mountsOutput = await client.execInInstance(this.name, ['mount']);
        const overlayLine = mountsOutput.stdout
          .split('\n')
          .find((line) => line.includes(`/.overlay-work/${overlayDevice}/upper`));
        if (overlayLine) {
          const match = overlayLine.match(/on (.+?) type overlay/);
          if (match && match[1]) {
            target = match[1];
          }
        }
      } else if (device.readonly === 'true') {
        mode = 'readonly';
      }

      if (device.source && target) {
        mounts.push({
          source: device.source,
          target,
          mode,
          device: deviceName,
        });
      }
    }

    return mounts;
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
