import { promises as fs } from 'fs';
import path from 'path';
import type {
  ParsedBond,
  KeyRateData,
  RateScenario,
  RateScheduleItem,
  CalculationResults,
  ScenariosResponse,
  ValuationStatus,
  InflationScenariosResponse,
  InflationRateItem,
} from '@/types';
import { fetchAllBonds } from './moex';
import { fetchKeyRateHistory } from './cbr';
import { calculate, calculateFairYtmFromCurve } from './calculations';
import { DEFAULT_COUPON_PERIOD_DAYS } from './constants';
import { fetchYieldCurve, type YieldCurvePoint } from './zcyc';
import logger from './logger';

const CALCULATIONS_DIR = path.join(process.cwd(), 'data', 'cache', 'calculations');
const SCENARIOS_FILE = path.join(process.cwd(), 'data', 'rate-scenarios.json');
const INFLATION_FILE = path.join(process.cwd(), 'data', 'inflation-scenarios.json');

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
  /** Daily trading volume in rubles */
  volume: number | null;
  // Calculated values
  realYield: number;
  optimalExitYield: number;
  optimalExitDate: string;
  parExitYield: number;
  parExitDate: string;
  yearsToMaturity: number;
  // Valuation status
  valuationStatus: ValuationStatus;
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
  /** True if calculations are in progress */
  isCalculating?: boolean;
}

/**
 * Load scenarios from JSON file
 */
async function loadScenarios(): Promise<ScenariosResponse> {
  const content = await fs.readFile(SCENARIOS_FILE, 'utf-8');
  return JSON.parse(content) as ScenariosResponse;
}

/**
 * Load inflation scenarios from JSON file
 */
async function loadInflationScenarios(): Promise<InflationScenariosResponse> {
  const content = await fs.readFile(INFLATION_FILE, 'utf-8');
  return JSON.parse(content) as InflationScenariosResponse;
}

/**
 * Get current inflation rate for a given date and scenario
 * Throws if no data available
 */
function getCurrentInflation(
  rates: InflationRateItem[],
  date: Date = new Date()
): number {
  if (rates.length === 0) {
    throw new Error('No inflation data available');
  }

  // Sort by date descending
  const sortedRates = [...rates].sort((a, b) =>
    b.date.localeCompare(a.date)
  );

  // Find the most recent rate that is <= the given date
  const dateStr = date.toISOString().split('T')[0] ?? '';
  for (const item of sortedRates) {
    if (item.date <= dateStr) {
      return item.rate;
    }
  }

  // Use earliest available if date is before all data
  const earliest = sortedRates[sortedRates.length - 1];
  if (!earliest) {
    throw new Error('No inflation rate found for date: ' + dateStr);
  }
  return earliest.rate;
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
  currentKeyRate: number,
  currentInflation: number,
  yieldCurve: YieldCurvePoint[]
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

  // Generate all coupon dates from first coupon to maturity
  const couponDates: Date[] = [];
  const couponDate = new Date(firstCouponDate);
  while (couponDate <= maturityDate) {
    couponDates.push(new Date(couponDate));
    couponDate.setDate(couponDate.getDate() + periodDays);
  }
  // Ensure maturity date is included as final coupon date
  if (couponDates.length === 0 || couponDates[couponDates.length - 1]?.getTime() !== maturityDate.getTime()) {
    couponDates.push(maturityDate);
  }

  // Calculate curve-consistent fair YTM by discounting cash flows with spot rates
  const fairYtmFromCurve = calculateFairYtmFromCurve(
    yieldCurve,
    today,
    couponDates,
    bond.coupon,
    bond.nominal
  );

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
      currentInflation,
      moexYtm: bond.ytm,
      theoreticalYield: fairYtmFromCurve,
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
      volume: bond.volume,
      realYield: results.realYieldMaturity,
      optimalExitYield: results.optimalExit.annualReturn,
      optimalExitDate: results.optimalExit.date.toISOString().split('T')[0] ?? '',
      parExitYield: results.parExit.annualReturn,
      parExitDate: results.parExit.date.toISOString().split('T')[0] ?? '',
      yearsToMaturity: results.yearsToMaturity,
      valuationStatus: results.valuation.status,
    };

    return { summary, results };
  } catch (error) {
    logger.error({ error, ticker: bond.ticker }, 'Failed to calculate bond');
    return null;
  }
}

/**
 * Yield to event loop to allow other requests to be processed
 */
function yieldToEventLoop(): Promise<void> {
  return new Promise((resolve) => setImmediate(resolve));
}

