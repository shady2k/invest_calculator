/**
 * Resilience patterns for external API calls:
 * - Circuit Breaker: Stop calling failing services
 * - Retry with Exponential Backoff: Retry transient failures
 * - Request Timeout: Prevent hung requests
 */

import logger from './logger';
import {
  RESILIENCE_DEFAULT_TIMEOUT_MS,
  RESILIENCE_DEFAULT_FAILURE_THRESHOLD,
  RESILIENCE_DEFAULT_RESET_TIMEOUT_MS,
  RESILIENCE_DEFAULT_MAX_RETRIES,
  RESILIENCE_DEFAULT_INITIAL_DELAY_MS,
  RESILIENCE_DEFAULT_MAX_DELAY_MS,
  RESILIENCE_DEFAULT_BACKOFF_MULTIPLIER,
  MOEX_TIMEOUT_MS,
  CBR_TIMEOUT_MS,
  CBR_RESET_TIMEOUT_MS,
} from './constants';

/**
 * Circuit Breaker States
 */
enum CircuitState {
  CLOSED = 'CLOSED', // Normal operation, requests pass through
  OPEN = 'OPEN', // Failing, reject all requests immediately
  HALF_OPEN = 'HALF_OPEN', // Testing if service recovered
}

interface CircuitBreakerConfig {
  /** Name for logging */
  name: string;
  /** Number of failures before opening circuit */
  failureThreshold: number;
  /** Time in ms before attempting recovery (half-open) */
  resetTimeoutMs: number;
}

interface CircuitBreakerState {
  state: CircuitState;
  failures: number;
  lastFailureTime: number;
  /** Gate to allow only one probe in half-open state */
  halfOpenProbeInFlight: boolean;
}

const circuitStates = new Map<string, CircuitBreakerState>();

function getCircuitState(name: string): CircuitBreakerState {
  let state = circuitStates.get(name);
  if (!state) {
    state = {
      state: CircuitState.CLOSED,
      failures: 0,
      lastFailureTime: 0,
      halfOpenProbeInFlight: false,
    };
    circuitStates.set(name, state);
  }
  return state;
}

/**
 * Circuit Breaker implementation
 */
export class CircuitBreaker {
  private config: CircuitBreakerConfig;

  constructor(config: Partial<CircuitBreakerConfig> & { name: string }) {
    this.config = {
      failureThreshold: RESILIENCE_DEFAULT_FAILURE_THRESHOLD,
      resetTimeoutMs: RESILIENCE_DEFAULT_RESET_TIMEOUT_MS,
      ...config,
    };
  }

  /**
   * Check if request should be allowed
   */
  canExecute(): boolean {
    const state = getCircuitState(this.config.name);
    const now = Date.now();

    switch (state.state) {
      case CircuitState.CLOSED:
        return true;

      case CircuitState.OPEN:
        // Check if reset timeout has passed
        if (now - state.lastFailureTime >= this.config.resetTimeoutMs) {
          state.state = CircuitState.HALF_OPEN;
          state.halfOpenProbeInFlight = false;
          logger.info({ circuit: this.config.name }, 'Circuit breaker half-open, ready to test');
          // Don't return true yet - fall through to half-open handling
          return this.tryHalfOpenProbe(state);
        }
        return false;

      case CircuitState.HALF_OPEN:
        return this.tryHalfOpenProbe(state);

      default:
        return true;
    }
  }

  /**
   * Try to acquire the single probe slot in half-open state
   */
  private tryHalfOpenProbe(state: CircuitBreakerState): boolean {
    if (state.halfOpenProbeInFlight) {
      // Another probe is already in flight, reject this request
      logger.debug({ circuit: this.config.name }, 'Half-open probe already in flight, rejecting');
      return false;
    }
    state.halfOpenProbeInFlight = true;
    logger.info({ circuit: this.config.name }, 'Half-open probe started');
    return true;
  }

  /**
   * Record a successful call
   */
  recordSuccess(): void {
    const state = getCircuitState(this.config.name);

    if (state.state === CircuitState.HALF_OPEN) {
      // Probe succeeded, close the circuit
      state.state = CircuitState.CLOSED;
      state.failures = 0;
      state.halfOpenProbeInFlight = false;
      logger.info({ circuit: this.config.name }, 'Circuit breaker closed (recovered)');
    } else if (state.state === CircuitState.CLOSED) {
      // Reset failure count on success
      state.failures = 0;
    }
  }

  /**
   * Record a failed call
   */
  recordFailure(error: unknown): void {
    const state = getCircuitState(this.config.name);
    state.failures++;
    state.lastFailureTime = Date.now();

    if (state.state === CircuitState.HALF_OPEN) {
      // Probe failed, go back to open
      state.state = CircuitState.OPEN;
      state.halfOpenProbeInFlight = false;
      logger.warn({ circuit: this.config.name, error }, 'Circuit breaker re-opened (probe failed)');
    } else if (state.failures >= this.config.failureThreshold) {
      state.state = CircuitState.OPEN;
      logger.warn(
        { circuit: this.config.name, failures: state.failures },
        'Circuit breaker opened (threshold reached)'
      );
    }
  }

  /**
   * Get current circuit state (for monitoring)
   */
  getState(): { state: CircuitState; failures: number } {
    const state = getCircuitState(this.config.name);
    return { state: state.state, failures: state.failures };
  }
}

/**
 * Retry configuration
 */
interface RetryConfig {
  /** Maximum number of retry attempts */
  maxRetries: number;
  /** Initial delay in ms */
  initialDelayMs: number;
  /** Maximum delay in ms */
  maxDelayMs: number;
  /** Multiplier for exponential backoff */
  backoffMultiplier: number;
}

