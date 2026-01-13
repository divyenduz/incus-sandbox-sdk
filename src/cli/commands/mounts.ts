import { buildCommand } from '@stricli/core';
import type { CliContext } from '../context';
import { incus } from '../../index';

async function mountsImpl(this: CliContext, flags: {}, name: string): Promise<void> {
  try {
    const sandbox = await incus.sandbox.getByName(name);
    const mounts = await sandbox.listMounts();

    if (mounts.length === 0) {
      this.process.stdout.write('No mounts\n');
      return;
    }

    const header = 'SOURCE\tTARGET\tMODE';
    this.process.stdout.write(header + '\n');

    for (const m of mounts) {
      this.process.stdout.write(`${m.source}\t${m.target}\t${m.mode}\n`);
    }
  } catch (err) {
    this.process.stderr.write(`Error: ${(err as Error).message}\n`);
    this.process.exitCode = 1;
  }
}

export const mountsCommand = buildCommand({
  loader: async () => mountsImpl,
  parameters: {
    positional: {
      kind: 'tuple',
      parameters: [
        {
          placeholder: 'name',
          brief: 'Sandbox name',
          parse: String,
        },
      ],
    },
  },
  docs: {
    brief: 'List mounts in a sandbox',
  },
});
