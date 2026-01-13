export class IncusSdkError extends Error {
  override name: string = 'IncusSdkError';
  code: string;
  override cause?: Error;

  constructor(message: string, code: string, cause?: Error) {
    super(message);
    this.name = 'IncusSdkError';
    this.code = code;
    this.cause = cause;
  }
}

export class SandboxNotFoundError extends IncusSdkError {
  constructor(name: string) {
    super(`Sandbox '${name}' not found`, 'SANDBOX_NOT_FOUND');
    this.name = 'SandboxNotFoundError';
  }
}

export class ImageNotFoundError extends IncusSdkError {
  constructor(image: string) {
    super(`Image '${image}' not found`, 'IMAGE_NOT_FOUND');
    this.name = 'ImageNotFoundError';
  }
}

export class TimeoutError extends IncusSdkError {
  constructor(operation: string, timeoutMs: number) {
    super(`Operation '${operation}' timed out after ${timeoutMs}ms`, 'TIMEOUT');
    this.name = 'TimeoutError';
  }
}

export class NameConflictError extends IncusSdkError {
  constructor(name: string) {
    super(`Sandbox with name '${name}' already exists`, 'NAME_CONFLICT');
    this.name = 'NameConflictError';
  }
}

export class SandboxNotRunningError extends IncusSdkError {
  constructor(name: string) {
    super(`Sandbox '${name}' is not running`, 'SANDBOX_NOT_RUNNING');
    this.name = 'SandboxNotRunningError';
  }
}

export class CommandError extends IncusSdkError {
  constructor(message: string, cause?: Error) {
    super(message, 'COMMAND_FAILED', cause);
    this.name = 'CommandError';
  }
}

export class ResourceLimitError extends IncusSdkError {
  constructor(message: string) {
    super(message, 'RESOURCE_LIMIT');
    this.name = 'ResourceLimitError';
  }
}

export class IncusConnectionError extends IncusSdkError {
  constructor(message: string, cause?: Error) {
    super(message, 'CONNECTION_ERROR', cause);
    this.name = 'IncusConnectionError';
  }
}
