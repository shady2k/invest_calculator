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
export const DEFAULT_KEY_RATE = 21; // Fallback key rate if API fails
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
