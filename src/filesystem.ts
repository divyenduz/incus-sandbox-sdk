import * as client from './client';
import type { FileStat, WriteOptions, MkdirOptions, RmOptions } from './types';
import { CommandError } from './errors';

export class FileSystem {
  constructor(private sandboxName: string) {}

  async readFile(path: string, encoding: 'utf8' | 'base64' = 'utf8'): Promise<string> {
    const result = await client.execInInstance(this.sandboxName, ['cat', path]);
    if (result.exitCode !== 0) {
      throw new CommandError(`Failed to read file ${path}: ${result.stderr}`);
    }

    if (encoding === 'base64') {
      return Buffer.from(result.stdout).toString('base64');
    }
    return result.stdout;
  }

  async writeFile(path: string, content: string, options?: WriteOptions): Promise<void> {
    const tempFile = `/tmp/incus-sdk-${Date.now()}-${Math.random().toString(36).slice(2)}`;

    await Bun.write(tempFile, content);

    try {
      await client.pushFile(this.sandboxName, tempFile, path);

      if (options?.mode) {
        await client.execInInstance(this.sandboxName, ['chmod', options.mode, path]);
      }

      if (options?.owner) {
        await client.execInInstance(this.sandboxName, ['chown', options.owner, path]);
      }
    } finally {
      await Bun.file(tempFile).exists() && (await import('fs/promises')).unlink(tempFile);
    }
  }

  async mkdir(path: string, options?: MkdirOptions): Promise<void> {
    const args = ['mkdir'];
    if (options?.recursive) {
      args.push('-p');
    }
    if (options?.mode) {
      args.push('-m', options.mode);
    }
    args.push(path);

    const result = await client.execInInstance(this.sandboxName, args);
    if (result.exitCode !== 0) {
      throw new CommandError(`Failed to create directory ${path}: ${result.stderr}`);
    }
  }

  async readdir(path: string): Promise<string[]> {
    const result = await client.execInInstance(this.sandboxName, ['ls', '-1', path]);
    if (result.exitCode !== 0) {
      throw new CommandError(`Failed to read directory ${path}: ${result.stderr}`);
    }

    return result.stdout
      .trim()
      .split('\n')
      .filter((line) => line.length > 0);
  }

  async exists(path: string): Promise<boolean> {
    const result = await client.execInInstance(this.sandboxName, ['test', '-e', path]);
    return result.exitCode === 0;
  }

  async stat(path: string): Promise<FileStat> {
    const result = await client.execInInstance(this.sandboxName, [
      'stat',
      '--printf',
      '%n\\n%F\\n%s\\n%a\\n%u\\n%g\\n%Y',
      path,
    ]);

    if (result.exitCode !== 0) {
      throw new CommandError(`Failed to stat ${path}: ${result.stderr}`);
    }

    const lines = result.stdout.trim().split('\n');
    const fileType = lines[1] ?? '';

    let type: 'file' | 'directory' | 'symlink' = 'file';
    if (fileType.includes('directory')) {
      type = 'directory';
    } else if (fileType.includes('symbolic link')) {
      type = 'symlink';
    }

    return {
      name: lines[0]?.split('/').pop() ?? lines[0] ?? '',
      type,
      size: parseInt(lines[2] ?? '0', 10),
      mode: lines[3] ?? '',
      uid: parseInt(lines[4] ?? '0', 10),
      gid: parseInt(lines[5] ?? '0', 10),
      mtime: new Date(parseInt(lines[6] ?? '0', 10) * 1000),
    };
  }

  async rm(path: string, options?: RmOptions): Promise<void> {
    const args = ['rm'];
    if (options?.recursive) {
      args.push('-r');
    }
    if (options?.force) {
      args.push('-f');
    }
    args.push(path);

    const result = await client.execInInstance(this.sandboxName, args);
    if (result.exitCode !== 0 && !options?.force) {
      throw new CommandError(`Failed to remove ${path}: ${result.stderr}`);
    }
  }

  async push(localPath: string, remotePath: string): Promise<void> {
    await client.pushFile(this.sandboxName, localPath, remotePath);
  }

  async pull(remotePath: string, localPath: string): Promise<void> {
    await client.pullFile(this.sandboxName, remotePath, localPath);
  }
}
