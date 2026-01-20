import 'server-only';
import pino from 'pino';

const TIMEZONE = 'Europe/Moscow';
const isDevelopment = process.env.NODE_ENV !== 'production';

/**
 * Check if running in Node.js (not Edge Runtime)
 */
function isNodeRuntime(): boolean {
  return typeof process !== 'undefined' && process.versions?.node !== undefined;
}

// Cached DateTimeFormat instances for performance
const dateFormatOptions: Intl.DateTimeFormatOptions = {
  timeZone: TIMEZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
  hour12: false,
};
const cachedFormatter = new Intl.DateTimeFormat('ru-RU', dateFormatOptions);

/**
 * Format date in Moscow timezone
 */
function formatMoscowDate(date: Date, format: 'filename' | 'log'): string {
  const parts = cachedFormatter.formatToParts(date);
  const get = (type: string): string => parts.find(p => p.type === type)?.value ?? '';

  if (format === 'filename') {
    return `${get('year')}-${get('month')}-${get('day')}_${get('hour')}-${get('minute')}-${get('second')}`;
  }
  return `${get('year')}-${get('month')}-${get('day')} ${get('hour')}:${get('minute')}:${get('second')}`;
}

// Custom timestamp function for Moscow timezone
const timestampMoscow = (): string => {
  const moscowTime = formatMoscowDate(new Date(), 'log');
  return `,"time":"${moscowTime}"`;
};

/**
 * Setup file logging (Node.js + development only)
 * Synchronous to ensure log file path is available before logger creation
 */
function setupFileLogging(): string | null {
  // Only setup file logging in development and Node.js runtime
  if (!isDevelopment || !isNodeRuntime()) {
    return null;
  }

  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const fs = require('fs') as typeof import('fs');
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const path = require('path') as typeof import('path');

    const LOGS_DIR = path.join(process.cwd(), 'logs');
    const MAX_LOG_FILES = 10;

    // Ensure logs directory exists and is writable
    try {
      if (!fs.existsSync(LOGS_DIR)) {
        fs.mkdirSync(LOGS_DIR, { recursive: true });
      }

      // Verify writability by attempting to open a test file
      const testFile = path.join(LOGS_DIR, '.write-test');
      const fd = fs.openSync(testFile, 'w');
      fs.closeSync(fd);
      fs.unlinkSync(testFile);
    } catch {
      // Directory not writable, skip file logging
      return null;
    }

    // Cleanup old logs
    try {
      const files = fs.readdirSync(LOGS_DIR)
        .filter((f: string) => f.endsWith('.log') && f !== '.gitkeep')
        .map((f: string) => {
          const filePath = path.join(LOGS_DIR, f);
          const stat = fs.statSync(filePath);
          return {
            name: f,
            path: filePath,
            mtime: stat.mtime.getTime(),
            size: stat.size,
          };
        });

      // Delete empty log files
      for (const file of files) {
        if (file.size === 0) {
          fs.unlinkSync(file.path);
        }
      }

      // Get non-empty files sorted by time
      const nonEmptyFiles = files
        .filter((f: { size: number }) => f.size > 0)
        .sort((a: { mtime: number }, b: { mtime: number }) => b.mtime - a.mtime);

      // Remove old files beyond MAX_LOG_FILES
      if (nonEmptyFiles.length > MAX_LOG_FILES) {
        const filesToDelete = nonEmptyFiles.slice(MAX_LOG_FILES);
        for (const file of filesToDelete) {
          fs.unlinkSync(file.path);
        }
      }
    } catch {
      // Ignore cleanup errors
    }

    // Return log file path
    const timestamp = formatMoscowDate(new Date(), 'filename');
    return path.join(LOGS_DIR, `${timestamp}.log`);
  } catch {
    return null;
  }
}

// File path for logging (set synchronously in Node.js development only)
const logFilePath: string | null = setupFileLogging();

// Create transport config
function getTransport(): pino.TransportMultiOptions | undefined {
  if (!isDevelopment) {
    return undefined;
  }

  const targets: pino.TransportTargetOptions[] = [
    // Console with pretty print
    {
      target: 'pino-pretty',
      options: {
        colorize: true,
        ignore: 'pid,hostname',
        // Don't translate time - we already format it in Moscow timezone
        translateTime: false,
      },
      level: 'debug',
    },
  ];

  // Add file output if path was successfully initialized
  if (logFilePath) {
    targets.push({
      target: 'pino-pretty',
      options: {
        colorize: false,
        ignore: 'pid,hostname',
        destination: logFilePath,
        mkdir: true,
        // Don't translate time - we already format it in Moscow timezone
        translateTime: false,
      },
      level: 'debug',
    });
  }

  return { targets };
}

export const logger = pino({
  level: process.env.LOG_LEVEL ?? (isDevelopment ? 'debug' : 'info'),
  timestamp: timestampMoscow,
  transport: getTransport(),
});

export default logger;
