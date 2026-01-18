const REQUIRED_DATA_FILES = [
  'data/rate-scenarios.json',
  'data/inflation-scenarios.json',
];

export async function register(): Promise<void> {
  // Only run on Node.js server (not Edge Runtime)
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    // Dynamic imports for Node.js-only modules
    const { existsSync, readFileSync } = await import('fs');
    const path = await import('path');
    const { default: logger } = await import('@/lib/logger');

    // Get version from package.json
    const getVersion = (): string => {
      try {
        const pkgPath = path.join(process.cwd(), 'package.json');
        const pkg = JSON.parse(readFileSync(pkgPath, 'utf-8')) as { version: string };
        return pkg.version;
      } catch {
        return 'unknown';
      }
    };

    // Validate required data files exist
    const validateRequiredFiles = (): void => {
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
    };

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
