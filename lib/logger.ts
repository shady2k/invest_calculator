import pino from 'pino';
import fs from 'fs';
import path from 'path';

const TIMEZONE = 'Europe/Moscow';
const isDevelopment = process.env.NODE_ENV !== 'production';
const LOGS_DIR = path.join(process.cwd(), 'logs');
const MAX_LOG_FILES = 10;

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

/**
 * Clean up old log files, keeping only the most recent MAX_LOG_FILES
 * Also removes empty log files
 */
function cleanupOldLogs(): void {
  try {
    if (!fs.existsSync(LOGS_DIR)) {
      fs.mkdirSync(LOGS_DIR, { recursive: true });
      return;
    }

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
  } catch {
    // Ignore errors during cleanup
  }
}

/**
 * Get log file path with Moscow timestamp
 */
function getLogFilePath(): string {
  const timestamp = formatMoscowDate(new Date(), 'filename');
  return path.join(LOGS_DIR, `${timestamp}.log`);
}

// Only setup file logging on server
let logFilePath: string | null = null;
if (typeof window === 'undefined') {
  cleanupOldLogs();
  logFilePath = getLogFilePath();
}

// Custom timestamp function for Moscow timezone
const timestampMoscow = (): string => {
  const moscowTime = formatMoscowDate(new Date(), 'log');
  return `,"time":"${moscowTime}"`;
};

// Create logger with appropriate transport
const transport = isDevelopment
  ? {
      targets: [
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
        // File output (if on server)
        ...(logFilePath
          ? [
              {
                target: 'pino-pretty',
                options: {
                  colorize: false,
                  translateTime: 'SYS:yyyy-mm-dd HH:MM:ss',
                  ignore: 'pid,hostname',
                  destination: logFilePath,
                  mkdir: true,
                },
                level: 'debug',
              },
            ]
          : []),
      ],
    }
  : undefined;

export const logger = pino({
  level: process.env.LOG_LEVEL ?? (isDevelopment ? 'debug' : 'info'),
  timestamp: timestampMoscow,
  transport,
});

export default logger;
