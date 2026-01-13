import { buildCommand } from '@stricli/core';
import type { CliContext } from '../context';
import { incus } from '../../index';

async function catImpl(
  this: CliContext,
  flags: {},
  name: string,
  path: string
): Promise<void> {
  try {
    const sandbox = await incus.sandbox.getByName(name);
    const content = await sandbox.fs.readFile(path);
    this.process.stdout.write(content);
  } catch (err) {
    this.process.stderr.write(`Error: ${(err as Error).message}\n`);
    this.process.exitCode = 1;
  }
}

export const catCommand = buildCommand({
  loader: async () => catImpl,
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
          brief: 'File path in sandbox',
          parse: String,
        },
      ],
    },
  },
  docs: {
    brief: 'Read a file from a sandbox',
  },
});
