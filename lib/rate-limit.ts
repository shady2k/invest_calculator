import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import logger from './logger';
import {
  RATE_LIMIT_DEFAULT_MAX_CONCURRENT,
  RATE_LIMIT_DEFAULT_MAX_GLOBAL_CONCURRENT,
  RATE_LIMIT_MAX_ENTRIES,
  RATE_LIMIT_EVICTION_PERCENT,
  RATE_LIMIT_CLEANUP_INTERVAL_MS,
  RATE_LIMIT_DEFAULT_ABUSE_LIMIT,
  RATE_LIMIT_WINDOW_MS,
} from './constants';

/**
 * Concurrent request limiting for adaptive throttling.
 * Throttles based on actual server load, not arbitrary time-based limits.
 */

// Global concurrent request counter
let globalActiveRequests = 0;

// Per-endpoint concurrent request counters
const endpointActiveRequests = new Map<string, number>();

/**
 * Configuration for concurrent limiting
 */
export interface ConcurrentLimitConfig {
  /** Identifier for this endpoint (used in logs and per-endpoint limits) */
  name: string;
  /** Maximum concurrent requests for this specific endpoint (optional) */
  maxConcurrent?: number;
  /** Maximum global concurrent requests across all endpoints */
  maxGlobalConcurrent?: number;
}

/** Context for Next.js App Router dynamic routes */
interface DynamicRouteContext {
  params: Promise<Record<string, string>>;
}

/** Route handler type - supports both simple and dynamic routes */
type RouteHandler = (
  req: NextRequest,
  context?: DynamicRouteContext
) => Promise<Response> | Response;

/**
 * Get current load metrics (useful for internal monitoring only)
 */
export function getLoadMetrics(): {
  globalActive: number;
  byEndpoint: Record<string, number>;
} {
  return {
    globalActive: globalActiveRequests,
    byEndpoint: Object.fromEntries(endpointActiveRequests),
  };
}

/**
 * Higher-Order Function for concurrent request limiting.
 * Throttles based on actual load, not arbitrary rate limits.
 */
export function withConcurrentLimit<T extends RouteHandler>(
  handler: T,
  config: ConcurrentLimitConfig
): T {
  const maxConcurrent = config.maxConcurrent ?? RATE_LIMIT_DEFAULT_MAX_CONCURRENT;
  const maxGlobal = config.maxGlobalConcurrent ?? RATE_LIMIT_DEFAULT_MAX_GLOBAL_CONCURRENT;

  const wrapped = async (req: NextRequest, context?: DynamicRouteContext): Promise<Response> => {
    const endpointActive = endpointActiveRequests.get(config.name) ?? 0;

    // Check global limit
    if (globalActiveRequests >= maxGlobal) {
      logger.warn(
        { endpoint: config.name, globalActive: globalActiveRequests, maxGlobal },
        'Global concurrent limit reached'
      );
      return NextResponse.json(
        { error: 'Server is busy. Please try again shortly.' },
        {
          status: 503,
          headers: { 'Retry-After': '2' },
        }
      );
    }

    // Check per-endpoint limit
    if (endpointActive >= maxConcurrent) {
      logger.warn(
        { endpoint: config.name, endpointActive, maxConcurrent },
        'Endpoint concurrent limit reached'
      );
      return NextResponse.json(
        { error: 'This endpoint is busy. Please try again shortly.' },
        {
          status: 503,
          headers: { 'Retry-After': '2' },
        }
      );
    }

    // Increment counters
    globalActiveRequests++;
    endpointActiveRequests.set(config.name, endpointActive + 1);

    try {
      // Call original handler and return response as-is (no load headers exposed)
      return await handler(req, context);
    } finally {
      // Always decrement counters
      globalActiveRequests--;
      const current = endpointActiveRequests.get(config.name) ?? 1;
      if (current <= 1) {
        endpointActiveRequests.delete(config.name);
      } else {
        endpointActiveRequests.set(config.name, current - 1);
      }
    }
  };

  return wrapped as T;
}

/**
 * Bounded rate limit store to prevent memory DoS.
 * Uses LRU-like eviction when max size is reached.
 */
interface RateLimitEntry {
  count: number;
  resetAt: number;
}

const rateLimitStore = new Map<string, RateLimitEntry>();

/**
 * Add entry to rate limit store with bounded size
 */
