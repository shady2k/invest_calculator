import pino from 'pino';

const TIMEZONE = 'Europe/Moscow';
const isDevelopment = process.env.NODE_ENV !== 'production';

/**
 * Check if running in Node.js (not Edge Runtime)
 */
function isNodeRuntime(): boolean {
  return typeof process !== 'undefined' && process.versions?.node !== undefined;
}

/**
 * Format date in Moscow timezone
 */
function formatMoscowDate(date: Date, format: 'filename' | 'log'): string {
  const options: Intl.DateTimeFormatOptions = {
    timeZone: TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  };

  const parts = new Intl.DateTimeFormat('ru-RU', options).formatToParts(date);
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
 * Setup file logging (Node.js only)
 * Uses dynamic imports to avoid Edge Runtime issues
 */
async function setupFileLogging(): Promise<string | null> {
  if (!isNodeRuntime()) {
    return null;
  }

  try {
    const fs = await import('fs');
    const path = await import('path');

    const LOGS_DIR = path.join(process.cwd(), 'logs');
    const MAX_LOG_FILES = 10;

    // Cleanup old logs
    try {
      if (!fs.existsSync(LOGS_DIR)) {
        fs.mkdirSync(LOGS_DIR, { recursive: true });
      } else {
        const files = fs.readdirSync(LOGS_DIR)
          .filter((f) => f.endsWith('.log') && f !== '.gitkeep')
          .map((f) => {
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
          .filter((f) => f.size > 0)
          .sort((a, b) => b.mtime - a.mtime);

        // Remove old files beyond MAX_LOG_FILES
        if (nonEmptyFiles.length > MAX_LOG_FILES) {
          const filesToDelete = nonEmptyFiles.slice(MAX_LOG_FILES);
          for (const file of filesToDelete) {
            fs.unlinkSync(file.path);
          }
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

// File path for logging (set asynchronously in Node.js)
let logFilePath: string | null = null;

// Initialize file logging in Node.js runtime (non-blocking)
if (isNodeRuntime()) {
  setupFileLogging().then((path) => {
    logFilePath = path;
  }).catch(() => {
    // Ignore errors
  });
}

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
        translateTime: 'SYS:HH:MM:ss',
        ignore: 'pid,hostname',
      },
      level: 'debug',
    },
  ];

  // File output only available synchronously if already set
  // For async setup, file logging starts after initialization
  if (logFilePath) {
    targets.push({
      target: 'pino-pretty',
      options: {
        colorize: false,
        translateTime: 'SYS:yyyy-mm-dd HH:MM:ss',
        ignore: 'pid,hostname',
        destination: logFilePath,
        mkdir: true,
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
