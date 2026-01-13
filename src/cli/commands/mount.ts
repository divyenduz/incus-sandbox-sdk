import { buildCommand } from '@stricli/core';
import type { CliContext } from '../context';
import { incus } from '../../index';
import type { MountMode } from '../../types';

interface MountFlags {
  mode?: MountMode;
}

async function mountImpl(
  this: CliContext,
  flags: MountFlags,
  name: string,
  source: string,
  target: string
): Promise<void> {
  try {
    const sandbox = await incus.sandbox.getByName(name);
    const mount = await sandbox.mount({
      source,
      target,
      mode: flags.mode ?? 'overlay',
    });
    this.process.stdout.write(`Mounted ${mount.source} -> ${mount.target} (${mount.mode})\n`);
  } catch (err) {
    this.process.stderr.write(`Error: ${(err as Error).message}\n`);
    this.process.exitCode = 1;
  }
}

export const mountCommand = buildCommand({
  loader: async () => mountImpl,
  parameters: {
    positional: {
      kind: 'tuple',
      parameters: [
        {
          placeholder: 'name',
          brief: 'Sandbox name',
          parse: String,
        },
        {
          placeholder: 'source',
          brief: 'Host directory path',
          parse: String,
        },
        {
          placeholder: 'target',
          brief: 'Path inside sandbox',
          parse: String,
        },
      ],
    },
    flags: {
      mode: {
        kind: 'enum',
        values: ['overlay', 'readonly', 'readwrite'] as const,
        brief: 'Mount mode (default: overlay)',
        optional: true,
      },
    },
  },
  docs: {
    brief: 'Mount a host directory into a sandbox',
  },
});
