import { buildCommand } from '@stricli/core';
import type { CliContext } from '../context';
import { incus } from '../../index';

async function snapshotsImpl(this: CliContext, flags: {}, name: string): Promise<void> {
  try {
    const sandbox = await incus.sandbox.getByName(name);
    const snapshots = await sandbox.listSnapshots();

    if (snapshots.length === 0) {
      this.process.stdout.write('No snapshots\n');
      return;
    }

    const header = 'NAME\tCREATED\tSTATEFUL';
    this.process.stdout.write(header + '\n');

    for (const s of snapshots) {
      const created = s.createdAt.toISOString().split('T')[0];
      this.process.stdout.write(`${s.name}\t${created}\t${s.stateful}\n`);
    }
  } catch (err) {
    this.process.stderr.write(`Error: ${(err as Error).message}\n`);
    this.process.exitCode = 1;
  }
}

export const snapshotsCommand = buildCommand({
  loader: async () => snapshotsImpl,
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
    brief: 'List snapshots of a sandbox',
  },
});