/**
 * Calculate all bonds for a given scenario
 */
export async function calculateAllBonds(
  scenarioId: string
): Promise<CalculationsCache> {
  logger.info({ scenarioId }, 'Starting calculations for all bonds');

  // Load data in parallel
  const [bonds, keyRateHistory, scenariosData, inflationData, yieldCurveData] =
    await Promise.all([
      fetchAllBonds(),
      fetchKeyRateHistory(),
      loadScenarios(),
      loadInflationScenarios(),
      fetchYieldCurve(),
    ]);

  // Derive current key rate from history[0]
  const currentKeyRate = keyRateHistory[0]?.rate;
  if (currentKeyRate === undefined) {
    throw new Error('Failed to fetch current key rate');
  }

  const scenario = scenariosData.scenarios[scenarioId];
  if (!scenario) {
    throw new Error(`Unknown scenario: ${scenarioId}`);
  }

  // Get inflation for this scenario
  const inflationScenario = inflationData.scenarios[scenarioId as keyof typeof inflationData.scenarios];
  if (!inflationScenario) {
    throw new Error(`No inflation data for scenario: ${scenarioId}`);
  }
  const currentInflation = getCurrentInflation(inflationScenario.rates);

  logger.info(
    { scenarioId, currentKeyRate, currentInflation, yieldCurveDate: yieldCurveData.tradeDate },
    'Using rates and yield curve'
  );

  // Build rate schedule
  const rateSchedule = buildRateSchedule(scenario, keyRateHistory, currentKeyRate);
  const yieldCurve = yieldCurveData.points;

  // Calculate all bonds, yielding after each to not block event loop
  const calculations: BondCalculation[] = [];
  let processed = 0;

  for (const bond of bonds) {
    const result = calculateBond(bond, rateSchedule, currentKeyRate, currentInflation, yieldCurve);
    if (result) {
      calculations.push(result);
    }
    processed++;

    // Yield after each bond to allow other requests
    await yieldToEventLoop();

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
 * Get scenarios file modification time
 */
async function getScenariosModTime(): Promise<number> {
  try {
    const stats = await fs.stat(SCENARIOS_FILE);
    return stats.mtimeMs;
  } catch {
    return 0;
  }
}

// Track background recalculations in progress
const recalculatingScenarios = new Set<string>();

/**
 * Trigger background recalculation (non-blocking)
 */
function triggerBackgroundRecalculation(scenarioId: string): void {
  if (recalculatingScenarios.has(scenarioId)) {
    logger.debug({ scenarioId }, 'Background recalculation already in progress');
    return;
  }

  recalculatingScenarios.add(scenarioId);
  logger.info({ scenarioId }, 'Starting background recalculation');

  // Run in background (don't await)
  calculateAllBonds(scenarioId)
    .then((fresh) => writeCalculationsCache(fresh))
    .then(() => {
      logger.info({ scenarioId }, 'Background recalculation complete');
    })
    .catch((error) => {
      logger.error({ error, scenarioId }, 'Background recalculation failed');
    })
    .finally(() => {
      recalculatingScenarios.delete(scenarioId);
    });
}

/**
 * Get calculated bonds with caching
 * NEVER blocks - returns immediately with whatever is available
 */
export async function getCalculatedBonds(
  scenarioId: string = 'base'
): Promise<CalculationsCache> {
  // Try to read from cache
  const cached = await readCalculationsCache(scenarioId);
  const isCalculating = recalculatingScenarios.has(scenarioId);

  if (cached) {
    const age = Date.now() - cached.timestamp;
    const scenariosModTime = await getScenariosModTime();
    const scenariosChanged = scenariosModTime > cached.timestamp;
    const isStale = age >= CALCULATIONS_MAX_AGE_MS || scenariosChanged;

    if (!isStale) {
      logger.debug({ scenarioId, age }, 'Using fresh cache');
      return { ...cached, isCalculating };
    }

    // Cache is stale - return it immediately but trigger background recalculation
    logger.debug({ scenarioId, age, scenariosChanged }, 'Returning stale cache, recalculating in background');
    triggerBackgroundRecalculation(scenarioId);
    return { ...cached, isCalculating: true };
  }

  // No cache at all - return empty response and trigger background calculation
  logger.info({ scenarioId }, 'No cache, starting background calculation');
  triggerBackgroundRecalculation(scenarioId);

  return {
    timestamp: Date.now(),
    scenario: scenarioId,
    currentKeyRate: 21, // Default until we fetch
    bonds: [],
    isCalculating: true,
  };
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
