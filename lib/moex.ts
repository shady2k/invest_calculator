import type { ParsedBond } from '@/types';
import {
  CACHE_BONDS_LIST,
  DEFAULT_NOMINAL,
  VALID_TICKER_PATTERN,
  DAYS_PER_YEAR,
} from './constants';
import { getWithCache } from './file-cache';
import { externalApiSemaphore } from './semaphore';
import { moexFetch } from './resilience';

const MOEX_BASE_URL = 'https://iss.moex.com/iss';
const OFZ_BOARD = 'TQOB';
const PERCENT_DIVISOR = 100;

/**
 * Get test bond filter from env (for development/testing)
 * Format: comma-separated tickers, e.g. "SU26238RMFS4,SU26248RMFS3"
 */
function getTestBondFilter(): Set<string> | null {
  const filter = process.env.TEST_BOND_FILTER;
  if (!filter || filter.trim() === '') {
    return null;
  }
  return new Set(filter.split(',').map((t) => t.trim()));
}

// File cache settings
const BONDS_CACHE_FILE = 'bonds-cache.json';
const BONDS_CACHE_MAX_AGE = CACHE_BONDS_LIST * 1000; // Convert seconds to ms

interface MoexSecuritiesResponse {
  securities: {
    columns: string[];
    data: (string | number | null)[][];
  };
  marketdata: {
    columns: string[];
    data: (string | number | null)[][];
  };
}

interface MoexHistoryResponse {
  history: {
    columns: string[];
    data: (string | number | null)[][];
  };
}

interface MoexColumnIndex {
  [key: string]: number;
}

function createColumnIndex(columns: string[]): MoexColumnIndex {
  const index: MoexColumnIndex = {};
  columns.forEach((col, i) => {
    index[col] = i;
  });
  return index;
}

function getValue<T>(
  row: (string | number | null)[],
  index: MoexColumnIndex,
  column: string
): T | null {
  const idx = index[column];
  if (idx === undefined) return null;
  const value = row[idx];
  if (value === null || value === undefined) return null;
  return value as T;
}

/**
 * Fetch historical volume data for all bonds (latest trading day)
 */
async function fetchHistoricalVolume(): Promise<Map<string, number>> {
  const url = `${MOEX_BASE_URL}/history/engines/stock/markets/bonds/boards/${OFZ_BOARD}/securities.json?iss.meta=off&limit=500`;

  // Semaphore limits concurrency, moexFetch adds timeout + retry + circuit breaker
  const response = await externalApiSemaphore.run(() =>
    moexFetch(url, { cache: 'no-store' })
  );

  if (!response.ok) {
    return new Map();
  }

  const data: MoexHistoryResponse = await response.json();
  const histIndex = createColumnIndex(data.history.columns);
  const volumeMap = new Map<string, number>();

  for (const row of data.history.data) {
    const secid = getValue<string>(row, histIndex, 'SECID');
    const value = getValue<number>(row, histIndex, 'VALUE');
    if (secid && value !== null) {
      volumeMap.set(secid, value);
    }
  }

  return volumeMap;
}

/**
 * Fetch all OFZ bonds directly from MOEX API (no file cache)
 */
async function fetchAllBondsFromApi(): Promise<ParsedBond[]> {
  const securitiesUrl = `${MOEX_BASE_URL}/engines/stock/markets/bonds/boards/${OFZ_BOARD}/securities.json`;

  // Fetch securities and historical volume in parallel
  const [securitiesResponse, historicalVolume] = await Promise.all([
    externalApiSemaphore.run(() => moexFetch(securitiesUrl, { cache: 'no-store' })),
    fetchHistoricalVolume(),
  ]);

  if (!securitiesResponse.ok) {
    throw new Error(`MOEX API error: ${securitiesResponse.status}`);
  }

  const data: MoexSecuritiesResponse = await securitiesResponse.json();

  const secIndex = createColumnIndex(data.securities.columns);
  const marketIndex = createColumnIndex(data.marketdata.columns);

  // Create a map of market data by secid
  const marketDataMap = new Map<string, (string | number | null)[]>();
  for (const row of data.marketdata.data) {
    const secid = getValue<string>(row, marketIndex, 'SECID');
    if (secid) {
      marketDataMap.set(secid, row);
    }
  }

  const bonds: ParsedBond[] = [];
  const testFilter = getTestBondFilter();

  for (const secRow of data.securities.data) {
    const ticker = getValue<string>(secRow, secIndex, 'SECID');
    if (!ticker) continue;

    // Filter only OFZ (government bonds)
    if (!ticker.startsWith('SU') && !ticker.startsWith('OFZ')) continue;

    // Skip floaters (ОФЗ-ПК, series 29xxx) - our model only supports fixed coupons
    if (ticker.startsWith('SU29')) continue;

    // Test mode: filter to specific tickers
    if (testFilter && !testFilter.has(ticker)) continue;

    const shortname = getValue<string>(secRow, secIndex, 'SHORTNAME');
    const facevalue = getValue<number>(secRow, secIndex, 'FACEVALUE') ?? DEFAULT_NOMINAL;
    const couponvalue = getValue<number>(secRow, secIndex, 'COUPONVALUE');
    const couponperiod = getValue<number>(secRow, secIndex, 'COUPONPERIOD');
    const matdate = getValue<string>(secRow, secIndex, 'MATDATE');
    const accruedint = getValue<number>(secRow, secIndex, 'ACCRUEDINT');

    const marketRow = marketDataMap.get(ticker);
    let price: number | null = null;
    let ytm: number | null = null;
    let volume: number | null = null;
    let duration: number | null = null;

    // Get price (percent of nominal) - try LAST, then PREVPRICE, then MARKETPRICE
    let pricePercent: number | null = null;

    if (marketRow) {
      pricePercent = getValue<number>(marketRow, marketIndex, 'LAST');
      ytm = getValue<number>(marketRow, marketIndex, 'YIELD');
      // Duration from MOEX is in days, convert to years
      const durationDays = getValue<number>(marketRow, marketIndex, 'DURATION');
      duration = durationDays !== null && durationDays > 0
        ? durationDays / DAYS_PER_YEAR
        : null;
      // Use realtime volume if available, otherwise fall back to historical
      const realtimeVolume = getValue<number>(marketRow, marketIndex, 'VALTODAY');
      volume = (realtimeVolume && realtimeVolume > 0)
        ? realtimeVolume
        : (historicalVolume.get(ticker) ?? null);
    } else {
      // No market data, try historical volume
      volume = historicalVolume.get(ticker) ?? null;
    }

    // PREVPRICE is in securities data
    if (pricePercent === null) {
      pricePercent = getValue<number>(secRow, secIndex, 'PREVPRICE');
    }

    if (pricePercent === null && marketRow) {
      pricePercent = getValue<number>(marketRow, marketIndex, 'MARKETPRICE');
    }

    if (pricePercent !== null) {
      price = (pricePercent / PERCENT_DIVISOR) * facevalue;
    }

    bonds.push({
      ticker,
      name: shortname ?? ticker,
      price,
      coupon: couponvalue,
      couponPeriod: couponperiod,
      maturityDate: matdate,
      nominal: facevalue,
      accruedInterest: accruedint,
      ytm,
      volume,
      duration,
    });
  }

  // Sort by maturity date
  bonds.sort((a, b) => {
    if (!a.maturityDate) return 1;
    if (!b.maturityDate) return -1;
    return a.maturityDate.localeCompare(b.maturityDate);
  });

  return bonds;
}

