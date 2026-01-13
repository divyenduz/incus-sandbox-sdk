export type SandboxType = 'container' | 'vm';
export type SandboxState = 'running' | 'stopped' | 'frozen' | 'error';
export type Language = 'python' | 'node' | 'bash' | 'ruby' | 'go';

export interface SandboxLimits {
  cpu?: number;
  memory?: string;
  disk?: string;
}

export interface SandboxOptions {
  image?: string;
  type?: SandboxType;
  name?: string;
  limits?: SandboxLimits;
  profiles?: string[];
  autoDestroy?: boolean;
  timeout?: number;
  mounts?: MountOptions[];
}

export interface ListOptions {
  type?: SandboxType | 'all';
  state?: SandboxState;
  prefix?: string;
}

export interface DestroyOptions {
  force?: boolean;
  deleteSnapshots?: boolean;
}

export interface StopOptions {
  force?: boolean;
  timeout?: number;
}

export interface CommandOptions {
  cwd?: string;
  env?: Record<string, string>;
  user?: string;
  timeout?: number;
  stdin?: string;
}

export interface CommandResult {
  stdout: string;
  stderr: string;
  exitCode: number;
  durationMs: number;
}

export interface CodeOptions {
  language: Language;
  timeout?: number;
  env?: Record<string, string>;
}

export interface CodeResult {
  output: string;
  exitCode: number;
  language: string;
  durationMs: number;
}

export interface WriteOptions {
  mode?: string;
  owner?: string;
}

export interface MkdirOptions {
  recursive?: boolean;
  mode?: string;
}

export interface RmOptions {
  recursive?: boolean;
  force?: boolean;
}

export interface FileStat {
  name: string;
  type: 'file' | 'directory' | 'symlink';
  size: number;
  mode: string;
  uid: number;
  gid: number;
  mtime: Date;
}

export interface SnapshotInfo {
  name: string;
  createdAt: Date;
  stateful: boolean;
}

export type MountMode = 'overlay' | 'readonly' | 'readwrite';

export interface MountOptions {
  source: string;
  target: string;
  mode?: MountMode;
  shift?: boolean;
}

export interface MountInfo {
  source: string;
  target: string;
  mode: MountMode;
  device: string;
}

export interface SandboxInfo {
  name: string;
  type: SandboxType;
  state: SandboxState;
  createdAt: Date;
  image?: string;
}

export interface IncusConfig {
  socket?: string;
  remote?: string;
  project?: string;
  defaultImage?: string;
  defaultType?: SandboxType;
}

export const DEFAULT_CONFIG: Required<IncusConfig> = {
  socket: '/var/lib/incus/unix.socket',
  remote: 'local',
  project: 'default',
  defaultImage: 'images:ubuntu/24.04',
  defaultType: 'container',
};

export const LANGUAGE_COMMANDS: Record<Language, { ext: string; cmd: string }> = {
  python: { ext: 'py', cmd: 'python3' },
  node: { ext: 'js', cmd: 'node' },
  bash: { ext: 'sh', cmd: 'bash' },
  ruby: { ext: 'rb', cmd: 'ruby' },
  go: { ext: 'go', cmd: 'go run' },
};
