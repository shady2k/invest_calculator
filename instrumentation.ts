import { existsSync, readFileSync } from 'fs';
import path from 'path';
import logger from '@/lib/logger';

const REQUIRED_DATA_FILES = [
  'data/rate-scenarios.json',
  'data/inflation-scenarios.json',
];

function getVersion(): string {
  try {
    const pkgPath = path.join(process.cwd(), 'package.json');
    const pkg = JSON.parse(readFileSync(pkgPath, 'utf-8')) as { version: string };
    return pkg.version;
  } catch {
    return 'unknown';
  }
}

function validateRequiredFiles(): void {
  const missing: string[] = [];

  for (const file of REQUIRED_DATA_FILES) {
    const fullPath = path.join(process.cwd(), file);
    if (!existsSync(fullPath)) {
      missing.push(file);
    }
  }

  if (missing.length > 0) {
    logger.fatal({ missing }, 'Required data files not found');
    process.exit(1);
  }
}

export async function register(): Promise<void> {
  // Only run on server
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    const version = getVersion();
    logger.info({ version }, 'Application starting');

    // Fail fast if required files are missing
    validateRequiredFiles();

    const { precalculateAllScenarios } = await import('@/lib/precalculate');

    logger.info('Starting background precalculation of all scenarios...');

    // Run in background, don't block server startup
    precalculateAllScenarios()
      .then(() => {
        logger.info('Background precalculation complete');
      })
      .catch((error) => {
        logger.error({ error }, 'Background precalculation failed');
      });
  }
}
