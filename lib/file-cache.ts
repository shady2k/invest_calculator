import { promises as fs } from 'fs';
import path from 'path';
import logger from './logger';

const CACHE_DIR = path.join(process.cwd(), 'data', 'cache');

interface CacheEntry<T> {
  timestamp: number;
  data: T;
}

// Memory cache layer - primary source during runtime
const memoryCache = new Map<string, CacheEntry<unknown>>();

/**
 * Validate cache filename to prevent path traversal
 */
function validateFilename(filename: string): void {
  if (filename.includes('..') || filename.includes('/') || filename.includes('\\')) {
    throw new Error(`Invalid cache filename: ${filename}`);
  }
}

/**
 * Read cached data from file
 */
export async function readCache<T>(filename: string): Promise<CacheEntry<T> | null> {
  validateFilename(filename);
  const filepath = path.join(CACHE_DIR, filename);

  try {
    const content = await fs.readFile(filepath, 'utf-8');
    const parsed = JSON.parse(content) as CacheEntry<T>;

    if (!parsed.timestamp || !parsed.data) {
      return null;
    }

    return parsed;
  } catch {
    return null;
  }
}

/**
 * Write data to cache file
 */
export async function writeCache<T>(filename: string, data: T): Promise<boolean> {
  validateFilename(filename);
  const filepath = path.join(CACHE_DIR, filename);

  try {
    await fs.mkdir(CACHE_DIR, { recursive: true });

    const entry: CacheEntry<T> = {
      timestamp: Date.now(),
      data,
    };

    await fs.writeFile(filepath, JSON.stringify(entry, null, 2), 'utf-8');
    logger.debug({ filename }, 'Cache written successfully');
    return true;
  } catch (error) {
    logger.error({ error, filename }, 'Failed to write cache');
    return false;
  }
}

/**
 * Check if cache is stale
 */
export function isCacheStale(timestamp: number, maxAgeMs: number): boolean {
  return Date.now() - timestamp > maxAgeMs;
}

/**
 * Get data with memory-first cache architecture
 *
 * Order of operations:
 * 1. Check memory cache (fastest)
 * 2. If memory miss or stale, check file cache (cold start)
 * 3. If file miss or stale, fetch fresh data
 * 4. On fetch failure, use stale cache if available
 */
export async function getWithCache<T>(
  filename: string,
  fetchFn: () => Promise<T>,
  maxAgeMs: number
): Promise<T> {
  // 1. Check memory cache first (primary source during runtime)
  const memoryCached = memoryCache.get(filename) as CacheEntry<T> | undefined;
  if (memoryCached && !isCacheStale(memoryCached.timestamp, maxAgeMs)) {
    logger.debug({ filename, age: Date.now() - memoryCached.timestamp, source: 'memory' }, 'Using fresh memory cache');
    return memoryCached.data;
  }

  // 2. Memory miss or stale - check file cache (cold start scenario)
  const fileCached = await readCache<T>(filename);
  if (fileCached && !isCacheStale(fileCached.timestamp, maxAgeMs)) {
    // Populate memory cache from file
    memoryCache.set(filename, fileCached);
    logger.debug({ filename, age: Date.now() - fileCached.timestamp, source: 'file' }, 'Loaded fresh cache from file into memory');
    return fileCached.data;
  }

  // Use stale data from memory or file while we try to fetch
  const staleData = memoryCached ?? fileCached;

  // 3. Try to fetch new data
  try {
    const freshData = await fetchFn();

    // Don't cache empty arrays
    if (Array.isArray(freshData) && freshData.length === 0) {
      logger.warn({ filename }, 'Fetch returned empty data, not caching');
      if (staleData) {
        return staleData.data;
      }
      throw new Error('Fetch returned empty data and no cache available');
    }

    // Successfully fetched - update both caches
    const entry: CacheEntry<T> = { timestamp: Date.now(), data: freshData };
    memoryCache.set(filename, entry);

    // Write to file in background (don't block return)
    writeCache(filename, freshData).catch((err) => {
      logger.error({ error: err, filename }, 'Failed to write cache to file');
    });

    logger.info({ filename }, 'Cache updated with fresh data');
    return freshData;
  } catch (error) {
    // 4. Fetch failed - use stale cache if available
    if (staleData) {
      logger.warn(
        { error, filename, age: Date.now() - staleData.timestamp },
        'Fetch failed, using stale cache'
      );
      return staleData.data;
    }

    // No cache available, propagate error
    throw error;
  }
}