const DEFAULT_RETRY_CONFIG: RetryConfig = {
  maxRetries: RESILIENCE_DEFAULT_MAX_RETRIES,
  initialDelayMs: RESILIENCE_DEFAULT_INITIAL_DELAY_MS,
  maxDelayMs: RESILIENCE_DEFAULT_MAX_DELAY_MS,
  backoffMultiplier: RESILIENCE_DEFAULT_BACKOFF_MULTIPLIER,
};

/**
 * Sleep for a given duration
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Check if an error is retryable (network errors, timeouts, 5xx, 429)
 */
function isRetryableError(error: unknown): boolean {
  if (error instanceof Error) {
    const message = error.message.toLowerCase();
    // Network errors, timeouts, abort errors
    if (
      message.includes('network') ||
      message.includes('timeout') ||
      message.includes('abort') ||
      message.includes('econnrefused') ||
      message.includes('econnreset')
    ) {
      return true;
    }
    // HTTP 5xx and 429 errors (we encode status in error message)
    if (message.includes('status 5') || message.includes('status 429')) {
      return true;
    }
  }
  // Unknown error types - don't retry by default
  return false;
}

/**
 * Retry a function with exponential backoff
 */
async function withRetry<T>(
  fn: () => Promise<T>,
  name: string,
  config: Partial<RetryConfig> = {}
): Promise<T> {
  const { maxRetries, initialDelayMs, maxDelayMs, backoffMultiplier } = {
    ...DEFAULT_RETRY_CONFIG,
    ...config,
  };

  let lastError: unknown;
  let delay = initialDelayMs;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;

      // Don't retry non-retryable errors
      if (!isRetryableError(error)) {
        throw error;
      }

      if (attempt < maxRetries) {
        logger.warn(
          { name, attempt: attempt + 1, maxRetries, delayMs: delay, error },
          'Retrying after failure'
        );
        await sleep(delay);
        delay = Math.min(delay * backoffMultiplier, maxDelayMs);
      }
    }
  }

  logger.error({ name, maxRetries, error: lastError }, 'All retry attempts failed');
  throw lastError;
}

/**
 * Fetch with timeout using AbortSignal
 */
export async function fetchWithTimeout(
  url: string,
  options: RequestInit = {},
  timeoutMs: number = RESILIENCE_DEFAULT_TIMEOUT_MS
): Promise<Response> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
    });
    return response;
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      throw new Error(`Request timeout after ${timeoutMs}ms: ${url}`);
    }
    throw error;
  } finally {
    clearTimeout(timeoutId);
  }
}

/**
 * Resilient fetch configuration
 */
export interface ResilientFetchConfig {
  /** Request timeout in ms */
  timeoutMs?: number;
  /** Circuit breaker config */
  circuit?: Partial<CircuitBreakerConfig>;
  /** Retry config */
  retry?: Partial<RetryConfig>;
}

/**
 * Create a resilient fetch function that:
 * 1. Adds timeout to prevent hung requests
 * 2. Checks response status and throws on errors
 * 3. Retries on transient failures
 * 4. Trips circuit breaker on repeated failures
 *
 * IMPORTANT: This wraps the entire operation (fetch + status check)
 * so that HTTP errors (4xx/5xx) properly trigger retries and circuit breaker.
 */
export function createResilientFetch(
  name: string,
  config: ResilientFetchConfig = {}
): (url: string, options?: RequestInit) => Promise<Response> {
  const circuitBreaker = new CircuitBreaker({ name, ...config.circuit });
  const timeoutMs = config.timeoutMs ?? RESILIENCE_DEFAULT_TIMEOUT_MS;

  return async (url: string, options?: RequestInit): Promise<Response> => {
    // Check circuit breaker
    if (!circuitBreaker.canExecute()) {
      const state = circuitBreaker.getState();
      logger.warn({ name, state, url }, 'Circuit breaker is open, failing fast');
      throw new Error(`Service ${name} is unavailable (circuit breaker open)`);
    }

    try {
      // Retry with backoff - wraps the ENTIRE operation including status check
      const response = await withRetry(
        async () => {
          const resp = await fetchWithTimeout(url, options, timeoutMs);

          // Throw on error status so retry/circuit breaker can handle it
          if (!resp.ok) {
            // 4xx errors (except 429) are not retryable
            if (resp.status >= 400 && resp.status < 500 && resp.status !== 429) {
              // Return the response for caller to handle (e.g., 404)
              return resp;
            }
            // 5xx and 429 are retryable
            throw new Error(`HTTP error status ${resp.status}: ${url}`);
          }

          return resp;
        },
        name,
        config.retry
      );

      circuitBreaker.recordSuccess();
      return response;
    } catch (error) {
      circuitBreaker.recordFailure(error);
      throw error;
    }
  };
}

/**
 * Pre-configured resilient fetchers for external APIs
 */
export const moexFetch = createResilientFetch('moex', {
  timeoutMs: MOEX_TIMEOUT_MS,
  circuit: {
    failureThreshold: RESILIENCE_DEFAULT_FAILURE_THRESHOLD,
    resetTimeoutMs: RESILIENCE_DEFAULT_RESET_TIMEOUT_MS,
  },
});

export const cbrFetch = createResilientFetch('cbr', {
  timeoutMs: CBR_TIMEOUT_MS,
  circuit: {
    failureThreshold: RESILIENCE_DEFAULT_FAILURE_THRESHOLD,
    resetTimeoutMs: CBR_RESET_TIMEOUT_MS,
  },
});

/**
 * Get circuit breaker status for all services (monitoring)
 */
export function getCircuitBreakerStatus(): Record<string, { state: string; failures: number }> {
  const status: Record<string, { state: string; failures: number }> = {};
  for (const [name, state] of circuitStates.entries()) {
    status[name] = { state: state.state, failures: state.failures };
  }
  return status;
}
