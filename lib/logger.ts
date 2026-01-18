import pino from 'pino';
import fs from 'fs';
import path from 'path';

const isDevelopment = process.env.NODE_ENV !== 'production';
const LOGS_DIR = path.join(process.cwd(), 'logs');
const MAX_LOG_FILES = 10;

/**
 * Clean up old log files, keeping only the most recent MAX_LOG_FILES
 */
function cleanupOldLogs(): void {
  try {
    if (!fs.existsSync(LOGS_DIR)) {
      fs.mkdirSync(LOGS_DIR, { recursive: true });
      return;
    }

    const files = fs.readdirSync(LOGS_DIR)
      .filter((f) => f.endsWith('.log'))
      .map((f) => ({
        name: f,
        path: path.join(LOGS_DIR, f),
        mtime: fs.statSync(path.join(LOGS_DIR, f)).mtime.getTime(),
      }))
      .sort((a, b) => b.mtime - a.mtime); // Newest first

    // Remove old files beyond MAX_LOG_FILES
    if (files.length >= MAX_LOG_FILES) {
      const filesToDelete = files.slice(MAX_LOG_FILES - 1);
      for (const file of filesToDelete) {
        fs.unlinkSync(file.path);
      }
    }
  } catch {
    // Ignore errors during cleanup
  }
}

/**
 * Get log file path with timestamp
 */
function getLogFilePath(): string {
  const now = new Date();
  const timestamp = now.toISOString()
    .replace(/[:.]/g, '-')
    .replace('T', '_')
    .slice(0, 19);
  return path.join(LOGS_DIR, `${timestamp}.log`);
}

// Only setup file logging on server
let logFilePath: string | null = null;
if (typeof window === 'undefined') {
  cleanupOldLogs();
  logFilePath = getLogFilePath();
}

// Create logger with appropriate transport
const transport = isDevelopment
  ? {
      targets: [
        // Console with pretty print
        {
          target: 'pino-pretty',
          options: {
            colorize: true,
            translateTime: 'HH:MM:ss',
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
                  translateTime: 'yyyy-mm-dd HH:MM:ss',
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
  transport,
});

export default logger;
