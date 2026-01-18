import { promises as fs } from 'fs';
import path from 'path';
import type {
  ParsedBond,
  KeyRateData,
  RateScenario,
  RateScheduleItem,
  CalculationResults,
  ScenariosResponse,
} from '@/types';
import { fetchAllBonds } from './moex';
import { fetchKeyRateHistory, getCurrentKeyRate } from './cbr';
import { calculate } from './calculations';
import { DEFAULT_COUPON_PERIOD_DAYS } from './constants';
import logger from './logger';

const CALCULATIONS_DIR = path.join(process.cwd(), 'data', 'cache', 'calculations');
const SCENARIOS_FILE = path.join(process.cwd(), 'data', 'rate-scenarios.json');

// Cache for 1 hour
const CALCULATIONS_MAX_AGE_MS = 60 * 60 * 1000;

/** Summary data for bond list view */
export interface BondSummary {
  ticker: string;
  name: string;
  price: number | null;
  priceWithAci: number | null;
  coupon: number | null;
  couponPeriod: number | null;
  maturityDate: string | null;
  nominal: number;
  accruedInterest: number | null;
  moexYtm: number | null;
  // Calculated values
  realYield: number;
  optimalExitYield: number;
  optimalExitDate: string;
  parExitYield: number;
  parExitDate: string;
  yearsToMaturity: number;
}

/** Full calculation result for detail view */
export interface BondCalculation {
  summary: BondSummary;
  results: CalculationResults;
}

/** Cached calculations for a scenario */
export interface CalculationsCache {
  timestamp: number;
  scenario: string;
  currentKeyRate: number;
  bonds: BondCalculation[];
}

/**
 * Load scenarios from JSON file
 */
async function loadScenarios(): Promise<ScenariosResponse> {
  const content = await fs.readFile(SCENARIOS_FILE, 'utf-8');
  return JSON.parse(content) as ScenariosResponse;
}

/**
 * Build rate schedule from scenario and key rate history
 */
function buildRateSchedule(
  scenario: RateScenario,
  keyRateHistory: KeyRateData[],
  currentKeyRate: number
): RateScheduleItem[] {
  const schedule: RateScheduleItem[] = [];

  // Add historical rates (sorted by date ascending)
  const sortedHistory = [...keyRateHistory].sort((a, b) =>
    a.date.localeCompare(b.date)
  );

  for (const item of sortedHistory) {
    schedule.push({
      date: new Date(item.date),
      rate: item.rate,
    });
  }

  // Add scenario rates (future), using current key rate for first entry
  const today = new Date();
  for (let i = 0; i < scenario.rates.length; i++) {
    const item = scenario.rates[i];
    if (!item) continue;

    const date = new Date(item.date);
    if (date > today) {
      schedule.push({
        date,
        rate: i === 0 ? currentKeyRate : item.rate,
      });
    }
  }

  // Sort by date
  schedule.sort((a, b) => a.date.getTime() - b.date.getTime());

  return schedule;
}

/**
 * Calculate a single bond
 */
function calculateBond(
  bond: ParsedBond,
  rateSchedule: RateScheduleItem[],
  currentKeyRate: number
): BondCalculation | null {
  // Skip bonds without required data
  if (
    !bond.maturityDate ||
    bond.price === null ||
    bond.coupon === null
  ) {
    logger.debug({ ticker: bond.ticker }, 'Skipping bond: missing required data');
    return null;
  }

  const today = new Date();
  const maturityDate = new Date(bond.maturityDate);

  // Skip already matured bonds
  if (maturityDate <= today) {
    logger.debug({ ticker: bond.ticker }, 'Skipping bond: already matured');
    return null;
  }

  // Estimate first coupon date (next coupon period from today)
  const firstCouponDate = new Date(today);
  const periodDays = bond.couponPeriod ?? DEFAULT_COUPON_PERIOD_DAYS;
  firstCouponDate.setDate(firstCouponDate.getDate() + periodDays);

  // Use price + accrued interest
  const priceWithAci =
    bond.price + (bond.accruedInterest ?? 0);

  try {
    const results = calculate({
      bondId: bond.ticker,
      bondName: bond.name,
      nominal: bond.nominal,
      currentPrice: priceWithAci,
      coupon: bond.coupon,
      couponPeriodDays: periodDays,
      purchaseDate: today.toISOString().split('T')[0] ?? '',
      firstCouponDate: firstCouponDate.toISOString().split('T')[0] ?? '',
      maturityDate: bond.maturityDate,
      rateSchedule,
      currentKeyRate,
      moexYtm: bond.ytm,
    });

    const summary: BondSummary = {
      ticker: bond.ticker,
      name: bond.name,
      price: bond.price,
      priceWithAci,
      coupon: bond.coupon,
      couponPeriod: bond.couponPeriod,
      maturityDate: bond.maturityDate,
      nominal: bond.nominal,
      accruedInterest: bond.accruedInterest,
      moexYtm: bond.ytm,
      realYield: results.realYieldMaturity,
      optimalExitYield: results.optimalExit.annualReturn,
      optimalExitDate: results.optimalExit.date.toISOString().split('T')[0] ?? '',
      parExitYield: results.parExit.annualReturn,
      parExitDate: results.parExit.date.toISOString().split('T')[0] ?? '',
      yearsToMaturity: results.yearsToMaturity,
    };

    return { summary, results };
  } catch (error) {
    logger.error({ error, ticker: bond.ticker }, 'Failed to calculate bond');
    return null;
  }
}

