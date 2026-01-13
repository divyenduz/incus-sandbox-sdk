# incus-sdk

A typesafe TypeScript SDK for [Incus](https://linuxcontainers.org/incus/), providing a simple API for managing containers and VMs as isolated compute sandboxes.

## Features

- 🚀 **Simple API** - Create sandboxes, run commands, manage files in just a few lines
- 🛡️ **Type-safe** - Full TypeScript support with comprehensive types
- 📦 **Containers & VMs** - Choose between fast containers or fully isolated VMs
- 📁 **Filesystem access** - Read, write, push, pull files easily
- ⚡ **Fast** - Container startup in ~1-2 seconds
- 🔧 **Zero config** - Works out of the box with sensible defaults

## Prerequisites

### Installing Incus

**Ubuntu/Debian:**

```bash
# Install Incus
sudo apt install incus

# Initialize Incus (accept defaults for simple setup)
sudo incus admin init --minimal

# Add your user to the incus-admin group (logout/login required)
sudo usermod -aG incus-admin $USER
```

**Fedora:**

```bash
sudo dnf install incus
sudo incus admin init --minimal
sudo usermod -aG incus-admin $USER
```

**Verify installation:**

```bash
incus launch ubuntu:24.04 test-container
incus exec test-container -- echo "Hello from container!"
incus delete test-container --force
```

## Installation

```bash
npm install incus-sdk
# or
bun add incus-sdk
```

## Quick Start

```typescript
import { incus } from 'incus-sdk';

// Create a sandbox
const sandbox = await incus.sandbox.create({
  image: 'ubuntu:24.04',
});

// Run a command
const result = await sandbox.runCommand('echo "Hello from sandbox!"');
console.log(result.stdout); // "Hello from sandbox!"

// Run code
const output = await sandbox.runCode('print(1 + 1)', { language: 'python' });
console.log(output.output); // "2"

// Clean up
await sandbox.destroy();
```

## Usage

### Creating Sandboxes

```typescript
// Simple container (fastest)
const container = await incus.sandbox.create();

// With custom image
const ubuntu = await incus.sandbox.create({
  image: 'ubuntu:22.04',
});

// With resource limits
const limited = await incus.sandbox.create({
  image: 'ubuntu:24.04',
  limits: {
    cpu: 2,
    memory: '1GB',
  },
});

// Virtual machine (stronger isolation)
const vm = await incus.sandbox.create({
  image: 'ubuntu:24.04',
  type: 'vm',
});

// Named sandbox (for later retrieval)
const named = await incus.sandbox.create({
  name: 'my-dev-env',
  image: 'ubuntu:24.04',
});
```

### Running Commands

```typescript
const result = await sandbox.runCommand('ls -la /');
console.log(result.stdout);
console.log(result.stderr);
console.log(result.exitCode);
console.log(result.durationMs);

// With options
const result2 = await sandbox.runCommand('npm install', {
  cwd: '/app',
  env: { NODE_ENV: 'production' },
  timeout: 60000,
  user: 'ubuntu',
});
```

### Running Code

```typescript
// Python
const py = await sandbox.runCode('print("Hello")', { language: 'python' });

// Node.js
const js = await sandbox.runCode('console.log(1 + 1)', { language: 'node' });

// Bash
const sh = await sandbox.runCode('echo $((2 + 2))', { language: 'bash' });

// With timeout
const slow = await sandbox.runCode(longRunningCode, {
  language: 'python',
  timeout: 120000,
});
```

### Filesystem Operations

```typescript
// Write a file
await sandbox.fs.writeFile('/app/config.json', JSON.stringify({ key: 'value' }));

// Read a file
const content = await sandbox.fs.readFile('/app/config.json');

// Check if file exists
if (await sandbox.fs.exists('/app/config.json')) {
  console.log('File exists!');
}

// List directory
const files = await sandbox.fs.readdir('/app');

// Create directory
await sandbox.fs.mkdir('/app/output');

// Delete file or directory
await sandbox.fs.rm('/app/temp', { recursive: true });

// Transfer files between host and sandbox
await sandbox.fs.push('./local/script.py', '/app/script.py');
await sandbox.fs.pull('/app/results.json', './local/results.json');
```

### Sandbox Lifecycle

```typescript
// Stop a running sandbox
await sandbox.stop();

// Start a stopped sandbox
await sandbox.start();

// Restart
await sandbox.restart();

// Check state
const state = await sandbox.getState(); // 'running' | 'stopped' | ...
```

### Snapshots

```typescript
// Create a snapshot
await sandbox.snapshot('before-tests');

// Run some operations...
await sandbox.runCommand('rm -rf /important-data');

// Oops! Restore from snapshot
await sandbox.restore('before-tests');

// List snapshots
const snapshots = await sandbox.listSnapshots();

// Delete a snapshot
await sandbox.deleteSnapshot('before-tests');
```

### Managing Sandboxes

```typescript
// List all sandboxes
const all = await incus.sandbox.list();

// Filter by type
const containers = await incus.sandbox.list({ type: 'container' });
const vms = await incus.sandbox.list({ type: 'vm' });

// Get existing sandbox by name
const existing = await incus.sandbox.getByName('my-dev-env');
```

### Configuration

```typescript
import { incus } from 'incus-sdk';

// Configure globally
incus.setConfig({
  defaultImage: 'debian:12',
  defaultType: 'container',
  project: 'my-project',
});

// Or use environment variables
// INCUS_SOCKET=/var/lib/incus/unix.socket
// INCUS_PROJECT=my-project
```

## Error Handling

```typescript
import { incus, SandboxNotFoundError, TimeoutError } from 'incus-sdk';

try {
  const sandbox = await incus.sandbox.getByName('nonexistent');
} catch (error) {
  if (error instanceof SandboxNotFoundError) {
    console.log('Sandbox does not exist');
  }
}

try {
  await sandbox.runCommand('sleep 100', { timeout: 1000 });
} catch (error) {
  if (error instanceof TimeoutError) {
    console.log('Command timed out');
  }
}
```

## Container vs VM

| Feature | Container | VM |
|---------|-----------|-----|
| Startup time | ~1-2 seconds | ~10-30 seconds |
| Isolation | Namespace/cgroup | Full hardware virtualization |
| Overhead | Minimal | Higher (dedicated kernel) |
| Use case | Code execution, dev envs | Untrusted code, kernel testing |

**Use containers (default)** for most workloads. **Use VMs** when you need:
- Complete kernel isolation
- Different kernel versions
- Maximum security for untrusted code

## Examples

### AI Code Execution Agent

```typescript
import { incus } from 'incus-sdk';

async function executeUserCode(code: string, language: 'python' | 'node') {
  const sandbox = await incus.sandbox.create({
    limits: { cpu: 1, memory: '256MB' },
  });

  try {
    const result = await sandbox.runCode(code, {
      language,
      timeout: 10000,
    });
    return { success: result.exitCode === 0, output: result.output };
  } finally {
    await sandbox.destroy();
  }
}
```

### Persistent Development Environment

```typescript
import { incus } from 'incus-sdk';

async function getOrCreateDevEnv(name: string) {
  try {
    return await incus.sandbox.getByName(name);
  } catch {
    const sandbox = await incus.sandbox.create({
      name,
      image: 'ubuntu:24.04',
      limits: { cpu: 4, memory: '4GB' },
    });
    
    // Install dependencies
    await sandbox.runCommand('apt-get update && apt-get install -y nodejs npm python3');
    await sandbox.snapshot('fresh-install');
    
    return sandbox;
  }
}
```

### Batch Processing

```typescript
import { incus } from 'incus-sdk';

async function processInParallel(items: string[]) {
  const results = await Promise.all(
    items.map(async (item) => {
      const sandbox = await incus.sandbox.create();
      try {
        await sandbox.fs.writeFile('/input.txt', item);
        await sandbox.runCommand('process-script /input.txt > /output.txt');
        return await sandbox.fs.readFile('/output.txt');
      } finally {
        await sandbox.destroy();
      }
    })
  );
  return results;
}
```

## Requirements

- Node.js 18+ or Bun 1.0+
- Linux with Incus 5.0+ installed
- User must be in `incus-admin` group (or have socket access)

## License

MIT
