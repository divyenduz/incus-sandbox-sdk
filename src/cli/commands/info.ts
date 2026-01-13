import { buildCommand } from '@stricli/core';
import type { CliContext } from '../context';
import { incus } from '../../index';

async function infoImpl(this: CliContext, flags: {}, name: string): Promise<void> {
  try {
    const sandbox = await incus.sandbox.getByName(name);
    const state = await sandbox.getState();

    this.process.stdout.write(`Name: ${sandbox.name}\n`);
    this.process.stdout.write(`Type: ${sandbox.type}\n`);
    this.process.stdout.write(`State: ${state}\n`);
  } catch (err) {
    this.process.stderr.write(`Error: ${(err as Error).message}\n`);
    this.process.exitCode = 1;
  }
}

export const infoCommand = buildCommand({
  loader: async () => infoImpl,
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
    brief: 'Show sandbox details',
  },
});
