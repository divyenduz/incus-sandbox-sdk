import { buildCommand, numberParser } from '@stricli/core';
import type { CliContext } from '../context';
import { incus } from '../../index';
import type { SandboxType } from '../../types';

interface CreateFlags {
  image?: string;
  type?: SandboxType;
  cpu?: number;
  memory?: string;
  mount?: string[];
}

async function createImpl(
  this: CliContext,
  flags: CreateFlags,
  name?: string
): Promise<void> {
  try {
    const sandbox = await incus.sandbox.create({
      name,
      image: flags.image,
      type: flags.type,
      limits: {
        cpu: flags.cpu,
        memory: flags.memory,
      },
    });

    if (flags.mount) {
      for (const mountSpec of flags.mount) {
        const parts = mountSpec.split(':');
        if (parts.length < 2) {
          this.process.stderr.write(`Invalid mount format: ${mountSpec}. Use source:target[:mode]\n`);
          continue;
        }
        const source = parts[0]!;
        const target = parts[1]!;
        const mode = parts[2] ?? 'overlay';
        if (mode !== 'overlay' && mode !== 'readonly' && mode !== 'readwrite') {
          this.process.stderr.write(`Invalid mount mode: ${mode}\n`);
          continue;
        }
        await sandbox.mount({ source, target, mode: mode as 'overlay' | 'readonly' | 'readwrite' });
      }
    }

    this.process.stdout.write(`${sandbox.name}\n`);
  } catch (err) {
    this.process.stderr.write(`Error: ${(err as Error).message}\n`);
    this.process.exitCode = 1;
  }
}

export const createCommand = buildCommand({
  loader: async () => createImpl,
  parameters: {
    positional: {
      kind: 'tuple',
      parameters: [
        {
          placeholder: 'name',
          brief: 'Sandbox name (auto-generated if omitted)',
          parse: String,
          optional: true,
        },
      ],
    },
    flags: {
      image: {
        kind: 'parsed',
        parse: String,
        brief: 'Image to use (e.g., images:ubuntu/24.04)',
        optional: true,
      },
      type: {
        kind: 'enum',
        values: ['container', 'vm'] as const,
        brief: 'Sandbox type',
        optional: true,
      },
      cpu: {
        kind: 'parsed',
        parse: numberParser,
        brief: 'CPU core limit',
        optional: true,
      },
      memory: {
        kind: 'parsed',
        parse: String,
        brief: 'Memory limit (e.g., 1GB)',
        optional: true,
      },
      mount: {
        kind: 'parsed',
        parse: String,
        variadic: true,
        brief: 'Mount host folder (source:target[:mode])',
        optional: true,
      },
    },
  },
  docs: {
    brief: 'Create a new sandbox',
  },
});