function setRateLimitEntry(key: string, entry: RateLimitEntry): void {
  // If at max size, evict entries to make room
  if (rateLimitStore.size >= RATE_LIMIT_MAX_ENTRIES && !rateLimitStore.has(key)) {
    const now = Date.now();
    const toEvict = Math.ceil(RATE_LIMIT_MAX_ENTRIES * RATE_LIMIT_EVICTION_PERCENT);

    // First pass: evict expired entries
    let evicted = 0;
    for (const [k, v] of rateLimitStore.entries()) {
      if (v.resetAt < now) {
        rateLimitStore.delete(k);
        evicted++;
        if (evicted >= toEvict) break;
      }
    }

    // Second pass: if still need more, evict oldest (first in Map)
    if (rateLimitStore.size >= RATE_LIMIT_MAX_ENTRIES) {
      for (const k of rateLimitStore.keys()) {
        rateLimitStore.delete(k);
        if (rateLimitStore.size < RATE_LIMIT_MAX_ENTRIES) break;
      }
    }
  }

  rateLimitStore.set(key, entry);
}

// Cleanup expired entries periodically
// Store interval reference for cleanup (e.g., in tests or graceful shutdown)
let cleanupInterval: ReturnType<typeof setInterval> | null = null;

function startCleanupInterval(): void {
  if (cleanupInterval) return; // Already running
  cleanupInterval = setInterval(() => {
    const now = Date.now();
    for (const [key, entry] of rateLimitStore.entries()) {
      if (entry.resetAt < now) {
        rateLimitStore.delete(key);
      }
    }
  }, RATE_LIMIT_CLEANUP_INTERVAL_MS);
}

/**
 * Stop the cleanup interval (for tests or graceful shutdown)
 */
export function stopCleanupInterval(): void {
  if (cleanupInterval) {
    clearInterval(cleanupInterval);
    cleanupInterval = null;
  }
}

// Start cleanup on module load
startCleanupInterval();

/**
 * Extract client IP from request.
 * Note: x-forwarded-for can be spoofed if not behind a trusted proxy.
 * For Docker/self-hosted behind nginx/traefik, this is typically safe.
 */
function getClientIp(req: NextRequest): string {
  // In production behind a reverse proxy, x-forwarded-for is set by the proxy
  const forwarded = req.headers.get('x-forwarded-for');
  if (forwarded) {
    // Take the first IP (client IP, set by outermost proxy)
    return forwarded.split(',')[0]?.trim() ?? 'unknown';
  }
  return req.headers.get('x-real-ip')?.trim() ?? 'unknown';
}

/**
 * Combined HOF: Concurrent limiting + basic abuse protection
 */
export interface ThrottleConfig extends ConcurrentLimitConfig {
  /** Max requests per minute per IP for abuse protection (default: 200) */
  abuseLimit?: number;
}

export function withThrottle<T extends RouteHandler>(
  handler: T,
  config: ThrottleConfig
): T {
  const abuseLimit = config.abuseLimit ?? RATE_LIMIT_DEFAULT_ABUSE_LIMIT;
  const windowMs = RATE_LIMIT_WINDOW_MS;

  // First wrap with concurrent limiting
  const concurrentLimited = withConcurrentLimit(handler, config);

  const wrapped = async (req: NextRequest, context?: DynamicRouteContext): Promise<Response> => {
    // Check abuse limit (per IP)
    const ip = getClientIp(req);
    const key = `abuse:${config.name}:${ip}`;
    const now = Date.now();
    const entry = rateLimitStore.get(key);

    if (entry && entry.resetAt > now && entry.count >= abuseLimit) {
      logger.warn({ ip, endpoint: config.name, count: entry.count }, 'Abuse limit reached');
      return NextResponse.json(
        { error: 'Too many requests. Please slow down.' },
        {
          status: 429,
          headers: {
            'Retry-After': String(Math.ceil((entry.resetAt - now) / 1000)),
          },
        }
      );
    }

    // Update abuse counter (with bounded store)
    if (!entry || entry.resetAt <= now) {
      setRateLimitEntry(key, { count: 1, resetAt: now + windowMs });
    } else {
      entry.count++;
    }

    // Proceed with concurrent limiting
    return concurrentLimited(req, context);
  };

  return wrapped as T;
}

/**
 * Preset configurations
 */
export const ThrottlePresets = {
  /** Standard API endpoint */
  standard: { maxConcurrent: 20, abuseLimit: 200 },
  /** Expensive/slow endpoint (like calculations) */
  expensive: { maxConcurrent: 10, abuseLimit: 100 },
  /** Light/cached endpoint */
  light: { maxConcurrent: 50, abuseLimit: 300 },
} as const;
