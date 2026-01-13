import { spawn } from 'child_process';
import type { IncusConfig, SandboxInfo, SandboxState, SandboxType } from './types';
import { DEFAULT_CONFIG } from './types';
import { IncusConnectionError, CommandError } from './errors';

let config: Required<IncusConfig> = { ...DEFAULT_CONFIG };

export function setConfig(newConfig: IncusConfig): void {
  config = { ...DEFAULT_CONFIG, ...newConfig };
}

export function getConfig(): Required<IncusConfig> {
  return config;
}

export interface ExecResult {
  stdout: string;
  stderr: string;
  exitCode: number;
}

export async function execIncus(args: string[], options?: { timeout?: number; stdin?: string }): Promise<ExecResult> {
  const timeout = options?.timeout ?? 60000;

  return new Promise((resolve, reject) => {
    const proc = spawn('incus', args, {
      stdio: ['pipe', 'pipe', 'pipe'],
      env: { ...process.env, LANG: 'C' },
    });

    let stdout = '';
    let stderr = '';
    let timeoutId: Timer | undefined;

    if (timeout > 0) {
      timeoutId = setTimeout(() => {
        proc.kill('SIGTERM');
        reject(new IncusConnectionError(`Command timed out after ${timeout}ms`));
      }, timeout);
    }

    proc.stdout.on('data', (data) => {
      stdout += data.toString();
    });

    proc.stderr.on('data', (data) => {
      stderr += data.toString();
    });

    if (options?.stdin) {
      proc.stdin.write(options.stdin);
      proc.stdin.end();
    } else {
      proc.stdin.end();
    }

    proc.on('error', (err) => {
      if (timeoutId) clearTimeout(timeoutId);
      reject(new IncusConnectionError(`Failed to execute incus command: ${err.message}`, err));
    });

    proc.on('close', (code) => {
      if (timeoutId) clearTimeout(timeoutId);
      resolve({
        stdout,
        stderr,
        exitCode: code ?? 0,
      });
    });
  });
}

export async function checkIncusAvailable(): Promise<boolean> {
  try {
    const result = await execIncus(['version']);
    return result.exitCode === 0;
  } catch {
    return false;
  }
}

export async function listInstances(options?: {
  type?: SandboxType | 'all';
  prefix?: string;
}): Promise<SandboxInfo[]> {
  const args = ['list', '--format', 'json'];

  if (options?.type && options.type !== 'all') {
    args.push('--type', options.type);
  }

  const result = await execIncus(args);
  if (result.exitCode !== 0) {
    throw new CommandError(`Failed to list instances: ${result.stderr}`);
  }

  const instances = JSON.parse(result.stdout) as Array<{
    name: string;
    type: string;
    status: string;
    created_at: string;
    config?: Record<string, string>;
  }>;

  return instances
    .filter((i) => !options?.prefix || i.name.startsWith(options.prefix))
    .map((i) => ({
      name: i.name,
      type: i.type as SandboxType,
      state: mapStatus(i.status),
      createdAt: new Date(i.created_at),
      image: i.config?.['image.description'],
    }));
}

export async function getInstance(name: string): Promise<{
  name: string;
  type: SandboxType;
  state: SandboxState;
  createdAt: Date;
} | null> {
  const result = await execIncus(['query', `/1.0/instances/${name}`]);

  if (result.exitCode !== 0) {
    return null;
  }

  try {
    const instance = JSON.parse(result.stdout) as {
      name: string;
      type: string;
      status: string;
      created_at: string;
    };

    return {
      name: instance.name,
      type: instance.type as SandboxType,
      state: mapStatus(instance.status),
      createdAt: new Date(instance.created_at),
    };
  } catch {
    return null;
  }
}

function mapStatus(status: string): SandboxState {
  const s = status.toLowerCase();
  if (s === 'running') return 'running';
  if (s === 'stopped') return 'stopped';
  if (s === 'frozen') return 'frozen';
  return 'error';
}

export async function launchInstance(
  name: string,
  image: string,
  type: SandboxType,
  limits?: { cpu?: number; memory?: string },
  profiles?: string[]
): Promise<void> {
  const args = ['launch', image, name];

  if (type === 'vm') {
    args.push('--vm');
  }

  if (profiles && profiles.length > 0) {
    for (const profile of profiles) {
      args.push('--profile', profile);
    }
  }

  if (limits?.cpu) {
    args.push('--config', `limits.cpu=${limits.cpu}`);
  }

  if (limits?.memory) {
    args.push('--config', `limits.memory=${limits.memory}`);
  }

  const result = await execIncus(args, { timeout: 120000 });

  if (result.exitCode !== 0) {
    throw new CommandError(`Failed to launch instance: ${result.stderr}`);
  }
}

export async function deleteInstance(name: string, force: boolean = false): Promise<void> {
  const args = ['delete', name];
  if (force) {
    args.push('--force');
  }

  const result = await execIncus(args);
  if (result.exitCode !== 0) {
    throw new CommandError(`Failed to delete instance: ${result.stderr}`);
  }
}

export async function startInstance(name: string): Promise<void> {
  const result = await execIncus(['start', name]);
  if (result.exitCode !== 0) {
    throw new CommandError(`Failed to start instance: ${result.stderr}`);
  }
}

export async function stopInstance(name: string, force: boolean = false, timeout?: number): Promise<void> {
  const args = ['stop', name];
  if (force) {
    args.push('--force');
  }
  if (timeout) {
    args.push('--timeout', String(Math.floor(timeout / 1000)));
  }

  const result = await execIncus(args);
  if (result.exitCode !== 0) {
    throw new CommandError(`Failed to stop instance: ${result.stderr}`);
  }
}

