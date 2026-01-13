import { buildCommand } from '@stricli/core';
import type { CliContext } from '../context';
import { incus } from '../../index';

async function pullImpl(
  this: CliContext,
  flags: {},
  name: string,
  remote: string,
  local: string
): Promise<void> {
  try {
    const sandbox = await incus.sandbox.getByName(name);
    await sandbox.fs.pull(remote, local);
    this.process.stdout.write(`Pulled ${remote} -> ${local}\n`);
  } catch (err) {
    this.process.stderr.write(`Error: ${(err as Error).message}\n`);
    this.process.exitCode = 1;
  }
}

export const pullCommand = buildCommand({
  loader: async () => pullImpl,
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
          placeholder: 'remote',
          brief: 'Remote file path in sandbox',
          parse: String,
        },
        {
          placeholder: 'local',
          brief: 'Local file path',
          parse: String,
        },
      ],
    },
  },
  docs: {
    brief: 'Copy a file from a sandbox',
  },
});
