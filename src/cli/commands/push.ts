import { buildCommand } from '@stricli/core';
import type { CliContext } from '../context';
import { incus } from '../../index';

async function pushImpl(
  this: CliContext,
  flags: {},
  name: string,
  local: string,
  remote: string
): Promise<void> {
  try {
    const sandbox = await incus.sandbox.getByName(name);
    await sandbox.fs.push(local, remote);
    this.process.stdout.write(`Pushed ${local} -> ${remote}\n`);
  } catch (err) {
    this.process.stderr.write(`Error: ${(err as Error).message}\n`);
    this.process.exitCode = 1;
  }
}

export const pushCommand = buildCommand({
  loader: async () => pushImpl,
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
          placeholder: 'local',
          brief: 'Local file path',
          parse: String,
        },
        {
          placeholder: 'remote',
          brief: 'Remote file path in sandbox',
          parse: String,
        },
      ],
    },
  },
  docs: {
    brief: 'Copy a file to a sandbox',
  },
});
