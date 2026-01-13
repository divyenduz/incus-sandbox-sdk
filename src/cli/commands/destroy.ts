import { buildCommand } from '@stricli/core';
import type { CliContext } from '../context';
import { incus } from '../../index';

interface DestroyFlags {
  force?: boolean;
}

async function destroyImpl(
  this: CliContext,
  flags: DestroyFlags,
  name: string
): Promise<void> {
  try {
    const sandbox = await incus.sandbox.getByName(name);
    await sandbox.destroy({ force: flags.force });
    this.process.stdout.write(`Destroyed ${name}\n`);
  } catch (err) {
    this.process.stderr.write(`Error: ${(err as Error).message}\n`);
    this.process.exitCode = 1;
  }
}

export const destroyCommand = buildCommand({
  loader: async () => destroyImpl,
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
    flags: {
      force: {
        kind: 'boolean',
        brief: 'Force destroy even if running',
        optional: true,
      },
    },
  },
  docs: {
    brief: 'Destroy a sandbox',
  },
});
