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
  RiskRewardAnalysis,
} from '@/types';
import { fetchAllBonds } from './moex';
import { fetchKeyRateHistory } from './cbr';
import { calculate, calculateFairYtmFromCurve } from './calculations';
import { calculateRiskReward, type ScenarioResults } from './risk-reward';
import {
  DEFAULT_COUPON_PERIOD_DAYS,
  VALID_SCENARIO_ID_PATTERN,
  CALCULATIONS_MAX_AGE_MS,
  MAX_MEMORY_CACHE_ENTRIES,
  CONFIG_CHECK_INTERVAL_MS,
} from './constants';
import { fetchYieldCurve, type YieldCurvePoint } from './zcyc';
import logger from './logger';

const CALCULATIONS_DIR = path.join(process.cwd(), 'data', 'cache', 'calculations');
const SCENARIOS_FILE = path.join(process.cwd(), 'data', 'rate-scenarios.json');
const INFLATION_FILE = path.join(process.cwd(), 'data', 'inflation-scenarios.json');

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
  // Risk/Reward (calculated after all scenarios are ready)
  riskReward?: RiskRewardAnalysis | null;
  // True when all calculations (including R/R) are complete
  calculationReady: boolean;
}

/** Full calculation result for detail view */
export interface BondCalculation {
  summary: BondSummary;
  results: CalculationResults;
}

/**
 * Check if a bond has all required calculations to be shown to the user.
 * Add new conditions here as calculation pipeline grows.
 */
function isBondCalculationComplete(summary: BondSummary): boolean {
  // Basic calculation data must be present
  const hasBasicData =
    summary.realYield !== undefined &&
    summary.optimalExitYield !== undefined &&
    summary.valuationStatus !== undefined;

  // Risk/Reward requires all 3 scenarios to be calculated
  const hasRiskReward = summary.riskReward !== undefined;

  // Add more conditions here as needed:
  // const hasFutureFeature = ...;

  return hasBasicData && hasRiskReward;
}

/**
 * Update calculationReady flag based on current state.
 * Call this after any calculation step that might complete the bond.
 */
function markBondReady(summary: BondSummary): void {
  summary.calculationReady = isBondCalculationComplete(summary);
}

/** Cached calculations for a scenario */
export interface CalculationsCache {
  timestamp: number;
  scenario: string;
  /** Current key rate, null if not yet fetched (cold start) */
  currentKeyRate: number | null;
  bonds: BondCalculation[];
}

/**
 * Load scenarios from JSON file (with memory cache)
 * Only re-reads file if modified since last check
 */
async function loadScenarios(): Promise<ScenariosResponse> {
  const now = Date.now();

  // Check if we need to verify file modification time
  if (scenariosCache && now - lastScenariosCheck < CONFIG_CHECK_INTERVAL_MS) {
    return scenariosCache.data;
  }

  // Check file modification time
  const modTime = await getScenariosModTime();
  lastScenariosCheck = now;

  // Return cached if file hasn't changed
  if (scenariosCache && modTime <= scenariosCache.modTime) {
    return scenariosCache.data;
  }

  // File changed or no cache - read from disk
  const content = await fs.readFile(SCENARIOS_FILE, 'utf-8');
  const data = JSON.parse(content) as ScenariosResponse;
  scenariosCache = { data, modTime };
  logger.debug({ modTime }, 'Loaded scenarios from disk');
  return data;
}

/**
 * Get list of valid scenario IDs from JSON file
 */
export async function getValidScenarioIds(): Promise<string[]> {
  const scenarios = await loadScenarios();
  return Object.keys(scenarios.scenarios);
}

/**
 * Check if a scenario ID is valid (exists in JSON)
 */
export async function isValidScenarioId(scenarioId: string): Promise<boolean> {
  const validIds = await getValidScenarioIds();
  return validIds.includes(scenarioId);
}

/**
 * Get inflation file modification time
 */
async function getInflationModTime(): Promise<number> {
  try {
    const stats = await fs.stat(INFLATION_FILE);
    return stats.mtimeMs;
  } catch {
    return 0;
  }
}

/**
 * Load inflation scenarios from JSON file (with memory cache)
 * Only re-reads file if modified since last check
 */
