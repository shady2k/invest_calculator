/**
 * Zero-Coupon Yield Curve (ZCYC) / Кривая бескупонной доходности (КБД)
 * Data from MOEX ISS API
 */

import { externalApiSemaphore } from './semaphore';
import { getWithCache } from './file-cache';
import logger from './logger';

const MOEX_ZCYC_URL = 'https://iss.moex.com/iss/engines/stock/zcyc.json?iss.meta=off';
const ZCYC_CACHE_FILE = 'zcyc-cache.json';
const ZCYC_CACHE_MAX_AGE = 3600 * 1000; // 1 hour

/** Yield curve point */
export interface YieldCurvePoint {
  /** Period in years */
  period: number;
  /** Yield in percent */
  yield: number;
}

/** Full yield curve data */
export interface YieldCurveData {
  /** Trade date */
  tradeDate: string;
  /** Yield curve points */
  points: YieldCurvePoint[];
}

interface MoexZcycResponse {
  yearyields: {
    columns: string[];
    data: (string | number)[][];
  };
}

/**
 * Fetch yield curve from MOEX API
 */
async function fetchYieldCurveFromApi(): Promise<YieldCurveData> {
  const response = await externalApiSemaphore.run(() =>
    fetch(MOEX_ZCYC_URL, { cache: 'no-store' })
  );

  if (!response.ok) {
    throw new Error(`MOEX ZCYC API error: ${response.status}`);
  }

  const data: MoexZcycResponse = await response.json();

  if (!data.yearyields?.data || data.yearyields.data.length === 0) {
    throw new Error('No yield curve data from MOEX');
  }

  const columns = data.yearyields.columns;
  const tradeDateIdx = columns.indexOf('tradedate');
  const periodIdx = columns.indexOf('period');
  const valueIdx = columns.indexOf('value');

  if (periodIdx === -1 || valueIdx === -1) {
    throw new Error('Invalid ZCYC response structure');
  }

  const points: YieldCurvePoint[] = [];
  let tradeDate = '';

  for (const row of data.yearyields.data) {
    if (!tradeDate && tradeDateIdx !== -1) {
      tradeDate = String(row[tradeDateIdx]);
    }

    const period = Number(row[periodIdx]);
    const yieldValue = Number(row[valueIdx]);

    if (!isNaN(period) && !isNaN(yieldValue)) {
      points.push({ period, yield: yieldValue });
    }
  }

  // Sort by period
  points.sort((a, b) => a.period - b.period);

  logger.info({ tradeDate, pointsCount: points.length }, 'Fetched yield curve from MOEX');

  return { tradeDate, points };
}

/**
 * Fetch yield curve with caching
 */
export async function fetchYieldCurve(): Promise<YieldCurveData> {
  return getWithCache<YieldCurveData>(
    ZCYC_CACHE_FILE,
    fetchYieldCurveFromApi,
    ZCYC_CACHE_MAX_AGE
  );
}

/**
 * Interpolate yield for a given maturity using linear interpolation
 */
export function interpolateYield(
  curve: YieldCurvePoint[],
  yearsToMaturity: number
): number {
  if (curve.length === 0) {
    throw new Error('Empty yield curve');
  }

  // If before first point, use first
  const first = curve[0];
  if (!first || yearsToMaturity <= first.period) {
    return first?.yield ?? 0;
  }

  // If after last point, use last
  const last = curve[curve.length - 1];
  if (!last || yearsToMaturity >= last.period) {
    return last?.yield ?? 0;
  }

  // Find surrounding points and interpolate
  for (let i = 0; i < curve.length - 1; i++) {
    const p1 = curve[i];
    const p2 = curve[i + 1];

    if (!p1 || !p2) continue;

    if (yearsToMaturity >= p1.period && yearsToMaturity <= p2.period) {
      // Linear interpolation
      const t = (yearsToMaturity - p1.period) / (p2.period - p1.period);
      return p1.yield + t * (p2.yield - p1.yield);
    }
  }

  // Fallback to last point
  return last?.yield ?? 0;
}

/**
 * Analyze yield curve shape
 * Returns info about curve inversion
 */
export function analyzeYieldCurve(curve: YieldCurvePoint[]): {
  /** Is curve inverted (short > long) */
  isInverted: boolean;
  /** Is long end inverted (5y > 15y) */
  isLongEndInverted: boolean;
  /** Short-term yield (1y) */
  shortYield: number;
  /** Medium-term yield (5y) */
  mediumYield: number;
  /** Long-term yield (15y) */
  longYield: number;
  /** Spread between short and long */
  spreadShortLong: number;
} {
  const shortYield = interpolateYield(curve, 1);
  const mediumYield = interpolateYield(curve, 5);
  const longYield = interpolateYield(curve, 15);

  const spreadShortLong = longYield - shortYield;
  const isInverted = spreadShortLong < 0;
  const isLongEndInverted = longYield < mediumYield;

  return {
    isInverted,
    isLongEndInverted,
    shortYield,
    mediumYield,
    longYield,
    spreadShortLong,
  };
}
