import { promises as fs } from 'fs';
import path from 'path';
import logger from './logger';

const CACHE_DIR = path.join(process.cwd(), 'data', 'cache');

interface CacheEntry<T> {
  timestamp: number;
  data: T;
}

/**
 * Read cached data from file
 */
export async function readCache<T>(filename: string): Promise<CacheEntry<T> | null> {
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
 * Get data with file cache fallback
 * - If cache exists and fresh: return cached data
 * - If cache exists but stale: try to fetch new, fallback to cache on error
 * - If no cache: fetch new data and cache it
 */
export async function getWithCache<T>(
  filename: string,
  fetchFn: () => Promise<T>,
  maxAgeMs: number
): Promise<T> {
  const cached = await readCache<T>(filename);

  // If we have fresh cache, use it
  if (cached && !isCacheStale(cached.timestamp, maxAgeMs)) {
    logger.debug({ filename, age: Date.now() - cached.timestamp }, 'Using fresh cache');
    return cached.data;
  }

  // Try to fetch new data
  try {
    const freshData = await fetchFn();

    // Don't cache empty arrays
    if (Array.isArray(freshData) && freshData.length === 0) {
      logger.warn({ filename }, 'Fetch returned empty data, not caching');
      if (cached) {
        return cached.data;
      }
      throw new Error('Fetch returned empty data and no cache available');
    }

    // Successfully fetched, update cache
    await writeCache(filename, freshData);
    logger.info({ filename }, 'Cache updated with fresh data');

    return freshData;
  } catch (error) {
    // Fetch failed, try to use stale cache
    if (cached) {
      logger.warn(
        { error, filename, age: Date.now() - cached.timestamp },
        'Fetch failed, using stale cache'
      );
      return cached.data;
    }

    // No cache available, propagate error
    throw error;
  }
}
