/**
 * Centralized constants for the OFZ calculator
 */

// Time constants
export const MS_PER_DAY = 24 * 60 * 60 * 1000;
export const MS_PER_YEAR = 365 * MS_PER_DAY;
export const DAYS_PER_YEAR = 365;

// Bond calculation constants
export const DEFAULT_COUPON_PERIOD_DAYS = 182; // Semi-annual coupon
export const DEFAULT_PERIODS_PER_YEAR = 2;
export const DEFAULT_NOMINAL = 1000;

// Price thresholds
export const PAR_THRESHOLD = 0.995; // 99.5% of nominal considered "at par"

// Key rate estimation
export const DEFAULT_SPREAD = -1.5; // Base spread between key rate and OFZ YTM
export const MAX_MATURITY_SPREAD = 1.5; // Maximum additional spread for long-term bonds
export const MATURITY_SPREAD_FACTOR = 0.1; // Spread increase per year to maturity

// XIRR calculation
export const XIRR_MAX_ITERATIONS = 100;
export const XIRR_TOLERANCE = 1e-7;
export const XIRR_MIN_RATE = -0.99;
export const XIRR_MAX_RATE = 10;
export const XIRR_DEFAULT_GUESS = 0.1;

// Validation tolerances
export const VALIDATION_TOLERANCE = 0.01; // 1% tolerance for validation checks

// Cache durations (in seconds)
export const CACHE_BONDS_LIST = 3600; // 1 hour
export const CACHE_BOND_DETAILS = 300; // 5 minutes
export const CACHE_KEY_RATE = 86400; // 24 hours

// Valuation assessment thresholds
// Based on spread (keyRate - YTM) and real yield (YTM - inflation)
//
// Overbought: bond is expensive, low future return potential
//   - YTM significantly below key rate (market priced in rate cuts)
//   - Low real yield (YTM barely beats inflation)
//
// Oversold: bond is cheap, good buying opportunity
//   - YTM above key rate (discount to fair value)
//   - High real yield
//
export const VALUATION_SPREAD_OVERBOUGHT = 1.5; // spread > 1.5% = YTM much below key rate
export const VALUATION_SPREAD_OVERSOLD = -0.5; // spread < -0.5% = YTM above key rate
export const VALUATION_REAL_YIELD_LOW = 3; // real yield < 3% = poor inflation-adjusted return
export const VALUATION_REAL_YIELD_HIGH = 8; // real yield > 8% = excellent real return
// ZCYC spread thresholds (YTM - theoreticalYield from curve)
export const VALUATION_ZCYC_OVERBOUGHT = -0.3; // YTM 0.3% below curve = expensive
export const VALUATION_ZCYC_OVERSOLD = 0.3; // YTM 0.3% above curve = cheap

// Duration category thresholds (years to maturity)
export const DURATION_SHORT_MAX = 3; // Short-term: < 3 years
export const DURATION_MEDIUM_MAX = 7; // Medium-term: 3-7 years, Long-term: > 7 years

// Input validation patterns (security)
export const VALID_SCENARIO_ID_PATTERN = /^[a-zA-Z0-9_-]+$/;
export const VALID_TICKER_PATTERN = /^[A-Z0-9-]{2,20}$/;

// Rate limiting constants
export const RATE_LIMIT_DEFAULT_MAX_CONCURRENT = 20;
export const RATE_LIMIT_DEFAULT_MAX_GLOBAL_CONCURRENT = 100;
export const RATE_LIMIT_MAX_ENTRIES = 10000;
export const RATE_LIMIT_EVICTION_PERCENT = 0.1;
export const RATE_LIMIT_CLEANUP_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes
export const RATE_LIMIT_DEFAULT_ABUSE_LIMIT = 200;
export const RATE_LIMIT_WINDOW_MS = 60 * 1000; // 1 minute

// Resilience constants
export const RESILIENCE_DEFAULT_TIMEOUT_MS = 10000;
export const RESILIENCE_DEFAULT_FAILURE_THRESHOLD = 3;
export const RESILIENCE_DEFAULT_RESET_TIMEOUT_MS = 60 * 1000; // 1 minute
export const RESILIENCE_DEFAULT_MAX_RETRIES = 3;
export const RESILIENCE_DEFAULT_INITIAL_DELAY_MS = 1000;
export const RESILIENCE_DEFAULT_MAX_DELAY_MS = 10000;
export const RESILIENCE_DEFAULT_BACKOFF_MULTIPLIER = 2;
export const MOEX_TIMEOUT_MS = 15000;
export const CBR_TIMEOUT_MS = 20000;
export const CBR_RESET_TIMEOUT_MS = 2 * 60 * 1000; // 2 minutes

// Precalculate cache constants
export const CALCULATIONS_MAX_AGE_MS = 60 * 60 * 1000; // 1 hour
export const MAX_MEMORY_CACHE_ENTRIES = 10;
export const CONFIG_CHECK_INTERVAL_MS = 60 * 1000; // 1 minute

// ZCYC cache constants
export const ZCYC_CACHE_MAX_AGE_MS = 24 * 3600 * 1000; // 24 hours
