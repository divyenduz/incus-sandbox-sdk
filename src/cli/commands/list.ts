import { buildCommand } from '@stricli/core';
import type { CliContext } from '../context';
import { incus } from '../../index';
import type { SandboxType } from '../../types';

interface ListFlags {
  type?: SandboxType | 'all';
}

async function listImpl(this: CliContext, flags: ListFlags): Promise<void> {
  try {
    const sandboxes = await incus.sandbox.list({
      type: flags.type === 'all' ? undefined : flags.type,
    });

    if (sandboxes.length === 0) {
      this.process.stdout.write('No sandboxes found\n');
      return;
    }

    const header = 'NAME\tTYPE\tSTATE\tCREATED';
    this.process.stdout.write(header + '\n');

    for (const sb of sandboxes) {
      const created = sb.createdAt.toISOString().split('T')[0];
      this.process.stdout.write(`${sb.name}\t${sb.type}\t${sb.state}\t${created}\n`);
    }
  } catch (err) {
    this.process.stderr.write(`Error: ${(err as Error).message}\n`);
    this.process.exitCode = 1;
  }
}

export const listCommand = buildCommand({
  loader: async () => listImpl,
  parameters: {
    flags: {
      type: {
        kind: 'enum',
        values: ['container', 'vm', 'all'] as const,
        brief: 'Filter by type',
        optional: true,
      },
    },
  },
  docs: {
    brief: 'List all sandboxes',
  },
});
