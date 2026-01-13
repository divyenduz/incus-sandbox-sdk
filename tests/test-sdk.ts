import { incus, Sandbox } from '../src';

const GREEN = '\x1b[32m';
const RED = '\x1b[31m';
const YELLOW = '\x1b[33m';
const RESET = '\x1b[0m';

function log(msg: string) {
  console.log(`${YELLOW}[TEST]${RESET} ${msg}`);
}

function pass(msg: string) {
  console.log(`${GREEN}[PASS]${RESET} ${msg}`);
}

function fail(msg: string, err?: unknown) {
  console.log(`${RED}[FAIL]${RESET} ${msg}`);
  if (err) console.error(err);
}

async function runTests() {
  console.log('\n========================================');
  console.log('       incus-sandbox-sdk Test Suite');
  console.log('========================================\n');

  let sandbox: Sandbox | null = null;
  const testResults: { name: string; passed: boolean }[] = [];

  try {
    // Test 1: Check Incus availability
    log('Test 1: Check Incus availability');
    const available = await incus.checkIncusAvailable();
    if (available) {
      pass('Incus is available');
      testResults.push({ name: 'Incus availability', passed: true });
    } else {
      fail('Incus is not available');
      testResults.push({ name: 'Incus availability', passed: false });
      return;
    }

    // Test 2: Create sandbox
    log('Test 2: Create sandbox');
    const startTime = Date.now();
    sandbox = await incus.sandbox.create({
      name: 'test-sdk-sandbox',
    });
    const createTime = Date.now() - startTime;
    if (sandbox && sandbox.name === 'test-sdk-sandbox') {
      pass(`Sandbox created: ${sandbox.name} (${createTime}ms)`);
      testResults.push({ name: 'Create sandbox', passed: true });
    } else {
      fail('Failed to create sandbox');
      testResults.push({ name: 'Create sandbox', passed: false });
      return;
    }

    // Test 3: Get sandbox state
    log('Test 3: Get sandbox state');
    const state = await sandbox.getState();
    if (state === 'running') {
      pass(`Sandbox state: ${state}`);
      testResults.push({ name: 'Get state', passed: true });
    } else {
      fail(`Unexpected state: ${state}`);
      testResults.push({ name: 'Get state', passed: false });
    }

    // Test 4: Run command
    log('Test 4: Run command');
    const cmdResult = await sandbox.runCommand('echo "Hello from sandbox"');
    if (cmdResult.stdout.trim() === 'Hello from sandbox' && cmdResult.exitCode === 0) {
      pass(`Command output: "${cmdResult.stdout.trim()}" (${cmdResult.durationMs}ms)`);
      testResults.push({ name: 'Run command', passed: true });
    } else {
      fail(`Unexpected command result: ${JSON.stringify(cmdResult)}`);
      testResults.push({ name: 'Run command', passed: false });
    }

    // Test 5: Run command with exit code
    log('Test 5: Run command with non-zero exit code');
    const failCmd = await sandbox.runCommand('exit 42');
    if (failCmd.exitCode === 42) {
      pass(`Exit code captured correctly: ${failCmd.exitCode}`);
      testResults.push({ name: 'Exit code handling', passed: true });
    } else {
      fail(`Unexpected exit code: ${failCmd.exitCode}`);
      testResults.push({ name: 'Exit code handling', passed: false });
    }

    // Test 6: Filesystem - write file
    log('Test 6: Write file');
    await sandbox.fs.writeFile('/tmp/test.txt', 'Hello, World!');
    pass('File written successfully');
    testResults.push({ name: 'Write file', passed: true });

    // Test 7: Filesystem - read file
    log('Test 7: Read file');
    const content = await sandbox.fs.readFile('/tmp/test.txt');
    if (content === 'Hello, World!') {
      pass(`File content: "${content}"`);
      testResults.push({ name: 'Read file', passed: true });
    } else {
      fail(`Unexpected content: "${content}"`);
      testResults.push({ name: 'Read file', passed: false });
    }

    // Test 8: Filesystem - exists
    log('Test 8: Check file exists');
    const exists = await sandbox.fs.exists('/tmp/test.txt');
    const notExists = await sandbox.fs.exists('/tmp/nonexistent.txt');
    if (exists && !notExists) {
      pass('File existence check works');
      testResults.push({ name: 'File exists', passed: true });
    } else {
      fail(`exists=${exists}, notExists=${notExists}`);
      testResults.push({ name: 'File exists', passed: false });
    }

    // Test 9: Filesystem - mkdir and readdir
    log('Test 9: mkdir and readdir');
    await sandbox.fs.mkdir('/tmp/testdir');
    await sandbox.fs.writeFile('/tmp/testdir/file1.txt', 'content1');
    await sandbox.fs.writeFile('/tmp/testdir/file2.txt', 'content2');
    const files = await sandbox.fs.readdir('/tmp/testdir');
    if (files.includes('file1.txt') && files.includes('file2.txt')) {
      pass(`Directory contents: ${files.join(', ')}`);
      testResults.push({ name: 'mkdir/readdir', passed: true });
    } else {
      fail(`Unexpected files: ${files.join(', ')}`);
      testResults.push({ name: 'mkdir/readdir', passed: false });
    }

    // Test 10: Filesystem - stat (using testdir which still exists)
    log('Test 10: File stat');
    const stat = await sandbox.fs.stat('/tmp/testdir/file1.txt');
    if (stat.type === 'file' && stat.size > 0) {
      pass(`Stat: type=${stat.type}, size=${stat.size}`);
      testResults.push({ name: 'File stat', passed: true });
    } else {
      fail(`Unexpected stat: ${JSON.stringify(stat)}`);
      testResults.push({ name: 'File stat', passed: false });
    }

    // Test 11: Filesystem - rm
    log('Test 11: Remove directory');
    await sandbox.fs.rm('/tmp/testdir', { recursive: true, force: true });
    const existsAfterRm = await sandbox.fs.exists('/tmp/testdir');
    if (!existsAfterRm) {
      pass('Directory removed successfully');
      testResults.push({ name: 'Remove directory', passed: true });
    } else {
      fail('Directory still exists after removal');
      testResults.push({ name: 'Remove directory', passed: false });
    }

    // Test 12: Run Python code
    log('Test 12: Run Python code');
    const pyResult = await sandbox.runCode('print(2 + 2)', { language: 'python' });
    if (pyResult.output.trim() === '4' && pyResult.exitCode === 0) {
      pass(`Python output: "${pyResult.output.trim()}" (${pyResult.durationMs}ms)`);
      testResults.push({ name: 'Run Python code', passed: true });
    } else {
      fail(`Unexpected Python result: ${JSON.stringify(pyResult)}`);
      testResults.push({ name: 'Run Python code', passed: false });
    }

    // Test 13: Run Bash code
    log('Test 13: Run Bash code');
    const bashResult = await sandbox.runCode('echo $((3 * 7))', { language: 'bash' });
    if (bashResult.output.trim() === '21' && bashResult.exitCode === 0) {
      pass(`Bash output: "${bashResult.output.trim()}"`);
      testResults.push({ name: 'Run Bash code', passed: true });
    } else {
      fail(`Unexpected Bash result: ${JSON.stringify(bashResult)}`);
      testResults.push({ name: 'Run Bash code', passed: false });
    }

    // Test 13b: Run command with environment variables
    log('Test 13b: Run command with env vars');
    const envResult = await sandbox.runCommand('echo $MY_VAR', { env: { MY_VAR: 'hello-env' } });
    if (envResult.stdout.trim() === 'hello-env') {
      pass(`Env var output: "${envResult.stdout.trim()}"`);
      testResults.push({ name: 'Env vars', passed: true });
    } else {
      fail(`Unexpected env result: ${envResult.stdout}`);
      testResults.push({ name: 'Env vars', passed: false });
    }

    // Test 14: List sandboxes
    log('Test 14: List sandboxes');
    const sandboxes = await incus.sandbox.list();
    const found = sandboxes.find((s) => s.name === 'test-sdk-sandbox');
    if (found) {
      pass(`Found sandbox in list: ${found.name} (state=${found.state})`);
      testResults.push({ name: 'List sandboxes', passed: true });
    } else {
      fail('Sandbox not found in list');
      testResults.push({ name: 'List sandboxes', passed: false });
    }

    // Test 15: Get sandbox by name
    log('Test 15: Get sandbox by name');
    const retrieved = await incus.sandbox.getByName('test-sdk-sandbox');
    if (retrieved && retrieved.name === 'test-sdk-sandbox') {
      pass(`Retrieved sandbox: ${retrieved.name}`);
      testResults.push({ name: 'Get by name', passed: true });
    } else {
      fail('Failed to retrieve sandbox by name');
      testResults.push({ name: 'Get by name', passed: false });
    }

    // Test 16: Snapshots
    log('Test 16: Create and list snapshots');
    await sandbox.snapshot('test-snapshot');
    const snapshots = await sandbox.listSnapshots();
    if (snapshots.find((s) => s.name === 'test-snapshot')) {
      pass(`Snapshot created: ${snapshots.map((s) => s.name).join(', ')}`);
      testResults.push({ name: 'Snapshots', passed: true });
    } else {
      fail('Snapshot not found');
      testResults.push({ name: 'Snapshots', passed: false });
    }

    // Test 17: Delete snapshot
    log('Test 17: Delete snapshot');
    await sandbox.deleteSnapshot('test-snapshot');
    const snapshotsAfter = await sandbox.listSnapshots();
    if (!snapshotsAfter.find((s) => s.name === 'test-snapshot')) {
      pass('Snapshot deleted successfully');
      testResults.push({ name: 'Delete snapshot', passed: true });
    } else {
      fail('Snapshot still exists');
      testResults.push({ name: 'Delete snapshot', passed: false });
    }

    // Test 18: Stop sandbox
    log('Test 18: Stop sandbox');
    await sandbox.stop();
    const stoppedState = await sandbox.getState();
    if (stoppedState === 'stopped') {
      pass('Sandbox stopped');
      testResults.push({ name: 'Stop sandbox', passed: true });
    } else {
      fail(`Unexpected state after stop: ${stoppedState}`);
      testResults.push({ name: 'Stop sandbox', passed: false });
    }

    // Test 19: Start sandbox
    log('Test 19: Start sandbox');
    await sandbox.start();
    await new Promise((r) => setTimeout(r, 2000)); // Wait for startup
    const startedState = await sandbox.getState();
    if (startedState === 'running') {
      pass('Sandbox started');
      testResults.push({ name: 'Start sandbox', passed: true });
    } else {
      fail(`Unexpected state after start: ${startedState}`);
      testResults.push({ name: 'Start sandbox', passed: false });
    }

    // Test 20: Mount with overlay mode
    log('Test 20: Mount host folder with overlay');
    const hostPath = `${process.env.HOME}/plv8ify`;
    const mountInfo = await sandbox.mount({
      source: hostPath,
      target: '/workspace',
      mode: 'overlay',
    });
    if (mountInfo.device.startsWith('mount-') && mountInfo.mode === 'overlay') {
      pass(`Overlay mount created: ${mountInfo.device}`);
      testResults.push({ name: 'Mount overlay', passed: true });
    } else {
      fail(`Unexpected mount info: ${JSON.stringify(mountInfo)}`);
      testResults.push({ name: 'Mount overlay', passed: false });
    }

    // Test 21: Verify mounted content is readable
    log('Test 21: Verify mounted content');
    const lsResult = await sandbox.runCommand('ls /workspace');
    if (lsResult.stdout.includes('package.json') && lsResult.stdout.includes('src')) {
      pass(`Mounted content visible: package.json, src found`);
      testResults.push({ name: 'Mounted content readable', passed: true });
    } else {
      fail(`Unexpected ls output: ${lsResult.stdout}`);
      testResults.push({ name: 'Mounted content readable', passed: false });
    }

    // Test 22: Verify overlay isolation - writes don't affect host
    log('Test 22: Verify overlay isolation');
    await sandbox.runCommand('echo "sandbox-only" > /workspace/test-overlay.txt');
    const existsInSandbox = await sandbox.fs.exists('/workspace/test-overlay.txt');
    const fs = await import('fs/promises');
    let existsOnHost = false;
    try {
      await fs.access(`${hostPath}/test-overlay.txt`);
      existsOnHost = true;
    } catch {
      existsOnHost = false;
    }
    if (existsInSandbox && !existsOnHost) {
      pass('Overlay isolation works: file exists in sandbox but not on host');
      testResults.push({ name: 'Overlay isolation', passed: true });
    } else {
      fail(`Isolation failed: sandbox=${existsInSandbox}, host=${existsOnHost}`);
      testResults.push({ name: 'Overlay isolation', passed: false });
    }

    // Test 23: List mounts
    log('Test 23: List mounts');
    const mounts = await sandbox.listMounts();
    const ourMount = mounts.find((m) => m.target === '/workspace');
    if (ourMount && ourMount.mode === 'overlay' && ourMount.source === hostPath) {
      pass(`Mount listed: ${ourMount.device} -> ${ourMount.target}`);
      testResults.push({ name: 'List mounts', passed: true });
    } else {
      fail(`Mount not found or incorrect: ${JSON.stringify(mounts)}`);
      testResults.push({ name: 'List mounts', passed: false });
    }

    // Test 24: Unmount
    log('Test 24: Unmount');
    await sandbox.unmount('/workspace');
    const mountsAfter = await sandbox.listMounts();
    const stillMounted = mountsAfter.find((m) => m.target === '/workspace');
    if (!stillMounted) {
      pass('Mount removed successfully');
      testResults.push({ name: 'Unmount', passed: true });
    } else {
      fail('Mount still exists after unmount');
      testResults.push({ name: 'Unmount', passed: false });
    }

    // Test 25: Mount with readonly mode
    log('Test 25: Mount readonly');
    const readonlyMount = await sandbox.mount({
      source: hostPath,
      target: '/readonly-workspace',
      mode: 'readonly',
    });
    const writeAttempt = await sandbox.runCommand('touch /readonly-workspace/should-fail.txt 2>&1 || echo "WRITE_FAILED"');
    if (writeAttempt.stdout.includes('WRITE_FAILED') || writeAttempt.stdout.includes('Read-only')) {
      pass('Readonly mount prevents writes');
      testResults.push({ name: 'Readonly mount', passed: true });
    } else {
      fail(`Readonly mount allowed write: ${writeAttempt.stdout}`);
      testResults.push({ name: 'Readonly mount', passed: false });
    }
    await sandbox.unmount('/readonly-workspace');

  } catch (err) {
    fail('Unexpected error during tests', err);
  } finally {
    // Cleanup
    if (sandbox) {
      log('Cleaning up: destroying sandbox');
      try {
        await sandbox.destroy({ force: true });
        pass('Sandbox destroyed');
        testResults.push({ name: 'Destroy sandbox', passed: true });
      } catch (err) {
        fail('Failed to destroy sandbox', err);
        testResults.push({ name: 'Destroy sandbox', passed: false });
      }
    }
  }

  // Summary
  console.log('\n========================================');
  console.log('              Test Summary');
  console.log('========================================');
  const passed = testResults.filter((t) => t.passed).length;
  const total = testResults.length;
  console.log(`\nPassed: ${passed}/${total}`);

  if (passed === total) {
    console.log(`\n${GREEN}All tests passed!${RESET}\n`);
  } else {
    console.log(`\n${RED}Some tests failed:${RESET}`);
    testResults.filter((t) => !t.passed).forEach((t) => {
      console.log(`  - ${t.name}`);
    });
    console.log('');
  }
}

runTests().catch(console.error);
