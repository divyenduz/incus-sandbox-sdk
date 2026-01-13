# incus-sdk Requirements

A typesafe TypeScript SDK for Incus, providing a simple API for managing containers and VMs as isolated compute sandboxes.

## 1. Overview

### 1.1 Purpose

Provide a developer-friendly, type-safe TypeScript interface to Incus for:
- Running untrusted code in isolated environments
- Building AI agents that execute code
- Creating ephemeral development/test environments
- Orchestrating containerized workloads locally or on remote Incus servers

### 1.2 Design Principles

1. **Simplicity first** - Common operations should be one-liners
2. **Type-safe** - Full TypeScript support with comprehensive types
3. **Sensible defaults** - Works out of the box with zero configuration
4. **Escape hatches** - Power users can access advanced Incus features
5. **ComputeSDK-compatible** - Similar API patterns for familiarity

### 1.3 Target Users

- Developers building code execution platforms
- AI/LLM application developers needing sandboxed code execution
- DevOps engineers automating container workflows
- Educators building interactive coding environments

---

## 2. Core Concepts

### 2.1 Sandbox

A **Sandbox** is an isolated compute environment backed by an Incus container or VM.

- Default type: `container` (fast startup, shared kernel)
- Optional type: `vm` (full isolation, dedicated kernel)
- Each sandbox has its own filesystem, network namespace, and process space
- Sandboxes are ephemeral by default but can be persisted

### 2.2 Instance Types

| Type | Startup Time | Isolation | Use Case |
|------|--------------|-----------|----------|
| `container` | ~1-2s | Process/namespace isolation | Default, code execution, dev environments |
| `vm` | ~10-30s | Full hardware virtualization | Kernel-level isolation, untrusted workloads |

The SDK defaults to `container` for performance. Users opt into `vm` when they need stronger isolation.

---

## 3. Functional Requirements

### 3.1 Sandbox Lifecycle

#### 3.1.1 Create Sandbox

```typescript
incus.sandbox.create(options?: SandboxOptions): Promise<Sandbox>
```

**Options:**
| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `image` | `string` | `'ubuntu:24.04'` | Incus image alias or fingerprint |
| `type` | `'container' \| 'vm'` | `'container'` | Instance type |
| `name` | `string` | auto-generated | Instance name (must be unique) |
| `limits.cpu` | `number` | unlimited | CPU core limit |
| `limits.memory` | `string` | `'512MB'` | Memory limit (e.g., `'2GB'`) |
| `limits.disk` | `string` | `'10GB'` | Root disk size |
| `profiles` | `string[]` | `['default']` | Incus profiles to apply |
| `autoDestroy` | `boolean` | `false` | Destroy on process exit |
| `timeout` | `number` | `60000` | Creation timeout in ms |

**Behavior:**
1. Generate unique name if not provided (format: `sandbox-{nanoid}`)
2. Launch instance from specified image
3. Wait for instance to be running and network ready
4. Return `Sandbox` handle

**Errors:**
- `ImageNotFoundError` - Image doesn't exist
- `ResourceLimitError` - Insufficient resources
- `TimeoutError` - Instance didn't start in time
- `NameConflictError` - Name already exists

#### 3.1.2 Get Existing Sandbox

```typescript
incus.sandbox.getByName(name: string): Promise<Sandbox>
```

Retrieve a handle to an existing instance by name.

**Errors:**
- `SandboxNotFoundError` - No instance with that name

#### 3.1.3 List Sandboxes

```typescript
incus.sandbox.list(options?: ListOptions): Promise<SandboxInfo[]>
```

**Options:**
| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `type` | `'container' \| 'vm' \| 'all'` | `'all'` | Filter by type |
| `state` | `SandboxState` | all | Filter by state |
| `prefix` | `string` | none | Filter by name prefix |

**Returns:** Array of `SandboxInfo` (lightweight metadata, not full handles)

#### 3.1.4 Destroy Sandbox

```typescript
sandbox.destroy(options?: DestroyOptions): Promise<void>
```

**Options:**
| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `force` | `boolean` | `false` | Force stop if running |
| `deleteSnapshots` | `boolean` | `true` | Delete associated snapshots |

**Behavior:**
1. Stop instance if running (or force stop)
2. Delete all snapshots if `deleteSnapshots` is true
3. Delete the instance

### 3.2 Command Execution

#### 3.2.1 Run Command

