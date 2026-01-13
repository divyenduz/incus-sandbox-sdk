import { sandbox, Sandbox } from './sandbox';
import { setConfig, getConfig, checkIncusAvailable } from './client';
import type { IncusConfig } from './types';

export const incus = {
  sandbox,
  setConfig,
  getConfig,
  checkIncusAvailable,
};

export { Sandbox };

export * from './types';
export * from './errors';
