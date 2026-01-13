# incus-sandbox-sdk

A typesafe TypeScript SDK for [Incus](https://linuxcontainers.org/incus/), providing a simple API for managing containers and VMs as isolated compute sandboxes.

## Features

- 🚀 **Simple API** - Create sandboxes, run commands, manage files in just a few lines
- 🛡️ **Type-safe** - Full TypeScript support with comprehensive types
- 📦 **Containers & VMs** - Choose between fast containers or fully isolated VMs
- 📁 **Filesystem access** - Read, write, push, pull files easily
- 🔗 **Overlay mounts** - Mount host folders with isolated writes (perfect for git repos)
- ⚡ **Fast** - Container startup in ~4 seconds
- 🔧 **Zero config** - Works out of the box with sensible defaults
- 🖥️ **CLI included** - Full-featured `isb` command-line tool

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

**Verify installation:**

```bash
incus launch images:ubuntu/24.04 test-container
incus exec test-container -- echo "Hello from container!"
incus delete test-container --force
```

## Installation

```bash
npm install incus-sandbox-sdk
# or
bun add incus-sandbox-sdk
```

## Quick Start

The recommended workflow is to **mount a host folder with overlay isolation** - your local files are instantly available in the sandbox, and any changes made inside the sandbox don't affect your host files.

```typescript
import { incus } from 'incus-sandbox-sdk';

// Create a sandbox
const sandbox = await incus.sandbox.create();

// Mount your project with overlay isolation (writes don't affect host)
await sandbox.mount({
  source: '/home/user/my-project',
  target: '/workspace',
  mode: 'overlay',
});

// Your files are instantly available - no copying needed!
const result = await sandbox.runCommand('ls /workspace');
console.log(result.stdout); // package.json, src/, ...

// Make changes safely - they only exist in the sandbox
await sandbox.runCommand('npm install && npm run build', { cwd: '/workspace' });

// When done, destroy - host files are untouched
await sandbox.destroy();
```

### Alternative: Simple code execution

```typescript
import { incus } from 'incus-sandbox-sdk';

const sandbox = await incus.sandbox.create();

// Run a command
const result = await sandbox.runCommand('echo "Hello from sandbox!"');
console.log(result.stdout); // "Hello from sandbox!"

// Run code directly
const output = await sandbox.runCode('print(2 + 2)', { language: 'python' });
console.log(output.output); // "4"

await sandbox.destroy();
```

## Usage

### Creating Sandboxes

```typescript
// Simple container (fastest, ~4s startup)
const container = await incus.sandbox.create();

// With custom image
const ubuntu = await incus.sandbox.create({
  image: 'images:debian/12',
});

// With resource limits
const limited = await incus.sandbox.create({
  limits: {
    cpu: 2,
    memory: '1GB',
  },
});

// Virtual machine (stronger isolation, ~30s startup)
const vm = await incus.sandbox.create({
  type: 'vm',
});

// Named sandbox (for later retrieval)
const named = await incus.sandbox.create({
  name: 'my-dev-env',
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

// Bash
const sh = await sandbox.runCode('echo $((2 + 2))', { language: 'bash' });

// With timeout
const slow = await sandbox.runCode(longRunningCode, {
  language: 'python',
  timeout: 120000,
});
```

**Supported languages:** `python`, `node`, `bash`, `ruby`, `go`

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
await sandbox.fs.mkdir('/app/output', { recursive: true });

// Get file info
const stat = await sandbox.fs.stat('/app/config.json');
console.log(stat.type, stat.size);

// Delete file or directory
await sandbox.fs.rm('/app/temp', { recursive: true, force: true });

// Transfer files between host and sandbox
await sandbox.fs.push('./local/script.py', '/app/script.py');
await sandbox.fs.pull('/app/results.json', './local/results.json');
```

### Host Folder Mounts (Recommended)

Mount host directories into sandboxes with different isolation modes. This is the **recommended workflow** for working with existing codebases - no need to copy files, and changes can be safely isolated.

```typescript
// Mount with overlay - writes are isolated (DEFAULT, recommended)
await sandbox.mount({
  source: '/home/user/my-repo',
  target: '/workspace',
  mode: 'overlay',
});

// Files are instantly available
await sandbox.runCommand('cat /workspace/package.json');

// Changes only exist in the sandbox - host is untouched
await sandbox.runCommand('echo "test" > /workspace/new-file.txt');
// /home/user/my-repo/new-file.txt does NOT exist on host!

// Unmount when done
await sandbox.unmount('/workspace');
```

**Mount modes:**

| Mode | Writes | Use Case |
|------|--------|----------|
| `overlay` | Isolated to sandbox | Safe experimentation, builds, tests |
| `readonly` | Blocked | Shared dependencies, reference data |
| `readwrite` | Affect host | Development workflow (use with caution) |

```typescript
// Readonly mount - no writes allowed
await sandbox.mount({
  source: '/shared/libs',
  target: '/libs',
  mode: 'readonly',
});

// Readwrite mount - changes affect host (careful!)
await sandbox.mount({
  source: '/home/user/project',
  target: '/project',
  mode: 'readwrite',
});

// List all mounts
const mounts = await sandbox.listMounts();
console.log(mounts);
// [{ source: '/home/user/project', target: '/project', mode: 'readwrite', device: 'mount-abc123' }]
```

> **Note:** Overlay mode requires containers (not VMs) and triggers a one-time container restart to enable mount syscall interception.

### Sandbox Lifecycle

```typescript
// Stop a running sandbox
await sandbox.stop();

// Start a stopped sandbox
await sandbox.start();

// Restart
await sandbox.restart();

// Check state
const state = await sandbox.getState(); // 'running' | 'stopped' | 'frozen' | 'error'

// Destroy (cleanup)
await sandbox.destroy();
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

// Filter by name prefix
const mySandboxes = await incus.sandbox.list({ prefix: 'my-' });

// Get existing sandbox by name
const existing = await incus.sandbox.getByName('my-dev-env');
```

### Configuration

```typescript
import { incus } from 'incus-sandbox-sdk';

// Configure globally
incus.setConfig({
  defaultImage: 'images:debian/12',
  defaultType: 'container',
  project: 'my-project',
});
```

## Error Handling

```typescript
import {
  incus,
  SandboxNotFoundError,
  TimeoutError,
  SandboxNotRunningError,
  MountError,
  PathNotFoundError,
} from 'incus-sandbox-sdk';

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
| Startup time | ~4 seconds | ~30 seconds |
| Isolation | Namespace/cgroup | Full hardware virtualization |
| Overhead | Minimal | Higher (dedicated kernel) |
| Use case | Code execution, dev envs | Untrusted code, kernel testing |

**Use containers (default)** for most workloads. **Use VMs** when you need:
- Complete kernel isolation
- Different kernel versions
- Maximum security for untrusted code

## Examples

### Sandboxed Git Repository Workflow

The most common use case: work on an existing git repository in complete isolation.

```typescript
import { incus } from 'incus-sandbox-sdk';

async function runIsolatedBuild(repoPath: string) {
  const sandbox = await incus.sandbox.create();

  // Mount repo with overlay - instant access, isolated writes
  await sandbox.mount({
    source: repoPath,
    target: '/workspace',
    mode: 'overlay',
  });

  // Install deps and build - doesn't pollute your local node_modules
  await sandbox.runCommand('npm ci && npm run build', {
    cwd: '/workspace',
    timeout: 120000,
  });

  // Run tests in isolation
  const result = await sandbox.runCommand('npm test', { cwd: '/workspace' });

  await sandbox.destroy();
  return { success: result.exitCode === 0, output: result.stdout };
}

// Your local repo stays clean!
await runIsolatedBuild('/home/user/my-project');
```

### AI Code Execution Agent

```typescript
import { incus } from 'incus-sandbox-sdk';

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
import { incus, SandboxNotFoundError } from 'incus-sandbox-sdk';

async function getOrCreateDevEnv(name: string) {
  try {
    return await incus.sandbox.getByName(name);
  } catch (err) {
    if (err instanceof SandboxNotFoundError) {
      const sandbox = await incus.sandbox.create({
        name,
        limits: { cpu: 4, memory: '4GB' },
      });

      // Install dependencies
      await sandbox.runCommand('apt-get update && apt-get install -y nodejs python3');
      await sandbox.snapshot('fresh-install');

      return sandbox;
    }
    throw err;
  }
}
```

## CLI (`isb`)

The SDK includes a full-featured command-line tool called `isb` (incus sandbox).

### Installation

```bash
# Install globally via npm
npm install -g incus-sandbox-sdk

# Or build a standalone binary
bun run build:binary
sudo mv isb /usr/local/bin/
```

### CLI Usage

```bash
# Sandbox lifecycle
isb create mybox                        # Create a sandbox
isb create --image images:debian/12     # With custom image
isb create --cpu 2 --memory 1GB         # With resource limits
isb list                                # List all sandboxes
isb info mybox                          # Show sandbox details
isb destroy mybox                       # Destroy sandbox

# Command execution
isb exec mybox ls -la                   # Run a command
isb exec mybox --cwd /app npm test      # With working directory
isb exec mybox --env NODE_ENV=prod cmd  # With environment variables

# Code execution
isb run mybox --language python --code 'print(2+2)'
isb run mybox --language node script.js

# Filesystem
isb push mybox ./local.txt /remote.txt  # Copy file to sandbox
isb pull mybox /remote.txt ./local.txt  # Copy file from sandbox
isb cat mybox /etc/hostname             # Read file
isb ls mybox /app                       # List directory

# Mounts (recommended workflow)
isb mount mybox ~/project /workspace              # Mount with overlay (default)
isb mount mybox ~/data /data --mode readonly      # Readonly mount
isb mounts mybox                                  # List mounts
isb unmount mybox /workspace                      # Unmount

# Snapshots
isb snapshot mybox before-test          # Create snapshot
isb restore mybox before-test           # Restore snapshot
isb snapshots mybox                     # List snapshots
```

### Example: Isolated Build

```bash
# Create sandbox and mount your project
isb create dev
isb mount dev ~/my-project /workspace

# Run build in isolation - host files untouched
isb exec dev --cwd /workspace npm ci
isb exec dev --cwd /workspace npm run build
isb exec dev --cwd /workspace npm test

# Cleanup
isb destroy dev
```

## Running Tests

```bash
bun run test
```

## Building

```bash
# Build SDK
bun run build

# Build CLI
bun run build:cli

# Build standalone binary
bun run build:binary
```

## Requirements

- Node.js 18+ or Bun 1.0+
- Linux with Incus installed
- User must be in `incus-admin` group (or have socket access)

## License

MIT
