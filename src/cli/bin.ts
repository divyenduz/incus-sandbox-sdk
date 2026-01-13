#!/usr/bin/env node
import { run } from '@stricli/core';
import { app } from './app';
import { buildContext } from './context';

const context = buildContext(process);

run(app, process.argv.slice(2), context).catch((err) => {
  process.stderr.write(`Fatal error: ${err.message}\n`);
  process.exit(1);
});
