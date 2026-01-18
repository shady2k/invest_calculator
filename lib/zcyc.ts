/**
 * Zero-Coupon Yield Curve (ZCYC) / Кривая бескупонной доходности (КБД)
 * Data from MOEX ISS API
 */

import { externalApiSemaphore } from './semaphore';
import { getWithCache } from './file-cache';
import logger from './logger';
// Re-export pure math functions from zcyc-math (no fs dependencies)
export { interpolateYield, analyzeYieldCurve, type YieldCurvePoint } from './zcyc-math';
import type { YieldCurvePoint } from './zcyc-math';

const MOEX_ZCYC_URL = 'https://iss.moex.com/iss/engines/stock/zcyc.json?iss.meta=off';
const ZCYC_CACHE_FILE = 'zcyc-cache.json';
const ZCYC_CACHE_MAX_AGE = 3600 * 1000; // 1 hour

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

    const rawPeriod = row[periodIdx];
    const rawYield = row[valueIdx];

    // Skip null/empty values (Number(null) = 0, not NaN)
    if (rawPeriod === null || rawPeriod === undefined || rawPeriod === '') continue;
    if (rawYield === null || rawYield === undefined || rawYield === '') continue;

    const period = Number(rawPeriod);
    const yieldValue = Number(rawYield);

    // Use Number.isFinite for stricter validation (rejects NaN and Infinity)
    if (Number.isFinite(period) && Number.isFinite(yieldValue) && period > 0) {
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

