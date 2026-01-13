import { buildCommand } from '@stricli/core';
import type { CliContext } from '../context';
import { incus } from '../../index';

async function lsImpl(
  this: CliContext,
  flags: {},
  name: string,
  path?: string
): Promise<void> {
  try {
    const sandbox = await incus.sandbox.getByName(name);
    const entries = await sandbox.fs.readdir(path ?? '/');
    for (const entry of entries) {
      this.process.stdout.write(entry + '\n');
    }
  } catch (err) {
    this.process.stderr.write(`Error: ${(err as Error).message}\n`);
    this.process.exitCode = 1;
  }
}

export const lsCommand = buildCommand({
  loader: async () => lsImpl,
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
          placeholder: 'path',
          brief: 'Directory path (default: /)',
          parse: String,
          optional: true,
        },
      ],
    },
  },
  docs: {
    brief: 'List directory contents in a sandbox',
  },
});
