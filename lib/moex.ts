import type { ParsedBond } from '@/types';
import { CACHE_BONDS_LIST, CACHE_BOND_DETAILS, DEFAULT_NOMINAL } from './constants';
import { getWithCache } from './file-cache';

const MOEX_BASE_URL = 'https://iss.moex.com/iss';
const OFZ_BOARD = 'TQOB';
const PERCENT_DIVISOR = 100;

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
 * Fetch all OFZ bonds directly from MOEX API (no file cache)
 */
async function fetchAllBondsFromApi(): Promise<ParsedBond[]> {
  const url = `${MOEX_BASE_URL}/engines/stock/markets/bonds/boards/${OFZ_BOARD}/securities.json`;

  const response = await fetch(url, {
    cache: 'no-store', // Bypass Next.js cache when using file cache
  });

  if (!response.ok) {
    throw new Error(`MOEX API error: ${response.status}`);
  }

  const data: MoexSecuritiesResponse = await response.json();

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

  for (const secRow of data.securities.data) {
    const ticker = getValue<string>(secRow, secIndex, 'SECID');
    if (!ticker) continue;

    // Filter only OFZ (government bonds)
    if (!ticker.startsWith('SU') && !ticker.startsWith('OFZ')) continue;

    // Skip floaters (ОФЗ-ПК, series 29xxx) - our model only supports fixed coupons
    if (ticker.startsWith('SU29')) continue;

    const shortname = getValue<string>(secRow, secIndex, 'SHORTNAME');
    const facevalue = getValue<number>(secRow, secIndex, 'FACEVALUE') ?? DEFAULT_NOMINAL;
    const couponvalue = getValue<number>(secRow, secIndex, 'COUPONVALUE');
    const couponperiod = getValue<number>(secRow, secIndex, 'COUPONPERIOD');
    const matdate = getValue<string>(secRow, secIndex, 'MATDATE');
    const accruedint = getValue<number>(secRow, secIndex, 'ACCRUEDINT');

    const marketRow = marketDataMap.get(ticker);
    let price: number | null = null;
    let ytm: number | null = null;

    if (marketRow) {
      // Get price (percent of nominal) - try LAST, then PREVPRICE, then WAPRICE
      let pricePercent = getValue<number>(marketRow, marketIndex, 'LAST');
      if (pricePercent === null) {
        pricePercent = getValue<number>(marketRow, marketIndex, 'PREVPRICE');
      }
      if (pricePercent === null) {
        pricePercent = getValue<number>(marketRow, marketIndex, 'WAPRICE');
      }
      if (pricePercent !== null) {
        price = (pricePercent / PERCENT_DIVISOR) * facevalue;
      }
      ytm = getValue<number>(marketRow, marketIndex, 'YIELD');
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
  const url = `${MOEX_BASE_URL}/engines/stock/markets/bonds/boards/${OFZ_BOARD}/securities/${ticker}.json`;

  const response = await fetch(url, {
    next: { revalidate: CACHE_BOND_DETAILS },
  });

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

  const marketRow = data.marketdata.data[0];
  if (marketRow) {
    // Get price (percent of nominal) - try LAST, then PREVPRICE, then WAPRICE
    let pricePercent = getValue<number>(marketRow, marketIndex, 'LAST');
    if (pricePercent === null) {
      pricePercent = getValue<number>(marketRow, marketIndex, 'PREVPRICE');
    }
    if (pricePercent === null) {
      pricePercent = getValue<number>(marketRow, marketIndex, 'WAPRICE');
    }
    if (pricePercent !== null) {
      price = (pricePercent / PERCENT_DIVISOR) * facevalue;
    }
    ytm = getValue<number>(marketRow, marketIndex, 'YIELD');
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
  };
}