```typescript
sandbox.runCommand(command: string, options?: CommandOptions): Promise<CommandResult>
```

**Options:**
| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `cwd` | `string` | `'/'` | Working directory |
| `env` | `Record<string, string>` | `{}` | Environment variables |
| `user` | `string` | `'root'` | User to run as |
| `timeout` | `number` | `30000` | Timeout in ms |
| `stdin` | `string` | none | Input to provide via stdin |

**Result:**
```typescript
interface CommandResult {
  stdout: string;
  stderr: string;
  exitCode: number;
  durationMs: number;
}
```

**Behavior:**
1. Execute command in the sandbox via `incus exec`
2. Capture stdout, stderr, exit code
3. Measure execution duration
4. Return result (does NOT throw on non-zero exit code)

**Errors:**
- `TimeoutError` - Command exceeded timeout
- `SandboxNotRunningError` - Sandbox is stopped

#### 3.2.2 Run Code

```typescript
sandbox.runCode(code: string, options: CodeOptions): Promise<CodeResult>
```

**Options:**
| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `language` | `'python' \| 'node' \| 'bash' \| 'ruby' \| 'go'` | Yes | Language runtime |
| `timeout` | `number` | No | Timeout in ms (default: 30000) |
| `env` | `Record<string, string>` | No | Environment variables |

**Result:**
```typescript
interface CodeResult {
  output: string;      // Combined stdout + stderr
  exitCode: number;
  language: string;
  durationMs: number;
}
```

**Behavior:**
1. Write code to temporary file in sandbox
2. Execute with appropriate interpreter
3. Capture combined output
4. Clean up temporary file
5. Return result

**Language Interpreters:**
| Language | Command |
|----------|---------|
| `python` | `python3 {file}` |
| `node` | `node {file}` |
| `bash` | `bash {file}` |
| `ruby` | `ruby {file}` |
| `go` | `go run {file}` |

### 3.3 Filesystem Operations

All filesystem operations are available via `sandbox.fs.*`.

#### 3.3.1 Read File

```typescript
sandbox.fs.readFile(path: string, encoding?: 'utf8' | 'base64'): Promise<string>
```

#### 3.3.2 Write File

```typescript
sandbox.fs.writeFile(path: string, content: string, options?: WriteOptions): Promise<void>
```

**Options:**
| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `mode` | `string` | `'0644'` | File permissions |
| `owner` | `string` | `'root'` | File owner |

#### 3.3.3 Directory Operations

```typescript
sandbox.fs.mkdir(path: string, options?: MkdirOptions): Promise<void>
sandbox.fs.readdir(path: string): Promise<string[]>
sandbox.fs.exists(path: string): Promise<boolean>
sandbox.fs.stat(path: string): Promise<FileStat>
sandbox.fs.rm(path: string, options?: RmOptions): Promise<void>
```

#### 3.3.4 File Transfer (Host <-> Sandbox)

```typescript
sandbox.fs.push(localPath: string, remotePath: string): Promise<void>
sandbox.fs.pull(remotePath: string, localPath: string): Promise<void>
```

Uses `incus file push` and `incus file pull` under the hood.

### 3.4 State Management

#### 3.4.1 Lifecycle Control

```typescript
sandbox.start(): Promise<void>
sandbox.stop(options?: StopOptions): Promise<void>
sandbox.restart(): Promise<void>
sandbox.getState(): Promise<SandboxState>
```

**States:**
```typescript
type SandboxState = 'running' | 'stopped' | 'frozen' | 'error';
```

#### 3.4.2 Snapshots

```typescript
sandbox.snapshot(name: string): Promise<void>
sandbox.restore(name: string): Promise<void>
sandbox.listSnapshots(): Promise<SnapshotInfo[]>
sandbox.deleteSnapshot(name: string): Promise<void>
```

### 3.5 Configuration

#### 3.5.1 Global Configuration

```typescript
incus.setConfig(options: IncusConfig): void
```

**Options:**
| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `socket` | `string` | `'/var/lib/incus/unix.socket'` | Unix socket path |
| `remote` | `string` | `'local'` | Incus remote name |
| `project` | `string` | `'default'` | Incus project |
| `defaultImage` | `string` | `'ubuntu:24.04'` | Default image for sandboxes |
| `defaultType` | `'container' \| 'vm'` | `'container'` | Default instance type |

#### 3.5.2 Environment Variables