/**
 * Calculate all bonds for a given scenario
 */
export async function calculateAllBonds(
  scenarioId: string
): Promise<CalculationsCache> {
  logger.info({ scenarioId }, 'Starting calculations for all bonds');

  // Load data in parallel
  const [bonds, keyRateHistory, currentKeyRateData, scenariosData] =
    await Promise.all([
      fetchAllBonds(),
      fetchKeyRateHistory(),
      getCurrentKeyRate(),
      loadScenarios(),
    ]);

  const currentKeyRate = currentKeyRateData?.rate ?? 21;
  const scenario = scenariosData.scenarios[scenarioId];

  if (!scenario) {
    throw new Error(`Unknown scenario: ${scenarioId}`);
  }

  // Build rate schedule
  const rateSchedule = buildRateSchedule(scenario, keyRateHistory, currentKeyRate);

  // Calculate all bonds
  const calculations: BondCalculation[] = [];
  let processed = 0;

  for (const bond of bonds) {
    const result = calculateBond(bond, rateSchedule, currentKeyRate);
    if (result) {
      calculations.push(result);
    }
    processed++;

    if (processed % 10 === 0) {
      logger.debug({ processed, total: bonds.length }, 'Calculation progress');
    }
  }

  // Sort by optimal exit yield (highest first)
  calculations.sort((a, b) => b.summary.optimalExitYield - a.summary.optimalExitYield);

  logger.info(
    { scenarioId, calculated: calculations.length, total: bonds.length },
    'Calculations complete'
  );

  return {
    timestamp: Date.now(),
    scenario: scenarioId,
    currentKeyRate,
    bonds: calculations,
  };
}

/**
 * Get cache file path for a scenario
 */
function getCacheFilePath(scenarioId: string): string {
  return path.join(CALCULATIONS_DIR, `${scenarioId}.json`);
}

/**
 * Read cached calculations
 */
async function readCalculationsCache(
  scenarioId: string
): Promise<CalculationsCache | null> {
  const filepath = getCacheFilePath(scenarioId);

  try {
    const content = await fs.readFile(filepath, 'utf-8');
    return JSON.parse(content, (key, value) => {
      // Restore Date objects in exitResults
      if (key === 'date' && typeof value === 'string' && value.match(/^\d{4}-\d{2}-\d{2}/)) {
        return new Date(value);
      }
      return value;
    }) as CalculationsCache;
  } catch {
    return null;
  }
}

/**
 * Write calculations to cache
 */
async function writeCalculationsCache(cache: CalculationsCache): Promise<void> {
  await fs.mkdir(CALCULATIONS_DIR, { recursive: true });

  const filepath = getCacheFilePath(cache.scenario);
  await fs.writeFile(filepath, JSON.stringify(cache, null, 2), 'utf-8');

  logger.info({ scenario: cache.scenario, filepath }, 'Calculations cache written');
}

/**
 * Get calculated bonds with caching
 */
export async function getCalculatedBonds(
  scenarioId: string = 'base'
): Promise<CalculationsCache> {
  // Try to read from cache
  const cached = await readCalculationsCache(scenarioId);

  if (cached) {
    const age = Date.now() - cached.timestamp;
    if (age < CALCULATIONS_MAX_AGE_MS) {
      logger.debug({ scenarioId, age }, 'Using cached calculations');
      return cached;
    }
    logger.debug({ scenarioId, age }, 'Cache stale, recalculating');
  }

  // Calculate fresh data
  const fresh = await calculateAllBonds(scenarioId);
  await writeCalculationsCache(fresh);

  return fresh;
}

/**
 * Get a single bond calculation by ticker
 */
export async function getCalculatedBond(
  ticker: string,
  scenarioId: string = 'base'
): Promise<BondCalculation | null> {
  const cache = await getCalculatedBonds(scenarioId);
  return cache.bonds.find((b) => b.summary.ticker === ticker) ?? null;
}

/**
 * Precalculate all scenarios (for warming up cache)
 */
export async function precalculateAllScenarios(): Promise<void> {
  const scenariosData = await loadScenarios();
  const scenarioIds = Object.keys(scenariosData.scenarios);

  logger.info({ scenarios: scenarioIds }, 'Precalculating all scenarios');

  for (const scenarioId of scenarioIds) {
    try {
      const result = await calculateAllBonds(scenarioId);
      await writeCalculationsCache(result);
    } catch (error) {
      logger.error({ error, scenarioId }, 'Failed to precalculate scenario');
    }
  }

  logger.info('All scenarios precalculated');
}
