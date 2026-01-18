export async function register(): Promise<void> {
  // Only run on server
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    const { precalculateAllScenarios } = await import('@/lib/precalculate');
    const loggerModule = await import('@/lib/logger');
    const logger = loggerModule.default;

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