/**
 * Fetch all OFZ bonds with file cache fallback
 * - Uses cached data if fresh
 * - Fetches new data if stale, keeps old cache on error
 */
export async function fetchAllBonds(): Promise<ParsedBond[]> {
  return getWithCache<ParsedBond[]>(
    BONDS_CACHE_FILE,
    fetchAllBondsFromApi,
    BONDS_CACHE_MAX_AGE
  );
}

/**
 * Fetch single bond data by ticker
 */
export async function fetchBondByTicker(ticker: string): Promise<ParsedBond | null> {
  // Validate ticker to prevent URL injection
  if (!VALID_TICKER_PATTERN.test(ticker)) {
    return null;
  }

  const url = `${MOEX_BASE_URL}/engines/stock/markets/bonds/boards/${OFZ_BOARD}/securities/${ticker}.json`;

  // Semaphore limits concurrency, moexFetch adds timeout + retry + circuit breaker
  const response = await externalApiSemaphore.run(() =>
    moexFetch(url, { cache: 'no-store' })
  );

  if (!response.ok) {
    if (response.status === 404) {
      return null;
    }
    throw new Error(`MOEX API error: ${response.status}`);
  }

  const data: MoexSecuritiesResponse = await response.json();

  if (data.securities.data.length === 0) {
    return null;
  }

  const secRow = data.securities.data[0];
  if (!secRow) return null;

  const secIndex = createColumnIndex(data.securities.columns);
  const marketIndex = createColumnIndex(data.marketdata.columns);

  const shortname = getValue<string>(secRow, secIndex, 'SHORTNAME');
  const facevalue = getValue<number>(secRow, secIndex, 'FACEVALUE') ?? DEFAULT_NOMINAL;
  const couponvalue = getValue<number>(secRow, secIndex, 'COUPONVALUE');
  const couponperiod = getValue<number>(secRow, secIndex, 'COUPONPERIOD');
  const matdate = getValue<string>(secRow, secIndex, 'MATDATE');
  const accruedint = getValue<number>(secRow, secIndex, 'ACCRUEDINT');

  let price: number | null = null;
  let ytm: number | null = null;
  let volume: number | null = null;
  let duration: number | null = null;

  // Get price (percent of nominal) - try LAST, then PREVPRICE, then MARKETPRICE
  let pricePercent: number | null = null;

  const marketRow = data.marketdata.data[0];
  if (marketRow) {
    pricePercent = getValue<number>(marketRow, marketIndex, 'LAST');
    ytm = getValue<number>(marketRow, marketIndex, 'YIELD');
    volume = getValue<number>(marketRow, marketIndex, 'VALTODAY');
    // Duration from MOEX is in days, convert to years
    const durationDays = getValue<number>(marketRow, marketIndex, 'DURATION');
    duration = durationDays !== null && durationDays > 0
      ? durationDays / DAYS_PER_YEAR
      : null;
  }

  // PREVPRICE is in securities data
  if (pricePercent === null) {
    pricePercent = getValue<number>(secRow, secIndex, 'PREVPRICE');
  }

  if (pricePercent === null && marketRow) {
    pricePercent = getValue<number>(marketRow, marketIndex, 'MARKETPRICE');
  }

  if (pricePercent !== null) {
    price = (pricePercent / PERCENT_DIVISOR) * facevalue;
  }

  return {
    ticker,
    name: shortname ?? ticker,
    price,
    coupon: couponvalue,
    couponPeriod: couponperiod,
    maturityDate: matdate,
    nominal: facevalue,
    accruedInterest: accruedint,
    ytm,
    volume,
    duration,
  };
}