| Variable | Description |
|----------|-------------|
| `INCUS_SOCKET` | Path to Incus Unix socket |
| `INCUS_REMOTE` | Default remote |
| `INCUS_PROJECT` | Default project |

---

## 4. Non-Functional Requirements

### 4.1 Performance

- Container creation: < 3 seconds (cold), < 1 second (warm/cached image)
- VM creation: < 30 seconds
- Command execution overhead: < 100ms
- File operations: Near-native performance via `incus file`

### 4.2 Reliability

- Graceful handling of Incus daemon unavailability
- Automatic cleanup of orphaned sandboxes (opt-in via `autoDestroy`)
- Proper resource cleanup on process exit (when enabled)

### 4.3 Security

- No shell injection vulnerabilities in command execution
- Sandboxes are isolated by default (no host mounts unless explicit)
- Support for unprivileged containers

### 4.4 Compatibility

- Node.js 18+
- Bun 1.0+
- Incus 5.0+ (tested on 6.x)
- Linux only (Incus requirement)

---

## 5. Technical Implementation

### 5.1 Incus Communication

The SDK communicates with Incus via:

1. **Primary:** Incus REST API over Unix socket (`/var/lib/incus/unix.socket`)
2. **Fallback:** CLI wrapper (`incus` command) for operations not easily done via API

### 5.2 Dependencies

- `node-fetch` or native fetch - HTTP client for Unix socket
- `nanoid` - Unique ID generation
- `zod` - Runtime type validation (optional)

### 5.3 Error Handling

All errors extend a base `IncusSdkError` class:

```typescript
class IncusSdkError extends Error {
  code: string;
  cause?: Error;
}

class SandboxNotFoundError extends IncusSdkError { code = 'SANDBOX_NOT_FOUND' }
class ImageNotFoundError extends IncusSdkError { code = 'IMAGE_NOT_FOUND' }
class TimeoutError extends IncusSdkError { code = 'TIMEOUT' }
class CommandError extends IncusSdkError { code = 'COMMAND_FAILED' }
// ... etc
```

### 5.4 Project Structure

```
incus-sdk/
├── src/
│   ├── index.ts           # Main exports
│   ├── client.ts          # Incus API client
│   ├── sandbox.ts         # Sandbox class
│   ├── filesystem.ts      # Filesystem operations
│   ├── errors.ts          # Error classes
│   ├── types.ts           # TypeScript types
│   └── cli/               # CLI implementation
│       ├── bin.ts         # CLI entry point
│       ├── app.ts         # Stricli application
│       ├── context.ts     # CLI context
│       └── commands/      # Individual commands
├── tests/
│   ├── sandbox.test.ts
│   ├── filesystem.test.ts
│   └── commands.test.ts
├── package.json
├── tsconfig.json
└── README.md
```

---

## 6. Host Folder Mounts

### 6.1 Overview

Mount host directories into sandboxes with optional overlay isolation. This enables:
- Mounting git repositories without re-cloning
- Sharing test fixtures across sandboxes
- Development workflows where host IDE edits are visible in sandbox
- Isolated experimentation on existing codebases

### 6.2 Mount Modes

| Mode | Description | Use Case |
|------|-------------|----------|
| `overlay` | Host folder as readonly base, writes go to ephemeral overlay | Sandboxed experimentation, isolated builds |
| `readonly` | Pure readonly mount, no writes allowed | Shared dependencies, reference data |
| `readwrite` | Direct bind-mount, writes affect host | Development workflows (use with caution) |

### 6.3 API

#### 6.3.1 Mount at Creation Time

```typescript
const sandbox = await incus.sandbox.create({
  mounts: [{
    source: '/home/user/repos/myproject',
    target: '/workspace',
    mode: 'overlay',
  }]
});
```

#### 6.3.2 Mount After Creation

```typescript
await sandbox.mount({
  source: '/home/user/repos/myproject',
  target: '/workspace',
  mode: 'overlay',
});
```

#### 6.3.3 Unmount

```typescript
await sandbox.unmount('/workspace');
```

#### 6.3.4 List Mounts

```typescript
const mounts = await sandbox.listMounts();
// [{ source: '/home/user/repos/myproject', target: '/workspace', mode: 'overlay', device: 'mount-a1b2c3' }]
```

### 6.4 Types

