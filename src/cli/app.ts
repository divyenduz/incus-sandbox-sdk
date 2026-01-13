import { buildApplication, buildRouteMap } from '@stricli/core';
import type { CliContext } from './context';

import { createCommand } from './commands/create';
import { destroyCommand } from './commands/destroy';
import { listCommand } from './commands/list';
import { startCommand } from './commands/start';
import { stopCommand } from './commands/stop';
import { restartCommand } from './commands/restart';
import { infoCommand } from './commands/info';
import { execCommand } from './commands/exec';
import { runCommand } from './commands/run';
import { pushCommand } from './commands/push';
import { pullCommand } from './commands/pull';
import { catCommand } from './commands/cat';
import { lsCommand } from './commands/ls';
import { mountCommand } from './commands/mount';
import { unmountCommand } from './commands/unmount';
import { mountsCommand } from './commands/mounts';
import { snapshotCommand } from './commands/snapshot';
import { restoreCommand } from './commands/restore';
import { snapshotsCommand } from './commands/snapshots';

const routes = buildRouteMap({
  routes: {
    create: createCommand,
    destroy: destroyCommand,
    list: listCommand,
    start: startCommand,
    stop: stopCommand,
    restart: restartCommand,
    info: infoCommand,
    exec: execCommand,
    run: runCommand,
    push: pushCommand,
    pull: pullCommand,
    cat: catCommand,
    ls: lsCommand,
    mount: mountCommand,
    unmount: unmountCommand,
    mounts: mountsCommand,
    snapshot: snapshotCommand,
    restore: restoreCommand,
    snapshots: snapshotsCommand,
  },
  docs: {
    brief: 'Incus Sandbox CLI',
  },
});

export const app = buildApplication<CliContext>(routes, {
  name: 'isb',
  versionInfo: {
    currentVersion: '0.1.0',
  },
  scanner: {
    caseStyle: 'allow-kebab-for-camel',
  },
});
