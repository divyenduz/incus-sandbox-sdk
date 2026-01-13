import { buildCommand } from '@stricli/core';
import type { CliContext } from '../context';
import { incus } from '../../index';

async function snapshotImpl(
  this: CliContext,
  flags: {},
  name: string,
  snapName: string
): Promise<void> {
  try {
    const sandbox = await incus.sandbox.getByName(name);
    await sandbox.snapshot(snapName);
    this.process.stdout.write(`Created snapshot '${snapName}'\n`);
  } catch (err) {
    this.process.stderr.write(`Error: ${(err as Error).message}\n`);
    this.process.exitCode = 1;
  }
}

export const snapshotCommand = buildCommand({
  loader: async () => snapshotImpl,
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
          brief: 'Name for the snapshot',
          parse: String,
        },
      ],
    },
  },
  docs: {
    brief: 'Create a snapshot of a sandbox',
  },
});
