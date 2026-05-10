export interface LogContext {
  [key: string]: unknown;
}

export type LogLevel = "debug" | "info" | "warn" | "error";

export interface Logger {
  debug: (message: string, context?: LogContext) => void;
  info: (message: string, context?: LogContext) => void;
  warn: (message: string, context?: LogContext) => void;
  error: (message: string, context?: LogContext) => void;
}

const LOG_LEVEL_WEIGHT: Record<LogLevel, number> = {
  debug: 10,
  info: 20,
  warn: 30,
  error: 40,
};

let currentLogLevel: LogLevel = "warn";

export function setLogLevel(level: LogLevel): void {
  currentLogLevel = level;
}

export function getLogLevel(): LogLevel {
  return currentLogLevel;
}

function enabled(level: LogLevel): boolean {
  return LOG_LEVEL_WEIGHT[level] >= LOG_LEVEL_WEIGHT[currentLogLevel];
}

function stamp(): string {
  return new Date().toISOString();
}

function payload(context?: LogContext): LogContext | undefined {
  return context && Object.keys(context).length > 0 ? context : undefined;
}

export function createLogger(scope: string): Logger {
  const prefix = `[AI3D][${scope}]`;

  return {
    debug(message: string, context?: LogContext) {
      if (!enabled("debug")) return;
      console.debug(prefix, stamp(), message, payload(context));
    },
    info(message: string, context?: LogContext) {
      if (!enabled("info")) return;
      console.debug(prefix, stamp(), message, payload(context));
    },
    warn(message: string, context?: LogContext) {
      if (!enabled("warn")) return;
      console.warn(prefix, stamp(), message, payload(context));
    },
    error(message: string, context?: LogContext) {
      if (!enabled("error")) return;
      console.error(prefix, stamp(), message, payload(context));
    },
  };
}
