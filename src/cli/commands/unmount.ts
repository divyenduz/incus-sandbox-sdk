import { buildCommand } from '@stricli/core';
import type { CliContext } from '../context';
import { incus } from '../../index';

async function unmountImpl(
  this: CliContext,
  flags: {},
  name: string,
  target: string
): Promise<void> {
  try {
    const sandbox = await incus.sandbox.getByName(name);
    await sandbox.unmount(target);
    this.process.stdout.write(`Unmounted ${target}\n`);
  } catch (err) {
    this.process.stderr.write(`Error: ${(err as Error).message}\n`);
    this.process.exitCode = 1;
  }
}

export const unmountCommand = buildCommand({
  loader: async () => unmountImpl,
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
          placeholder: 'target',
          brief: 'Mount target path inside sandbox',
          parse: String,
        },
      ],
    },
  },
  docs: {
    brief: 'Unmount a directory from a sandbox',
  },
});