async function loadInflationScenarios(): Promise<InflationScenariosResponse> {
  const now = Date.now();

  // Check if we need to verify file modification time
  if (inflationCache && now - lastInflationCheck < CONFIG_CHECK_INTERVAL_MS) {
    return inflationCache.data;
  }

  // Check file modification time
  const modTime = await getInflationModTime();
  lastInflationCheck = now;

  // Return cached if file hasn't changed
  if (inflationCache && modTime <= inflationCache.modTime) {
    return inflationCache.data;
  }

  // File changed or no cache - read from disk
  const content = await fs.readFile(INFLATION_FILE, 'utf-8');
  const data = JSON.parse(content) as InflationScenariosResponse;
  inflationCache = { data, modTime };
  logger.debug({ modTime }, 'Loaded inflation scenarios from disk');
  return data;
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
      calculationReady: false, // Will be set to true after R/R calculation
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

  for (const bond of bonds) {
    const result = calculateBond(bond, rateSchedule, currentKeyRate, currentInflation, yieldCurve);
    if (result) {
      calculations.push(result);
    }

    // Yield after each bond to allow other requests
    await yieldToEventLoop();

    if (calculations.length % 10 === 0) {
      logger.debug({ calculated: calculations.length, total: bonds.length }, 'Calculation progress');
    }
  }

  // Sort final results by optimal exit yield (highest first)
  calculations.sort((a, b) => b.summary.optimalExitYield - a.summary.optimalExitYield);

  logger.info(
    { scenarioId, calculated: calculations.length, total: bonds.length },
    'Calculations complete'
  );

  // Return result without updating memory cache
  // Memory cache is only updated after R/R calculation in precalculateAllScenarios()
  return {
    timestamp: Date.now(),
    scenario: scenarioId,
    currentKeyRate,
    bonds: calculations,
  };
}

/**
 * Secondary validation for scenario ID (defense in depth).
 * Primary validation happens in API routes via isValidScenarioId().
 * This ensures safety even if internal functions are called directly.
 */
function validateScenarioId(scenarioId: string): void {
  if (!VALID_SCENARIO_ID_PATTERN.test(scenarioId)) {
    throw new Error(`Invalid scenario ID: ${scenarioId}`);
  }
}

/**
 * Get cache file path for a scenario
 */
