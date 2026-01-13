import { buildCommand } from '@stricli/core';
import type { CliContext } from '../context';
import { incus } from '../../index';

async function restoreImpl(
  this: CliContext,
  flags: {},
  name: string,
  snapName: string
): Promise<void> {
  try {
    const sandbox = await incus.sandbox.getByName(name);
    await sandbox.restore(snapName);
    this.process.stdout.write(`Restored snapshot '${snapName}'\n`);
  } catch (err) {
    this.process.stderr.write(`Error: ${(err as Error).message}\n`);
    this.process.exitCode = 1;
  }
}

export const restoreCommand = buildCommand({
  loader: async () => restoreImpl,
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
          placeholder: 'snapshot-name',
          brief: 'Snapshot to restore',
          parse: String,
        },
      ],
    },
  },
  docs: {
    brief: 'Restore a sandbox from a snapshot',
  },
});