```typescript
type MountMode = 'overlay' | 'readonly' | 'readwrite';

interface MountOptions {
  source: string;      // Host path (absolute)
  target: string;      // Container path
  mode?: MountMode;    // Default: 'overlay'
  shift?: boolean;     // UID/GID shifting (default: false, requires kernel 6.2+)
}

interface MountInfo {
  source: string;
  target: string;
  mode: MountMode;
  device: string;      // Internal Incus device name
}
```

### 6.5 Implementation (Approach 2: OverlayFS inside container)

For `mode: 'overlay'`:
1. Bind-mount host path as readonly at `/.overlay-base/<device>`
2. Create upper/work directories in container storage at `/.overlay-work/<device>/`
3. Mount overlayfs at target path with lowerdir=base, upperdir=upper, workdir=work

For `mode: 'readonly'`:
1. Bind-mount host path as readonly directly at target path

For `mode: 'readwrite'`:
1. Bind-mount host path with write access directly at target path

### 6.6 Incus Commands Used

```bash
# Add readonly disk device
incus config device add <instance> <device> disk source=<host_path> path=<container_path> readonly=true shift=true

# Setup overlay inside container
incus exec <instance> -- mkdir -p /.overlay-work/<device>/upper /.overlay-work/<device>/work
incus exec <instance> -- mount -t overlay overlay \
  -o lowerdir=/.overlay-base/<device>,upperdir=/.overlay-work/<device>/upper,workdir=/.overlay-work/<device>/work \
  <target_path>

# Remove device
incus config device remove <instance> <device>
```

### 6.7 Limitations

- `overlay` mode requires container type (not VM) - throws error for VMs
- `shift=true` requires kernel 6.2+ for VFS idmap shifting (default: false)
- Overlay writes are ephemeral - lost on unmount or sandbox destroy
- First overlay mount on a container requires restart (to enable syscall interception)

### 6.8 Errors

- `MountError` - Failed to setup mount or overlay
- `PathNotFoundError` - Source path doesn't exist on host
- `MountNotFoundError` - Target path not mounted (for unmount)

---

## 7. Command Line Interface (CLI)

### 7.1 Overview

The SDK includes a CLI tool called `isb` (incus sandbox) that exposes all SDK functionality via the command line.

### 7.2 Commands

| Command | Description |
|---------|-------------|
| `isb create [name]` | Create a new sandbox |
| `isb destroy <name>` | Destroy a sandbox |
| `isb list` | List all sandboxes |
| `isb info <name>` | Show sandbox details |
| `isb start <name>` | Start a stopped sandbox |
| `isb stop <name>` | Stop a running sandbox |
| `isb restart <name>` | Restart a sandbox |
| `isb exec <name> <command...>` | Run a command in a sandbox |
| `isb run <name> --language <lang>` | Run code in a sandbox |
| `isb push <name> <local> <remote>` | Copy file to sandbox |
| `isb pull <name> <remote> <local>` | Copy file from sandbox |
| `isb cat <name> <path>` | Read file from sandbox |
| `isb ls <name> [path]` | List directory in sandbox |
| `isb mount <name> <source> <target>` | Mount host directory |
| `isb unmount <name> <target>` | Unmount directory |
| `isb mounts <name>` | List mounts |
| `isb snapshot <name> <snap-name>` | Create snapshot |
| `isb restore <name> <snap-name>` | Restore snapshot |
| `isb snapshots <name>` | List snapshots |

### 7.3 Implementation

- Built with [Stricli](https://bloomberg.github.io/stricli/) CLI framework
- Type-safe command definitions
- Supports building as standalone binary via Bun

### 7.4 Build Scripts

```bash
bun run build:cli      # Build CLI to dist/cli/
bun run build:binary   # Build standalone binary
```

---

## 9. Future Considerations (Out of Scope for v2)

- **Networking:** Port forwarding, custom networks
- **GPU passthrough:** For ML workloads
- **Clustering:** Multi-node Incus clusters
- **Image building:** Custom image creation
- **Streaming:** Real-time stdout/stderr streaming
- **Metrics:** Resource usage monitoring
- **Remote connections:** TLS-based remote Incus servers

---

## 10. Success Criteria

1. All core operations (create, destroy, runCommand, fs operations) work reliably
2. Full TypeScript types with no `any` escapes
3. < 3s container startup time
4. Comprehensive error messages
5. Unit and integration tests with > 80% coverage
6. Documentation with examples for all major use cases