function getCacheFilePath(scenarioId: string): string {
  validateScenarioId(scenarioId);
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

// In-memory cache - primary source of truth during runtime
// File cache is only for persistence across restarts
// Bounded to prevent memory issues with many scenarios
const memoryCache = new Map<string, CalculationsCache>();

/**
 * Set value in memory cache with LRU eviction
 */
function setMemoryCache(key: string, value: CalculationsCache): void {
  // If at max size and key doesn't exist, evict oldest (first in Map)
  if (memoryCache.size >= MAX_MEMORY_CACHE_ENTRIES && !memoryCache.has(key)) {
    const firstKey = memoryCache.keys().next().value;
    if (firstKey) {
      memoryCache.delete(firstKey);
      logger.debug({ evictedKey: firstKey }, 'Evicted oldest cache entry');
    }
  }

  // Delete and re-add to move to end (most recently used)
  memoryCache.delete(key);
  memoryCache.set(key, value);
}

// Memory cache for JSON config files (scenarios, inflation)
// These change rarely, so we cache them with a check interval
let scenariosCache: { data: ScenariosResponse; modTime: number } | null = null;
let inflationCache: { data: InflationScenariosResponse; modTime: number } | null = null;
let lastScenariosCheck = 0;
let lastInflationCheck = 0;

// Flag to track if full recalculation is in progress
let fullRecalculationInProgress = false;

/**
 * Check if any recalculation is currently in progress
 */
export function isRecalculationInProgress(): boolean {
  return fullRecalculationInProgress;
}

/**
 * Trigger background recalculation of ALL scenarios (non-blocking)
 * R/R calculation requires all 3 scenarios, so we always recalculate together
 */
function triggerBackgroundRecalculation(scenarioId: string): void {
  // If any recalculation is already in progress, skip
  if (fullRecalculationInProgress || recalculatingScenarios.size > 0) {
    logger.debug({ scenarioId }, 'Background recalculation already in progress');
    return;
  }

  fullRecalculationInProgress = true;
  logger.info({ triggeredBy: scenarioId }, 'Starting background recalculation of all scenarios');

  // Run precalculateAllScenarios which handles all scenarios + R/R
  precalculateAllScenarios()
    .then(() => {
      logger.info('Background recalculation of all scenarios complete');
    })
    .catch((error) => {
      logger.error({ error }, 'Background recalculation failed');
    })
    .finally(() => {
      fullRecalculationInProgress = false;
    });
}

/**
 * Get calculated bonds with caching
 * NEVER blocks - returns immediately with whatever is available
 *
 * Memory-first architecture:
 * 1. Check memoryCache first (fastest, always up-to-date during runtime)
 * 2. If memory miss (cold start), read from file cache
 * 3. If file miss, return empty and trigger background calculation
 */
export async function getCalculatedBonds(
  scenarioId: string = 'base'
): Promise<CalculationsCache> {
  const now = Date.now();

  // Helper to check if cache is stale
  const checkStale = (timestamp: number, scenariosModTime: number): { isStale: boolean; scenariosChanged: boolean } => {
    const age = now - timestamp;
    const scenariosChanged = scenariosModTime > timestamp;
    return {
      isStale: age >= CALCULATIONS_MAX_AGE_MS || scenariosChanged,
      scenariosChanged,
    };
  };

  // 1. Check memory cache first (primary source during runtime)
  const memoryCached = memoryCache.get(scenarioId);
  if (memoryCached) {
    const scenariosModTime = await getScenariosModTime();
    const { isStale, scenariosChanged } = checkStale(memoryCached.timestamp, scenariosModTime);
    const age = now - memoryCached.timestamp;

    if (!isStale) {
      logger.debug({ scenarioId, age, source: 'memory' }, 'Using fresh memory cache');
      return memoryCached;
    }

    // Memory cache is stale - return it immediately but trigger background recalculation
    logger.debug({ scenarioId, age, scenariosChanged, source: 'memory' }, 'Returning stale memory cache, recalculating');
    triggerBackgroundRecalculation(scenarioId);
    return memoryCached;
  }

  // 2. Memory miss - try file cache (cold start scenario)
  // Fetch scenariosModTime once for both checks
  const scenariosModTime = await getScenariosModTime();
  const fileCached = await readCalculationsCache(scenarioId);

  if (fileCached) {
    // Populate memory cache from file
    setMemoryCache(scenarioId, fileCached);
    logger.info({ scenarioId, source: 'file' }, 'Loaded cache from file into memory');

    const { isStale, scenariosChanged } = checkStale(fileCached.timestamp, scenariosModTime);
    const age = now - fileCached.timestamp;

    if (!isStale) {
      return fileCached;
    }

    // File cache is stale - return it immediately but trigger background recalculation
    logger.debug({ scenarioId, age, scenariosChanged, source: 'file' }, 'File cache stale, recalculating');
    triggerBackgroundRecalculation(scenarioId);
    return fileCached;
  }

  // 3. No cache at all - return empty response and trigger background calculation
  logger.info({ scenarioId }, 'No cache, starting background calculation');
  triggerBackgroundRecalculation(scenarioId);

  return {
    timestamp: Date.now(),
    scenario: scenarioId,
    currentKeyRate: null, // Will be populated when calculation completes
    bonds: [],
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

  // Store calculated results for R/R computation
  const calculatedCaches: Map<string, CalculationsCache> = new Map();

  for (const scenarioId of scenarioIds) {
    try {
      const result = await calculateAllBonds(scenarioId);
      calculatedCaches.set(scenarioId, result);
      // Don't write to cache yet - wait until R/R is calculated
    } catch (error) {
      logger.error({ error, scenarioId }, 'Failed to precalculate scenario');
    }
  }

  // Now calculate R/R for all bonds using cross-scenario data
  const baseCache = calculatedCaches.get('base');
  const optimisticCache = calculatedCaches.get('optimistic');
  const conservativeCache = calculatedCaches.get('conservative');

  if (baseCache && optimisticCache && conservativeCache) {
    logger.info('Calculating Risk/Reward for all bonds');

    // Get duration data from MOEX
    const moexBonds = await fetchAllBonds();
    const durationMap = new Map(moexBonds.map((b) => [b.ticker, b.duration]));

    // Create lookup maps
    const baseMap = new Map(baseCache.bonds.map((b) => [b.summary.ticker, b]));
    const optimisticMap = new Map(optimisticCache.bonds.map((b) => [b.summary.ticker, b]));
    const conservativeMap = new Map(conservativeCache.bonds.map((b) => [b.summary.ticker, b]));

    // Calculate R/R for each bond in each scenario cache
    for (const [scenarioId, cache] of calculatedCaches) {
      let updated = false;

      for (const bond of cache.bonds) {
        const baseBond = baseMap.get(bond.summary.ticker);
        const optimisticBond = optimisticMap.get(bond.summary.ticker);
        const conservativeBond = conservativeMap.get(bond.summary.ticker);

        if (baseBond && optimisticBond && conservativeBond) {
          const scenarios: ScenarioResults = {
            base: baseBond.results,
            optimistic: optimisticBond.results,
            conservative: conservativeBond.results,
          };
          const duration = durationMap.get(bond.summary.ticker) ?? null;
          bond.summary.riskReward = calculateRiskReward(scenarios, duration);
          markBondReady(bond.summary);
          updated = true;
        }
      }

      if (updated) {
        // Update memory cache and write to file
        setMemoryCache(scenarioId, cache);
        await writeCalculationsCache(cache);
      }
    }

    logger.info('Risk/Reward calculation complete');
  } else {
    logger.warn('Could not calculate R/R - missing base/optimistic/conservative scenarios');
  }

  logger.info('All scenarios precalculated');
}
