import { buildCommand } from '@stricli/core';
import type { CliContext } from '../context';
import { incus } from '../../index';

interface StopFlags {
  force?: boolean;
}

async function stopImpl(this: CliContext, flags: StopFlags, name: string): Promise<void> {
  try {
    const sandbox = await incus.sandbox.getByName(name);
    await sandbox.stop({ force: flags.force });
    this.process.stdout.write(`Stopped ${name}\n`);
  } catch (err) {
    this.process.stderr.write(`Error: ${(err as Error).message}\n`);
    this.process.exitCode = 1;
  }
}

export const stopCommand = buildCommand({
  loader: async () => stopImpl,
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
        brief: 'Force stop',
        optional: true,
      },
    },
  },
  docs: {
    brief: 'Stop a running sandbox',
  },
});
