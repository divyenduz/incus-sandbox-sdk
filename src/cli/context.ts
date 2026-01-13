export interface CliContext {
  readonly process: NodeJS.Process;
}

export function buildContext(process: NodeJS.Process): CliContext {
  return {
    process,
  };
}
