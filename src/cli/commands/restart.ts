import { buildCommand } from '@stricli/core';
import type { CliContext } from '../context';
import { incus } from '../../index';

async function restartImpl(this: CliContext, flags: {}, name: string): Promise<void> {
  try {
    const sandbox = await incus.sandbox.getByName(name);
    await sandbox.restart();
    this.process.stdout.write(`Restarted ${name}\n`);
  } catch (err) {
    this.process.stderr.write(`Error: ${(err as Error).message}\n`);
    this.process.exitCode = 1;
  }
}

export const restartCommand = buildCommand({
  loader: async () => restartImpl,
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
    brief: 'Restart a sandbox',
  },
});