export async function restartInstance(name: string): Promise<void> {
  const result = await execIncus(['restart', name]);
  if (result.exitCode !== 0) {
    throw new CommandError(`Failed to restart instance: ${result.stderr}`);
  }
}

export async function execInInstance(
  name: string,
  command: string[],
  options?: { cwd?: string; env?: Record<string, string>; user?: string; timeout?: number }
): Promise<ExecResult> {
  const args = ['exec', name];

  if (options?.cwd) {
    args.push('--cwd', options.cwd);
  }

  if (options?.user) {
    args.push('--user', options.user);
  }

  if (options?.env) {
    for (const [key, value] of Object.entries(options.env)) {
      args.push('--env', `${key}=${value}`);
    }
  }

  args.push('--');
  args.push(...command);

  return execIncus(args, { timeout: options?.timeout ?? 30000 });
}

export async function pushFile(name: string, localPath: string, remotePath: string): Promise<void> {
  const result = await execIncus(['file', 'push', '-p', localPath, `${name}${remotePath}`]);
  if (result.exitCode !== 0) {
    throw new CommandError(`Failed to push file: ${result.stderr}`);
  }
}

export async function pullFile(name: string, remotePath: string, localPath: string): Promise<void> {
  const result = await execIncus(['file', 'pull', `${name}${remotePath}`, localPath]);
  if (result.exitCode !== 0) {
    throw new CommandError(`Failed to pull file: ${result.stderr}`);
  }
}

export async function createSnapshot(name: string, snapshotName: string): Promise<void> {
  const result = await execIncus(['snapshot', 'create', name, snapshotName]);
  if (result.exitCode !== 0) {
    throw new CommandError(`Failed to create snapshot: ${result.stderr}`);
  }
}

export async function restoreSnapshot(name: string, snapshotName: string): Promise<void> {
  const result = await execIncus(['snapshot', 'restore', name, snapshotName]);
  if (result.exitCode !== 0) {
    throw new CommandError(`Failed to restore snapshot: ${result.stderr}`);
  }
}

export async function deleteSnapshot(name: string, snapshotName: string): Promise<void> {
  const result = await execIncus(['snapshot', 'delete', name, snapshotName]);
  if (result.exitCode !== 0) {
    throw new CommandError(`Failed to delete snapshot: ${result.stderr}`);
  }
}

export async function listSnapshots(name: string): Promise<Array<{ name: string; createdAt: Date; stateful: boolean }>> {
  const result = await execIncus(['snapshot', 'list', name, '--format', 'json']);
  if (result.exitCode !== 0) {
    throw new CommandError(`Failed to list snapshots: ${result.stderr}`);
  }

  const snapshots = JSON.parse(result.stdout || '[]') as Array<{
    name: string;
    created_at: string;
    stateful: boolean;
  }>;

  return snapshots.map((s) => ({
    name: s.name,
    createdAt: new Date(s.created_at),
    stateful: s.stateful,
  }));
}

export async function addDiskDevice(
  instanceName: string,
  deviceName: string,
  source: string,
  path: string,
  options?: { readonly?: boolean; shift?: boolean }
): Promise<void> {
  const args = ['config', 'device', 'add', instanceName, deviceName, 'disk', `source=${source}`, `path=${path}`];

  if (options?.readonly) {
    args.push('readonly=true');
  }

  if (options?.shift === true) {
    args.push('shift=true');
  }

  const result = await execIncus(args);
  if (result.exitCode !== 0) {
    throw new CommandError(`Failed to add disk device: ${result.stderr}`);
  }
}

export async function removeDiskDevice(instanceName: string, deviceName: string): Promise<void> {
  const result = await execIncus(['config', 'device', 'remove', instanceName, deviceName]);
  if (result.exitCode !== 0) {
    throw new CommandError(`Failed to remove disk device: ${result.stderr}`);
  }
}

export async function setInstanceConfig(instanceName: string, key: string, value: string): Promise<void> {
  const result = await execIncus(['config', 'set', instanceName, `${key}=${value}`]);
  if (result.exitCode !== 0) {
    throw new CommandError(`Failed to set config ${key}: ${result.stderr}`);
  }
}

export async function getInstanceConfig(instanceName: string, key: string): Promise<string | null> {
  const result = await execIncus(['config', 'get', instanceName, key]);
  if (result.exitCode !== 0) {
    return null;
  }
  return result.stdout.trim();
}

export async function listDevices(instanceName: string): Promise<
  Record<string, { type: string; source?: string; path?: string; readonly?: string; shift?: string }>
> {
  const result = await execIncus(['config', 'device', 'show', instanceName]);
  if (result.exitCode !== 0) {
    throw new CommandError(`Failed to list devices: ${result.stderr}`);
  }

  if (!result.stdout.trim()) {
    return {};
  }

  const lines = result.stdout.split('\n');
  const devices: Record<string, Record<string, string>> = {};
  let currentDevice: string | null = null;

  for (const line of lines) {
    if (!line.startsWith(' ') && line.endsWith(':')) {
      currentDevice = line.slice(0, -1);
      devices[currentDevice] = {};
    } else if (currentDevice && line.includes(':')) {
      const [key, ...valueParts] = line.trim().split(':');
      if (key) {
        devices[currentDevice]![key.trim()] = valueParts.join(':').trim();
      }
    }
  }

  return devices as Record<string, { type: string; source?: string; path?: string; readonly?: string; shift?: string }>;
}
