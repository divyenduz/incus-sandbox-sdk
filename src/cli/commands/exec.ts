import { buildCommand, numberParser } from '@stricli/core';
import type { CliContext } from '../context';
import { incus } from '../../index';

interface ExecFlags {
  cwd?: string;
  env?: string[];
  user?: string;
  timeout?: number;
}

async function execImpl(
  this: CliContext,
  flags: ExecFlags,
  name: string,
  ...args: string[]
): Promise<void> {
  try {
    const sandbox = await incus.sandbox.getByName(name);
    const command = args.join(' ');

    const envRecord: Record<string, string> = {};
    if (flags.env) {
      for (const e of flags.env) {
        const idx = e.indexOf('=');
        if (idx > 0) {
          envRecord[e.slice(0, idx)] = e.slice(idx + 1);
        }
      }
    }

    const result = await sandbox.runCommand(command, {
      cwd: flags.cwd,
      env: Object.keys(envRecord).length > 0 ? envRecord : undefined,
      user: flags.user,
      timeout: flags.timeout,
    });

    if (result.stdout) {
      this.process.stdout.write(result.stdout);
    }
    if (result.stderr) {
      this.process.stderr.write(result.stderr);
    }
    this.process.exitCode = result.exitCode;
  } catch (err) {
    this.process.stderr.write(`Error: ${(err as Error).message}\n`);
    this.process.exitCode = 1;
  }
}

export const execCommand = buildCommand({
  loader: async () => execImpl,
  parameters: {
    positional: {
      kind: 'array',
      parameter: {
        placeholder: 'name command...',
        brief: 'Sandbox name followed by command to run',
        parse: String,
      },
      minimum: 2,
    },
    flags: {
      cwd: {
        kind: 'parsed',
        parse: String,
        brief: 'Working directory',
        optional: true,
      },
      env: {
        kind: 'parsed',
        parse: String,
        variadic: true,
        brief: 'Environment variable (KEY=VALUE)',
        optional: true,
      },
      user: {
        kind: 'parsed',
        parse: String,
        brief: 'User to run as',
        optional: true,
      },
      timeout: {
        kind: 'parsed',
        parse: numberParser,
        brief: 'Timeout in milliseconds',
        optional: true,
      },
    },
  },
  docs: {
    brief: 'Run a command in a sandbox',
  },
});
