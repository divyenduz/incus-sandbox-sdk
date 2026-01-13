import { buildCommand, numberParser } from '@stricli/core';
import type { CliContext } from '../context';
import { incus } from '../../index';
import type { Language } from '../../types';
import * as fs from 'fs/promises';
import * as path from 'path';

interface RunFlags {
  language: Language;
  code?: string;
  timeout?: number;
}

async function runImpl(
  this: CliContext,
  flags: RunFlags,
  name: string,
  file?: string
): Promise<void> {
  try {
    const sandbox = await incus.sandbox.getByName(name);

    let code: string;
    if (flags.code) {
      code = flags.code;
    } else if (file) {
      const filePath = path.resolve(file);
      code = await fs.readFile(filePath, 'utf-8');
    } else {
      this.process.stderr.write('Error: Either --code or a file path is required\n');
      this.process.exitCode = 1;
      return;
    }

    const result = await sandbox.runCode(code, {
      language: flags.language,
      timeout: flags.timeout,
    });

    this.process.stdout.write(result.output);
    this.process.exitCode = result.exitCode;
  } catch (err) {
    this.process.stderr.write(`Error: ${(err as Error).message}\n`);
    this.process.exitCode = 1;
  }
}

export const runCommand = buildCommand({
  loader: async () => runImpl,
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
          placeholder: 'file',
          brief: 'Code file to run (optional if --code is provided)',
          parse: String,
          optional: true,
        },
      ],
    },
    flags: {
      language: {
        kind: 'enum',
        values: ['python', 'node', 'bash', 'ruby', 'go'] as const,
        brief: 'Language runtime',
      },
      code: {
        kind: 'parsed',
        parse: String,
        brief: 'Inline code to run',
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
    brief: 'Run code in a sandbox',
  },
});
